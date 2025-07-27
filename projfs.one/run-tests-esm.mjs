#!/usr/bin/env node

import { execSync } from 'child_process';
import { readdir } from 'fs/promises';
import { join } from 'path';

console.log('🧪 ProjFS.ONE Test Runner (ESM TypeScript)\n');

// Function to run tests with proper ESM/TypeScript support
async function runTests() {
    const testDirs = ['test/unit', 'test/integration', 'test/performance'];
    const results = { passed: 0, failed: 0 };
    
    for (const dir of testDirs) {
        try {
            const files = await readdir(dir).catch(() => []);
            const testFiles = files.filter(f => f.endsWith('.test.ts'));
            
            if (testFiles.length === 0) {
                console.log(`⚠️  No tests found in ${dir}\n`);
                continue;
            }
            
            console.log(`\n📁 Running ${dir.split('/')[1]} tests...`);
            console.log('─'.repeat(60));
            
            const timeout = dir.includes('performance') ? 60000 : 30000;
            const pattern = join(dir, '**/*.test.ts');
            
            try {
                // First, let's compile TypeScript to check for errors
                execSync('npx tsc --noEmit', { stdio: 'inherit' });
                
                // Run tests using Node with tsx loader
                execSync(
                    `node --loader tsx --no-warnings=ExperimentalWarning node_modules/.bin/mocha "${pattern}" --timeout ${timeout}`,
                    { stdio: 'inherit' }
                );
                results.passed += testFiles.length;
            } catch (error) {
                results.failed += testFiles.length;
                console.error(`\n❌ Tests in ${dir} failed`);
            }
        } catch (error) {
            console.log(`⚠️  Could not read ${dir}`);
        }
    }
    
    // Summary
    console.log('\n\n📊 Test Summary');
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${results.passed} test files`);
    console.log(`❌ Failed: ${results.failed} test files`);
    
    if (results.failed > 0) {
        console.log('\n❌ Some tests failed');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    }
}

// Check if tsx is available
try {
    execSync('npx tsx --version', { stdio: 'ignore' });
} catch (error) {
    console.error('❌ tsx is not installed. Please run: npm install --save-dev tsx');
    process.exit(1);
}

runTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
});