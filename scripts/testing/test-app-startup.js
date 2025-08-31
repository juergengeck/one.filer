const { execSync } = require('child_process');

console.log('🔍 Testing application startup step by step...');

try {
  console.log('1. Building application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('\n2. Testing basic startup...');
  const output = execSync('node lib/index.js start -c configs/filer.json --secret "test123"', 
    { encoding: 'utf-8', timeout: 10000 });
  
  console.log('Application output:', output);
  
} catch (error) {
  console.log('\n❌ Error during startup:');
  console.log('Exit code:', error.status);
  console.log('stdout:', error.stdout);
  console.log('stderr:', error.stderr);
} 