#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ProjFSAvailability } from '../src/utils/ProjFSAvailability.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

console.log('🧪 Running ProjFS.ONE Tests\n');

// Check ProjFS availability first
console.log('🔍 Checking ProjFS availability...');
const availability = await ProjFSAvailability.isAvailable();

if (!availability.available) {
    console.error('❌ ProjFS is not available on this system');
    console.error(`   Reason: ${availability.reason}`);
    if (availability.details) {
        console.error('   Details:', JSON.stringify(availability.details, null, 2));
    }
    console.error('\n💡 To enable ProjFS on Windows:');
    console.error('   1. Run PowerShell as Administrator');
    console.error('   2. Execute: Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS');
    console.error('   3. Restart if prompted\n');
    
    // Get system info for debugging
    const systemInfo = await ProjFSAvailability.getSystemInfo();
    console.error('📋 System Information:');
    console.error(JSON.stringify(systemInfo, null, 2));
    
    process.exit(1);
}

console.log('✅ ProjFS is available');
console.log('   Details:', JSON.stringify(availability.details, null, 2));
console.log('');

// Function to run a test file
function runTest(testFile, category) {
    console.log(`\n📁 Running ${category} tests: ${testFile}`);
    console.log('─'.repeat(60));
    
    try {
        // First compile the test file
        execSync(`npx tsc ${testFile} --outDir dist-test --module commonjs --target es2022 --esModuleInterop --allowSyntheticDefaultImports`, {
            cwd: projectRoot,
            stdio: 'inherit'
        });
        
        // Then run it with mocha
        const jsFile = testFile.replace('/test/', '/dist-test/test/').replace('.ts', '.js');
        execSync(`npx mocha ${jsFile} --reporter spec`, {
            cwd: projectRoot,
            stdio: 'inherit'
        });
        
        return true;
    } catch (error) {
        console.error(`❌ Failed to run ${testFile}`);
        return false;
    }
}

// Get all test files
const testDirs = ['test/unit', 'test/integration', 'test/performance'];
const results = {
    passed: [],
    failed: []
};

for (const dir of testDirs) {
    const fullDir = join(projectRoot, dir);
    try {
        const files = readdirSync(fullDir)
            .filter(f => f.endsWith('.test.ts'))
            .map(f => join(dir, f));
        
        for (const file of files) {
            const category = dir.split('/')[1];
            const success = runTest(file, category);
            
            if (success) {
                results.passed.push(file);
            } else {
                results.failed.push(file);
            }
        }
    } catch (e) {
        console.log(`⚠️  No tests found in ${dir}`);
    }
}

// Summary
console.log('\n\n📊 Test Summary');
console.log('═'.repeat(60));
console.log(`✅ Passed: ${results.passed.length} test files`);
console.log(`❌ Failed: ${results.failed.length} test files`);

if (results.failed.length > 0) {
    console.log('\n❌ Failed tests:');
    results.failed.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
} else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
}