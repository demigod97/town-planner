# Windows PowerShell Setup for Town Planner Integration
# Run this in your project root (D:\ailocal\coral)

Write-Host "🚀 Setting up town-planner integration tools..." -ForegroundColor Green

# Create directory structure
New-Item -ItemType Directory -Force -Path ".automation"
New-Item -ItemType Directory -Force -Path ".automation\scripts"
New-Item -ItemType Directory -Force -Path ".automation\reports"

Write-Host "✅ Created automation directories" -ForegroundColor Green

# Create integration checker script
$integrationChecker = @'
#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

class TownPlannerChecker {
  constructor() {
    this.results = { passed: [], failed: [], warnings: [] };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
  }

  checkFile(file, desc) {
    if (fs.existsSync(file)) {
      this.results.passed.push(`✅ ${desc}: ${file}`);
      return true;
    } else {
      this.results.failed.push(`❌ ${desc}: ${file} not found`);
      return false;
    }
  }

  checkDirectory(dir, desc) {
    if (fs.existsSync(dir)) {
      this.results.passed.push(`✅ ${desc}: ${dir}`);
      return true;
    } else {
      this.results.failed.push(`❌ ${desc}: ${dir} not found`);
      return false;
    }
  }

  checkProjectStructure() {
    this.log('Checking project structure...', 'info');
    
    // Core React files
    this.checkFile('package.json', 'Package configuration');
    this.checkFile('vite.config.ts', 'Vite configuration');
    this.checkFile('src/main.tsx', 'Main React entry');
    
    // Core directories
    this.checkDirectory('src', 'Source directory');
    this.checkDirectory('src/components', 'Components directory');
    this.checkDirectory('src/hooks', 'Hooks directory');
    this.checkDirectory('src/lib', 'Library directory');
  }

  checkEnvironment() {
    this.log('Checking environment setup...', 'info');
    
    if (this.checkFile('.env', 'Environment variables')) {
      const envContent = fs.readFileSync('.env', 'utf8');
      
      const requiredVars = [
        'POSTGRES_PASSWORD',
        'JWT_SECRET', 
        'ANON_KEY',
        'SERVICE_ROLE_KEY'
      ];
      
      requiredVars.forEach(varName => {
        if (envContent.includes(`${varName}=`)) {
          this.results.passed.push(`✅ Environment variable: ${varName}`);
        } else {
          this.results.failed.push(`❌ Missing environment variable: ${varName}`);
        }
      });
    }
    
    this.checkFile('.env.example', 'Environment template');
  }

  checkIntegrationSetup() {
    this.log('Checking integration setup...', 'info');
    
    // Docker configuration
    this.checkFile('docker-compose.yml', 'Docker Compose configuration');
    
    // Integration package
    this.checkDirectory('town-planner-local-package', 'Town Planner integration package');
    this.checkFile('town-planner-local-package/Dockerfile', 'Town Planner Dockerfile');
    this.checkFile('town-planner-local-package/docker-compose.copy.yml', 'Docker services configuration');
    
    // Supabase setup
    this.checkDirectory('supabase', 'Supabase directory');
    this.checkFile('supabase-migration.sql', 'Database migration');
    this.checkDirectory('supabase/functions', 'Supabase functions');
    
    // n8n workflows
    this.checkDirectory('n8n', 'n8n workflows directory');
  }

  checkDockerStatus() {
    this.log('Checking Docker containers...', 'info');
    
    try {
      const output = execSync('docker ps --format "{{.Names}}"', { 
        encoding: 'utf8',
        timeout: 5000 
      });
      
      const containers = output.split('\n').filter(name => name.trim());
      
      const requiredServices = ['n8n', 'supabase', 'ollama', 'kong'];
      
      requiredServices.forEach(service => {
        const found = containers.some(name => name.toLowerCase().includes(service));
        if (found) {
          this.results.passed.push(`✅ Docker service running: ${service}`);
        } else {
          this.results.warnings.push(`⚠️  Docker service not running: ${service}`);
        }
      });
      
      if (containers.length > 0) {
        this.results.passed.push(`✅ Docker is accessible (${containers.length} containers)`);
      } else {
        this.results.warnings.push('⚠️  No Docker containers running');
      }
      
    } catch (error) {
      this.results.warnings.push('⚠️  Docker not accessible or not running');
    }
  }

  checkNodeModules() {
    this.log('Checking Node.js setup...', 'info');
    
    this.checkDirectory('node_modules', 'Node modules installed');
    
    if (fs.existsSync('package.json')) {
      try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const deps = Object.keys(packageJson.dependencies || {}).length;
        const devDeps = Object.keys(packageJson.devDependencies || {}).length;
        
        this.results.passed.push(`✅ Dependencies: ${deps} prod, ${devDeps} dev`);
      } catch (error) {
        this.results.failed.push('❌ Could not parse package.json');
      }
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      projectName: 'town-planner-local-ai',
      results: this.results,
      summary: {
        total: this.results.passed.length + this.results.failed.length,
        passed: this.results.passed.length,
        failed: this.results.failed.length,
        warnings: this.results.warnings.length,
        successRate: this.results.passed.length + this.results.failed.length > 0 ? 
          Math.round((this.results.passed.length / (this.results.passed.length + this.results.failed.length)) * 100) : 0
      }
    };

    // Save detailed report
    fs.writeFileSync('.automation/reports/integration-report.json', JSON.stringify(report, null, 2));
    
    // Display summary
    console.log('\n' + '='.repeat(50));
    console.log('🏗️  TOWN PLANNER INTEGRATION STATUS');
    console.log('='.repeat(50));
    console.log(`📊 Success Rate: ${report.summary.successRate}%`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    console.log('='.repeat(50));
    
    if (this.results.failed.length > 0) {
      console.log('\n🔴 CRITICAL ISSUES:');
      this.results.failed.forEach(item => console.log(`  ${item}`));
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n🟡 WARNINGS:');
      this.results.warnings.forEach(item => console.log(`  ${item}`));
    }
    
    if (this.results.passed.length > 0) {
      console.log('\n🟢 WORKING CORRECTLY:');
      this.results.passed.slice(0, 5).forEach(item => console.log(`  ${item}`));
      if (this.results.passed.length > 5) {
        console.log(`  ... and ${this.results.passed.length - 5} more`);
      }
    }
    
    console.log(`\n📄 Full report saved: .automation/reports/integration-report.json`);
    
    // Provide next steps
    if (report.summary.failed > 0) {
      console.log('\n📋 NEXT STEPS:');
      console.log('1. Fix the critical issues listed above');
      console.log('2. Run this check again: npm run check:integration');
      console.log('3. Generate Claude context: npm run generate:context');
    } else {
      console.log('\n🎉 Integration looks good! Run: npm run generate:context');
    }
  }

  run() {
    this.log('Starting Town Planner integration check...', 'info');
    
    this.checkProjectStructure();
    this.checkEnvironment();
    this.checkNodeModules();
    this.checkIntegrationSetup();
    this.checkDockerStatus();
    
    this.generateReport();
  }
}

if (require.main === module) {
  new TownPlannerChecker().run();
}

module.exports = TownPlannerChecker;
'@

$integrationChecker | Out-File -FilePath ".automation\scripts\integration-check.js" -Encoding UTF8

Write-Host "✅ Created integration checker" -ForegroundColor Green

# Create context generator script
$contextGenerator = @'
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class ContextGenerator {
  constructor() {
    this.projectName = 'town-planner-local-ai';
  }

  generateProjectContext() {
    console.log('🔄 Generating project context...');
    
    const context = {
      project: {
        name: this.projectName,
        type: 'React/Vite + Docker Integration with local-ai-packaged',
        description: 'Town planning AI assistant with document processing and chat functionality',
        lastUpdated: new Date().toISOString(),
        location: process.cwd()
      },
      status: this.getProjectStatus(),
      architecture: this.getArchitecture(),
      currentIssues: this.getCurrentIssues(),
      nextSteps: this.getNextSteps(),
      claudeInstructions: this.getClaudeInstructions()
    };

    // Save context
    fs.writeFileSync('.automation/reports/project-context.json', JSON.stringify(context, null, 2));
    
    // Generate markdown summary for Claude
    const summary = this.generateClaudeSummary(context);
    fs.writeFileSync('.automation/reports/claude-summary.md', summary);
    
    console.log('✅ Project context generated successfully!');
    console.log('\n📁 Files created:');
    console.log('  📄 .automation/reports/project-context.json');
    console.log('  📝 .automation/reports/claude-summary.md');
    console.log('\n💬 To use with Claude:');
    console.log('  1. Copy the content of claude-summary.md');
    console.log('  2. Paste it in your Claude conversation');
    console.log('  3. Ask Claude for help with specific issues');
    
    return context;
  }

  getProjectStatus() {
    const status = {
      phase: 'Docker Integration Setup',
      lastCheck: new Date().toISOString()
    };
    
    // Read integration report if available
    if (fs.existsSync('.automation/reports/integration-report.json')) {
      try {
        const report = JSON.parse(fs.readFileSync('.automation/reports/integration-report.json', 'utf8'));
        status.integrationHealth = `${report.summary.successRate}%`;
        status.criticalIssues = report.summary.failed;
        status.warnings = report.summary.warnings;
        status.lastIntegrationCheck = report.timestamp;
      } catch (error) {
        status.integrationHealth = 'Unknown';
      }
    }
    
    return status;
  }

  getArchitecture() {
    return {
      frontend: {
        framework: 'React 18 + TypeScript',
        buildTool: 'Vite',
        styling: 'Tailwind CSS + shadcn/ui',
        state: 'React Context + Local Storage'
      },
      backend: {
        database: 'Supabase PostgreSQL + vector extensions',
        auth: 'Supabase Auth',
        storage: 'Supabase Storage',
        functions: 'Supabase Edge Functions',
        workflows: 'n8n automation'
      },
      integration: {
        platform: 'local-ai-packaged Docker environment',
        ai: 'OpenAI API / Ollama (configurable)',
        vectorDB: 'Supabase pgvector',
        containerization: 'Docker Compose'
      }
    };
  }

  getCurrentIssues() {
    const issues = [];
    
    // Check for common setup issues
    if (!fs.existsSync('.env')) {
      issues.push('Environment variables not configured (.env file missing)');
    }
    
    if (!fs.existsSync('docker-compose.yml')) {
      issues.push('Docker Compose configuration not found');
    }
    
    if (!fs.existsSync('town-planner-local-package/')) {
      issues.push('Town planner local package not created');
    }
    
    // Read integration report
    if (fs.existsSync('.automation/reports/integration-report.json')) {
      try {
        const report = JSON.parse(fs.readFileSync('.automation/reports/integration-report.json', 'utf8'));
        issues.push(...report.results.failed.map(item => item.replace('❌ ', '')));
      } catch (error) {
        issues.push('Could not read integration report');
      }
    }
    
    return issues.length > 0 ? issues : ['No critical issues detected'];
  }

  getNextSteps() {
    return [
      'Complete local-ai-packaged integration setup',
      'Create town-planner-local-package with Dockerfile and configs',
      'Set up environment variables (.env file)',
      'Configure Docker Compose with town-planner service',
      'Set up Supabase database and edge functions',
      'Create n8n workflows for file processing and chat',
      'Test file upload and processing pipeline',
      'Implement chat functionality with n8n backend',
      'Validate end-to-end integration',
      'Deploy and test production setup'
    ];
  }

  getClaudeInstructions() {
    return {
      contextFiles: [
        'TASKS.md - Current development priorities and blocking issues',
        'AGENTS.md - Architecture guidelines and development patterns',
        '.automation/reports/claude-summary.md - Latest project context',
        '.automation/reports/integration-report.json - Technical status'
      ],
      keyCommands: {
        'npm run check:integration': 'Run comprehensive integration check',
        'npm run generate:context': 'Generate updated context for Claude',
        'npm run docker:up': 'Start all Docker services',
        'npm run docker:down': 'Stop all Docker services'
      },
      focusAreas: [
        'Docker container integration with local-ai-packaged',
        'Environment variable configuration and validation',
        'n8n workflow setup for file processing automation',
        'Supabase edge function connectivity',
        'Frontend-backend API communication',
        'File upload processing pipeline'
      ],
      projectStructure: {
        'src/': 'React frontend application code',
        'supabase/': 'Database schema and edge functions',
        'town-planner-local-package/': 'Docker integration files (needs creation)',
        'n8n/': 'Workflow automation definitions',
        '.automation/': 'Development automation and monitoring scripts'
      }
    };
  }

  generateClaudeSummary(context) {
    return `# 🤖 Town Planner Project Context for Claude

## Project Overview
**${context.project.name}** - ${context.project.description}

**Type**: ${context.project.type}  
**Current Phase**: ${context.status.phase}  
**Location**: ${context.project.location}  
**Last Updated**: ${context.project.lastUpdated}

## 📊 Current Status
- **Integration Health**: ${context.status.integrationHealth || 'Checking...'}
- **Critical Issues**: ${context.status.criticalIssues || 0}
- **Warnings**: ${context.status.warnings || 0}
- **Last Check**: ${context.status.lastIntegrationCheck || 'Not run yet'}

## 🏗️ Architecture
### Frontend
- **Framework**: ${context.architecture.frontend.framework}
- **Build Tool**: ${context.architecture.frontend.buildTool}
- **Styling**: ${context.architecture.frontend.styling}

### Backend & Integration
- **Database**: ${context.architecture.backend.database}
- **Workflows**: ${context.architecture.backend.workflows}
- **Platform**: ${context.architecture.integration.platform}
- **AI Provider**: ${context.architecture.integration.ai}

## 🔴 Current Issues
${context.currentIssues.map(issue => `- ${issue}`).join('\n')}

## 📋 Next Steps (Priority Order)
${context.nextSteps.slice(0, 5).map((step, i) => `${i + 1}. ${step}`).join('\n')}

## 🔧 For Claude Development Assistance

### Key Files to Reference
${context.claudeInstructions.contextFiles.map(file => `- **${file}**`).join('\n')}

### Useful Commands
${Object.entries(context.claudeInstructions.keyCommands).map(([cmd, desc]) => `- \`${cmd}\` - ${desc}`).join('\n')}

### Current Focus Areas
${context.claudeInstructions.focusAreas.map(area => `- ${area}`).join('\n')}

### Project Structure
${Object.entries(context.claudeInstructions.projectStructure).map(([dir, desc]) => `- **${dir}** - ${desc}`).join('\n')}

## 🚀 Quick Development Commands
\`\`\`bash
# Check current integration status
npm run check:integration

# Start Docker services (if configured)
npm run docker:up

# View n8n logs
npm run logs:n8n

# Generate updated context for Claude
npm run generate:context
\`\`\`

## 💡 Claude Instructions
When helping with this project:
1. **Always check integration status first** using \`npm run check:integration\`
2. **Reference TASKS.md** for current development priorities
3. **Follow AGENTS.md** for architecture guidelines
4. **Focus on Docker integration** with local-ai-packaged
5. **Prioritize file processing workflows** and n8n connectivity

**🎯 Current Priority**: ${context.nextSteps[0]}

---
*Generated automatically by town-planner integration tools*
*For latest status, run: \`npm run generate:context\`*
`;
  }
}

if (require.main === module) {
  new ContextGenerator().generateProjectContext();
}

module.exports = ContextGenerator;
'@

$contextGenerator | Out-File -FilePath ".automation\scripts\generate-context.js" -Encoding UTF8

Write-Host "✅ Created context generator" -ForegroundColor Green

# Update package.json with new scripts
Write-Host "📝 Updating package.json with automation scripts..." -ForegroundColor Yellow

$packageUpdater = @'
const fs = require('fs');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  packageJson.scripts = packageJson.scripts || {};
  
  // Add automation scripts
  packageJson.scripts['check:integration'] = 'node .automation/scripts/integration-check.js';
  packageJson.scripts['generate:context'] = 'node .automation/scripts/generate-context.js';
  packageJson.scripts['docker:up'] = 'python start_services.py --profile gpu-nvidia';
  packageJson.scripts['docker:down'] = 'docker compose -p localai -f docker-compose.yml --profile gpu-nvidia down';
  packageJson.scripts['logs:n8n'] = 'docker logs n8n -f';
  packageJson.scripts['logs:supabase'] = 'docker compose -p localai logs supabase_kong -f';
  
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  console.log('✅ Package.json updated successfully');
} catch (error) {
  console.log('❌ Could not update package.json:', error.message);
}
'@

$packageUpdater | Out-File -FilePath ".automation\scripts\update-package.js" -Encoding UTF8
node .automation\scripts\update-package.js

# Create README for automation tools
$readme = @'
# Town Planner Integration Tools

This directory contains automation scripts for the town-planner project integration with local-ai-packaged.

## Quick Start

```bash
# Check integration status
npm run check:integration

# Generate Claude context
npm run generate:context

# Start Docker services
npm run docker:up

# Stop Docker services  
npm run docker:down
```

## Scripts

### integration-check.js
Validates the entire project setup including:
- Project structure (React files, directories)
- Environment variables configuration
- Docker integration files
- Container status
- Node.js dependencies

### generate-context.js
Creates context files for Claude conversations:
- project-context.json (detailed project info)
- claude-summary.md (formatted for Claude)

## Generated Reports

All reports are saved in `.automation/reports/`:
- `integration-report.json` - Technical integration status
- `project-context.json` - Complete project context
- `claude-summary.md` - Ready-to-use Claude context

## Usage with Claude

1. Run: `npm run generate:context`
2. Copy content from `.automation/reports/claude-summary.md`
3. Paste in Claude conversation with your specific question
4. Claude will have full project context to help effectively

## Troubleshooting

If scripts fail:
1. Ensure you're in the project root directory
2. Check that Node.js is installed and accessible
3. Verify package.json exists
4. Run `npm install` if dependencies are missing
'@

$readme | Out-File -FilePath ".automation\README.md" -Encoding UTF8

Write-Host ""
Write-Host "🎉 Setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Available commands:" -ForegroundColor Cyan
Write-Host "  npm run check:integration  - Check integration status" -ForegroundColor White
Write-Host "  npm run generate:context   - Generate Claude context" -ForegroundColor White
Write-Host "  npm run docker:up          - Start Docker services" -ForegroundColor White
Write-Host "  npm run docker:down        - Stop Docker services" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm run check:integration" -ForegroundColor White
Write-Host "2. Fix any critical issues found" -ForegroundColor White
Write-Host "3. Run: npm run generate:context" -ForegroundColor White
Write-Host "4. Use .automation\reports\claude-summary.md with Claude" -ForegroundColor White
Write-Host ""
Write-Host "📁 Files created in .automation\ directory" -ForegroundColor Green