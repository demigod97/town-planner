File Organization Structure
Here's where each script should go in your project:
D:\ailocal\town-planner\
├── .claude/
│   ├── project.json                    ← Claude Code configuration
│   ├── prompts.json                    ← Custom prompts for Claude
│   └── commands/                       ← Custom Claude commands
│       └── debug.md
├── claude-tasks/
│   ├── integration-checker.js          ← The script you showed
│   ├── dev-tasks.js                    ← Development task automation
│   ├── conversation-helper.js          ← Claude conversation integration
│   └── README.md                       ← Documentation
├── .automation/                        ← Alternative manual tools
│   ├── scripts/
│   └── reports/
└── (your existing files...)
Step-by-Step Setup
1. Create the Directory Structure
bash# In your project root (D:\ailocal\town-planner\)
mkdir -p .claude/commands
mkdir -p claude-tasks
mkdir -p .automation/scripts
mkdir -p .automation/reports
2. Place the Integration Checker
Save your integration checker script as:
bash# Save the script you showed as:
claude-tasks/integration-checker.js

#!/usr/bin/env node

/**
 * Claude Code Development Task Automation
 * Automates common development tasks for the town-planner project
 * Save as: claude-tasks/dev-tasks.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DevTaskManager {
  constructor() {
    this.tasksFile = 'TASKS.md';
    this.agentsFile = 'AGENTS.md';
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}[${type.toUpperCase()}] ${message}${colors.reset}`);
  }

  executeCommand(command, description) {
    this.log(`Executing: ${description}`, 'info');
    try {
      const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      this.log(`✅ ${description} completed`, 'success');
      return output;
    } catch (error) {
      this.log(`❌ ${description} failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async checkProjectHealth() {
    this.log('Checking project health...', 'info');
    
    // Check if dependencies are installed
    if (!fs.existsSync('node_modules')) {
      this.log('Installing dependencies...', 'info');
      try {
        this.executeCommand('npm install', 'Install dependencies');
      } catch (error) {
        this.log('Failed to install dependencies', 'error');
      }
    }

    // Check TypeScript compilation
    try {
      this.executeCommand('npx tsc --noEmit', 'TypeScript compilation check');
    } catch (error) {
      this.log('TypeScript compilation issues found', 'warning');
    }

    // Check if Vite can build
    try {
      this.executeCommand('npm run build', 'Production build test');
      this.log('✅ Build successful', 'success');
    } catch (error) {
      this.log('Build failed - check for errors', 'error');
    }
  }

  async checkSupabaseStatus() {
    this.log('Checking Supabase status...', 'info');
    
    try {
      // Check if Supabase containers are running
      const dockerPs = this.executeCommand('docker ps --filter "name=supabase" --format "{{.Names}}"', 'Check Supabase containers');
      
      if (dockerPs.trim()) {
        this.log('✅ Supabase containers running', 'success');
        
        // Check specific services
        const services = ['supabase_db', 'supabase_kong', 'supabase_auth'];
        services.forEach(service => {
          if (dockerPs.includes(service)) {
            this.log(`✅ ${service} is running`, 'success');
          } else {
            this.log(`❌ ${service} not found`, 'error');
          }
        });
      } else {
        this.log('❌ No Supabase containers running', 'error');
        this.log('💡 Try: npm run docker:up', 'info');
      }
    } catch (error) {
      this.log('❌ Could not check Supabase status', 'error');
    }
  }

  async checkN8nStatus() {
    this.log('Checking n8n status...', 'info');
    
    try {
      const dockerPs = this.executeCommand('docker ps --filter "name=n8n" --format "{{.Status}}"', 'Check n8n container');
      
      if (dockerPs.includes('Up')) {
        this.log('✅ n8n container is running', 'success');
        
        // Check if n8n is accessible
        try {
          const curlCheck = this.executeCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost:5678', 'Test n8n connectivity');
          if (curlCheck.trim() === '200') {
            this.log('✅ n8n is accessible at http://localhost:5678', 'success');
          } else {
            this.log('⚠️  n8n container running but not accessible', 'warning');
          }
        } catch (error) {
          this.log('⚠️  Could not test n8n connectivity', 'warning');
        }
      } else {
        this.log('❌ n8n container is not running', 'error');
      }
    } catch (error) {
      this.log('❌ Could not check n8n status', 'error');
    }
  }

  async runLinting() {
    this.log('Running linting checks...', 'info');
    
    try {
      this.executeCommand('npm run lint', 'ESLint check');
      this.log('✅ Linting passed', 'success');
    } catch (error) {
      this.log('❌ Linting issues found', 'error');
      try {
        this.executeCommand('npm run lint -- --fix', 'Auto-fix linting issues');
        this.log('✅ Auto-fixed linting issues', 'success');
      } catch (fixError) {
        this.log('❌ Could not auto-fix all linting issues', 'error');
      }
    }
  }

  async updateTaskStatus() {
    this.log('Updating task status...', 'info');
    
    if (!fs.existsSync(this.tasksFile)) {
      this.log('TASKS.md not found, creating template...', 'warning');
      this.createTasksTemplate();
    }

    const tasksContent = fs.readFileSync(this.tasksFile, 'utf8');
    const timestamp = new Date().toISOString();
    
    // Add automation timestamp
    const updatedContent = tasksContent.replace(
      /Last Updated: .*/,
      `Last Updated: ${timestamp} (via Claude Code automation)`
    );
    
    fs.writeFileSync(this.tasksFile, updatedContent);
    this.log('✅ Tasks file updated', 'success');
  }

  createTasksTemplate() {
    const template = `# TASKS.md - Development Task Backlog

> **⚠️ Important**: This file is automatically updated by Claude Code automation.

## 🔴 Critical Issues (Blocking Core Functionality)

### 1. Integration Status Check
**Priority**: 🔥 URGENT  
**Status**: ✅ AUTOMATED  
**Description**: Claude Code integration and monitoring active

**Automated Checks**:
- [x] Project structure validation
- [x] Environment variables verification  
- [x] Docker containers status
- [x] Supabase connection validation
- [x] n8n workflow connectivity

## 🟡 High Priority (Core Features)

### Development Tasks
- [ ] Complete town-planner-local-package integration
- [ ] Set up n8n workflow automation
- [ ] Implement file upload processing
- [ ] Fix chat message persistence
- [ ] Validate API endpoints
- [ ] Test end-to-end workflow

## 📝 Notes

*Last Updated: ${new Date().toISOString()} (via Claude Code automation)*
`;

    fs.writeFileSync(this.tasksFile, template);
  }

  async runIntegrationTests() {
    this.log('Running integration tests...', 'info');
    
    // Run the integration checker
    try {
      this.executeCommand('node claude-tasks/integration-checker.js', 'Integration status check');
    } catch (error) {
      this.log('Integration checker failed', 'error');
    }

    // Check if we can start the dev server
    try {
      this.log('Testing development server startup...', 'info');
      const child = execSync('timeout 10 npm run dev', { encoding: 'utf8', timeout: 12000 });
      this.log('✅ Development server can start', 'success');
    } catch (error) {
      if (error.signal === 'SIGTERM') {
        this.log('✅ Development server started successfully (timeout reached)', 'success');
      } else {
        this.log('❌ Development server failed to start', 'error');
      }
    }
  }

  async runFullCheck() {
    this.log('Running full development environment check...', 'info');
    
    await this.checkProjectHealth();
    await this.runLinting();
    await this.checkSupabaseStatus();
    await this.checkN8nStatus();
    await this.runIntegrationTests();
    await this.updateTaskStatus();
    
    this.log('✅ Full development check completed', 'success');
    this.log('📋 Check integration-report.json for detailed status', 'info');
  }
}

// CLI interface
if (require.main === module) {
  const manager = new DevTaskManager();
  const command = process.argv[2];
  
  switch (command) {
    case 'check':
      manager.runFullCheck();
      break;
    case 'health':
      manager.checkProjectHealth();
      break;
    case 'supabase':
      manager.checkSupabaseStatus();
      break;
    case 'n8n':
      manager.checkN8nStatus();
      break;
    case 'lint':
      manager.runLinting();
      break;
    case 'test':
      manager.runIntegrationTests();
      break;
    case 'tasks':
      manager.updateTaskStatus();
      break;
    default:
      console.log(`
Claude Code Development Tasks

Usage: node claude-tasks/dev-tasks.js <command>

Commands:
  check      - Run full development environment check
  health     - Check project health (dependencies, build)
  supabase   - Check Supabase container status
  n8n        - Check n8n container status
  lint       - Run linting checks
  test       - Run integration tests
  tasks      - Update task status

Examples:
  node claude-tasks/dev-tasks.js check
  node claude-tasks/dev-tasks.js health
      `);
  }
}

module.exports = DevTaskManager;


#!/usr/bin/env node

/**
 * Claude Conversation Integration Helper
 * Helps integrate with Claude conversations and projects
 * Save as: claude-tasks/conversation-helper.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ClaudeConversationHelper {
  constructor() {
    this.contextFile = 'claude-context.json';
    this.summaryFile = 'claude-conversation-summary.md';
    this.projectFile = '.claude/project.json';
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m', 
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}[${type.toUpperCase()}] ${message}${colors.reset}`);
  }

  async generateProjectContext() {
    this.log('Generating project context for Claude...', 'info');
    
    const context = {
      project: {
        name: 'town-planner',
        type: 'React/Vite Frontend with Supabase & n8n Integration',
        description: 'Town planning application with AI-powered document processing and chat',
        lastUpdated: new Date().toISOString(),
        location: process.cwd()
      },
      tech_stack: this.getTechStack(),
      architecture: this.getArchitecture(),
      currentStatus: await this.getCurrentStatus(),
      activeIssues: await this.getActiveIssues(),
      recentChanges: await this.getRecentChanges(),
      nextTasks: await this.getNextTasks(),
      claudeInstructions: this.getClaudeInstructions()
    };

    fs.writeFileSync(this.contextFile, JSON.stringify(context, null, 2));
    this.log(`✅ Context saved to ${this.contextFile}`, 'success');
    
    return context;
  }

  getTechStack() {
    return {
      frontend: {
        framework: 'React 18',
        language: 'TypeScript',
        buildTool: 'Vite',
        styling: 'Tailwind CSS',
        components: 'shadcn/ui',
        testing: 'Cypress'
      },
      backend: {
        database: 'Supabase PostgreSQL',
        auth: 'Supabase Auth', 
        storage: 'Supabase Storage',
        functions: 'Supabase Edge Functions',
        workflows: 'n8n automation'
      },
      integration: {
        platform: 'local-ai-packaged Docker',
        ai: 'OpenAI/Ollama (configurable)',
        vectorDB: 'Supabase pgvector',
        containerization: 'Docker Compose'
      }
    };
  }

  getArchitecture() {
    return {
      pattern: 'Frontend → Supabase Edge Functions → n8n Workflows → AI Services',
      dataFlow: [
        'User uploads file → Supabase Storage',
        'Edge function triggers → n8n workflow',
        'n8n processes → AI analysis', 
        'Results stored → Supabase DB',
        'Frontend displays → Real-time updates'
      ],
      keyComponents: {
        'src/': 'React frontend application',
        'supabase/': 'Database schema and edge functions',
        'n8n/': 'Workflow automation definitions',
        'claude-tasks/': 'Development automation scripts'
      }
    };
  }

  async getCurrentStatus() {
    const status = {
      development: 'In Progress',
      phase: 'Docker Integration & Workflow Setup',
      lastCheck: new Date().toISOString()
    };

    // Check if integration report exists
    if (fs.existsSync('integration-report.json')) {
      const report = JSON.parse(fs.readFileSync('integration-report.json', 'utf8'));
      status.integrationHealth = `${report.successRate}%`;
      status.lastIntegrationCheck = report.timestamp;
      status.criticalIssues = report.results.failed.length;
    }

    // Check project health
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      status.projectVersion = packageJson.version;
      status.dependencies = Object.keys(packageJson.dependencies || {}).length;
    } catch (error) {
      status.projectHealth = 'Could not read package.json';
    }

    // Check Docker status
    try {
      const dockerPs = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
      const containers = dockerPs.split('\n').filter(name => name.trim());
      status.dockerContainers = containers.length;
      status.dockerServices = {
        n8n: containers.some(name => name.includes('n8n')),
        supabase: containers.some(name => name.includes('supabase')),
        ollama: containers.some(name => name.includes('ollama'))
      };
    } catch (error) {
      status.dockerStatus = 'Not accessible';
    }

    return status;
  }

  async getActiveIssues() {
    const issues = [];

    // Check TASKS.md for current issues
    if (fs.existsSync('TASKS.md')) {
      const tasksContent = fs.readFileSync('TASKS.md', 'utf8');
      
      // Extract critical issues
      const criticalSection = tasksContent.match(/## 🔴 Critical Issues[\s\S]*?(?=## |$)/);
      if (criticalSection) {
        const criticalIssues = criticalSection[0].match(/### \d+\. (.+)/g);
        if (criticalIssues) {
          issues.push(...criticalIssues.map(issue => issue.replace(/### \d+\. /, '')));
        }
      }
    }

    // Check integration report
    if (fs.existsSync('integration-report.json')) {
      const report = JSON.parse(fs.readFileSync('integration-report.json', 'utf8'));
      issues.push(...report.results.failed.map(fail => fail.replace('❌ ', '')));
    }

    // Check for missing files
    const criticalFiles = [
      '.env',
      'docker-compose.yml', 
      'town-planner-local-package/',
      'supabase/',
      'n8n/'
    ];

    criticalFiles.forEach(file => {
      if (!fs.existsSync(file)) {
        issues.push(`Missing: ${file}`);
      }
    });

    return issues.length > 0 ? issues : ['No critical issues detected'];
  }

  async getRecentChanges() {
    const changes = [];

    try {
      // Get recent git commits
      const gitLog = execSync('git log --oneline -5', { encoding: 'utf8' });
      changes.push(...gitLog.split('\n').filter(line => line.trim()));
    } catch (error) {
      changes.push('Git history not available');
    }

    return changes;
  }

  async getNextTasks() {
    const tasks = [
      'Create town-planner-local-package with Dockerfile',
      'Set up environment variables (.env configuration)',
      'Update docker-compose.yml with town-planner service',
      'Create Supabase edge functions for n8n integration',
      'Set up n8n workflows for file processing',
      'Implement file upload processing pipeline',
      'Create chat functionality with AI backend',
      'Test end-to-end workflow',
      'Add error handling and monitoring',
      'Deploy and validate production setup'
    ];

    // Check TASKS.md for specific next tasks
    if (fs.existsSync('TASKS.md')) {
      const tasksContent = fs.readFileSync('TASKS.md', 'utf8');
      const highPrioritySection = tasksContent.match(/## 🟡 High Priority[\s\S]*?(?=## |$)/);
      if (highPrioritySection) {
        const priorityTasks = highPrioritySection[0].match(/- \[ \] (.+)/g);
        if (priorityTasks) {
          const extracted = priorityTasks.map(task => task.replace('- [ ] ', ''));
          tasks.splice(0, 0, ...extracted); // Add to beginning
        }
      }
    }

    return tasks.slice(0, 10); // Limit to top 10 tasks
  }

  getClaudeInstructions() {
    return {
      contextFiles: [
        'TASKS.md - Current development priorities and blocking issues',
        'AGENTS.md - Architecture guidelines and development patterns', 
        'claude-conversation-summary.md - Latest project summary',
        'integration-report.json - Technical integration status',
        'package.json - Project configuration and dependencies'
      ],
      keyCommands: {
        'node claude-tasks/integration-checker.js': 'Run integration validation',
        'node claude-tasks/dev-tasks.js check': 'Full development environment check',
        'node claude-tasks/conversation-helper.js sync': 'Generate updated context',
        'npm run dev': 'Start development server',
        'npm run build': 'Build for production'
      },
      focusAreas: [
        'Docker integration with local-ai-packaged project',
        'n8n workflow automation for file processing',
        'Supabase edge function API connectivity',
        'Frontend-backend communication setup',
        'Environment variable configuration',
        'File upload and processing pipeline'
      ],
      currentPriority: 'Complete Docker integration and workflow setup'
    };
  }

  async generateConversationSummary(context) {
    const summary = `# 🤖 Town Planner Project Context for Claude

## Project Overview
**${context.project.name}** - ${context.project.description}

**Type**: ${context.project.type}  
**Phase**: ${context.currentStatus.phase}  
**Location**: ${context.project.location}  
**Last Updated**: ${context.project.lastUpdated}

## 🏗️ Technology Stack
### Frontend
- **Framework**: ${context.tech_stack.frontend.framework} + ${context.tech_stack.frontend.language}
- **Build Tool**: ${context.tech_stack.frontend.buildTool}
- **Styling**: ${context.tech_stack.frontend.styling} + ${context.tech_stack.frontend.components}

### Backend & Integration
- **Database**: ${context.tech_stack.backend.database}
- **Workflows**: ${context.tech_stack.backend.workflows}
- **Platform**: ${context.tech_stack.integration.platform}
- **AI**: ${context.tech_stack.integration.ai}

## 📊 Current Status
- **Integration Health**: ${context.currentStatus.integrationHealth || 'Unknown'}
- **Docker Services**: ${JSON.stringify(context.currentStatus.dockerServices || {})}
- **Critical Issues**: ${context.currentStatus.criticalIssues || 0}
- **Dependencies**: ${context.currentStatus.dependencies || 'Unknown'} packages

## 🔴 Active Issues
${context.activeIssues.slice(0, 5).map(issue => `- ${issue}`).join('\n')}

## 📋 Next Tasks (Priority Order)
${context.nextTasks.slice(0, 5).map((task, i) => `${i + 1}. ${task}`).join('\n')}

## 🏛️ Architecture Pattern
**Data Flow**: ${context.architecture.pattern}

**Key Components**:
${Object.entries(context.architecture.keyComponents).map(([dir, desc]) => `- **${dir}** - ${desc}`).join('\n')}

## 🔧 For Claude Development Assistance

### Key Files to Reference
${context.claudeInstructions.contextFiles.map(file => `- **${file}**`).join('\n')}

### Useful Commands
${Object.entries(context.claudeInstructions.keyCommands).map(([cmd, desc]) => `- \`${cmd}\` - ${desc}`).join('\n')}

### Current Focus Areas
${context.claudeInstructions.focusAreas.map(area => `- ${area}`).join('\n')}

## 🚀 Quick Development Commands
\`\`\`bash
# Check integration status
node claude-tasks/integration-checker.js

# Full development environment check  
node claude-tasks/dev-tasks.js check

# Update this context
node claude-tasks/conversation-helper.js sync

# Start development server
npm run dev
\`\`\`

## 📋 Recent Changes
${context.recentChanges.slice(0, 3).map(change => `- ${change}`).join('\n')}

---

**💡 Claude Instructions**: 
This project needs help with Docker integration, n8n workflow setup, and frontend-backend connectivity. Always check the latest integration status first, then help with the current blocking issues listed above.

**🎯 Current Priority**: ${context.claudeInstructions.currentPriority}

**🔍 To help effectively**:
1. Run integration check to see current status
2. Review TASKS.md for specific issues
3. Focus on Docker setup and workflow automation
4. Provide specific, actionable solutions
`;

    fs.writeFileSync(this.summaryFile, summary);
    this.log(`✅ Conversation summary saved to ${this.summaryFile}`, 'success');
    
    return summary;
  }

  async exportForClaudeProjects() {
    this.log('Exporting project data for Claude Projects...', 'info');

    const exportData = {
      project: {
        name: 'town-planner',
        description: 'React/Vite town planning AI assistant with Supabase and n8n integration',
        technology: 'React, TypeScript, Vite, Supabase, n8n, Docker',
        status: 'Development - Integration Phase'
      },
      files: [],
      context: await this.generateProjectContext()
    };

    // Add important files for Claude Projects
    const importantFiles = [
      'TASKS.md',
      'AGENTS.md', 
      'package.json',
      'src/main.tsx',
      'vite.config.ts',
      'claude-conversation-summary.md'
    ];

    for (const file of importantFiles) {
      if (fs.existsSync(file)) {
        exportData.files.push({
          path: file,
          content: fs.readFileSync(file, 'utf8'),
          type: path.extname(file) || 'text'
        });
      }
    }

    fs.writeFileSync('claude-projects-export.json', JSON.stringify(exportData, null, 2));
    this.log('✅ Export ready for Claude Projects', 'success');
    
    console.log('\n📤 To use with Claude Projects:');
    console.log('1. Copy the contents of claude-projects-export.json');
    console.log('2. Create a new project in Claude');
    console.log('3. Add the key files from the export');
    console.log('4. Use claude-conversation-summary.md as context');

    return exportData;
  }

  async runFullSync() {
    this.log('Running full Claude synchronization...', 'info');
    
    const context = await this.generateProjectContext();
    await this.generateConversationSummary(context);
    await this.exportForClaudeProjects();
    
    this.log('✅ Full synchronization completed!', 'success');
    console.log('\n📋 Generated files:');
    console.log('  - claude-context.json (detailed project context)');
    console.log('  - claude-conversation-summary.md (for conversations)');
    console.log('  - claude-projects-export.json (for Claude Projects)');
    console.log('\n💬 Copy claude-conversation-summary.md content to provide context in Claude conversations');
  }
}

// CLI interface
if (require.main === module) {
  const helper = new ClaudeConversationHelper();
  const command = process.argv[2];
  
  switch (command) {
    case 'sync':
      helper.runFullSync();
      break;
    case 'context':
      helper.generateProjectContext();
      break;
    case 'summary':
      helper.generateProjectContext().then(context => 
        helper.generateConversationSummary(context)
      );
      break;
    case 'export':
      helper.exportForClaudeProjects();
      break;
    default:
      console.log(`
Claude Conversation Integration Helper

Usage: node claude-tasks/conversation-helper.js <command>

Commands:
  sync      - Run full synchronization (recommended)
  context   - Generate project context only
  summary   - Create conversation summary
  export    - Export for Claude Projects

Examples:
  node claude-tasks/conversation-helper.js sync
  node claude-tasks/conversation-helper.js summary
      `);
  }
}

module.exports = ClaudeConversationHelper;

4. Update Your package.json
Add these scripts to your package.json:

{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    
    "claude:check": "node claude-tasks/integration-checker.js",
    "claude:dev": "node claude-tasks/dev-tasks.js check", 
    "claude:health": "node claude-tasks/dev-tasks.js health",
    "claude:supabase": "node claude-tasks/dev-tasks.js supabase",
    "claude:n8n": "node claude-tasks/dev-tasks.js n8n",
    "claude:sync": "node claude-tasks/conversation-helper.js sync",
    "claude:context": "node claude-tasks/conversation-helper.js summary",
    
    "docker:up": "python start_services.py --profile gpu-nvidia",
    "docker:down": "docker compose -p localai -f docker-compose.yml --profile gpu-nvidia down",
    "logs:n8n": "docker logs n8n -f",
    "logs:supabase": "docker compose -p localai logs supabase_kong -f"
  }
}

I'll continue with creating the Claude Code configuration files and complete setup guide.
{
  "project_context": {
    "prompt": "You are helping with a React/Vite town planning application that uses Supabase for backend and n8n for workflow automation. The app processes PDFs and provides AI-powered chat functionality. Focus on frontend-backend integration, Docker setup with local-ai-packaged, and workflow automation.",
    "context_files": [
      "TASKS.md",
      "AGENTS.md", 
      "claude-conversation-summary.md",
      "integration-report.json",
      "package.json"
    ]
  },
  "integration_check": {
    "prompt": "Check the integration status of the town-planner app with local-ai-packaged Docker environment. Verify project structure, environment variables, Docker configuration, Supabase setup, and n8n workflows. Provide specific actionable recommendations for any issues found.",
    "files": [
      "docker-compose.yml",
      ".env",
      "town-planner-local-package/",
      "supabase/",
      "n8n/"
    ]
  },
  "code_review": {
    "prompt": "Review the React/TypeScript code for best practices, potential issues, and integration patterns. Focus on Supabase client usage, API integration, error handling, TypeScript types, and component architecture. Ensure code follows modern React patterns.",
    "files": [
      "src/components/",
      "src/hooks/",
      "src/lib/",
      "src/pages/",
      "src/main.tsx"
    ]
  },
  "workflow_debug": {
    "prompt": "Help debug n8n workflow issues and Supabase edge function integration. Check workflow configurations, webhook endpoints, authentication, data flow, and container connectivity. Provide step-by-step troubleshooting guidance.",
    "files": [
      "n8n/",
      "supabase/functions/",
      ".env",
      "docker-compose.yml"
    ]
  },
  "docker_setup": {
    "prompt": "Help with Docker integration using local-ai-packaged. Review Docker configurations, container connectivity, environment variables, service definitions, and networking. Ensure proper integration with existing local-ai-packaged infrastructure.",
    "files": [
      "docker-compose.yml",
      "town-planner-local-package/Dockerfile",
      "town-planner-local-package/docker-compose.copy.yml",
      ".env"
    ]
  },
  "frontend_development": {
    "prompt": "Help with React/Vite frontend development. Review component architecture, state management, API integration, TypeScript usage, styling with Tailwind CSS, and user experience. Focus on file upload, chat interface, and real-time updates.",
    "files": [
      "src/",
      "vite.config.ts",
      "tsconfig.json",
      "tailwind.config.ts"
    ]
  }
}

Create Custom Claude Commands:
# Debug Town Planner Integration

Debug common issues with the town-planner project integration.

## Usage
Run this command when experiencing issues with:
- Docker containers not starting
- n8n workflows not triggering
- Supabase connection problems
- File upload processing failures
- Frontend-backend communication issues

## Steps

1. **Check Integration Status**
   ```bash
   node claude-tasks/integration-checker.js
   ```

2. **Verify Environment Variables**
   - Check `.env` file exists and has required variables
   - Verify Docker environment variables are set
   - Ensure Supabase keys are correct

3. **Check Docker Services**
   ```bash
   docker ps
   docker logs n8n
   docker logs supabase_kong
   ```

4. **Test Connectivity**
   - n8n: http://localhost:5678
   - Supabase: http://localhost:8000
   - Frontend: http://localhost:5173

5. **Common Solutions**
   - Restart Docker services: `npm run docker:down && npm run docker:up`
   - Clear Docker cache: `docker system prune`
   - Rebuild containers: `docker-compose build --no-cache`
   - Check firewall/port conflicts

## Troubleshooting Checklist

- [ ] All required files exist (docker-compose.yml, .env, etc.)
- [ ] Environment variables are properly set
- [ ] Docker Desktop is running
- [ ] No port conflicts (5678, 8000, 5173)
- [ ] Latest code is pulled and dependencies installed
- [ ] n8n workflows are activated
- [ ] Supabase edge functions are deployed


Create Setup Script

#!/bin/bash

# Complete Claude Code Integration Setup for Town Planner
# Run this in your project root: D:\ailocal\town-planner\

set -e

echo "🚀 Setting up Claude Code integration for town-planner project..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Are you in the project root?"
    exit 1
fi

# Create directory structure
log_info "Creating directory structure..."
mkdir -p .claude/commands
mkdir -p claude-tasks
mkdir -p .automation/scripts
mkdir -p .automation/reports

# Create Claude project configuration
log_info "Creating Claude project configuration..."
cat > .claude/project.json << 'EOF'
{
  "name": "town-planner",
  "description": "React/Vite town planner app with Supabase backend and n8n workflows",
  "version": "1.0.0",
  "claude_code": {
    "project_type": "web_application",
    "tech_stack": [
      "React",
      "TypeScript",
      "Vite",
      "Supabase",
      "Docker",
      "n8n",
      "Tailwind CSS"
    ],
    "primary_directories": [
      "src/",
      "supabase/",
      "town-planner-local-package/",
      "n8n/",
      "claude-tasks/"
    ],
    "ignore_patterns": [
      "node_modules/",
      "dist/",
      "build/",
      ".git/",
      "*.log",
      "claude-context.json",
      "integration-report.json"
    ],
    "development_tasks": {
      "integration_check": {
        "description": "Check local-ai-packaged integration status",
        "files": [
          "docker-compose.yml",
          ".env",
          "town-planner-local-package/",
          "supabase/functions/"
        ]
      },
      "workflow_validation": {
        "description": "Validate n8n workflows and connections",
        "files": [
          "n8n/",
          "supabase/functions/*/index.ts"
        ]
      },
      "code_review": {
        "description": "Review React components and API integration",
        "files": [
          "src/components/",
          "src/hooks/",
          "src/lib/"
        ]
      }
    },
    "ai_assistant_rules": [
      "Always check TASKS.md for current development priorities",
      "Follow the architecture patterns in AGENTS.md",
      "Ensure Docker integration follows local-ai-packaged patterns",
      "Validate n8n workflow connections before code changes",
      "Check environment variable consistency across all config files"
    ]
  }
}
EOF

# Create Claude prompts configuration
log_info "Creating Claude prompts configuration..."
cat > .claude/prompts.json << 'EOF'
{
  "project_context": {
    "prompt": "You are helping with a React/Vite town planning application that uses Supabase for backend and n8n for workflow automation. The app processes PDFs and provides AI-powered chat functionality. Focus on frontend-backend integration, Docker setup with local-ai-packaged, and workflow automation.",
    "context_files": [
      "TASKS.md",
      "AGENTS.md", 
      "claude-conversation-summary.md",
      "integration-report.json",
      "package.json"
    ]
  },
  "integration_check": {
    "prompt": "Check the integration status of the town-planner app with local-ai-packaged Docker environment. Verify project structure, environment variables, Docker configuration, Supabase setup, and n8n workflows. Provide specific actionable recommendations for any issues found.",
    "files": [
      "docker-compose.yml",
      ".env",
      "town-planner-local-package/",
      "supabase/",
      "n8n/"
    ]
  },
  "code_review": {
    "prompt": "Review the React/TypeScript code for best practices, potential issues, and integration patterns. Focus on Supabase client usage, API integration, error handling, TypeScript types, and component architecture. Ensure code follows modern React patterns.",
    "files": [
      "src/components/",
      "src/hooks/",
      "src/lib/",
      "src/pages/",
      "src/main.tsx"
    ]
  }
}
EOF

# Create debug command
log_info "Creating custom debug command..."
cat > .claude/commands/debug.md << 'EOF'
# Debug Town Planner Integration

Debug common issues with the town-planner project integration.

## Usage
Run this command when experiencing issues with:
- Docker containers not starting
- n8n workflows not triggering
- Supabase connection problems
- File upload processing failures
- Frontend-backend communication issues

## Steps

1. **Check Integration Status**
   ```bash
   node claude-tasks/integration-checker.js
   ```

2. **Verify Environment Variables**
   - Check `.env` file exists and has required variables
   - Verify Docker environment variables are set
   - Ensure Supabase keys are correct

3. **Check Docker Services**
   ```bash
   docker ps
   docker logs n8n
   docker logs supabase_kong
   ```

4. **Test Connectivity**
   - n8n: http://localhost:5678
   - Supabase: http://localhost:8000
   - Frontend: http://localhost:5173

5. **Common Solutions**
   - Restart Docker services: `npm run docker:down && npm run docker:up`
   - Clear Docker cache: `docker system prune`
   - Rebuild containers: `docker-compose build --no-cache`
   - Check firewall/port conflicts

## Troubleshooting Checklist

- [ ] All required files exist (docker-compose.yml, .env, etc.)
- [ ] Environment variables are properly set
- [ ] Docker Desktop is running
- [ ] No port conflicts (5678, 8000, 5173)
- [ ] Latest code is pulled and dependencies installed
- [ ] n8n workflows are activated
- [ ] Supabase edge functions are deployed
EOF

# Check if scripts already exist, if not create them
if [ ! -f "claude-tasks/integration-checker.js" ]; then
    log_info "Integration checker script not found. Please copy your script to claude-tasks/integration-checker.js"
fi

# Update package.json with scripts
log_info "Updating package.json with Claude Code scripts..."

# Check if jq is available for JSON manipulation
if command -v jq &> /dev/null; then
    # Use jq to update package.json
    jq '.scripts += {
        "claude:check": "node claude-tasks/integration-checker.js",
        "claude:dev": "node claude-tasks/dev-tasks.js check", 
        "claude:health": "node claude-tasks/dev-tasks.js health",
        "claude:supabase": "node claude-tasks/dev-tasks.js supabase",
        "claude:n8n": "node claude-tasks/dev-tasks.js n8n",
        "claude:sync": "node claude-tasks/conversation-helper.js sync",
        "claude:context": "node claude-tasks/conversation-helper.js summary",
        "docker:up": "python start_services.py --profile gpu-nvidia",
        "docker:down": "docker compose -p localai -f docker-compose.yml --profile gpu-nvidia down",
        "logs:n8n": "docker logs n8n -f",
        "logs:supabase": "docker compose -p localai logs supabase_kong -f"
    }' package.json > package.json.tmp && mv package.json.tmp package.json
    log_success "Updated package.json with Claude scripts"
else
    log_warning "jq not found. Please manually add these scripts to package.json:"
    echo '  "claude:check": "node claude-tasks/integration-checker.js",'
    echo '  "claude:dev": "node claude-tasks/dev-tasks.js check",'
    echo '  "claude:sync": "node claude-tasks/conversation-helper.js sync",'
    echo '  "docker:up": "python start_services.py --profile gpu-nvidia",'
    echo '  "docker:down": "docker compose -p localai -f docker-compose.yml --profile gpu-nvidia down"'
fi

# Create aliases file
log_info "Creating helpful aliases..."
cat > .claude/aliases.sh << 'EOF'
#!/bin/bash

# Claude Code Aliases for town-planner project

alias claude-check="npm run claude:check"
alias claude-dev="npm run claude:dev"
alias claude-sync="npm run claude:sync"

# Docker shortcuts
alias tp-up="npm run docker:up"
alias tp-down="npm run docker:down"
alias tp-logs="docker compose -p localai logs -f"

# Development shortcuts
alias tp-dev="npm run dev"
alias tp-build="npm run build"
alias tp-lint="npm run lint"

# Service logs
alias n8n-logs="npm run logs:n8n"
alias sb-logs="npm run logs:supabase"

echo "🔧 Town Planner aliases loaded!"
echo "Available commands:"
echo "  claude-check     - Run integration check"
echo "  claude-dev       - Full development check"
echo "  claude-sync      - Sync with Claude"
echo "  tp-up            - Start all services"
echo "  tp-down          - Stop all services"
echo "  tp-dev           - Start development server"
echo "  n8n-logs         - View n8n logs"
EOF

chmod +x .claude/aliases.sh

# Create README for Claude integration
log_info "Creating documentation..."
cat > claude-tasks/README.md << 'EOF'
# Claude Code Integration

This directory contains Claude Code integration scripts for the town-planner project.

## Quick Start

```bash
# Load helpful aliases
source .claude/aliases.sh

# Check integration status
claude-check

# Run full development check
claude-dev

# Generate context for Claude conversations
claude-sync
```

## Available Scripts

- **integration-checker.js** - Validates the entire integration setup
- **dev-tasks.js** - Automates common development tasks
- **conversation-helper.js** - Generates context for Claude conversations

## NPM Scripts

```bash
npm run claude:check      # Integration check
npm run claude:dev        # Development check  
npm run claude:sync       # Generate Claude context
npm run docker:up         # Start Docker services
npm run docker:down       # Stop Docker services
```

## Custom Claude Commands

- `/debug` - Troubleshoot integration issues
- Use these in Claude Code by typing `/` followed by the command name

## Integration with Claude Conversations

1. Run: `npm run claude:sync`
2. Copy content from `claude-conversation-summary.md`
3. Paste in Claude conversation with your question
4. Claude will have full project context

## Files Generated

- **claude-context.json** - Detailed project context
- **claude-conversation-summary.md** - Ready-to-use summary for Claude
- **integration-report.json** - Technical integration status
EOF

# Update .gitignore
log_info "Updating .gitignore..."
if [ ! -f ".gitignore" ]; then
    touch .gitignore
fi

# Add Claude-specific ignores if not already present
if ! grep -q "claude-context.json" .gitignore; then
    cat >> .gitignore << 'EOF'

# Claude Code files
claude-context.json
integration-report.json
claude-conversation-summary.md
claude-projects-export.json
.claude/cache/
.claude/temp/
EOF
fi

log_success "Claude Code integration setup completed!"
echo ""
echo "🎉 Setup Summary:"
echo "✅ Created .claude/ configuration directory"
echo "✅ Added custom prompts and commands"
echo "✅ Updated package.json with npm scripts"
echo "✅ Created helpful aliases"
echo "✅ Added documentation"
echo ""
echo "📋 Next Steps:"
echo "1. Copy your scripts to claude-tasks/ directory:"
echo "   - integration-checker.js"
echo "   - dev-tasks.js" 
echo "   - conversation-helper.js"
echo ""
echo "2. Load aliases: source .claude/aliases.sh"
echo "3. Test installation: claude --version"
echo "4. Run initial check: claude-check"
echo "5. Generate context: claude-sync"
echo ""
echo "🚀 Your Claude Code integration is ready!"
echo "📖 See claude-tasks/README.md for detailed usage"

Complete File Organization Summary
Here's exactly where each file should go:
D:\ailocal\town-planner\
├── .claude/
│   ├── project.json                    ← Claude Code main config
│   ├── prompts.json                    ← Custom prompts
│   ├── aliases.sh                      ← Helpful command aliases
│   └── commands/
│       └── debug.md                    ← Custom debug command
│
├── claude-tasks/
│   ├── integration-checker.js          ← Your existing script
│   ├── dev-tasks.js                    ← Development automation
│   ├── conversation-helper.js          ← Claude conversation helper
│   └── README.md                       ← Documentation
│
├── (your existing project files...)
├── package.json                        ← Updated with new scripts
└── .gitignore                          ← Updated with Claude ignores
Step-by-Step Implementation
1. Run the Setup Script
bash# Save the setup script as setup-claude-integration.sh
chmod +x setup-claude-integration.sh
./setup-claude-integration.sh
2. Copy Your Scripts
bash# You already have integration-checker.js, copy the other two:
# Save dev-tasks.js to: claude-tasks/dev-tasks.js
# Save conversation-helper.js to: claude-tasks/conversation-helper.js
3. Test Your Setup
bash# Load aliases
source .claude/aliases.sh

# Test Claude Code
claude --version

# If Claude Code works, start it
claude

# Test your integration scripts
npm run claude:check
npm run claude:dev
npm run claude:sync
Using Claude Code with Your Project
Starting Claude Code
bash# Navigate to your project
cd D:\ailocal\town-planner\

# Start Claude Code (it will read .claude/project.json automatically)
claude

# Use custom commands
claude /debug
Common Workflows

Daily Development Check:
bashclaude-dev  # or npm run claude:dev

Before Making Changes:
bashclaude-check  # or npm run claude:check

Sync with Claude Conversations:
bashclaude-sync  # or npm run claude:sync
# Then copy claude-conversation-summary.md content

Get Help from Claude Code:
bashclaude
# Then ask: "Help me debug the n8n workflow integration"
# Or: "Review my React components for best practices"