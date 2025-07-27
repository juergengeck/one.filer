#!/usr/bin/env node

import { execSync } from 'child_process';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 ProjFS.ONE Test Runner (Direct TypeScript)\n');

// First, compile all TypeScript files
console.log('📦 Compiling TypeScript...');
try {
    execSync('npx tsc', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ TypeScript compilation successful\n');
} catch (error) {
    console.error('❌ TypeScript compilation failed');
    process.exit(1);
}

// Now run the compiled JavaScript tests
const testCategories = [
    { dir: 'dist/test/unit', name: 'Unit', timeout: 5000 },
    { dir: 'dist/test/integration', name: 'Integration', timeout: 30000 },
    { dir: 'dist/test/performance', name: 'Performance', timeout: 60000 }
];

let totalPassed = 0;
let totalFailed = 0;

for (const category of testCategories) {
    try {
        const files = await readdir(join(__dirname, category.dir)).catch(() => []);
        const testFiles = files.filter(f => f.endsWith('.test.js'));
        
        if (testFiles.length === 0) {
            console.log(`⚠️  No ${category.name} tests found\n`);
            continue;
        }
        
        console.log(`\n📁 Running ${category.name} Tests`);
        console.log('─'.repeat(60));
        
        try {
            execSync(
                `npx mocha "${category.dir}/**/*.test.js" --timeout ${category.timeout}`,
                { stdio: 'inherit', cwd: __dirname }
            );
            totalPassed += testFiles.length;
        } catch (error) {
            totalFailed += testFiles.length;
            console.error(`\n❌ ${category.name} tests failed`);
        }
    } catch (error) {
        console.log(`⚠️  Could not access ${category.dir}`);
    }
}

// Summary
console.log('\n\n📊 Test Summary');
console.log('═'.repeat(60));
console.log(`✅ Passed: ${totalPassed} test files`);
console.log(`❌ Failed: ${totalFailed} test files`);

if (totalFailed > 0) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
} else if (totalPassed === 0) {
    console.log('\n⚠️  No tests were run');
    process.exit(0);
} else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
}