import type { IFileSystem, FileSystemDirectory, FileSystemFile, FileDescription } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';

export interface MockFile {
    content: Uint8Array;
    mode: number;
    size: number;
    mtime: Date;
}

export interface MockDirectory {
    children: string[];
    mode: number;
    mtime: Date;
}

export class MockFileSystem implements Partial<IFileSystem> {
    private data: Map<string, MockFile | MockDirectory> = new Map();
    private readDelay: number = 0;
    private failPaths: Set<string> = new Set();
    
    constructor() {
        // Initialize with root directory
        this.data.set('/', {
            children: [],
            mode: 16877, // Directory mode
            mtime: new Date()
        });
    }
    
    // Test helper methods
    public addFile(path: string, content: string | Uint8Array, mode: number = 33188): void {
        const contentBuffer = typeof content === 'string' 
            ? new TextEncoder().encode(content)
            : content;
            
        this.data.set(path, {
            content: contentBuffer,
            mode,
            size: contentBuffer.length,
            mtime: new Date()
        });
        
        // Add to parent directory
        this.addToParentDirectory(path);
    }
    
    public addDirectory(path: string, children: string[] = []): void {
        this.data.set(path, {
            children,
            mode: 16877,
            mtime: new Date()
        });
        
        // Add to parent directory
        if (path !== '/') {
            this.addToParentDirectory(path);
        }
    }
    
    public addToParentDirectory(path: string): void {
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
        const name = path.substring(path.lastIndexOf('/') + 1);
        
        const parent = this.data.get(parentPath) as MockDirectory;
        if (parent && !parent.children.includes(name)) {
            parent.children.push(name);
        }
    }
    
    public setReadDelay(ms: number): void {
        this.readDelay = ms;
    }
    
    public setFailPath(path: string): void {
        this.failPaths.add(path);
    }
    
    public clearFailPaths(): void {
        this.failPaths.clear();
    }
    
    private async delay(): Promise<void> {
        if (this.readDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.readDelay));
        }
    }
    
    // IFileSystem implementation
    async readDir(path: string): Promise<FileSystemDirectory> {
        await this.delay();
        
        if (this.failPaths.has(path)) {
            throw new Error(`Mock error: Failed to read directory ${path}`);
        }
        
        const entry = this.data.get(path);
        if (!entry) {
            throw new Error(`Path not found: ${path}`);
        }
        
        if (!('children' in entry)) {
            throw new Error(`Not a directory: ${path}`);
        }
        
        return {
            children: [...entry.children]
        };
    }
    
    async readFile(path: string): Promise<FileSystemFile> {
        await this.delay();
        
        if (this.failPaths.has(path)) {
            throw new Error(`Mock error: Failed to read file ${path}`);
        }
        
        const entry = this.data.get(path);
        if (!entry) {
            throw new Error(`File not found: ${path}`);
        }
        
        if (!('content' in entry)) {
            throw new Error(`Not a file: ${path}`);
        }
        
        return {
            content: new Uint8Array(entry.content)
        };
    }
    
    async stat(path: string): Promise<FileDescription> {
        await this.delay();
        
        if (this.failPaths.has(path)) {
            throw new Error(`Mock error: Failed to stat ${path}`);
        }
        
        const entry = this.data.get(path);
        if (!entry) {
            throw new Error(`Path not found: ${path}`);
        }
        
        const isDirectory = 'children' in entry;
        
        return {
            mode: entry.mode,
            size: isDirectory ? 0 : (entry as MockFile).size,
            // Add isDirectory as extension for our tests
            isDirectory
        } as FileDescription & { isDirectory?: boolean; mtime?: Date };
    }
    
    // Test helper to get internal state
    public getInternalState(): Map<string, MockFile | MockDirectory> {
        return new Map(this.data);
    }
    
    // Helper to create realistic test data
    public setupTestData(): void {
        // Root directories
        this.addDirectory('/chats', []);
        this.addDirectory('/debug', []);
        this.addDirectory('/objects', []);
        this.addDirectory('/invites', []);
        this.addDirectory('/types', []);
        
        // Add some test files
        this.addDirectory('/chats/channel1', ['message1.txt', 'message2.txt']);
        this.addFile('/chats/channel1/message1.txt', 'Hello World');
        this.addFile('/chats/channel1/message2.txt', 'Test message');
        
        this.addDirectory('/debug/logs', ['app.log', 'error.log']);
        this.addFile('/debug/logs/app.log', 'Application started\n');
        this.addFile('/debug/logs/error.log', 'No errors\n');
        
        // Update root children
        (this.data.get('/') as MockDirectory).children = ['chats', 'debug', 'objects', 'invites', 'types'];
    }
}