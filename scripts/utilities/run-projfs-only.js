#!/usr/bin/env node

/**
 * Simple ProjFS-only test script
 * Tests native ProjFS functionality without FUSE wrapper
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import ProjFS provider directly
import { ProjFSProvider } from './one.projfs/dist/src/provider/ProjFSProvider.js';
import { IFileSystemToProjFSAdapter } from './one.projfs/dist/src/provider/IFileSystemToProjFSAdapter.js';

// Simple in-memory filesystem for testing
class TestFileSystem {
    constructor() {
        this.files = new Map();
        
        // Prepopulate with test data
        this.files.set('/', {
            type: 'directory',
            children: ['chats', 'debug', 'invites', 'objects', 'types', 'test.txt']
        });
        
        this.files.set('/chats', {
            type: 'directory',
            children: []
        });
        
        this.files.set('/debug', {
            type: 'directory',
            children: ['log.txt']
        });
        
        this.files.set('/debug/log.txt', {
            type: 'file',
            content: 'Debug log content\n',
            size: 17
        });
        
        this.files.set('/invites', {
            type: 'directory',
            children: []
        });
        
        this.files.set('/objects', {
            type: 'directory',
            children: []
        });
        
        this.files.set('/types', {
            type: 'directory',
            children: []
        });
        
        this.files.set('/test.txt', {
            type: 'file',
            content: 'Hello from ProjFS!\n',
            size: 19
        });
    }
    
    async listDirectory(virtualPath) {
        const normalized = virtualPath === '' ? '/' : virtualPath.startsWith('/') ? virtualPath : '/' + virtualPath;
        const entry = this.files.get(normalized);
        
        console.log(`[TestFS] listDirectory called for: "${virtualPath}" -> "${normalized}"`);
        
        if (!entry || entry.type !== 'directory') {
            console.log(`[TestFS] Not a directory or not found`);
            return [];
        }
        
        const result = entry.children.map(name => {
            const childPath = normalized === '/' ? '/' + name : normalized + '/' + name;
            const child = this.files.get(childPath);
            
            return {
                name,
                isDirectory: child.type === 'directory',
                size: child.size || 0
            };
        });
        
        console.log(`[TestFS] Returning ${result.length} entries: ${result.map(e => e.name).join(', ')}`);
        return result;
    }
    
    async getFileData(virtualPath, byteOffset, length) {
        const normalized = virtualPath.startsWith('/') ? virtualPath : '/' + virtualPath;
        const entry = this.files.get(normalized);
        
        if (!entry || entry.type !== 'file') {
            throw new Error('File not found');
        }
        
        const content = entry.content;
        const data = Buffer.from(content).slice(byteOffset, byteOffset + length);
        return data;
    }
    
    async getPlaceholderInfo(virtualPath) {
        const normalized = virtualPath === '' ? '/' : virtualPath.startsWith('/') ? virtualPath : '/' + virtualPath;
        const entry = this.files.get(normalized);
        
        if (!entry) {
            throw new Error('Path not found');
        }
        
        return {
            isDirectory: entry.type === 'directory',
            size: entry.size || 0
        };
    }
}

async function runTest() {
    console.log('🧪 ProjFS-Only Test');
    console.log('==================\n');
    
    const mountPoint = path.join('C:\\', `TestProjFS_${Date.now()}`);
    
    try {
        // Clean up if exists
        if (fs.existsSync(mountPoint)) {
            try {
                fs.rmSync(mountPoint, { recursive: true, force: true });
            } catch (e) {
                console.log('⚠️  Could not remove existing directory');
            }
        }
        
        // Create mount point
        fs.mkdirSync(mountPoint);
        console.log(`📁 Created mount point: ${mountPoint}`);
        
        // Create filesystem and adapter
        const fileSystem = new TestFileSystem();
        const adapter = new IFileSystemToProjFSAdapter(fileSystem, mountPoint);
        
        // Create ProjFS provider
        const provider = new ProjFSProvider(adapter, mountPoint);
        
        console.log('🚀 Starting ProjFS provider...');
        await provider.start(null, { virtualizationRootPath: mountPoint });
        
        console.log('✅ ProjFS started successfully!\n');
        
        // Give Windows a moment to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test directory listing
        console.log('📊 Testing directory enumeration:');
        console.log('--------------------------------');
        
        const entries = fs.readdirSync(mountPoint);
        console.log(`Found ${entries.length} entries:`);
        entries.forEach(entry => {
            const stats = fs.statSync(path.join(mountPoint, entry));
            console.log(`  ${stats.isDirectory() ? '📁' : '📄'} ${entry}`);
        });
        
        if (entries.length === 0) {
            console.log('\n❌ No entries found - directory enumeration not working');
        } else {
            console.log('\n✅ Directory enumeration is working!');
            
            // Test file reading
            console.log('\n📖 Testing file reading:');
            console.log('------------------------');
            try {
                const content = fs.readFileSync(path.join(mountPoint, 'test.txt'), 'utf8');
                console.log('Content of test.txt:', JSON.stringify(content));
                console.log('✅ File reading works!');
            } catch (err) {
                console.log('❌ File reading failed:', err.message);
            }
        }
        
        // Keep running for manual testing
        console.log('\n📌 ProjFS is running. Press Ctrl+C to stop.');
        console.log(`   Open File Explorer and navigate to: ${mountPoint}`);
        
        // Wait for Ctrl+C
        await new Promise(resolve => {
            process.on('SIGINT', resolve);
        });
        
        console.log('\n🛑 Stopping ProjFS...');
        await provider.stop();
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        try {
            if (fs.existsSync(mountPoint)) {
                // Try multiple times with delay
                for (let i = 0; i < 3; i++) {
                    try {
                        fs.rmSync(mountPoint, { recursive: true, force: true });
                        break;
                    } catch (e) {
                        if (i < 2) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }
            }
        } catch (e) {
            console.log('⚠️  Could not clean up mount point');
        }
    }
}

// Run the test
runTest().catch(console.error);

console.log('🚀 ONE.filer ProjFS Direct Runner');
console.log('==================================\n');

async function runProjFS() {
    try {
        // Load config
        const configPath = process.argv[2] || 'configs/windows-native.json';
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        
        // Get secret from args or env
        const secret = process.argv[3] || process.env.ONE_SECRET || 'test123';
        
        console.log('Configuration:');
        console.log(`- Config: ${configPath}`);
        console.log(`- Directory: ${config.directory}`);
        console.log(`- ProjFS Root: ${config.filerConfig.projfsRoot}`);
        console.log('');
        
        // Initialize ONE.core
        console.log('Initializing ONE.core...');
        await initOneCoreInstance(config.directory, secret);
        
        // Create models in the correct order
        const channelManager = new ChannelManager();
        const leuteModel = new LeuteModel(channelManager);
        const connections = new ConnectionsModel(leuteModel, config.connectionsConfig);
        const iomManager = new IoMManager();
        const topicModel = new TopicModel(channelManager, leuteModel);
        const notifications = new Notifications(channelManager);
        
        // Create FilerWithProjFS directly
        console.log('Creating ProjFS filer...');
        const filer = new FilerWithProjFS(
            {
                channelManager,
                connections,
                leuteModel,
                notifications,
                topicModel,
                iomManager
            },
            config.filerConfig
        );
        
        // Initialize (this will use ProjFS)
        console.log('Initializing ProjFS...');
        await filer.init();
        
        console.log('\n✅ ProjFS filesystem mounted successfully!');
        console.log(`📁 Access your files at: ${config.filerConfig.projfsRoot}\n`);
        
        // Keep running
        process.on('SIGINT', async () => {
            console.log('\nShutting down...');
            await filer.shutdown();
            await shutdownOneCoreInstance();
            process.exit(0);
        });
        
        // Keep the process alive
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Failed to start ProjFS:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runProjFS();
}
