/**
 * Test for FUSE3 N-API addon
 * 
 * This test can be run in two modes:
 * 1. With compiled addon: npm run build && node test.js
 * 2. With stub implementation: node test.js
 */

const path = require('path');
const fs = require('fs');

// Test mount point
const MOUNT_POINT = '/tmp/fuse3-napi-test';

// Simple test filesystem
const testFS = {
    '/': {
        type: 'dir',
        mode: 0o755,
        files: ['hello.txt', 'world.txt', 'subdir']
    },
    '/hello.txt': {
        type: 'file',
        mode: 0o644,
        content: 'Hello from FUSE3!\n'
    },
    '/world.txt': {
        type: 'file',
        mode: 0o644,
        content: 'World of filesystems\n'
    },
    '/subdir': {
        type: 'dir',
        mode: 0o755,
        files: ['nested.txt']
    },
    '/subdir/nested.txt': {
        type: 'file',
        mode: 0o644,
        content: 'Nested file content\n'
    }
};

// Load native-fuse3 module
let Fuse;
try {
    // Load from local index.js
    const fuse = require('./index.js');
    Fuse = fuse.Fuse || fuse;
    console.log('Loaded FUSE module from index.js');
} catch (err) {
    console.error('Failed to load FUSE module:', err);
    process.exit(1);
}

// Check error constants
console.log('\n=== Error Constants ===');
console.log('ENOENT:', Fuse.ENOENT);
console.log('EACCES:', Fuse.EACCES);
console.log('EISDIR:', Fuse.EISDIR);

// Create FUSE operations
const operations = {
    getattr: (path, cb) => {
        console.log(`[getattr] ${path}`);
        
        const entry = testFS[path];
        if (!entry) {
            return cb(Fuse.ENOENT);
        }
        
        const now = new Date();
        const stat = {
            mode: entry.type === 'dir' ? (0o40000 | entry.mode) : (0o100000 | entry.mode),
            size: entry.content ? entry.content.length : 4096,
            uid: process.getuid(),
            gid: process.getgid(),
            mtime: now,
            atime: now,
            ctime: now
        };
        
        cb(0, stat);
    },
    
    readdir: (path, cb) => {
        console.log(`[readdir] ${path}`);
        
        const entry = testFS[path];
        if (!entry) {
            return cb(Fuse.ENOENT);
        }
        
        if (entry.type !== 'dir') {
            return cb(Fuse.ENOTDIR);
        }
        
        cb(0, entry.files || []);
    },
    
    open: (path, flags, cb) => {
        console.log(`[open] ${path} flags=${flags}`);
        
        const entry = testFS[path];
        if (!entry) {
            return cb(Fuse.ENOENT);
        }
        
        if (entry.type !== 'file') {
            return cb(Fuse.EISDIR);
        }
        
        // Return a fake file descriptor
        cb(0, 42);
    },
    
    read: (path, fd, buffer, length, offset, cb) => {
        console.log(`[read] ${path} fd=${fd} length=${length} offset=${offset}`);
        
        const entry = testFS[path];
        if (!entry || entry.type !== 'file') {
            return cb(Fuse.ENOENT);
        }
        
        const content = entry.content || '';
        const data = Buffer.from(content);
        const bytesRead = Math.min(length, data.length - offset);
        
        if (bytesRead > 0) {
            data.copy(buffer, 0, offset, offset + bytesRead);
        }
        
        cb(bytesRead, buffer);
    },
    
    release: (path, fd, cb) => {
        console.log(`[release] ${path} fd=${fd}`);
        cb(0);
    }
};

// Create and mount filesystem
console.log('\n=== Creating FUSE Instance ===');
const fuse = new Fuse(MOUNT_POINT, operations);

console.log('\n=== Checking FUSE Configuration ===');
Fuse.isConfigured((err, configured) => {
    if (err) {
        console.error('Configuration check error:', err);
    } else {
        console.log('FUSE configured:', configured);
    }
    
    console.log('\n=== Mounting Filesystem ===');
    fuse.mount((err) => {
        if (err) {
            console.error('Mount failed:', err);
            process.exit(1);
        }
        
        console.log('Mount successful!');
        console.log(`\nFilesystem mounted at: ${MOUNT_POINT}`);
        console.log('You can now test it with:');
        console.log(`  ls -la ${MOUNT_POINT}`);
        console.log(`  cat ${MOUNT_POINT}/hello.txt`);
        console.log(`  ls -la ${MOUNT_POINT}/subdir`);
        console.log('\nPress Ctrl+C to unmount and exit...');
        
        // Handle shutdown
        process.on('SIGINT', () => {
            console.log('\n\n=== Unmounting Filesystem ===');
            fuse.unmount((err) => {
                if (err) {
                    console.error('Unmount failed:', err);
                    process.exit(1);
                }
                console.log('Unmount successful!');
                process.exit(0);
            });
        });
    });
});