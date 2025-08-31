// Test script to debug what's happening with the filesystem
import TemporaryFileSystem from './node_modules/@refinio/one.models/lib/fileSystems/TemporaryFileSystem.js';

const fs = new TemporaryFileSystem();

// Mock the fstab
fs.fstab = new Map([
    ['/chats', { readDir: async (path) => ({ children: ['subfolder1', 'file1.txt'] }) }],
    ['/debug', { readDir: async (path) => ({ children: ['logs', 'dumps'] }) }],
    ['/invites', { readDir: async (path) => ({ children: [] }) }],
    ['/objects', { readDir: async (path) => ({ children: ['abc123', 'def456'] }) }],
    ['/types', { readDir: async (path) => ({ children: ['type1', 'type2'] }) }]
]);

// Test what happens when ProjFS gives us paths without leading /
const projfsPaths = [
    '',          // Root
    'chats',     // What ProjFS gives for C:\OneFiler\chats
    'debug',     
    'objects',
    'chats\\subfolder1',  // What ProjFS might give for subdirs
];

console.log('Testing what happens with ProjFS-style paths:\n');

for (const path of projfsPaths) {
    console.log(`\nPath from ProjFS: "${path}"`);
    
    const isRoot = fs.isRootPath(path);
    console.log(`  isRootPath() = ${isRoot}`);
    
    const searchResult = fs.search(path);
    if (searchResult) {
        console.log(`  search() found mount, relativePath = "${searchResult.relativePath}"`);
    } else {
        console.log(`  search() = null (no mount found)`);
    }
    
    try {
        const dirContents = await fs.readDir(path);
        console.log(`  readDir() returned: ${JSON.stringify(dirContents.children)}`);
    } catch (e) {
        console.log(`  readDir() threw: ${e.message}`);
    }
}