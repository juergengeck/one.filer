// Simple test to check imports
console.log('🔧 Testing imports...');

try {
  console.log('Step 1: Testing Replicant import...');
  const Replicant = require('./lib/Replicant.js');
  console.log('✅ Replicant imported successfully:', !!Replicant);
  console.log('Default export:', !!Replicant.default);
  
  console.log('Step 2: Testing config helpers...');
  const { readJsonFileOrEmpty } = require('./lib/misc/configHelper.js');
  console.log('✅ Config helper imported');
  
  console.log('Step 3: Testing OneCoreInit...');
  const { initOneCoreInstance } = require('./lib/misc/OneCoreInit.js');
  console.log('✅ OneCoreInit imported');
  
  console.log('✅ All imports successful');
  
} catch (error) {
  console.error('❌ Import error:', error.message);
  console.error(error.stack);
} 