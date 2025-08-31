// Test the running application properly
const { spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 Testing running FUSE application...');

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
  console.log('📡 Starting application...');
  
  const app = spawn('node', ['debug-startup.js'], {
    cwd: '/mnt/c/Users/juerg/source/one.filer',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  let success = false;
  
  app.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📤 APP:', output.trim());
    
    // When we see FUSE mounted, test the content
    if (output.includes('FUSE filesystem mounted successfully')) {
      console.log('✅ FUSE mounted, waiting 2 seconds then testing...');
      
      setTimeout(() => {
        success = testMountedContent();
        
        if (success) {
          console.log('🎉 SUCCESS: Application is working correctly!');
        } else {
          console.log('❌ FAILED: Content not accessible');
        }
        
        // Clean shutdown
        console.log('🛑 Sending shutdown signal...');
        app.kill('SIGINT');
      }, 2000);
    }
  });
  
  app.stderr.on('data', (data) => {
    console.log('📥 ERR:', data.toString().trim());
  });
  
  app.on('exit', (code, signal) => {
    console.log(`📴 Application exited with code ${code}, signal ${signal}`);
    console.log(`📊 Final result: ${success ? 'SUCCESS' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  });
  
  // Safety timeout
  setTimeout(() => {
    console.log('⏰ Timeout reached, killing application...');
    app.kill('SIGTERM');
  }, 30000);
}

main(); 