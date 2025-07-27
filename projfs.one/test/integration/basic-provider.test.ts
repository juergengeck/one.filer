import { expect } from 'chai';
import { ProjFSProvider } from '../../src/index.js';
import type { IFileSystem, FileSystemFile, FileSystemDirectory, FileDescription } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';

/**
 * Mock IFileSystem implementation for testing
 */
class MockFileSystem implements IFileSystem {
    private files = new Map<string, { 
        content: Uint8Array; 
        mode: number; 
        type: 'file' | 'directory' | 'symlink';
        target?: string;
    }>();
    
    constructor() {
        // Initialize with some test data
        this.files.set('/', { 
            content: new Uint8Array(0), 
            mode: 0o040755, 
            type: 'directory' 
        });
        
        this.files.set('/test.txt', {
            content: new TextEncoder().encode('Hello, World!'),
            mode: 0o100644,
            type: 'file'
        });
        
        this.files.set('/documents', {
            content: new Uint8Array(0),
            mode: 0o040755,
            type: 'directory'
        });
        
        this.files.set('/documents/readme.md', {
            content: new TextEncoder().encode('# Test Document\n\nThis is a test.'),
            mode: 0o100644,
            type: 'file'
        });
    }
    
    async createDir(directoryPath: string, dirMode: number): Promise<void> {
        this.files.set(directoryPath, {
            content: new Uint8Array(0),
            mode: dirMode,
            type: 'directory'
        });
    }
    
    async createFile(
        directoryPath: string, 
        fileHash: string, 
        fileName: string, 
        fileMode: number
    ): Promise<void> {
        const fullPath = path.posix.join(directoryPath, fileName);
        this.files.set(fullPath, {
            content: new TextEncoder().encode(`Mock content for ${fileName}`),
            mode: fileMode,
            type: 'file'
        });
    }
    
    async readDir(dirPath: string): Promise<FileSystemDirectory> {
        const children: string[] = [];
        const normalizedPath = dirPath.endsWith('/') && dirPath !== '/' 
            ? dirPath.slice(0, -1) 
            : dirPath;
        
        for (const [filePath, ] of this.files) {
            if (filePath === normalizedPath) continue;
            
            const relative = path.posix.relative(normalizedPath, filePath);
            if (relative && !relative.startsWith('..')) {
                const parts = relative.split('/');
                if (parts.length === 1) {
                    children.push(parts[0]);
                }
            }
        }
        
        return { children };
    }
    
    async readFile(filePath: string): Promise<FileSystemFile> {
        const file = this.files.get(filePath);
        if (!file || file.type !== 'file') {
            throw new Error(`File not found: ${filePath}`);
        }
        return { content: file.content };
    }
    
    async readlink(filePath: string): Promise<FileSystemFile> {
        const file = this.files.get(filePath);
        if (!file || file.type !== 'symlink') {
            throw new Error(`Symlink not found: ${filePath}`);
        }
        return { content: new TextEncoder().encode(file.target || '') };
    }
    
    async readFileInChunks(
        filePath: string, 
        length: number, 
        position: number
    ): Promise<FileSystemFile> {
        const file = await this.readFile(filePath);
        return {
            content: file.content.slice(position, position + length)
        };
    }
    
    supportsChunkedReading(path?: string): boolean {
        return true;
    }
    
    async stat(path: string): Promise<FileDescription> {
        const file = this.files.get(path);
        if (!file) {
            throw new Error(`Path not found: ${path}`);
        }
        
        return {
            mode: file.mode,
            size: file.type === 'directory' ? 0 : file.content.length
        };
    }
    
    async rmdir(pathName: string): Promise<number> {
        const file = this.files.get(pathName);
        if (!file || file.type !== 'directory') {
            return -1;
        }
        this.files.delete(pathName);
        return 0;
    }
    
    async unlink(pathName: string): Promise<number> {
        const file = this.files.get(pathName);
        if (!file || file.type === 'directory') {
            return -1;
        }
        this.files.delete(pathName);
        return 0;
    }
    
    async symlink(src: string, dest: string): Promise<void> {
        this.files.set(dest, {
            content: new Uint8Array(0),
            mode: 0o120777,
            type: 'symlink',
            target: src
        });
    }
    
    async rename(src: string, dest: string): Promise<number> {
        const file = this.files.get(src);
        if (!file) {
            return -1;
        }
        this.files.set(dest, file);
        this.files.delete(src);
        return 0;
    }
    
    async chmod(pathName: string, mode: number): Promise<number> {
        const file = this.files.get(pathName);
        if (!file) {
            return -1;
        }
        file.mode = mode;
        return 0;
    }
}

describe('ProjFS Provider Integration Tests', function() {
    this.timeout(10000);
    
    let provider: ProjFSProvider;
    let testRoot: string;
    
    before(async function() {
        // Skip if not on Windows
        if (os.platform() !== 'win32') {
            this.skip();
            return;
        }
        
        // Create test directory
        testRoot = path.join(os.tmpdir(), `projfs-test-${Date.now()}`);
        await fs.mkdir(testRoot, { recursive: true });
    });
    
    after(async function() {
        // Cleanup
        if (provider?.isRunning()) {
            await provider.stop();
        }
        
        if (testRoot) {
            try {
                await fs.rmdir(testRoot, { recursive: true });
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });
    
    describe('Provider Lifecycle', () => {
        it('should create provider instance', () => {
            const fileSystem = new MockFileSystem();
            provider = new ProjFSProvider(fileSystem, {
                logLevel: 'error'
            });
            
            expect(provider).to.be.instanceOf(ProjFSProvider);
            expect(provider.isRunning()).to.be.false;
        });
        
        it('should fail to start without native module', async () => {
            const fileSystem = new MockFileSystem();
            provider = new ProjFSProvider(fileSystem);
            
            try {
                await provider.start({
                    virtualizationRootPath: testRoot
                });
                
                // If we get here, native module loaded (unexpected in test)
                expect(provider.isRunning()).to.be.true;
                await provider.stop();
            } catch (error: any) {
                // Expected: native module not loaded
                expect(error.message).to.include('Native module not loaded');
            }
        });
        
        it('should get empty stats when not running', () => {
            const fileSystem = new MockFileSystem();
            provider = new ProjFSProvider(fileSystem);
            
            const stats = provider.getStats();
            expect(stats).to.deep.include({
                placeholderInfoRequests: 0,
                fileDataRequests: 0,
                directoryEnumerations: 0,
                fileModifications: 0,
                uptime: 0
            });
        });
    });
    
    describe('IFileSystem Adapter', () => {
        it('should convert paths correctly', async () => {
            // This tests the adapter's path mapping
            const fileSystem = new MockFileSystem();
            const adapter = new (await import('../../src/provider/IFileSystemToProjFSAdapter.js')).IFileSystemToProjFSAdapter(
                fileSystem,
                'C:\\TestDrive'
            );
            
            // Test root path
            const rootInfo = await adapter.onGetPlaceholderInfo('');
            expect(rootInfo.isDirectory).to.be.true;
            
            // Test file
            const fileInfo = await adapter.onGetPlaceholderInfo('test.txt');
            expect(fileInfo.isDirectory).to.be.false;
            expect(fileInfo.fileSize).to.equal(13n); // "Hello, World!"
        });
        
        it('should enumerate directories', async () => {
            const fileSystem = new MockFileSystem();
            const adapter = new (await import('../../src/provider/IFileSystemToProjFSAdapter.js')).IFileSystemToProjFSAdapter(
                fileSystem,
                'C:\\TestDrive'
            );
            
            const entries = await adapter.onGetDirectoryEnumeration('');
            expect(entries).to.have.length(2);
            
            const names = entries.map(e => e.fileName).sort();
            expect(names).to.deep.equal(['documents', 'test.txt']);
        });
        
        it('should read file data', async () => {
            const fileSystem = new MockFileSystem();
            const adapter = new (await import('../../src/provider/IFileSystemToProjFSAdapter.js')).IFileSystemToProjFSAdapter(
                fileSystem,
                'C:\\TestDrive'
            );
            
            // Read entire file
            const data = await adapter.onGetFileData('test.txt', 0n, 100);
            expect(data.toString()).to.equal('Hello, World!');
            
            // Read partial
            const partial = await adapter.onGetFileData('test.txt', 7n, 5);
            expect(partial.toString()).to.equal('World');
        });
    });
    
    describe('Cache Behavior', () => {
        it('should cache file metadata', async () => {
            const fileSystem = new MockFileSystem();
            let statCalls = 0;
            
            // Wrap stat to count calls
            const originalStat = fileSystem.stat.bind(fileSystem);
            fileSystem.stat = async (path: string) => {
                statCalls++;
                return originalStat(path);
            };
            
            const adapter = new (await import('../../src/provider/IFileSystemToProjFSAdapter.js')).IFileSystemToProjFSAdapter(
                fileSystem,
                'C:\\TestDrive',
                { cacheSize: 1024 * 1024 }
            );
            
            // First call - cache miss
            await adapter.onGetPlaceholderInfo('test.txt');
            expect(statCalls).to.equal(1);
            
            // Second call - cache hit
            await adapter.onGetPlaceholderInfo('test.txt');
            expect(statCalls).to.equal(1);
        });
    });
});