console.log('🔬 Testing FUSE persistence issue...');

// Test basic FUSE mounting to see what happens
const { spawn } = require('child_process');

console.log('Starting application with explicit stay-alive mechanism...');

const app = spawn('node', ['-e', `
  console.log('🚀 Starting stay-alive test...');
  
  // Start the application
  const { initOneCoreInstance } = require('./lib/misc/OneCoreInit.js');
  const Replicant = require('./lib/Replicant.js').default;
  const { readJsonFileOrEmpty } = require('./lib/misc/configHelper.js');
  const { checkReplicantConfig } = require('./lib/ReplicantConfig.js');
  
  async function testApp() {
    try {
      const config = await readJsonFileOrEmpty('configs/filer.json');
      const replicantConfig = checkReplicantConfig(config);
      const replicant = new Replicant(replicantConfig);
      
      console.log('📡 Starting replicant...');
      await replicant.start('test123');
      
      console.log('✅ Replicant started successfully');
      console.log('⏳ Keeping alive with interval...');
      
      // Keep the process alive with a timer
      const keepAlive = setInterval(() => {
        console.log('💓 Still alive...');
      }, 5000);
      
      // Handle shutdown
      process.on('SIGINT', async () => {
        console.log('🛑 Shutting down...');
        clearInterval(keepAlive);
        await replicant.stop();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
  
  testApp();
`], { 
  stdio: 'inherit',
  cwd: '/mnt/c/Users/juerg/source/one.filer'
});

// Let it run for 15 seconds then kill it
setTimeout(() => {
  console.log('\\n🔍 Sending SIGINT after 15 seconds...');
  app.kill('SIGINT');
}, 15000); 