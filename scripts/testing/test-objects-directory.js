const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🎯 Testing the /objects directory specifically...');

const mountPoint = '/home/refinio/one-files';
const objectsPath = path.join(mountPoint, 'objects');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function testObjectsDirectory() {
  console.log('\n📁 Testing /objects directory for ONE objects...');
  console.log('='.repeat(60));
  
  try {
    // Check if mount point exists
    const mountStats = fs.statSync(mountPoint);
    console.log(`✅ Mount point exists: ${mountPoint}`);
    
    // List root contents
    const rootItems = fs.readdirSync(mountPoint);
    console.log(`📋 Root directory contents (${rootItems.length} items):`, rootItems);
    
    // Check if objects directory exists
    if (rootItems.includes('objects')) {
      console.log(`\n✅ /objects directory found! Exploring contents...`);
      
      const objectsStats = fs.statSync(objectsPath);
      console.log(`📊 /objects directory stats:`, {
        isDirectory: objectsStats.isDirectory(),
        size: objectsStats.size,
        mode: objectsStats.mode
      });
      
      // List objects directory contents
      const objectItems = fs.readdirSync(objectsPath);
      console.log(`\n📦 Objects directory contents (${objectItems.length} items):`);
      
      if (objectItems.length > 0) {
        console.log('🎉 Found ONE objects!');
        
        // Show first 20 object hashes
        objectItems.slice(0, 20).forEach((item, index) => {
          const itemPath = path.join(objectsPath, item);
          try {
            const stats = fs.statSync(itemPath);
            console.log(`  ${index + 1}. ${item} (${stats.size} bytes)`);
          } catch (e) {
            console.log(`  ${index + 1}. ${item} (Error: ${e.message})`);
          }
        });
        
        if (objectItems.length > 20) {
          console.log(`  ... and ${objectItems.length - 20} more objects`);
        }
        
        // Try to read one of the objects
        if (objectItems.length > 0) {
          const testObjectPath = path.join(objectsPath, objectItems[0]);
          try {
            const content = fs.readFileSync(testObjectPath);
            console.log(`\n📄 Sample object content (first 100 bytes):`);
            console.log(content.slice(0, 100).toString('hex'));
          } catch (e) {
            console.log(`\n❌ Error reading object: ${e.message}`);
          }
        }
        
      } else {
        console.log('📭 Objects directory is empty');
      }
      
    } else {
      console.log(`\n❌ /objects directory not found in root`);
      console.log('🔍 Available directories:', rootItems.filter(item => {
        try {
          return fs.statSync(path.join(mountPoint, item)).isDirectory();
        } catch (e) {
          return false;
        }
      }));
    }
    
  } catch (e) {
    console.log(`❌ Error accessing filesystem: ${e.message}`);
  }
}

async function startAppAndTestObjects() {
  console.log('🚀 Starting application to test objects exposure...');
  
  // Start the application with logging enabled
  const app = spawn('node', ['lib/index.js', 'start', '-c', 'configs/filer.json', '--secret', 'test123'], {
    cwd: '/mnt/c/Users/juerg/source/one.filer',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  let appReady = false;
  
  app.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📱 App:', output.trim());
    
    if (output.includes('Replicant started')) {
      appReady = true;
    }
  });
  
  app.stderr.on('data', (data) => {
    console.log('🔥 App Error:', data.toString().trim());
  });
  
  // Wait for app to start
  console.log('⏳ Waiting for application to be ready...');
  let attempts = 0;
  while (!appReady && attempts < 30) {
    await sleep(1000);
    attempts++;
    
    // Test if filesystem is ready
    try {
      fs.statSync(mountPoint);
      console.log(`🎯 Mount detected (attempt ${attempts}), checking objects...`);
      
      // Check if objects directory is ready
      try {
        fs.statSync(objectsPath);
        console.log('✅ Objects directory detected, testing...');
        break;
      } catch (e) {
        // Objects directory not ready yet
      }
    } catch (e) {
      // Mount not ready yet
    }
  }
  
  if (attempts >= 30) {
    console.log('❌ Application failed to start within 30 seconds');
    app.kill();
    return;
  }
  
  // Test the objects directory
  testObjectsDirectory();
  
  // Give it a moment
  await sleep(3000);
  
  console.log('\n🛑 Stopping application...');
  app.kill();
  
  // Wait for cleanup
  await sleep(1000);
}

startAppAndTestObjects().catch(console.error); 