// Test the real application 
const { spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 Testing REAL one.filer application...');

const mountPoint = '/home/refinio/one-files';

function testMountedContent() {
  try {
    console.log('🔍 Testing mounted content...');
    
    // Check if mount point exists and is accessible
    const stats = fs.statSync(mountPoint);
    console.log(`✅ Mount point exists and accessible`);
    
    // List root contents
    const items = fs.readdirSync(mountPoint);
    console.log(`📋 Root directory contains ${items.length} items:`, items);
    
    if (items.includes('objects')) {
      console.log('🎯 Found /objects directory!');
      const objectItems = fs.readdirSync(`${mountPoint}/objects`);
      console.log(`📦 Objects directory contains ${objectItems.length} items`);
      console.log('First 5 objects:', objectItems.slice(0, 5));
      
      if (objectItems.length > 0) {
        console.log('✅ SUCCESS: ONE objects are accessible via FUSE!');
        return true;
      }
    }
    
    if (items.includes('debug')) {
      console.log('🔍 Found /debug directory!');
      const debugItems = fs.readdirSync(`${mountPoint}/debug`);
      console.log(`🐛 Debug directory contains ${debugItems.length} items:`, debugItems);
    }
    
    return items.length > 0;
  } catch (error) {
    console.log('❌ Error accessing mounted content:', error.message);
    return false;
  }
}

async function main() {
  console.log('📡 Starting REAL application...');
  
  // Use the actual built application
  const app = spawn('node', ['lib/index.js', 'start', '-c', 'configs/filer.json', '--secret', 'test123'], {
    cwd: '/mnt/c/Users/juerg/source/one.filer',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  let success = false;
  let hasOutput = false;
  
  app.stdout.on('data', (data) => {
    const output = data.toString();
    hasOutput = true;
    console.log('📤 APP:', output.trim());
    
    // When we see mount message, test the content
    if (output.includes('mounted at') || output.includes('started successfully')) {
      console.log('✅ App seems to be running, waiting 3 seconds then testing...');
      
      setTimeout(() => {
        success = testMountedContent();
        
        if (success) {
          console.log('🎉 SUCCESS: Real application is working correctly!');
        } else {
          console.log('❌ FAILED: Content not accessible');
        }
        
        // Clean shutdown
        console.log('🛑 Sending shutdown signal...');
        app.kill('SIGINT');
      }, 3000);
    }
  });
  
  app.stderr.on('data', (data) => {
    console.log('📥 ERR:', data.toString().trim());
  });
  
  app.on('exit', (code, signal) => {
    console.log(`📴 Application exited with code ${code}, signal ${signal}`);
    console.log(`📊 Final result: ${success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`📊 Had output: ${hasOutput}`);
    process.exit(success ? 0 : 1);
  });
  
  // After 10 seconds, try testing even if no specific message was seen
  setTimeout(() => {
    if (!success) {
      console.log('⏰ 10 seconds passed, testing anyway...');
      success = testMountedContent();
      
      if (success) {
        console.log('🎉 SUCCESS: Application works even without expected output!');
        app.kill('SIGINT');
      }
    }
  }, 10000);
  
  // Safety timeout
  setTimeout(() => {
    console.log('⏰ Final timeout reached, killing application...');
    app.kill('SIGTERM');
  }, 30000);
}

main(); 