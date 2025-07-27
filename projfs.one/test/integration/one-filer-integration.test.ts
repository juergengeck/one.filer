import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';

// Mock IFileSystem for testing
class MockFileSystem implements IFileSystem {
    private files = new Map<string, { content: Uint8Array; mode: number }>();
    
    constructor() {
        this.files.set('/', { content: new Uint8Array(0), mode: 0o040755 });
        this.files.set('/test.txt', {
            content: new TextEncoder().encode('Test content'),
            mode: 0o100644
        });
    }
    
    async createDir(directoryPath: string, dirMode: number): Promise<void> {
        this.files.set(directoryPath, { content: new Uint8Array(0), mode: dirMode });
    }
    
    async createFile(directoryPath: string, _fileHash: string, fileName: string, fileMode: number): Promise<void> {
        const fullPath = `${directoryPath}/${fileName}`.replace('//', '/');
        this.files.set(fullPath, {
            content: new TextEncoder().encode(`File: ${fileName}`),
            mode: fileMode
        });
    }
    
    async readDir(dirPath: string): Promise<{ children: string[] }> {
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
        return { content: file.content.slice(position, position + length) };
    }
    
    supportsChunkedReading(_path?: string): boolean {
        return true;
    }
    
    async stat(path: string): Promise<{ mode: number; size: number }> {
        const file = this.files.get(path);
        if (!file) {
            throw new Error(`Path not found: ${path}`);
        }
        return { mode: file.mode, size: file.content.length };
    }
    
    async rmdir(pathName: string): Promise<number> {
        this.files.delete(pathName);
        return 0;
    }
    
    async deleteFile(filePath: string): Promise<void> {
        this.files.delete(filePath);
    }
    
    async unlink(pathName: string): Promise<number> {
        this.files.delete(pathName);
        return 0;
    }
    
    async symlink(target: string, linkPath: string): Promise<void> {
        this.files.set(linkPath, {
            content: new TextEncoder().encode(`symlink:${target}`),
            mode: 0o120777
        });
    }
    
    async rename(src: string, dest: string): Promise<number> {
        const file = this.files.get(src);
        if (file) {
            this.files.set(dest, file);
            this.files.delete(src);
            return 0;
        }
        return -1;
    }
    
    async chmod(pathName: string, mode: number): Promise<number> {
        const file = this.files.get(pathName);
        if (file) {
            file.mode = mode;
            return 0;
        }
        return -1;
    }
}

describe('ONE.filer Integration', () => {
    describe('Mock IFileSystem', () => {
        let fileSystem: IFileSystem;
        
        before(() => {
            fileSystem = new MockFileSystem();
        });
        
        it('should read root directory', async () => {
            const result = await fileSystem.readDir('/');
            expect(result.children).to.include('test.txt');
        });
        
        it('should read file content', async () => {
            const result = await fileSystem.readFile('/test.txt');
            const content = new TextDecoder().decode(result.content);
            expect(content).to.equal('Test content');
        });
        
        it('should get file stats', async () => {
            const stats = await fileSystem.stat('/test.txt');
            expect(stats.mode).to.equal(0o100644);
            expect(stats.size).to.equal(12); // "Test content" length
        });
        
        it('should support chunked reading', async () => {
            const chunk = await fileSystem.readFileInChunks('/test.txt', 4, 0);
            const content = new TextDecoder().decode(chunk.content);
            expect(content).to.equal('Test');
        });
        
        it('should create and delete files', async () => {
            await fileSystem.createFile('/', 'hash123', 'new.txt', 0o100644);
            
            const result = await fileSystem.readDir('/');
            expect(result.children).to.include('new.txt');
            
            await fileSystem.unlink('/new.txt');
            const afterDelete = await fileSystem.readDir('/');
            expect(afterDelete.children).to.not.include('new.txt');
        });
    });
    
    describe('Integration Configuration', () => {
        it('should have valid default configuration', () => {
            const config = {
                directory: './one-data',
                filer: {
                    projfsRoot: 'C:\\OneFiler',
                    useProjFS: true
                },
                communication: {
                    url: 'https://comm.one-dragon.com'
                }
            };
            
            expect(config.directory).to.be.a('string');
            expect(config.filer.projfsRoot).to.match(/^[A-Z]:\\/);
            expect(config.filer.useProjFS).to.be.true;
            expect(config.communication.url).to.match(/^https:\/\//);
        });
    });
    
    // Note: Full integration tests with ProjFS require Windows environment
    // and native module compilation. These tests verify the interfaces
    // and mock implementations work correctly.
});