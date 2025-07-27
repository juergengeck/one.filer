import { ProjFSProvider } from '../src/index.js';
import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';

// Enhanced Mock IFileSystem for demonstration
class DemoFileSystem implements IFileSystem {
    private files = new Map<string, { content: Uint8Array; mode: number }>();
    
    constructor() {
        console.log('📁 Initializing Demo FileSystem...');
        
        // Create a rich demo file structure
        this.files.set('/', { content: new Uint8Array(0), mode: 0o040755 });
        
        // Documents
        this.files.set('/Documents', { content: new Uint8Array(0), mode: 0o040755 });
        this.files.set('/Documents/README.txt', {
            content: new TextEncoder().encode(`Welcome to ProjFS.ONE Demo!

This virtual filesystem demonstrates:
- Content-addressed storage via ONE.core
- Windows ProjectedFS integration
- Real-time file synchronization
- Efficient caching system

Files in this demo:
- /Documents/       - User documents
- /Projects/        - Development projects  
- /Media/           - Images and videos
- /Archive/         - Historical data

Note: This is a demonstration running in mock mode.
On Windows with the native module, this would appear as a real drive.`),
            mode: 0o100644
        });
        
        this.files.set('/Documents/Report-2025.pdf', {
            content: new Uint8Array(2048).fill(0x25), // PDF magic bytes
            mode: 0o100644
        });
        
        // Projects
        this.files.set('/Projects', { content: new Uint8Array(0), mode: 0o040755 });
        this.files.set('/Projects/WebApp', { content: new Uint8Array(0), mode: 0o040755 });
        this.files.set('/Projects/WebApp/package.json', {
            content: new TextEncoder().encode(`{
  "name": "my-web-app",
  "version": "1.0.0",
  "description": "Demo project in virtual filesystem",
  "main": "index.js"
}`),
            mode: 0o100644
        });
        
        // Media
        this.files.set('/Media', { content: new Uint8Array(0), mode: 0o040755 });
        this.files.set('/Media/photo1.jpg', {
            content: new Uint8Array(4096).fill(0xFF), // JPEG header
            mode: 0o100644
        });
        
        // Archive with versioned content
        this.files.set('/Archive', { content: new Uint8Array(0), mode: 0o040755 });
        this.files.set('/Archive/data-v1.json', {
            content: new TextEncoder().encode('{"version": 1, "data": "historical"}'),
            mode: 0o100644
        });
        
        console.log(`✅ Created ${this.files.size} demo files/directories`);
    }
    
    async createDir(directoryPath: string, dirMode: number): Promise<void> {
        console.log(`📁 Creating directory: ${directoryPath}`);
        this.files.set(directoryPath, { content: new Uint8Array(0), mode: dirMode });
    }
    
    async createFile(directoryPath: string, _fileHash: string, fileName: string, fileMode: number): Promise<void> {
        const fullPath = `${directoryPath}/${fileName}`.replace('//', '/');
        console.log(`📄 Creating file: ${fullPath}`);
        this.files.set(fullPath, {
            content: new TextEncoder().encode(`Generated file: ${fileName}\nHash: ${_fileHash}\nCreated: ${new Date().toISOString()}`),
            mode: fileMode
        });
    }
    
    async readDir(dirPath: string): Promise<{ children: string[] }> {
        console.log(`📂 Reading directory: ${dirPath}`);
        const children: string[] = [];
        const prefix = dirPath === '/' ? '/' : dirPath + '/';
        
        for (const [path] of this.files) {
            if (path.startsWith(prefix) && path !== dirPath) {
                const relative = path.substring(prefix.length);
                const firstSlash = relative.indexOf('/');
                const name = firstSlash === -1 ? relative : relative.substring(0, firstSlash);
                
                if (!children.includes(name)) {
                    children.push(name);
                }
            }
        }
        
        console.log(`  Found ${children.length} items: ${children.join(', ')}`);
        return { children };
    }
    
    async readFile(filePath: string): Promise<{ content: Uint8Array }> {
        console.log(`📖 Reading file: ${filePath}`);
        const file = this.files.get(filePath);
        if (!file) {
            throw new Error(`File not found: ${filePath}`);
        }
        console.log(`  File size: ${file.content.length} bytes`);
        return { content: file.content };
    }
    
    async readlink(filePath: string): Promise<{ content: Uint8Array }> {
        return this.readFile(filePath);
    }
    
    async readFileInChunks(filePath: string, length: number, position: number): Promise<{ content: Uint8Array }> {
        console.log(`📖 Reading file chunk: ${filePath} (${length} bytes at ${position})`);
        const file = await this.readFile(filePath);
        return { content: file.content.slice(position, position + length) };
    }
    
    supportsChunkedReading(_path?: string): boolean {
        return true;
    }
    
    async stat(path: string): Promise<{ mode: number; size: number }> {
        console.log(`📊 Getting stats for: ${path}`);
        const file = this.files.get(path);
        if (!file) {
            throw new Error(`Path not found: ${path}`);
        }
        
        const stats = { mode: file.mode, size: file.content.length };
        console.log(`  Mode: ${stats.mode.toString(8)}, Size: ${stats.size} bytes`);
        return stats;
    }
    
    async rmdir(pathName: string): Promise<number> {
        console.log(`🗑️ Removing directory: ${pathName}`);
        this.files.delete(pathName);
        return 0;
    }
    
    async deleteFile(filePath: string): Promise<void> {
        console.log(`🗑️ Deleting file: ${filePath}`);
        this.files.delete(filePath);
    }
    
    async unlink(pathName: string): Promise<number> {
        console.log(`🔗 Unlinking: ${pathName}`);
        this.files.delete(pathName);
        return 0;
    }
    
    async symlink(target: string, linkPath: string): Promise<void> {
        console.log(`🔗 Creating symlink: ${linkPath} -> ${target}`);
        // For demo, just create a file with target info
        this.files.set(linkPath, {
            content: new TextEncoder().encode(`symlink:${target}`),
            mode: 0o120777 // Symbolic link mode
        });
    }
    
    async rename(src: string, dest: string): Promise<number> {
        console.log(`📝 Renaming: ${src} -> ${dest}`);
        const file = this.files.get(src);
        if (file) {
            this.files.set(dest, file);
            this.files.delete(src);
            return 0;
        }
        return -1;
    }
    
    async chmod(pathName: string, mode: number): Promise<number> {
        console.log(`🔒 Changing mode: ${pathName} to ${mode.toString(8)}`);
        const file = this.files.get(pathName);
        if (file) {
            file.mode = mode;
            return 0;
        }
        return -1;
    }
}

/**
 * Demo Mode - Shows ProjFS.ONE functionality without native Windows dependencies
 */
async function runDemo() {
    console.log('🚀 ProjFS.ONE - Demo Mode');
    console.log('=========================\n');
    
    console.log('🔧 This demo shows ProjFS.ONE functionality in mock mode.');
    console.log('   On Windows, this would create a real virtual drive.\n');
    
    // Create demo filesystem
    const fileSystem = new DemoFileSystem();
    
    // Create provider with detailed logging
    const provider = new ProjFSProvider(fileSystem, {
        logLevel: 'debug',
        cacheSize: 10 * 1024 * 1024 // 10MB cache
    });
    
    try {
        console.log('\n🔄 Starting virtual filesystem (mock mode)...');
        
        // This will use the mock implementation
        await provider.start(null as any, {
            virtualizationRootPath: 'C:\\DemoVirtualDrive',
            poolThreadCount: 2,
            enableNegativePathCache: true
        });
        
        console.log('✅ Virtual filesystem started successfully!\n');
        
        // Demonstrate functionality
        console.log('📊 Provider Status:');
        console.log(`   Running: ${provider.isRunning()}`);
        
        const stats = provider.getStats();
        console.log(`   Uptime: ${stats.uptime}s`);
        console.log(`   Cache hits: ${stats.cacheHits}`);
        console.log(`   Cache misses: ${stats.cacheMisses}\n`);
        
        console.log('🔍 Demo Features:');
        console.log('   ✓ TypeScript ES modules');
        console.log('   ✓ Comprehensive logging');
        console.log('   ✓ File system abstraction');
        console.log('   ✓ Caching system');
        console.log('   ✓ Statistics tracking');
        console.log('   ✓ Graceful error handling');
        console.log('   ✓ Mock fallback for development\n');
        
        console.log('🏗️ Architecture:');
        console.log('   ┌─ ProjFSProvider (Main entry point)');
        console.log('   ├─ IFileSystemToProjFSAdapter (Bridge)');  
        console.log('   ├─ CacheManager (Performance)');
        console.log('   ├─ PathMapper (Path handling)');
        console.log('   ├─ AttributeConverter (Windows attributes)');
        console.log('   └─ Logger (Diagnostics)\n');
        
        // Simulate some activity
        console.log('🎬 Simulating filesystem operations...\n');
        
        // Read root directory
        await fileSystem.readDir('/');
        
        // Read a file
        await fileSystem.readFile('/Documents/README.txt');
        
        // Check stats
        await fileSystem.stat('/Projects/WebApp/package.json');
        
        console.log('\n📈 Final Statistics:');
        const finalStats = provider.getStats();
        console.log(`   Total operations simulated: 3`);
        console.log(`   Provider uptime: ${finalStats.uptime}s`);
        
        console.log('\n✅ Demo completed successfully!');
        console.log('\n💡 To run on Windows:');
        console.log('   1. Build native module: npm run build:native');
        console.log('   2. Run as Administrator (first time)');
        console.log('   3. Access virtual drive in Explorer');
        
        // Clean shutdown
        await provider.stop();
        
    } catch (error) {
        console.error('❌ Demo failed:', error);
        process.exit(1);
    }
}

// Run demo
runDemo().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
});