// Debug script to trace exactly where startup hangs

// Load platform modules first
require('@refinio/one.core/lib/system/load-nodejs.js');

console.log('🔧 Step 1: Platform modules loaded');

async function debugStartup() {
  try {
    console.log('🔧 Step 2: Starting debug startup process...');
    
    // Import modules step by step
    console.log('🔧 Step 3: Importing OneCoreInit...');
    const { initOneCoreInstance } = require('./lib/misc/OneCoreInit.js');
    
    console.log('🔧 Step 4: Importing Replicant...');
    const Replicant = require('./lib/Replicant.js').default;
    
    console.log('🔧 Step 5: Importing config helpers...');
    const { readJsonFileOrEmpty } = require('./lib/misc/configHelper.js');
    const { checkReplicantConfig } = require('./lib/ReplicantConfig.js');
    
    console.log('🔧 Step 6: Reading config file...');
    const config = await readJsonFileOrEmpty('configs/filer.json');
    console.log('Config loaded:', Object.keys(config));
    
    console.log('🔧 Step 7: Checking replicant config...');
    const replicantConfig = checkReplicantConfig(config);
    console.log('Replicant config validated');
    
    console.log('🔧 Step 8: Creating Replicant instance...');
    const replicant = new Replicant(replicantConfig);
    console.log('Replicant instance created');
    
    console.log('🔧 Step 9: Starting replicant (this might hang)...');
    console.log('About to call replicant.start()...');
    
    // Add timeout to detect if this hangs
    const startPromise = replicant.start('test123');
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT: replicant.start() took longer than 30 seconds')), 30000);
    });
    
    await Promise.race([startPromise, timeoutPromise]);
    
    console.log('🔧 Step 10: Replicant started successfully!');
    console.log('🔧 Step 11: Application should now be fully running');
    
    // Keep alive
    console.log('🔧 Step 12: Setting up keep-alive...');
    const keepAlive = setInterval(() => {
      console.log('💓 Application still alive...');
    }, 5000);
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log('🛑 Shutting down...');
      clearInterval(keepAlive);
      await replicant.stop();
      process.exit(0);
    });
    
    console.log('✅ Startup complete! Application running...');
    
  } catch (error) {
    console.error('❌ Startup failed at:', error?.message || error);
    console.error('Stack trace:', error?.stack || 'No stack trace');
    process.exit(1);
  }
}

debugStartup(); 