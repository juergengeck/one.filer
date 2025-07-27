import { ProjFSProvider } from '../src/index.js';
import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';

// Mock IFileSystem for demonstration
class MockFileSystem implements IFileSystem {
    private files = new Map<string, { content: Uint8Array; mode: number }>();
    
    constructor() {
        // Add some sample files
        this.files.set('/readme.txt', {
            content: new TextEncoder().encode('Welcome to projfs.one!\n\nThis is a virtual filesystem powered by ONE.core.'),
            mode: 0o100644
        });
        
        this.files.set('/documents', {
            content: new Uint8Array(0),
            mode: 0o040755
        });
        
        this.files.set('/documents/report.pdf', {
            content: new Uint8Array(1024).fill(0x50), // Fake PDF header
            mode: 0o100644
        });
    }
    
    async createDir(directoryPath: string, dirMode: number): Promise<void> {
        this.files.set(directoryPath, {
            content: new Uint8Array(0),
            mode: dirMode
        });
    }
    
    async createFile(directoryPath: string, _fileHash: string, fileName: string, fileMode: number): Promise<void> {
        const fullPath = `${directoryPath}/${fileName}`.replace('//', '/');
        // In real implementation, would fetch content by hash
        this.files.set(fullPath, {
            content: new TextEncoder().encode(`File: ${fileName}`),
            mode: fileMode
        });
    }
    
    async readDir(dirPath: string): Promise<{ children: string[] }> {
        const children: string[] = [];
        const prefix = dirPath === '/' ? '/' : dirPath + '/';
        
        for (const [path, ] of this.files) {
            if (path.startsWith(prefix) && path !== dirPath) {
                const relative = path.substring(prefix.length);
                const firstSlash = relative.indexOf('/');
                const name = firstSlash === -1 ? relative : relative.substring(0, firstSlash);
                
                if (!children.includes(name)) {
                    children.push(name);
                }
            }
        }
        
        return { children };
    }
    
    async readFile(filePath: string): Promise<{ content: Uint8Array }> {
        const file = this.files.get(filePath);
        if (!file) {
            throw new Error(`File not found: ${filePath}`);
        }
        return { content: file.content };
    }
    
    async readlink(filePath: string): Promise<{ content: Uint8Array }> {
        return this.readFile(filePath);
    }
    
    async readFileInChunks(filePath: string, length: number, position: number): Promise<{ content: Uint8Array }> {
        const file = await this.readFile(filePath);
        return {
            content: file.content.slice(position, position + length)
        };
    }
    
    supportsChunkedReading(_path?: string): boolean {
        return true;
    }
    
    async stat(path: string): Promise<{ mode: number; size: number }> {
        const file = this.files.get(path);
        if (!file) {
            throw new Error(`Path not found: ${path}`);
        }
        
        return {
            mode: file.mode,
            size: file.content.length
        };
    }
    
    async rmdir(pathName: string): Promise<number> {
        this.files.delete(pathName);
        return 0;
    }
    
    async unlink(pathName: string): Promise<number> {
        this.files.delete(pathName);
        return 0;
    }
    
    async symlink(src: string, dest: string): Promise<void> {
        const srcFile = this.files.get(src);
        if (srcFile) {
            this.files.set(dest, {
                content: new TextEncoder().encode(src),
                mode: 0o120777
            });
        }
    }
    
    async rename(src: string, dest: string): Promise<number> {
        const file = this.files.get(src);
        if (file) {
            this.files.set(dest, file);
            this.files.delete(src);
        }
        return 0;
    }
    
    async chmod(pathName: string, mode: number): Promise<number> {
        const file = this.files.get(pathName);
        if (file) {
            file.mode = mode;
        }
        return 0;
    }
}

/**
 * Example: Mount a virtual filesystem at C:\MyVirtualDrive
 */
async function main() {
    console.log('projfs.one - Basic Mount Example');
    console.log('================================\n');
    
    // Create a mock filesystem
    const fileSystem = new MockFileSystem();
    
    // Create the provider
    const provider = new ProjFSProvider(fileSystem, {
        logLevel: 'debug',
        cacheSize: 50 * 1024 * 1024 // 50MB cache
    });
    
    try {
        // Start the virtual filesystem
        // The provider will create its own adapter internally
        await provider.start(null as any, {
            virtualizationRootPath: 'C:\\MyVirtualDrive',
            poolThreadCount: 4,
            enableNegativePathCache: true
        });
        
        console.log('\nVirtual filesystem is running!');
        console.log('Open Windows Explorer and navigate to C:\\MyVirtualDrive');
        console.log('\nPress Ctrl+C to stop...\n');
        
        // Keep running and print stats every 10 seconds
        setInterval(() => {
            const stats = provider.getStats();
            console.log('Statistics:');
            console.log(`  Uptime: ${stats.uptime}s`);
            console.log(`  Placeholder requests: ${stats.placeholderInfoRequests}`);
            console.log(`  File data requests: ${stats.fileDataRequests}`);
            console.log(`  Directory enumerations: ${stats.directoryEnumerations}`);
            console.log(`  Bytes read: ${stats.totalBytesRead}`);
            console.log('');
        }, 10000);
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\nShutting down...');
            await provider.stop();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('Failed to start virtual filesystem:', error);
        process.exit(1);
    }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}