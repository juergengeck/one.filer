#!/usr/bin/env node

/**
 * Test script for unified FUSE3 module
 * Works on both Windows (ProjFS) and Linux (FUSE)
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the unified FUSE3 module
import { FUSE3, errno, S_IFDIR, S_IFREG, S_IRUSR, S_IWUSR, S_IXUSR, S_IRGRP, S_IROTH } from './one.projfs/dist/src/fuse3-unified.js';

// Simple in-memory filesystem for testing
class TestFileSystem {
    constructor() {
        this.files = new Map();
        
        // Root directory
        this.files.set('/', {
            type: 'directory',
            mode: S_IFDIR | 0o755,
            children: ['hello.txt', 'data', 'readme.md']
        });
        
        // Files
        this.files.set('/hello.txt', {
            type: 'file',
            mode: S_IFREG | 0o644,
            content: 'Hello from unified FUSE3!\n',
            size: 26
        });
        
        this.files.set('/readme.md', {
            type: 'file',
            mode: S_IFREG | 0o644,
            content: '# Unified FUSE3\n\nThis works on both Linux and Windows!\n',
            size: 56
        });
        
        // Subdirectory
        this.files.set('/data', {
            type: 'directory',
            mode: S_IFDIR | 0o755,
            children: ['test.json', 'config.ini']
        });
        
        this.files.set('/data/test.json', {
            type: 'file',
            mode: S_IFREG | 0o644,
            content: '{"message": "Hello from FUSE3", "platform": "unified"}\n',
            size: 55
        });
        
        this.files.set('/data/config.ini', {
            type: 'file',
            mode: S_IFREG | 0o644,
            content: '[settings]\nenabled=true\nversion=1.0\n',
            size: 35
        });
    }
    
    getattr(path) {
        const entry = this.files.get(path);
        if (!entry) {
            return -errno.ENOENT;
        }
        
        return {
            mode: entry.mode,
            size: entry.size || 0,
            nlink: 1,
            uid: process.getuid ? process.getuid() : 0,
            gid: process.getgid ? process.getgid() : 0
        };
    }
    
    readdir(path) {
        const entry = this.files.get(path);
        if (!entry) {
            return -errno.ENOENT;
        }
        
        if (entry.type !== 'directory') {
            return -errno.ENOTDIR;
        }
        
        // Return children
        return entry.children.map(name => ({
            name,
            stat: this.getattr(path === '/' ? `/${name}` : `${path}/${name}`)
        }));
    }
    
    read(path, size, offset) {
        const entry = this.files.get(path);
        if (!entry) {
            return -errno.ENOENT;
        }
        
        if (entry.type !== 'file') {
            return -errno.EISDIR;
        }
        
        // Return requested portion of file
        const content = entry.content;
        const data = Buffer.from(content).slice(offset, offset + size);
        return data;
    }
}

async function testUnifiedFUSE3() {
    console.log('🧪 Unified FUSE3 Test');
    console.log('====================');
    console.log(`Platform: ${process.platform}\n`);
    
    const mountPoint = process.platform === 'win32' 
        ? path.join('C:\\', `TestFUSE3_${Date.now()}`)
        : path.join('/tmp', `testfuse3_${Date.now()}`);
    
    // Create mount point
    if (!fs.existsSync(mountPoint)) {
        fs.mkdirSync(mountPoint, { recursive: true });
    }
    
    console.log(`📁 Mount point: ${mountPoint}`);
    
    // Create filesystem and FUSE3 operations
    const testFS = new TestFileSystem();
    
    const operations = {
        getattr: (path) => testFS.getattr(path),
        readdir: (path) => testFS.readdir(path),
        read: (path, size, offset) => testFS.read(path, size, offset),
        
        init: () => {
            console.log('✅ FUSE3 initialized');
        },
        
        destroy: () => {
            console.log('🛑 FUSE3 destroyed');
        }
    };
    
    // Create FUSE3 instance
    const fuse = new FUSE3(mountPoint, operations);
    
    // Set up event handlers
    fuse.on('ready', () => {
        console.log('✅ Filesystem mounted successfully!\n');
        
        // Test filesystem operations
        console.log('📊 Testing filesystem operations:');
        console.log('--------------------------------');
        
        try {
            // List root directory
            const rootEntries = fs.readdirSync(mountPoint);
            console.log(`Root directory (${rootEntries.length} entries):`);
            rootEntries.forEach(entry => {
                const fullPath = path.join(mountPoint, entry);
                const stats = fs.statSync(fullPath);
                const type = stats.isDirectory() ? '📁' : '📄';
                const size = stats.isDirectory() ? '' : ` (${stats.size} bytes)`;
                console.log(`  ${type} ${entry}${size}`);
            });
            
            // Read a file
            console.log('\n📖 Reading /hello.txt:');
            const content = fs.readFileSync(path.join(mountPoint, 'hello.txt'), 'utf8');
            console.log(`  Content: "${content.trim()}"`);
            
            // List subdirectory
            console.log('\n📁 Listing /data directory:');
            const dataEntries = fs.readdirSync(path.join(mountPoint, 'data'));
            dataEntries.forEach(entry => {
                console.log(`  📄 ${entry}`);
            });
            
            console.log('\n✅ All tests passed!');
            
        } catch (error) {
            console.error('❌ Test failed:', error);
        }
        
        console.log('\n📌 Filesystem is mounted. Press Ctrl+C to unmount and exit.');
    });
    
    fuse.on('error', (error) => {
        console.error('❌ FUSE error:', error);
    });
    
    fuse.on('unmount', () => {
        console.log('📤 Filesystem unmounted');
    });
    
    // Mount the filesystem
    try {
        console.log('🚀 Mounting filesystem...');
        fuse.mount();
    } catch (error) {
        console.error('❌ Failed to mount:', error);
        process.exit(1);
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🧹 Cleaning up...');
        
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
}

// Run the test
testUnifiedFUSE3().catch(console.error);