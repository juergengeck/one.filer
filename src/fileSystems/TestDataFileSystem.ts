import type {IFileSystem, FileSystemDirectory, FileSystemFile, FileDescription} from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';

/**
 * Test Data File System - Creates dynamic test data on initialization
 */
export class TestDataFileSystem implements IFileSystem {
    private readonly creationTime: Date;
    private readonly instanceId: string;
    private initialized: boolean = false;
    private files: Map<string, Uint8Array> = new Map();
    private directories: Set<string> = new Set();

    constructor() {
        this.creationTime = new Date();
        this.instanceId = Math.random().toString(36).substring(2, 9);
        this.directories.add('/');
    }

    /**
     * Initialize with 5 unique dynamic test entries - called lazily
     */
    private async ensureInitialized(): Promise<void> {
        if (this.initialized) return;
        
        await this.initialize();
    }
    
    /**
     * Public initialization method to force test data creation
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;
        
        console.log('📝 Creating test data in /test-data folder...');
        
        // Create test data entries
        const testEntries = [
            {
                name: `instance-info-${this.instanceId}.json`,
                content: JSON.stringify({
                    instanceId: this.instanceId,
                    createdAt: this.creationTime.toISOString(),
                    platform: process.platform,
                    nodeVersion: process.version,
                    timestamp: Date.now()
                }, null, 2)
            },
            {
                name: `test-document-${Date.now()}.txt`,
                content: `Test Document
==================
Created: ${this.creationTime.toISOString()}
Instance: ${this.instanceId}
Platform: ${process.platform}

This is a test document created automatically by the TestDataFileSystem.
It demonstrates that the filesystem is working and can create content.

Random Data:
- Number: ${Math.floor(Math.random() * 10000)}
- String: ${Math.random().toString(36).substring(2)}
- UUID: ${this.generateUUID()}

End of test document.
`
            },
            {
                name: `metrics-${this.instanceId}.csv`,
                content: `timestamp,metric,value
${Date.now()},cpu_usage,${Math.random() * 100}
${Date.now() + 1000},memory_usage,${Math.random() * 100}
${Date.now() + 2000},disk_usage,${Math.random() * 100}
${Date.now() + 3000},network_latency,${Math.random() * 50}
${Date.now() + 4000},request_count,${Math.floor(Math.random() * 1000)}
`
            },
            {
                name: `config-sample.yaml`,
                content: `# Test Configuration File
instance:
  id: ${this.instanceId}
  created: ${this.creationTime.toISOString()}
  
test_data:
  random_number: ${Math.floor(Math.random() * 10000)}
  random_string: ${Math.random().toString(36).substring(2)}
  uuid: ${this.generateUUID()}
  
system:
  platform: ${process.platform}
  arch: ${process.arch}
  node_version: ${process.version}
`
            },
            {
                name: `readme.md`,
                content: `# Test Data Folder

This folder contains automatically generated test data.

## Instance Information
- **Instance ID**: ${this.instanceId}
- **Created**: ${this.creationTime.toISOString()}
- **Platform**: ${process.platform}

## Files in this folder

1. **instance-info-${this.instanceId}.json** - JSON metadata about this instance
2. **test-document-*.txt** - A sample text document with timestamps
3. **metrics-*.csv** - Sample CSV data with metrics
4. **config-sample.yaml** - Sample YAML configuration
5. **readme.md** - This file

## Nested Data

Check the \`nested-data\` directory for additional test content.

Generated at: ${new Date().toISOString()}
Random verification code: ${Math.random().toString(36).substring(2).toUpperCase()}
`
            }
        ];

        // Write all test files to our in-memory storage
        for (const entry of testEntries) {
            try {
                // Convert content to Uint8Array
                const content = new TextEncoder().encode(entry.content);
                // Store the file
                this.files.set(`/${entry.name}`, content);
                console.log(`   ✅ Created: ${entry.name}`);
            } catch (error) {
                console.error(`   ❌ Failed to create ${entry.name}:`, error);
            }
        }

        // Create a subdirectory with nested content
        try {
            // Add the nested directory
            this.directories.add('/nested-data');
            
            const nestedContent = JSON.stringify({
                level: 'nested',
                parentFolder: 'nested-data',
                created: new Date().toISOString(),
                instanceId: this.instanceId
            }, null, 2);
            
            const content = new TextEncoder().encode(nestedContent);
            this.files.set('/nested-data/nested-test.json', content);
            console.log('   ✅ Created: nested-data/nested-test.json');
        } catch (error) {
            console.error('   ❌ Failed to create nested data:', error);
        }

        this.initialized = true;
        console.log(`📊 Test data initialization complete - ${testEntries.length} files created`);
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private normalizePath(path: string): string {
        // Ensure path starts with /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        // Remove trailing slash except for root
        if (path !== '/' && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        return path;
    }


    // IFileSystem implementation
    async readDir(dirPath: string): Promise<FileSystemDirectory> {
        await this.ensureInitialized();
        dirPath = this.normalizePath(dirPath);
        
        const children: string[] = [];
        
        // List files in this directory
        for (const [path, ] of this.files) {
            const dir = path.substring(0, path.lastIndexOf('/')) || '/';
            if (dir === dirPath) {
                const fileName = path.substring(path.lastIndexOf('/') + 1);
                children.push(fileName);
            }
        }
        
        // List subdirectories
        for (const dir of this.directories) {
            if (dir === '/' || dir === dirPath) continue;
            const parentDir = dir.substring(0, dir.lastIndexOf('/')) || '/';
            if (parentDir === dirPath) {
                const dirName = dir.substring(dir.lastIndexOf('/') + 1);
                children.push(dirName);
            }
        }
        
        return { children };
    }

    async readFile(filePath: string): Promise<FileSystemFile> {
        await this.ensureInitialized();
        filePath = this.normalizePath(filePath);
        
        const content = this.files.get(filePath);
        if (!content) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        return {
            content: content
        };
    }

    async createDir(directoryPath: string, dirMode: number): Promise<void> {
        await this.ensureInitialized();
        directoryPath = this.normalizePath(directoryPath);
        this.directories.add(directoryPath);
    }

    async createFile(directoryPath: string, fileHash: SHA256Hash, fileName: string, fileMode: number): Promise<void> {
        await this.ensureInitialized();
        directoryPath = this.normalizePath(directoryPath);
        
        // Generate some test content for the new file
        const content = new TextEncoder().encode(`Test file created at ${new Date().toISOString()}\nHash: ${fileHash}\nMode: ${fileMode}`);
        const filePath = directoryPath === '/' ? `/${fileName}` : `${directoryPath}/${fileName}`;
        
        this.files.set(filePath, content);
        console.log(`   ✅ Created new file: ${filePath}`);
    }

    async readlink(filePath: string): Promise<FileSystemFile> {
        await this.ensureInitialized();
        throw new Error('Symlinks not supported in test filesystem');
    }

    async readFileInChunks(filePath: string, length: number, position: number): Promise<FileSystemFile> {
        await this.ensureInitialized();
        filePath = this.normalizePath(filePath);
        
        const content = this.files.get(filePath);
        if (!content) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        // For simplicity, return the whole file content
        return {
            content: content
        };
    }

    supportsChunkedReading(path?: string): boolean {
        return false; // Simple test filesystem doesn't support chunked reading
    }

    async stat(path: string): Promise<FileDescription> {
        await this.ensureInitialized();
        path = this.normalizePath(path);
        
        if (this.directories.has(path)) {
            return {
                size: 0,
                mode: 0o40755 // Directory mode
            };
        }
        
        const content = this.files.get(path);
        if (content) {
            return {
                size: content.length,
                mode: 0o100644 // File mode
            };
        }
        
        throw new Error(`Path not found: ${path}`);
    }

    async rmdir(pathName: string): Promise<number> {
        await this.ensureInitialized();
        pathName = this.normalizePath(pathName);
        
        if (this.directories.has(pathName)) {
            this.directories.delete(pathName);
            return 0;
        }
        return -1;
    }

    async unlink(pathName: string): Promise<number> {
        await this.ensureInitialized();
        pathName = this.normalizePath(pathName);
        
        if (this.files.has(pathName)) {
            this.files.delete(pathName);
            return 0;
        }
        return -1;
    }

    async symlink(src: string, dest: string): Promise<void> {
        await this.ensureInitialized();
        throw new Error('Symlinks not supported in test filesystem');
    }

    async rename(src: string, dest: string): Promise<number> {
        await this.ensureInitialized();
        src = this.normalizePath(src);
        dest = this.normalizePath(dest);
        
        // Try file rename
        const content = this.files.get(src);
        if (content) {
            this.files.set(dest, content);
            this.files.delete(src);
            return 0;
        }
        
        // Try directory rename
        if (this.directories.has(src)) {
            this.directories.delete(src);
            this.directories.add(dest);
            return 0;
        }
        
        return -1;
    }
    
    async chmod(pathName: string, mode: number): Promise<number> {
        await this.ensureInitialized();
        // No-op for test filesystem - permissions don't matter
        return 0; // Success
    }
    
    // Additional write method for easier testing
    async writeFile(filePath: string, content: string | Uint8Array): Promise<void> {
        await this.ensureInitialized();
        filePath = this.normalizePath(filePath);
        
        // Convert string to Uint8Array if needed
        const data = typeof content === 'string' 
            ? new TextEncoder().encode(content)
            : content;
            
        this.files.set(filePath, data);
        console.log(`   ✅ Wrote file: ${filePath} (${data.length} bytes)`);
    }
}