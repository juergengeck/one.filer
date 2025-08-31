const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Starting application and testing filesystem exposure...');

const mountPoint = '/home/refinio/one-files';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function exploreDirectory(dirPath, level = 0) {
  const indent = '  '.repeat(level);
  
  try {
    const items = fs.readdirSync(dirPath);
    console.log(`${indent}📁 ${path.basename(dirPath) || 'root'}/ (${items.length} items)`);
    
    for (const item of items.slice(0, 10)) { // Limit to first 10 items
      const itemPath = path.join(dirPath, item);
      
      try {
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          console.log(`${indent}  📁 ${item}/`);
          if (level < 2) { // Limit depth
            exploreDirectory(itemPath, level + 1);
          }
        } else if (stats.isFile()) {
          console.log(`${indent}  📄 ${item} (${stats.size} bytes)`);
        }
      } catch (e) {
        console.log(`${indent}  ❌ ${item} (Error: ${e.message})`);
      }
    }
    
    if (items.length > 10) {
      console.log(`${indent}  ... and ${items.length - 10} more items`);
    }
  } catch (e) {
    console.log(`${indent}❌ Error reading directory: ${e.message}`);
  }
}

async function testFilesystem() {
  console.log('\n🔍 Testing mounted filesystem...');
  console.log('='.repeat(50));
  
  // Check if mount point exists
  try {
    const stats = fs.statSync(mountPoint);
    console.log(`✅ Mount point exists: ${mountPoint}`);
    
    exploreDirectory(mountPoint);
    
  } catch (e) {
    console.log(`❌ Mount point not accessible: ${e.message}`);
  }
}

async function startAppAndTest() {
  console.log('🚀 Starting one.filer application...');
  
  // Start the application
  const app = spawn('node', ['lib/index.js', 'start', '-c', 'configs/filer.json', '--secret', 'test123'], {
    cwd: '/mnt/c/Users/juerg/source/one.filer',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  let appReady = false;
  
  app.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📱 App:', output.trim());
    
    if (output.includes('Replicant started') || output.includes('FUSE mount successful')) {
      appReady = true;
    }
  });
  
  app.stderr.on('data', (data) => {
    console.log('🔥 App Error:', data.toString().trim());
  });
  
  // Wait for app to start
  console.log('⏳ Waiting for application to start...');
  let attempts = 0;
  while (!appReady && attempts < 20) {
    await sleep(1000);
    attempts++;
    
    // Test if filesystem is ready
    try {
      fs.statSync(mountPoint);
      console.log('🎯 Mount point detected, testing filesystem...');
      break;
    } catch (e) {
      // Mount not ready yet
    }
  }
  
  if (attempts >= 20) {
    console.log('❌ Application failed to start within 20 seconds');
    app.kill();
    return;
  }
  
  // Test the filesystem
  await testFilesystem();
  
  // Give it a moment to see results
  await sleep(2000);
  
  console.log('\n🛑 Stopping application...');
  app.kill();
  
  // Wait for cleanup
  await sleep(1000);
}

startAppAndTest().catch(console.error); 