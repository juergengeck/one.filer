const { spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 Testing FUSE application with proper logging...');

const mountPoint = '/home/refinio/one-files';

function testMountedContent() {
  try {
    console.log('🔍 Testing mounted content...');
    
    // Check if mount point exists
    const stats = fs.statSync(mountPoint);
    console.log(`✅ Mount point exists and accessible`);
    
    // List root contents
    const items = fs.readdirSync(mountPoint);
    console.log(`📋 Root directory contains ${items.length} items:`, items);
    
    if (items.includes('objects')) {
      console.log('🎯 Found /objects directory!');
      const objectItems = fs.readdirSync(`${mountPoint}/objects`);
      console.log(`📦 Objects directory contains ${objectItems.length} items`);
      console.log('First 10 objects:', objectItems.slice(0, 10));
    }
    
    if (items.includes('debug')) {
      console.log('🔍 Found /debug directory!');
      const debugItems = fs.readdirSync(`${mountPoint}/debug`);
      console.log(`🐛 Debug directory contains ${debugItems.length} items:`, debugItems);
    }
    
    return true;
  } catch (error) {
    console.log('❌ Error accessing mounted content:', error.message);
    return false;
  }
}

function startApplication() {
  return new Promise((resolve, reject) => {
    console.log('📡 Starting application...');
    
    const app = spawn('node', ['lib/index.js', 'start', '-c', 'configs/filer.json', '--secret', 'test123'], {
      cwd: '/mnt/c/Users/juerg/source/one.filer',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdoutData = '';
    let stderrData = '';
    
    app.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutData += output;
      console.log('📤 STDOUT:', output.trim());
      
      // Check for successful mount message
      if (output.includes('Filer file system was mounted at')) {
        console.log('✅ FUSE mounted successfully!');
        
        // Wait a moment for mount to stabilize, then test
        setTimeout(() => {
          const success = testMountedContent();
          if (success) {
            console.log('🎉 SUCCESS: ONE content is properly exposed!');
          }
          resolve({ success, stdout: stdoutData, stderr: stderrData });
        }, 2000);
      }
    });
    
    app.stderr.on('data', (data) => {
      const output = data.toString();
      stderrData += output;
      console.log('📥 STDERR:', output.trim());
    });
    
    app.on('error', (error) => {
      console.log('❌ Process error:', error.message);
      reject(error);
    });
    
    app.on('exit', (code, signal) => {
      console.log(`📴 Process exited with code ${code}, signal ${signal}`);
      resolve({ success: false, code, signal, stdout: stdoutData, stderr: stderrData });
    });
    
    // Set a timeout
    setTimeout(() => {
      if (!app.killed) {
        console.log('⏰ Timeout reached, killing process...');
        app.kill('SIGTERM');
        resolve({ success: false, timeout: true, stdout: stdoutData, stderr: stderrData });
      }
    }, 15000);
  });
}

async function main() {
  try {
    const result = await startApplication();
    console.log('📊 Final result:', {
      success: result.success,
      hasOutput: !!result.stdout,
      hasErrors: !!result.stderr
    });
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
  }
}

main(); 