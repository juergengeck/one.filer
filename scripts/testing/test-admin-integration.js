#!/usr/bin/env node

/**
 * Test script for refinio.api and one.filer integration
 * 
 * This script demonstrates:
 * 1. Starting one.filer with admin API enabled
 * 2. Using refinio.cli to manage the filer
 * 
 * Usage:
 *   node test-admin-integration.js
 */

const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    log(`Running: ${command} ${args.join(' ')}`, colors.blue);
    
    const child = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      shell: true,
      ...options
    });
    
    let output = '';
    if (options.silent) {
      child.stdout.on('data', (data) => output += data.toString());
      child.stderr.on('data', (data) => output += data.toString());
    }
    
    child.on('close', (code) => {
      if (code !== 0 && !options.ignoreError) {
        reject(new Error(`Command failed with code ${code}: ${output}`));
      } else {
        resolve(output);
      }
    });
    
    child.on('error', reject);
    
    if (options.detached) {
      // For background processes, resolve immediately
      setTimeout(() => resolve(child), 1000);
    }
  });
}

async function main() {
  log('=== ONE.FILER ADMIN API INTEGRATION TEST ===', colors.green);
  
  try {
    // Step 1: Build the project if needed
    log('\n1. Building projects...', colors.yellow);
    await runCommand('npm', ['run', 'build'], { silent: true });
    log('   ✓ Build completed', colors.green);
    
    // Step 2: Start one.filer with admin API
    log('\n2. Starting one.filer with admin API...', colors.yellow);
    const filerProcess = await runCommand('node', [
      'dist/cli.js',
      'start',
      '-s', 'test-secret',
      '--filer', 'true',
      '--enable-admin-api',
      '--api-port', '3000',
      '--api-host', 'localhost'
    ], { detached: true });
    
    log('   Waiting for services to start...', colors.yellow);
    await sleep(5000);
    log('   ✓ Filer started with admin API', colors.green);
    
    // Step 3: Test CLI commands
    log('\n3. Testing CLI filer commands...', colors.yellow);
    
    // Get status
    log('\n   Getting filer status...', colors.blue);
    await runCommand('node', [
      path.join('refinio.cli', 'dist', 'cli.js'),
      'filer', 'status'
    ]);
    
    // List filesystems
    log('\n   Listing filesystems...', colors.blue);
    await runCommand('node', [
      path.join('refinio.cli', 'dist', 'cli.js'),
      'filer', 'list-fs'
    ]);
    
    // Get filesystem info
    log('\n   Getting /chats filesystem info...', colors.blue);
    await runCommand('node', [
      path.join('refinio.cli', 'dist', 'cli.js'),
      'filer', 'fs-info', '/chats'
    ]);
    
    log('\n   ✓ CLI commands tested successfully', colors.green);
    
    // Step 4: Clean up
    log('\n4. Cleaning up...', colors.yellow);
    if (filerProcess && filerProcess.pid) {
      process.kill(filerProcess.pid);
    }
    log('   ✓ Services stopped', colors.green);
    
    log('\n=== TEST COMPLETED SUCCESSFULLY ===', colors.green);
    
  } catch (error) {
    log(`\nError: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  log('\n\nInterrupted by user', colors.yellow);
  process.exit(0);
});

main();