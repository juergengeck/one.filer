#!/usr/bin/env node
// Test invites directory in ProjFS
import * as fs from 'fs';
import * as path from 'path';

const MOUNT_POINT = 'C:\\OneFilerNew';
const INVITES_PATH = path.join(MOUNT_POINT, 'invites');

console.log('🔍 Testing invites directory...\n');

// Check if mount exists
if (!fs.existsSync(MOUNT_POINT)) {
    console.log('❌ Mount point does not exist:', MOUNT_POINT);
    process.exit(1);
}

console.log('✅ Mount point exists:', MOUNT_POINT);

// Check invites directory
try {
    const stats = fs.statSync(INVITES_PATH);
    console.log('✅ Invites directory exists');
    console.log('   Is directory:', stats.isDirectory());
    console.log('   Size:', stats.size);
} catch (e) {
    console.log('❌ Cannot stat invites directory:', e.message);
}

// Try to list contents
try {
    console.log('\n📁 Listing invites directory contents...');
    const items = fs.readdirSync(INVITES_PATH);
    console.log('   Items found:', items.length);
    
    if (items.length === 0) {
        console.log('   (Directory is empty)');
    } else {
        for (const item of items) {
            console.log('   -', item);
        }
    }
} catch (e) {
    console.log('❌ Cannot read invites directory:', e.message);
    console.log('   Error code:', e.code);
}

// Try to read expected files
console.log('\n📄 Checking for standard invite files...');
const expectedFiles = ['README.txt', 'invite.txt', 'pairing.txt'];

for (const file of expectedFiles) {
    const filePath = path.join(INVITES_PATH, file);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`✅ ${file} exists (${content.length} chars)`);
        console.log(`   Preview: "${content.substring(0, 50)}..."`);
    } catch (e) {
        console.log(`❌ ${file} not found:`, e.code);
    }
}