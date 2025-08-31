// Test the root filesystem directly to see what it contains

// Load platform modules first
require('@refinio/one.core/lib/system/load-nodejs.js');

const { initOneCoreInstance, shutdownOneCoreInstance } = require('./lib/misc/OneCoreInit.js');

async function testRootFileSystem() {
  try {
    console.log('🔧 Initializing ONE core instance...');
    await initOneCoreInstance('test123', 'data');
    
    console.log('📊 Testing root filesystem setup...');
    
    // Import the filesystem modules
    const TemporaryFileSystem = require('@refinio/one.models/lib/fileSystems/TemporaryFileSystem').default;
    const ObjectsFileSystem = require('@refinio/one.models/lib/fileSystems/ObjectsFileSystem').default;
    const ChatFileSystem = require('@refinio/one.models/lib/fileSystems/ChatFileSystem').default;
    const DebugFileSystem = require('@refinio/one.models/lib/fileSystems/DebugFileSystem').default;
    const PairingFileSystem = require('@refinio/one.models/lib/fileSystems/PairingFileSystem').default;
    const TypesFileSystem = require('@refinio/one.models/lib/fileSystems/TypesFileSystem').default;
    
    console.log('📁 Creating root filesystem...');
    const rootFileSystem = new TemporaryFileSystem();
    
    console.log('📁 Testing root filesystem before mounting...');
    const beforeMounting = await rootFileSystem.readDir('/');
    console.log('Before mounting:', beforeMounting);
    
    console.log('📁 Creating subsystems...');
    const objectsFileSystem = new ObjectsFileSystem();
    const debugFileSystem = new DebugFileSystem();
    const typesFileSystem = new TypesFileSystem();
    
    console.log('📁 Mounting subsystems...');
    await rootFileSystem.mountFileSystem('/objects', objectsFileSystem);
    console.log('✅ Mounted /objects');
    
    await rootFileSystem.mountFileSystem('/debug', debugFileSystem);
    console.log('✅ Mounted /debug');
    
    await rootFileSystem.mountFileSystem('/types', typesFileSystem);
    console.log('✅ Mounted /types');
    
    console.log('📁 Testing root filesystem after mounting...');
    const afterMounting = await rootFileSystem.readDir('/');
    console.log('After mounting:', afterMounting);
    
    console.log('🔍 Testing individual mounted filesystems...');
    
    try {
      const objectsContent = await objectsFileSystem.readDir('/');
      console.log('Objects filesystem content:', objectsContent);
    } catch (e) {
      console.log('Error reading objects filesystem:', e.message);
    }
    
    try {
      const debugContent = await debugFileSystem.readDir('/');
      console.log('Debug filesystem content:', debugContent);
    } catch (e) {
      console.log('Error reading debug filesystem:', e.message);
    }
    
    console.log('✅ Test complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await shutdownOneCoreInstance();
  }
}

testRootFileSystem(); 