// Test the fixed isRootPath logic
import TemporaryFileSystem from './node_modules/@refinio/one.models/lib/fileSystems/TemporaryFileSystem.js';

const fs = new TemporaryFileSystem();

// Mock the fstab
fs.fstab = new Map([
    ['/chats', {}],
    ['/debug', {}],
    ['/invites', {}],
    ['/objects', {}],
    ['/types', {}]
]);

// Test cases
const testPaths = [
    '/',           // Should be root
    '',            // Should be root
    'chats',       // Should NOT be root (missing /)
    '/chats',      // Should NOT be root (mounted)
    '/chats/foo',  // Should NOT be root (under mounted)
    'objects',     // Should NOT be root (missing /)
    '/objects',    // Should NOT be root (mounted)
    '/unknown',    // Should be root (not mounted)
    'unknown'      // Should be root (not mounted)
];

console.log('Testing isRootPath with fixed logic:\n');
testPaths.forEach(path => {
    const result = fs.isRootPath(path);
    console.log(`isRootPath('${path}') = ${result}`);
});

console.log('\n\nTesting search with fixed logic:\n');
testPaths.forEach(path => {
    const result = fs.search(path);
    if (result) {
        console.log(`search('${path}') = { relativePath: '${result.relativePath}' }`);
    } else {
        console.log(`search('${path}') = null`);
    }
});