// Test script to verify projfs-fuse.one integration
import { getFuse } from './lib/fuse/index.js';
import { promises as fs } from 'fs';
import path from 'path';

console.log('🔧 Testing projfs-fuse.one mounting...\n');

async function testMount() {
    try {
        // Get the FUSE implementation
        const Fuse = await getFuse();
        console.log('✅ Loaded FUSE implementation');
        
        // Create test mount point
        const mountPath = 'C:\\TestMount';
        
        // Ensure mount directory exists
        try {
            await fs.mkdir(mountPath, { recursive: true });
            console.log(`✅ Created mount directory: ${mountPath}`);
        } catch (err) {
            console.log(`ℹ️  Mount directory already exists: ${mountPath}`);
        }
        
        // Define simple test operations
        const testOperations = {
            init: () => {
                console.log('📂 FUSE initialized');
            },
            
            getattr: (path) => {
                console.log(`📊 getattr called for: ${path}`);
                
                if (path === '/' || path === '\\') {
                    return {
                        mtime: new Date(),
                        atime: new Date(),
                        ctime: new Date(),
                        size: 0,
                        mode: 0o040755, // Directory
                        uid: 0,
                        gid: 0
                    };
                }
                
                if (path === '/test.txt' || path === '\\test.txt') {
                    return {
                        mtime: new Date(),
                        atime: new Date(),
                        ctime: new Date(),
                        size: 13,
                        mode: 0o100644, // File
                        uid: 0,
                        gid: 0
                    };
                }
                
                return null;
            },
            
            readdir: (path) => {
                console.log(`📁 readdir called for: ${path}`);
                
                if (path === '/' || path === '\\') {
                    return ['.', '..', 'test.txt'];
                }
                
                return [];
            },
            
            read: (path, size, offset) => {
                console.log(`📖 read called for: ${path} (size: ${size}, offset: ${offset})`);
                
                if (path === '/test.txt' || path === '\\test.txt') {
                    const content = 'Hello ProjFS!';
                    return Buffer.from(content).slice(offset, offset + size);
                }
                
                return null;
            }
        };
        
        // Create and mount
        console.log('\n🚀 Creating FUSE instance...');
        const fuse = new Fuse(mountPath, testOperations);
        
        console.log('🔌 Mounting filesystem...');
        await new Promise((resolve, reject) => {
            fuse.mount((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        
        console.log(`✅ Successfully mounted at: ${mountPath}`);
        console.log('\n📂 You can now browse the virtual filesystem:');
        console.log(`   - Open File Explorer and navigate to ${mountPath}`);
        console.log('   - You should see a test.txt file');
        console.log('   - Opening test.txt should show "Hello ProjFS!"');
        console.log('\n⏸️  Press Ctrl+C to unmount and exit...');
        
        // Keep running until interrupted
        process.on('SIGINT', async () => {
            console.log('\n\n🔧 Unmounting...');
            
            await new Promise((resolve) => {
                fuse.unmount((err) => {
                    if (err) {
                        console.error('❌ Unmount error:', err);
                    } else {
                        console.log('✅ Successfully unmounted');
                    }
                    resolve();
                });
            });
            
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testMount();