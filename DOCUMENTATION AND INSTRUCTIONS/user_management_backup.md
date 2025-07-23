# User Management, Authentication & Backup Procedures

## User Management System

### Multi-Tenant Architecture

#### User Roles and Permissions
```sql
-- Create user roles table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO user_roles (name, description, permissions) VALUES
('super_admin', 'System administrator with full access', '{
  "system_admin": true,
  "manage_users": true,
  "manage_all_projects": true,
  "view_system_stats": true,
  "manage_templates": true
}'),
('organization_admin', 'Organization administrator', '{
  "manage_org_users": true,
  "manage_org_projects": true,
  "view_org_stats": true,
  "create_templates": true
}'),
('project_manager', 'Project manager with full project access', '{
  "manage_project": true,
  "invite_users": true,
  "generate_reports": true,
  "upload_documents": true
}'),
('consultant', 'Planning consultant with document and report access', '{
  "view_project": true,
  "upload_documents": true,
  "generate_reports": true,
  "chat_access": true
}'),
('client', 'Client with read-only access', '{
  "view_project": true,
  "download_reports": true,
  "chat_access": true
}');

-- Create user profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  organization_id UUID REFERENCES organizations(id),
  role_id UUID REFERENCES user_roles(id),
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'UTC',
  preferences JSONB DEFAULT '{}',
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  domain TEXT UNIQUE,
  logo_url TEXT,
  address TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  billing_email TEXT,
  subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'professional', 'enterprise')),
  max_users INTEGER DEFAULT 10,
  max_projects INTEGER DEFAULT 50,
  max_storage_gb INTEGER DEFAULT 100,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create project access table
CREATE TABLE project_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('read', 'write', 'admin')),
  granted_by UUID REFERENCES user_profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, notebook_id)
);
```

#### Row Level Security Policies
```sql
-- Enable RLS on all user tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_access ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Organization admins can view org users" ON user_profiles
  FOR SELECT USING (
    organization_id IN (
      SELECT up.organization_id 
      FROM user_profiles up 
      JOIN user_roles ur ON up.role_id = ur.id
      WHERE up.id = auth.uid() 
        AND (ur.permissions->>'manage_org_users')::boolean = true
    )
  );

-- Organizations policies
CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Project access policies
CREATE POLICY "Users can view their project access" ON project_access
  FOR SELECT USING (user_id = auth.uid());

-- Enhanced notebooks policy with project access
DROP POLICY IF EXISTS "Users can access their notebooks" ON notebooks;
CREATE POLICY "Users can access authorized notebooks" ON notebooks
  FOR ALL USING (
    user_id = auth.uid() OR
    id IN (
      SELECT notebook_id 
      FROM project_access 
      WHERE user_id = auth.uid()
        AND (expires_at IS NULL OR expires_at > NOW())
    )
  );
```

### Authentication Setup

#### Supabase Auth Configuration
```typescript
// lib/auth.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      redirectTo: `${window.location.origin}/auth/callback`
    }
  }
);

export class AuthManager {
  // Sign up with organization creation
  static async signUp(email: string, password: string, userData: {
    full_name: string;
    organization_name?: string;
    role?: string;
  }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: userData.full_name,
        }
      }
    });

    if (error) throw error;

    // Create organization if needed
    if (userData.organization_name && data.user) {
      await this.createOrganization(data.user.id, userData.organization_name);
    }

    return data;
  }

  // Sign in with role-based redirect
  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Update last login
    if (data.user) {
      await supabase
        .from('user_profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);
    }

    return data;
  }

  // Get current user with role and permissions
  static async getCurrentUserWithRole() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select(`
        *,
        organizations (*),
        user_roles (name, permissions)
      `)
      .eq('id', user.id)
      .single();

    return {
      user,
      profile,
      role: profile?.user_roles,
      organization: profile?.organizations
    };
  }

  // Check user permissions
  static async hasPermission(permission: string): Promise<boolean> {
    const userData = await this.getCurrentUserWithRole();
    if (!userData?.role?.permissions) return false;
    
    return userData.role.permissions[permission] === true;
  }

  // Create organization for new user
  static async createOrganization(userId: string, orgName: string) {
    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName })
      .select()
      .single();

    if (orgError) throw orgError;

    // Get organization admin role
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('name', 'organization_admin')
      .single();

    // Create user profile with admin role
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        organization_id: org.id,
        role_id: adminRole?.id
      });

    if (profileError) throw profileError;

    return org;
  }

  // Invite user to organization
  static async inviteUser(email: string, organizationId: string, roleId: string) {
    // Generate invite token
    const inviteToken = crypto.randomUUID();
    
    // Store invitation
    const { error } = await supabase
      .from('user_invitations')
      .insert({
        email,
        organization_id: organizationId,
        role_id: roleId,
        invite_token: inviteToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      });

    if (error) throw error;

    // Send invitation email (implement with your email service)
    await this.sendInvitationEmail(email, inviteToken);

    return { inviteToken };
  }

  // Accept invitation
  static async acceptInvitation(inviteToken: string, password: string) {
    // Get invitation details
    const { data: invitation, error: inviteError } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('invite_token', inviteToken)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invitation) {
      throw new Error('Invalid or expired invitation');
    }

    // Sign up user
    const { data, error } = await supabase.auth.signUp({
      email: invitation.email,
      password
    });

    if (error) throw error;

    // Create user profile with invited role
    if (data.user) {
      await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          email: invitation.email,
          organization_id: invitation.organization_id,
          role_id: invitation.role_id
        });

      // Mark invitation as accepted
      await supabase
        .from('user_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('invite_token', inviteToken);
    }

    return data;
  }

  private static async sendInvitationEmail(email: string, token: string) {
    // Implement with your email service (SendGrid, AWS SES, etc.)
    const inviteUrl = `${window.location.origin}/auth/accept-invite?token=${token}`;
    
    // Email sending implementation here
    console.log(`Send invitation to ${email}: ${inviteUrl}`);
  }
}
```

#### Frontend Auth Components
```typescript
// components/auth/SignUpForm.tsx
import { useState } from 'react';
import { AuthManager } from '@/lib/auth';

export function SignUpForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    organization_name: '',
    create_org: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await AuthManager.signUp(formData.email, formData.password, {
        full_name: formData.full_name,
        organization_name: formData.create_org ? formData.organization_name : undefined
      });
      
      // Redirect to email verification page
      window.location.href = '/auth/verify-email';
    } catch (error) {
      console.error('Sign up failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Full Name</label>
        <input
          type="text"
          value={formData.full_name}
          onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
          className="w-full border rounded-md px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          className="w-full border rounded-md px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Password</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
          className="w-full border rounded-md px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.create_org}
            onChange={(e) => setFormData(prev => ({ ...prev, create_org: e.target.checked }))}
          />
          <span className="text-sm">Create new organization</span>
        </label>
      </div>

      {formData.create_org && (
        <div>
          <label className="block text-sm font-medium mb-2">Organization Name</label>
          <input
            type="text"
            value={formData.organization_name}
            onChange={(e) => setFormData(prev => ({ ...prev, organization_name: e.target.value }))}
            className="w-full border rounded-md px-3 py-2"
            required={formData.create_org}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Creating Account...' : 'Sign Up'}
      </button>
    </form>
  );
}

// components/auth/ProtectedRoute.tsx
import { useEffect, useState } from 'react';
import { AuthManager } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ 
  children, 
  requiredPermission, 
  fallback 
}: ProtectedRouteProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (!requiredPermission) {
        setHasAccess(true);
        return;
      }

      const hasPermission = await AuthManager.hasPermission(requiredPermission);
      setHasAccess(hasPermission);
    };

    checkAccess();
  }, [requiredPermission]);

  if (hasAccess === null) {
    return <div>Loading...</div>;
  }

  if (!hasAccess) {
    return fallback || <div>Access denied</div>;
  }

  return <>{children}</>;
}
```

### Project Access Management

#### Project Access Control
```typescript
// lib/project-access.ts
export class ProjectAccessManager {
  // Grant access to a project
  static async grantAccess(
    notebookId: string, 
    userEmail: string, 
    accessLevel: 'read' | 'write' | 'admin',
    expiresAt?: Date
  ) {
    // Get user ID from email
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (!userProfile) {
      throw new Error('User not found');
    }

    // Check if current user can grant access
    const canGrant = await this.canGrantAccess(notebookId);
    if (!canGrant) {
      throw new Error('Insufficient permissions to grant access');
    }

    // Grant access
    const { error } = await supabase
      .from('project_access')
      .upsert({
        user_id: userProfile.id,
        notebook_id: notebookId,
        access_level: accessLevel,
        granted_by: (await AuthManager.getCurrentUserWithRole())?.user?.id,
        expires_at: expiresAt?.toISOString()
      });

    if (error) throw error;

    // Send notification email
    await this.sendAccessGrantedEmail(userEmail, notebookId, accessLevel);
  }

  // Revoke access to a project
  static async revokeAccess(notebookId: string, userId: string) {
    const canRevoke = await this.canGrantAccess(notebookId);
    if (!canRevoke) {
      throw new Error('Insufficient permissions to revoke access');
    }

    const { error } = await supabase
      .from('project_access')
      .delete()
      .eq('notebook_id', notebookId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // Get project members
  static async getProjectMembers(notebookId: string) {
    const { data, error } = await supabase
      .from('project_access')
      .select(`
        *,
        user_profiles (
          id,
          email,
          full_name,
          avatar_url,
          user_roles (name)
        )
      `)
      .eq('notebook_id', notebookId)
      .order('granted_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // Check if user can grant access
  static async canGrantAccess(notebookId: string): Promise<boolean> {
    const userData = await AuthManager.getCurrentUserWithRole();
    if (!userData) return false;

    // Super admin can always grant access
    if (userData.role?.permissions?.system_admin) return true;

    // Check if user owns the project
    const { data: notebook } = await supabase
      .from('notebooks')
      .select('user_id')
      .eq('id', notebookId)
      .single();

    if (notebook?.user_id === userData.user.id) return true;

    // Check if user has admin access to project
    const { data: access } = await supabase
      .from('project_access')
      .select('access_level')
      .eq('notebook_id', notebookId)
      .eq('user_id', userData.user.id)
      .single();

    return access?.access_level === 'admin';
  }

  private static async sendAccessGrantedEmail(email: string, notebookId: string, accessLevel: string) {
    // Implementation for sending access granted notification
    console.log(`Access granted to ${email} for project ${notebookId} with level ${accessLevel}`);
  }
}
```

## Backup and Disaster Recovery

### Automated Backup System

#### Database Backup Strategy
```bash
#!/bin/bash
# scripts/backup-database.sh

set -e

# Configuration
BACKUP_DIR="/backups/town-planning"
RETENTION_DAYS=30
S3_BUCKET="town-planning-backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"

# Function to create database backup
create_db_backup() {
    local backup_type=$1
    local backup_file="$BACKUP_DIR/$backup_type/db_backup_${backup_type}_${DATE}.sql"
    
    echo "Creating $backup_type database backup..."
    
    # Full database backup
    pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
        --no-password \
        --verbose \
        --format=custom \
        --compress=9 \
        --file="$backup_file"
    
    # Verify backup
    if [ -f "$backup_file" ]; then
        echo "Backup created successfully: $backup_file"
        ls -lh "$backup_file"
    else
        echo "ERROR: Backup failed"
        exit 1
    fi
    
    # Upload to S3
    aws s3 cp "$backup_file" "s3://$S3_BUCKET/$backup_type/"
    
    echo "Backup uploaded to S3"
}

# Create schema-only backup for quick recovery
create_schema_backup() {
    local schema_file="$BACKUP_DIR/schema/schema_${DATE}.sql"
    
    echo "Creating schema backup..."
    
    pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
        --no-password \
        --schema-only \
        --file="$schema_file"
    
    aws s3 cp "$schema_file" "s3://$S3_BUCKET/schema/"
}

# Create data-only backup for critical tables
create_critical_data_backup() {
    local data_file="$BACKUP_DIR/critical/critical_data_${DATE}.sql"
    
    echo "Creating critical data backup..."
    
    pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
        --no-password \
        --data-only \
        --table=notebooks \
        --table=sources \
        --table=pdf_metadata \
        --table=report_templates \
        --table=report_generations \
        --table=user_profiles \
        --table=organizations \
        --file="$data_file"
    
    aws s3 cp "$data_file" "s3://$S3_BUCKET/critical/"
}

# Determine backup type based on day
DAY_OF_WEEK=$(date +%u)  # 1-7 (Monday-Sunday)
DAY_OF_MONTH=$(date +%d)

if [ "$DAY_OF_MONTH" = "01" ]; then
    # Monthly backup on 1st of month
    create_db_backup "monthly"
elif [ "$DAY_OF_WEEK" = "7" ]; then
    # Weekly backup on Sunday
    create_db_backup "weekly"
else
    # Daily backup
    create_db_backup "daily"
fi

# Always create schema and critical data backups
create_schema_backup
create_critical_data_backup

# Cleanup old local backups
find "$BACKUP_DIR" -type f -name "*.sql" -mtime +$RETENTION_DAYS -delete

echo "Backup process completed at $(date)"
```

#### Supabase Storage Backup
```bash
#!/bin/bash
# scripts/backup-storage.sh

set -e

BACKUP_DIR="/backups/storage"
DATE=$(date +%Y%m%d_%H%M%S)
S3_BUCKET="town-planning-backups"

echo "Starting storage backup at $(date)"

# Backup sources bucket
echo "Backing up sources bucket..."
supabase storage download sources --recursive --output "$BACKUP_DIR/sources_$DATE"

# Backup reports bucket
echo "Backing up reports bucket..."
supabase storage download reports --recursive --output "$BACKUP_DIR/reports_$DATE"

# Create archive
echo "Creating archive..."
tar -czf "$BACKUP_DIR/storage_backup_$DATE.tar.gz" \
    "$BACKUP_DIR/sources_$DATE" \
    "$BACKUP_DIR/reports_$DATE"

# Upload to S3
aws s3 cp "$BACKUP_DIR/storage_backup_$DATE.tar.gz" \
    "s3://$S3_BUCKET/storage/storage_backup_$DATE.tar.gz"

# Cleanup
rm -rf "$BACKUP_DIR/sources_$DATE" "$BACKUP_DIR/reports_$DATE"

echo "Storage backup completed at $(date)"
```

#### Backup Monitoring
```sql
-- Create backup monitoring table
CREATE TABLE backup_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  backup_type TEXT NOT NULL, -- 'database', 'storage', 'schema'
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  file_path TEXT,
  file_size BIGINT,
  duration_seconds INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to log backup status
CREATE OR REPLACE FUNCTION log_backup_status(
  p_backup_type TEXT,
  p_status TEXT,
  p_file_path TEXT DEFAULT NULL,
  p_file_size BIGINT DEFAULT NULL,
  p_duration_seconds INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  backup_id UUID;
BEGIN
  INSERT INTO backup_logs (
    backup_type, status, file_path, file_size, 
    duration_seconds, error_message
  ) VALUES (
    p_backup_type, p_status, p_file_path, p_file_size,
    p_duration_seconds, p_error_message
  ) RETURNING id INTO backup_id;
  
  RETURN backup_id;
END;
$$ LANGUAGE plpgsql;

-- View for backup monitoring
CREATE VIEW backup_status_summary AS
SELECT 
  backup_type,
  COUNT(*) as total_backups,
  COUNT(*) FILTER (WHERE status = 'completed') as successful_backups,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_backups,
  MAX(created_at) FILTER (WHERE status = 'completed') as last_successful_backup,
  AVG(duration_seconds) FILTER (WHERE status = 'completed') as avg_duration_seconds,
  SUM(file_size) FILTER (WHERE status = 'completed') as total_backup_size
FROM backup_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY backup_type;
```

### Disaster Recovery Procedures

#### Recovery Playbook
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

set -e

echo "=== DISASTER RECOVERY PROCEDURE ==="
echo "Starting recovery process at $(date)"

# Configuration
RECOVERY_TYPE=${1:-"full"}  # full, partial, schema-only
BACKUP_DATE=${2:-"latest"}
S3_BUCKET="town-planning-backups"
TEMP_DIR="/tmp/recovery_$(date +%s)"

mkdir -p "$TEMP_DIR"

recovery_full() {
    echo "Performing full system recovery..."
    
    # 1. Stop all services
    echo "Stopping services..."
    docker-compose down
    
    # 2. Download latest backup
    echo "Downloading database backup..."
    if [ "$BACKUP_DATE" = "latest" ]; then
        BACKUP_FILE=$(aws s3 ls s3://$S3_BUCKET/daily/ | sort | tail -n 1 | awk '{print $4}')
    else
        BACKUP_FILE="db_backup_daily_${BACKUP_DATE}.sql"
    fi
    
    aws s3 cp "s3://$S3_BUCKET/daily/$BACKUP_FILE" "$TEMP_DIR/"
    
    # 3. Restore database
    echo "Restoring database..."
    pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME \
        --clean --if-exists --no-owner --no-privileges \
        --verbose "$TEMP_DIR/$BACKUP_FILE"
    
    # 4. Restore storage
    echo "Restoring storage..."
    STORAGE_BACKUP=$(aws s3 ls s3://$S3_BUCKET/storage/ | sort | tail -n 1 | awk '{print $4}')
    aws s3 cp "s3://$S3_BUCKET/storage/$STORAGE_BACKUP" "$TEMP_DIR/"
    
    cd "$TEMP_DIR"
    tar -xzf "$STORAGE_BACKUP"
    
    # Upload to Supabase storage
    supabase storage upload sources --recursive sources_*/
    supabase storage upload reports --recursive reports_*/
    
    # 5. Restart services
    echo "Restarting services..."
    docker-compose up -d
    
    # 6. Verify system health
    sleep 30
    ./scripts/health-check.sh
    
    echo "Full recovery completed successfully"
}

recovery_schema_only() {
    echo "Performing schema-only recovery..."
    
    # Download schema backup
    SCHEMA_BACKUP=$(aws s3 ls s3://$S3_BUCKET/schema/ | sort | tail -n 1 | awk '{print $4}')
    aws s3 cp "s3://$S3_BUCKET/schema/$SCHEMA_BACKUP" "$TEMP_DIR/"
    
    # Restore schema
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$TEMP_DIR/$SCHEMA_BACKUP"
    
    echo "Schema recovery completed"
}

recovery_critical_data() {
    echo "Performing critical data recovery..."
    
    # Download critical data backup
    CRITICAL_BACKUP=$(aws s3 ls s3://$S3_BUCKET/critical/ | sort | tail -n 1 | awk '{print $4}')
    aws s3 cp "s3://$S3_BUCKET/critical/$CRITICAL_BACKUP" "$TEMP_DIR/"
    
    # Restore critical data
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$TEMP_DIR/$CRITICAL_BACKUP"
    
    echo "Critical data recovery completed"
}

# Execute recovery based on type
case $RECOVERY_TYPE in
    "full")
        recovery_full
        ;;
    "schema")
        recovery_schema_only
        ;;
    "critical")
        recovery_critical_data
        ;;
    *)
        echo "Usage: $0 [full|schema|critical] [backup_date]"
        exit 1
        ;;
esac

# Cleanup
rm -rf "$TEMP_DIR"

echo "Recovery process completed at $(date)"
```

#### Point-in-Time Recovery
```sql
-- Create point-in-time recovery function
CREATE OR REPLACE FUNCTION create_recovery_point(label TEXT)
RETURNS TABLE (
    recovery_point_id UUID,
    created_at TIMESTAMPTZ,
    database_size TEXT
) AS $$
DECLARE
    point_id UUID;
    db_size TEXT;
BEGIN
    point_id := uuid_generate_v4();
    
    -- Get current database size
    SELECT pg_size_pretty(pg_database_size(current_database())) INTO db_size;
    
    -- Log recovery point
    INSERT INTO recovery_points (id, label, database_size)
    VALUES (point_id, label, db_size);
    
    -- Create snapshot (this would involve your backup system)
    PERFORM log_backup_status('recovery_point', 'completed', label, 
                             pg_database_size(current_database())::bigint, 0);
    
    RETURN QUERY 
    SELECT point_id, NOW(), db_size;
END;
$$ LANGUAGE plpgsql;

-- Table for recovery points
CREATE TABLE recovery_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label TEXT NOT NULL,
    database_size TEXT,
    backup_file TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Monitoring and Alerting for Backups

#### Backup Health Monitoring
```typescript
// lib/backup-monitoring.ts
export class BackupMonitor {
  static async checkBackupHealth(): Promise<{
    status: string;
    issues: any[];
    lastBackups: any[];
  }> {
    const issues = [];
    
    // Check recent backups
    const { data: recentBackups } = await supabase
      .from('backup_logs')
      .select('*')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    const lastDailyBackup = recentBackups?.find(b => 
      b.backup_type === 'database' && b.status === 'completed'
    );

    // Check if daily backup is recent
    if (!lastDailyBackup || 
        new Date(lastDailyBackup.created_at) < new Date(Date.now() - 25 * 60 * 60 * 1000)) {
      issues.push({
        type: 'stale_backup',
        message: 'Daily backup is more than 25 hours old',
        severity: 'critical'
      });
    }

    // Check backup failures
    const failedBackups = recentBackups?.filter(b => b.status === 'failed') || [];
    if (failedBackups.length > 0) {
      issues.push({
        type: 'backup_failures',
        message: `${failedBackups.length} backup failures in last 48 hours`,
        severity: 'warning'
      });
    }

    // Check backup sizes for anomalies
    const completedBackups = recentBackups?.filter(b => 
      b.status === 'completed' && b.file_size
    ) || [];
    
    if (completedBackups.length >= 2) {
      const avgSize = completedBackups.reduce((sum, b) => sum + (b.file_size || 0), 0) / completedBackups.length;
      const latestSize = completedBackups[0]?.file_size || 0;
      
      if (latestSize < avgSize * 0.5) {
        issues.push({
          type: 'backup_size_anomaly',
          message: 'Latest backup is significantly smaller than average',
          severity: 'warning'
        });
      }
    }

    return {
      status: issues.some(i => i.severity === 'critical') ? 'critical' : 
              issues.length > 0 ? 'warning' : 'healthy',
      issues,
      lastBackups: recentBackups?.slice(0, 5) || []
    };
  }

  static async sendBackupAlert(issues: any[]) {
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    
    if (criticalIssues.length > 0) {
      // Send immediate alert
      await this.sendAlert('CRITICAL: Backup System Issues', {
        issues: criticalIssues,
        timestamp: new Date().toISOString()
      });
    }
  }

  private static async sendAlert(subject: string, data: any) {
    // Implementation for sending alerts via email, Slack, etc.
    console.log(`ALERT: ${subject}`, data);
  }
}
```

### Data Retention Policies

#### Automated Data Cleanup
```sql
-- Create data retention policies
CREATE TABLE data_retention_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  retention_period INTERVAL NOT NULL,
  cleanup_field TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_cleanup TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert retention policies
INSERT INTO data_retention_policies (table_name, retention_period, cleanup_field) VALUES
('error_logs', '90 days', 'timestamp'),
('system_events', '180 days', 'created_at'),
('backup_logs', '365 days', 'created_at'),
('chat_messages', '2 years', 'created_at'),
('processing_jobs', '30 days', 'created_at');

-- Function to apply retention policies
CREATE OR REPLACE FUNCTION apply_retention_policies()
RETURNS TEXT AS $$
DECLARE
    policy RECORD;
    deleted_count INTEGER;
    total_deleted INTEGER := 0;
    result_text TEXT := '';
BEGIN
    FOR policy IN 
        SELECT * FROM data_retention_policies WHERE is_active = true
    LOOP
        EXECUTE format(
            'DELETE FROM %I WHERE %I < NOW() - INTERVAL %L',
            policy.table_name,
            policy.cleanup_field,
            policy.retention_period
        );
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        
        result_text := result_text || format(
            'Deleted %s records from %s | ',
            deleted_count,
            policy.table_name
        );
        
        -- Update last cleanup time
        UPDATE data_retention_policies 
        SET last_cleanup = NOW() 
        WHERE id = policy.id;
    END LOOP;
    
    result_text := result_text || format('Total deleted: %s records', total_deleted);
    
    -- Log cleanup activity
    INSERT INTO system_events (event_type, details)
    VALUES ('data_cleanup', jsonb_build_object(
        'total_deleted', total_deleted,
        'timestamp', NOW()
    ));
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup (run via cron or scheduled job)
-- 0 2 * * * psql -d your_database -c "SELECT apply_retention_policies();"
```

This comprehensive user management, authentication, and backup system provides:

1. **Multi-tenant user management** with role-based access control
2. **Secure authentication** with Supabase Auth integration
3. **Project access management** for collaborative workflows
4. **Automated backup system** with multiple backup types and schedules
5. **Disaster recovery procedures** for different failure scenarios
6. **Backup monitoring and alerting** to ensure system reliability
7. **Data retention policies** for compliance and storage optimization

The system ensures data security, user access control, and business continuity for the Town Planning RAG system.