#!/usr/bin/env node
/**
 * Test Windows FUSE Access
 * 
 * Creates a minimal FUSE filesystem with test files that Windows can access
 */

import { Fuse } from './lib/fuse/native-fuse3.js';
import fs from 'fs';
import { execSync } from 'child_process';

const MOUNT_POINT = '/tmp/windows-fuse-test';

// Cleanup function
function cleanup() {
    try {
        console.log('Cleaning up...');
        execSync(`fusermount3 -u ${MOUNT_POINT} 2>/dev/null || true`);
        console.log('✅ Unmounted (if it was mounted)');
    } catch (e) {
        // Ignore cleanup errors
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, cleaning up...');
    cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, cleaning up...');
    cleanup();
    process.exit(0);
});

// Main test function
async function runTest() {
    console.log('=== Windows FUSE Access Test ===\n');
    
    // Clean up any previous mounts
    cleanup();
    
    // Create mount point
    if (!fs.existsSync(MOUNT_POINT)) {
        fs.mkdirSync(MOUNT_POINT, { recursive: true });
        console.log(`✅ Created mount point: ${MOUNT_POINT}`);
    }
    
    // Virtual file system data
    const files = {
        '/': { 
            type: 'dir', 
            files: ['hello.txt', 'test-data.txt', 'info.json']
        },
        '/hello.txt': { 
            type: 'file', 
            content: 'Hello from WSL2 FUSE! Accessible from Windows Explorer.' 
        },
        '/test-data.txt': { 
            type: 'file', 
            content: 'This is test data from a FUSE filesystem in WSL2.\nYou can read this from Windows!\nTime: ' + new Date().toISOString()
        },
        '/info.json': { 
            type: 'file', 
            content: JSON.stringify({
                message: "FUSE filesystem working!",
                platform: process.platform,
                node_version: process.version,
                mount_point: MOUNT_POINT,
                windows_path: `\\\\\\\\wsl$\\\\Ubuntu${MOUNT_POINT}`,
                timestamp: new Date().toISOString()
            }, null, 2)
        }
    };
    
    // FUSE operations
    const ops = {
        readdir: (path, cb) => {
            console.log('📁 readdir:', path);
            if (files[path] && files[path].type === 'dir') {
                cb(0, files[path].files);
            } else {
                cb(Fuse.ENOENT);
            }
        },
        
        getattr: (path, cb) => {
            console.log('📄 getattr:', path);
            if (!files[path]) {
                return cb(Fuse.ENOENT);
            }
            
            const now = new Date();
            if (files[path].type === 'dir') {
                cb(0, {
                    mtime: now,
                    atime: now,
                    ctime: now,
                    size: 4096,
                    mode: 16877, // 0755 | S_IFDIR
                    uid: process.getuid(),
                    gid: process.getgid()
                });
            } else {
                cb(0, {
                    mtime: now,
                    atime: now,
                    ctime: now,
                    size: files[path].content.length,
                    mode: 33188, // 0644 | S_IFREG
                    uid: process.getuid(),
                    gid: process.getgid()
                });
            }
        },
        
        open: (path, flags, cb) => {
            console.log('📂 open:', path, 'flags:', flags);
            if (files[path] && files[path].type === 'file') {
                cb(0, 42); // Return a fake file handle
            } else {
                cb(Fuse.ENOENT);
            }
        },
        
        read: (path, fd, buf, len, pos, cb) => {
            console.log('📖 read:', path, 'pos:', pos, 'len:', len);
            if (files[path] && files[path].type === 'file') {
                const content = files[path].content;
                const data = content.slice(pos, pos + len);
                buf.write(data);
                cb(data.length);
            } else {
                cb(Fuse.ENOENT);
            }
        }
    };
    
    console.log('🔧 Creating FUSE filesystem...');
    const fuse = new Fuse(MOUNT_POINT, ops, { debug: false, allowOther: true });
    
    console.log('📎 Mounting filesystem...');
    fuse.mount((err) => {
        if (err) {
            console.error('❌ Mount failed:', err);
            process.exit(1);
        }
        
        console.log(`✅ FUSE filesystem mounted at: ${MOUNT_POINT}`);
        console.log(`🪟 Windows path: \\\\\\\\wsl$\\\\Ubuntu${MOUNT_POINT}`);
        console.log('');
        console.log('Test files created:');
        console.log('  - hello.txt');
        console.log('  - test-data.txt');
        console.log('  - info.json');
        console.log('');
        console.log('🧪 Test from Windows:');
        console.log(`   1. Open Windows Explorer`);
        console.log(`   2. Navigate to: \\\\\\\\wsl$\\\\Ubuntu${MOUNT_POINT}`);
        console.log(`   3. You should see the test files listed above`);
        console.log(`   4. Try opening hello.txt in Notepad`);
        console.log('');
        console.log('💡 Or test from WSL:');
        console.log(`   ls -la ${MOUNT_POINT}`);
        console.log(`   cat ${MOUNT_POINT}/hello.txt`);
        console.log('');
        console.log('🛑 Press Ctrl+C to unmount and exit');
    });
}

// Run the test
runTest().catch(err => {
    console.error('❌ Test failed:', err);
    cleanup();
    process.exit(1);
});