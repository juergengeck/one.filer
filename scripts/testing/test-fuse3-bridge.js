#!/usr/bin/env node

/**
 * Test script for ProjFS-FUSE3 N-API Bridge
 * 
 * This tests the clean N-API approach that directly bridges FUSE3 to ProjFS.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the FUSE3 bridge
import { FUSE3Mount, errno, S_IFREG, S_IFDIR } from './one.projfs/dist/src/fuse3-bridge.js';

console.log('🧪 ProjFS-FUSE3 N-API Bridge Test');
console.log('================================\n');

// Simple test filesystem
const testFiles = new Map([
    ['/', {
        type: 'directory',
        mode: S_IFDIR | 0o755,
        children: ['hello.txt', 'data', 'info.md']
    }],
    ['/hello.txt', {
        type: 'file',
        mode: S_IFREG | 0o644,
        content: 'Hello from ProjFS-FUSE3 bridge!\n',
        size: 33
    }],
    ['/info.md', {
        type: 'file', 
        mode: S_IFREG | 0o644,
        content: '# ProjFS-FUSE3 Bridge\n\nThis is a clean N-API bridge!\n',
        size: 58
    }],
    ['/data', {
        type: 'directory',
        mode: S_IFDIR | 0o755,
        children: ['config.json']
    }],
    ['/data/config.json', {
        type: 'file',
        mode: S_IFREG | 0o644,
        content: '{"bridge": "projfs-fuse3", "working": true}\n',
        size: 42
    }]
]);

// FUSE3 operations implementation
const operations = {
    getattr: (path) => {
        console.log(`[FUSE] getattr: ${path}`);
        
        const entry = testFiles.get(path);
        if (!entry) {
            return -errno.ENOENT;
        }
        
        return {
            mode: entry.mode,
            size: entry.size || 0,
            nlink: 1,
            uid: 0,
            gid: 0
        };
    },
    
    readdir: (path) => {
        console.log(`[FUSE] readdir: ${path}`);
        
        const entry = testFiles.get(path);
        if (!entry) {
            return -errno.ENOENT;
        }
        
        if (entry.type !== 'directory') {
            return -errno.ENOTDIR;
        }
        
        return entry.children.map(name => ({ name }));
    },
    
    read: (path, size, offset) => {
        console.log(`[FUSE] read: ${path} (${size} bytes at offset ${offset})`);
        
        const entry = testFiles.get(path);
        if (!entry) {
            return -errno.ENOENT;
        }
        
        if (entry.type !== 'file') {
            return -errno.EISDIR;
        }
        
        const content = Buffer.from(entry.content);
        return content.slice(offset, offset + size);
    },
    
    init: () => {
        console.log('[FUSE] Filesystem initialized');
    },
    
    destroy: () => {
        console.log('[FUSE] Filesystem destroyed');
    }
};

async function testBridge() {
    const mountPoint = path.join('C:\\', `TestFUSE3Bridge_${Date.now()}`);
    
    try {
        // Create mount point
        if (!fs.existsSync(mountPoint)) {
            fs.mkdirSync(mountPoint, { recursive: true });
        }
        
        console.log(`📁 Mount point: ${mountPoint}`);
        console.log('📦 Creating FUSE3 bridge instance...');
        
        // Create FUSE3 mount
        const fuse = new FUSE3Mount(mountPoint, operations);
        
        // Set up event handlers
        fuse.on('ready', () => {
            console.log('✅ Bridge mounted successfully!\n');
            
            console.log('🧪 Testing filesystem operations:');
            console.log('--------------------------------');
            
            try {
                // List root directory
                const entries = fs.readdirSync(mountPoint);
                console.log(`Root directory contains ${entries.length} entries:`);
                entries.forEach(entry => {
                    const fullPath = path.join(mountPoint, entry);
                    const stats = fs.statSync(fullPath);
                    const icon = stats.isDirectory() ? '📁' : '📄';
                    const size = stats.isDirectory() ? '' : ` (${stats.size} bytes)`;
                    console.log(`  ${icon} ${entry}${size}`);
                });
                
                // Read a file
                console.log('\n📖 Reading hello.txt:');
                const content = fs.readFileSync(path.join(mountPoint, 'hello.txt'), 'utf8');
                console.log(`  "${content.trim()}"`);
                
                // Read from subdirectory
                console.log('\n📁 Reading data/config.json:');
                const configContent = fs.readFileSync(path.join(mountPoint, 'data', 'config.json'), 'utf8');
                console.log(`  ${configContent.trim()}`);
                
                console.log('\n✅ All tests passed!');
                console.log('\n📌 Bridge is working. You can explore the filesystem at:');
                console.log(`   ${mountPoint}`);
                console.log('\nPress Ctrl+C to unmount and exit.');
                
            } catch (error) {
                console.error('❌ Test failed:', error);
            }
        });
        
        fuse.on('error', (error) => {
            console.error('❌ Bridge error:', error);
        });
        
        fuse.on('unmount', () => {
            console.log('📤 Bridge unmounted');
        });
        
        // Mount the filesystem
        console.log('🚀 Mounting filesystem with ProjFS bridge...');
        fuse.mount();
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🧹 Shutting down...');
            
            try {
                fuse.unmount();
            } catch (error) {
                console.error('Error during unmount:', error);
            }
            
            // Clean up mount point
            try {
                fs.rmSync(mountPoint, { recursive: true, force: true });
            } catch (error) {
                // Ignore cleanup errors
            }
            
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Failed to create bridge:', error);
        process.exit(1);
    }
}

// Run the test
testBridge().catch(console.error);