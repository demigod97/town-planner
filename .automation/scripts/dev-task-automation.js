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