#!/usr/bin/env node

/**
 * Claude Code Integration Checker
 * Validates the town-planner integration with local-ai-packaged
 */

const fs = require('fs');
const path = require('path');

class IntegrationChecker {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
  }

  checkFile(filePath, description) {
    if (fs.existsSync(filePath)) {
      this.results.passed.push(`✅ ${description}: ${filePath}`);
      return true;
    } else {
      this.results.failed.push(`❌ ${description}: ${filePath} not found`);
      return false;
    }
  }

  checkDirectory(dirPath, description) {
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      this.results.passed.push(`✅ ${description}: ${dirPath}`);
      return true;
    } else {
      this.results.failed.push(`❌ ${description}: ${dirPath} not found`);
      return false;
    }
  }

  checkEnvVariables() {
    this.log('Checking environment variables...');
    
    const requiredEnvVars = [
      'POSTGRES_PASSWORD',
      'JWT_SECRET',
      'ANON_KEY',
      'SERVICE_ROLE_KEY',
      'N8N_ENCRYPTION_KEY'
    ];

    if (this.checkFile('.env', 'Main environment file')) {
      const envContent = fs.readFileSync('.env', 'utf8');
      
      requiredEnvVars.forEach(varName => {
        if (envContent.includes(`${varName}=`)) {
          this.results.passed.push(`✅ Environment variable: ${varName}`);
        } else {
          this.results.failed.push(`❌ Missing environment variable: ${varName}`);
        }
      });

      // Check for town-planner specific variables
      const townPlannerVars = [
        'TOWN_PLANNER_CHAT_URL',
        'TOWN_PLANNER_INGEST_URL',
        'TOWN_PLANNER_WEBHOOK_AUTH'
      ];

      townPlannerVars.forEach(varName => {
        if (envContent.includes(`${varName}=`)) {
          this.results.passed.push(`✅ Town Planner variable: ${varName}`);
        } else {
          this.results.warnings.push(`⚠️  Optional Town Planner variable: ${varName}`);
        }
      });
    }
  }

  checkDockerConfiguration() {
    this.log('Checking Docker configuration...');
    
    // Check main docker-compose.yml
    if (this.checkFile('docker-compose.yml', 'Main Docker Compose file')) {
      const composeContent = fs.readFileSync('docker-compose.yml', 'utf8');
      
      if (composeContent.includes('town-planner:')) {
        this.results.passed.push('✅ Town Planner service found in docker-compose.yml');
      } else {
        this.results.failed.push('❌ Town Planner service not found in docker-compose.yml');
      }
    }

    // Check town-planner-local-package structure
    this.checkDirectory('town-planner-local-package', 'Town Planner package directory');
    this.checkFile('town-planner-local-package/Dockerfile', 'Town Planner Dockerfile');
    this.checkFile('town-planner-local-package/docker-compose.copy.yml', 'Town Planner Docker Compose copy');
  }

  checkSupabaseConfiguration() {
    this.log('Checking Supabase configuration...');
    
    this.checkDirectory('supabase', 'Supabase directory');
    this.checkFile('supabase-migration.sql', 'Database migration file');
    
    // Check edge functions
    const functionsDir = 'supabase/functions';
    if (this.checkDirectory(functionsDir, 'Supabase functions directory')) {
      const functions = ['tp-proxy', 'tp-process-document', 'tp-chat'];
      functions.forEach(func => {
        this.checkFile(`${functionsDir}/${func}/index.ts`, `${func} edge function`);
      });
    }

    // Check Supabase Docker configuration
    this.checkFile('supabase/docker/docker-compose.yml', 'Supabase Docker Compose');
  }

  checkN8nWorkflows() {
    this.log('Checking n8n workflows...');
    
    if (this.checkDirectory('n8n', 'N8N workflows directory')) {
      const workflowFiles = fs.readdirSync('n8n').filter(file => file.endsWith('.json'));
      
      if (workflowFiles.length > 0) {
        this.results.passed.push(`✅ Found ${workflowFiles.length} n8n workflow files`);
        workflowFiles.forEach(file => {
          this.log(`  - ${file}`, 'info');
        });
      } else {
        this.results.warnings.push('⚠️  No n8n workflow files found');
      }
    }
  }

  checkProjectStructure() {
    this.log('Checking project structure...');
    
    const requiredDirs = [
      'src',
      'src/components',
      'src/hooks',
      'src/lib'
    ];

    const requiredFiles = [
      'package.json',
      'vite.config.ts',
      'tsconfig.json',
      'src/main.tsx'
    ];

    requiredDirs.forEach(dir => {
      this.checkDirectory(dir, `Source directory: ${dir}`);
    });

    requiredFiles.forEach(file => {
      this.checkFile(file, `Required file: ${file}`);
    });
  }

  generateReport() {
    this.log('\n=== INTEGRATION STATUS REPORT ===\n');
    
    console.log('\n🟢 PASSED CHECKS:');
    this.results.passed.forEach(item => console.log(`  ${item}`));
    
    if (this.results.warnings.length > 0) {
      console.log('\n🟡 WARNINGS:');
      this.results.warnings.forEach(item => console.log(`  ${item}`));
    }
    
    if (this.results.failed.length > 0) {
      console.log('\n🔴 FAILED CHECKS:');
      this.results.failed.forEach(item => console.log(`  ${item}`));
    }

    const totalChecks = this.results.passed.length + this.results.failed.length;
    const successRate = Math.round((this.results.passed.length / totalChecks) * 100);
    
    console.log(`\n📊 SUCCESS RATE: ${successRate}% (${this.results.passed.length}/${totalChecks})`);
    
    if (this.results.failed.length === 0) {
      console.log('\n🎉 ALL CRITICAL CHECKS PASSED! Ready for development.');
    } else {
      console.log('\n⚠️  Some checks failed. Review the issues above before proceeding.');
    }

    // Save report to file
    const report = {
      timestamp: new Date().toISOString(),
      successRate,
      results: this.results
    };
    
    fs.writeFileSync('integration-report.json', JSON.stringify(report, null, 2));
    console.log('\n📝 Detailed report saved to: integration-report.json');
  }

  run() {
    this.log('Starting integration check...');
    
    this.checkProjectStructure();
    this.checkEnvVariables();
    this.checkDockerConfiguration();
    this.checkSupabaseConfiguration();
    this.checkN8nWorkflows();
    
    this.generateReport();
  }
}

// Run the checker
if (require.main === module) {
  const checker = new IntegrationChecker();
  checker.run();
}

module.exports = IntegrationChecker;