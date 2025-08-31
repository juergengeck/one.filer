// Simple script to check what ONE content exists and create test content

// First, load the platform modules
require('@refinio/one.core/lib/system/load-nodejs.js');

const { initOneCoreInstance, shutdownOneCoreInstance } = require('./lib/misc/OneCoreInit.js');

async function checkOneContent() {
  try {
    console.log('🔧 Initializing ONE core instance...');
    await initOneCoreInstance('test123', 'data');
    
    console.log('📊 Checking what ONE content exists...');
    
    // Import storage functions  
    const { listAllObjectHashes } = require('@refinio/one.core/lib/system/storage-base');
    const { getInstanceIdHash } = require('@refinio/one.core/lib/instance');
    
    // Check instance
    const instanceId = getInstanceIdHash();
    console.log(`Instance ID: ${instanceId || 'undefined'}`);
    
    // List objects
    const objects = await listAllObjectHashes();
    console.log(`📦 Found ${objects.length} ONE objects:`);
    
    if (objects.length > 0) {
      console.log('Object hashes:', objects.slice(0, 10)); // Show first 10
      if (objects.length > 10) {
        console.log(`... and ${objects.length - 10} more`);
      }
    } else {
      console.log('🔍 No objects found - this explains why the filesystem is empty!');
      console.log('💡 Creating some test content...');
      
      // Create a simple test object
      const { storeVersionedObject } = require('@refinio/one.core/lib/storage-versioned-objects');
      
      // Create a test person object
      const testPerson = {
        $type$: 'Person',
        name: 'Test User',
        email: 'test@example.com'
      };
      
      const personHash = await storeVersionedObject(testPerson);
      console.log(`✅ Created test Person object: ${personHash}`);
      
      // Create a test file-like object  
      const testFile = {
        $type$: 'File',
        name: 'test.txt',
        content: 'Hello from ONE!'
      };
      
      const fileHash = await storeVersionedObject(testFile);
      console.log(`✅ Created test File object: ${fileHash}`);
      
      // Check again
      const newObjects = await listAllObjectHashes();
      console.log(`📦 Now have ${newObjects.length} objects total`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('🔧 Shutting down ONE core...');
    shutdownOneCoreInstance();
  }
}

checkOneContent().catch(console.error); 