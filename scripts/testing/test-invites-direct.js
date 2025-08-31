#!/usr/bin/env node
// Direct test of invites enumeration
import * as fs from 'fs';
import { execSync } from 'child_process';

const MOUNT_POINT = 'C:\\OneFilerFixed';

console.log('🔍 Direct invites test\n');

// First check root
try {
    console.log('1. Checking root directory...');
    const rootItems = fs.readdirSync(MOUNT_POINT);
    console.log(`   Found ${rootItems.length} items:`, rootItems);
} catch (e) {
    console.log('   Error:', e.message);
}

// Now try to trigger invites enumeration via cmd
console.log('\n2. Using CMD to access invites...');
try {
    const output = execSync(`cmd /c "dir ${MOUNT_POINT}\\invites"`, { encoding: 'utf8' });
    console.log('   CMD output:');
    console.log(output);
} catch (e) {
    console.log('   CMD error:', e.message);
}

// Try PowerShell
console.log('\n3. Using PowerShell to access invites...');
try {
    const output = execSync(`powershell -Command "Get-ChildItem '${MOUNT_POINT}\\invites' -ErrorAction Stop"`, { encoding: 'utf8' });
    console.log('   PowerShell output:');
    console.log(output);
} catch (e) {
    console.log('   PowerShell error:', e.message);
}

// Try to create a file to trigger enumeration
console.log('\n4. Trying to trigger enumeration by checking for a file...');
const testFile = `${MOUNT_POINT}\\invites\\iom_invite.txt`;
try {
    if (fs.existsSync(testFile)) {
        console.log('   ✅ iom_invite.txt exists!');
        const content = fs.readFileSync(testFile, 'utf8');
        console.log(`   Content: "${content.substring(0, 50)}..."`);
    } else {
        console.log('   ❌ iom_invite.txt not found');
    }
} catch (e) {
    console.log('   Error:', e.message);
}