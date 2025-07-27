"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const IFileSystemToProjFSAdapter_js_1 = require("../../src/provider/IFileSystemToProjFSAdapter.js");
/**
 * Performance test for large directory enumeration
 */
class LargeDirectoryFileSystem {
    fileCount;
    constructor(fileCount = 10000) {
        this.fileCount = fileCount;
    }
    async createDir(directoryPath, dirMode) {
        throw new Error('Not implemented');
    }
    async createFile(directoryPath, fileHash, fileName, fileMode) {
        throw new Error('Not implemented');
    }
    async readDir(dirPath) {
        const children = [];
        if (dirPath === '/' || dirPath === '') {
            // Generate large number of files
            for (let i = 0; i < this.fileCount; i++) {
                children.push(`file_${i.toString().padStart(6, '0')}.txt`);
            }
            // Add some directories
            for (let i = 0; i < 100; i++) {
                children.push(`folder_${i.toString().padStart(3, '0')}`);
            }
        }
        return { children };
    }
    async readFile(filePath) {
        return {
            content: new TextEncoder().encode(`Content of ${filePath}`)
        };
    }
    async readlink(filePath) {
        throw new Error('Not implemented');
    }
    async readFileInChunks(filePath, length, position) {
        const content = `Content of ${filePath}`.repeat(100);
        const bytes = new TextEncoder().encode(content);
        return {
            content: bytes.slice(Number(position), Number(position) + length)
        };
    }
    supportsChunkedReading(path) {
        return true;
    }
    async stat(path) {
        if (path === '/' || path === '') {
            return {
                mode: 0o040755,
                size: 0
            };
        }
        if (path.includes('folder_')) {
            return {
                mode: 0o040755,
                size: 0
            };
        }
        return {
            mode: 0o100644,
            size: 1024 * 1024 // 1MB files
        };
    }
    async rmdir(pathName) {
        return 0;
    }
    async unlink(pathName) {
        return 0;
    }
    async symlink(src, dest) {
        throw new Error('Not implemented');
    }
    async rename(src, dest) {
        return 0;
    }
    async chmod(pathName, mode) {
        return 0;
    }
}
describe('Performance: Large Directory', function () {
    this.timeout(60000); // 60 second timeout
    describe('Directory Enumeration', () => {
        it('should handle 10,000 files efficiently', async () => {
            const fileSystem = new LargeDirectoryFileSystem(10000);
            const adapter = new IFileSystemToProjFSAdapter_js_1.IFileSystemToProjFSAdapter(fileSystem, 'C:\\TestDrive', { cacheSize: 10 * 1024 * 1024 } // 10MB cache
            );
            const start = Date.now();
            const entries = await adapter.onGetDirectoryEnumeration('');
            const duration = Date.now() - start;
            (0, chai_1.expect)(entries).to.have.length(10100); // 10000 files + 100 folders
            (0, chai_1.expect)(duration).to.be.below(1000); // Should complete in under 1 second
            console.log(`Enumerated ${entries.length} entries in ${duration}ms`);
        });
        it('should benefit from caching on repeated calls', async () => {
            const fileSystem = new LargeDirectoryFileSystem(5000);
            const adapter = new IFileSystemToProjFSAdapter_js_1.IFileSystemToProjFSAdapter(fileSystem, 'C:\\TestDrive', { cacheSize: 10 * 1024 * 1024 });
            // First call - cache miss
            const start1 = Date.now();
            await adapter.onGetDirectoryEnumeration('');
            const duration1 = Date.now() - start1;
            // Second call - cache hit
            const start2 = Date.now();
            await adapter.onGetDirectoryEnumeration('');
            const duration2 = Date.now() - start2;
            (0, chai_1.expect)(duration2).to.be.below(duration1 / 2); // Cache hit should be at least 2x faster
            console.log(`First call: ${duration1}ms, Second call: ${duration2}ms`);
        });
    });
    describe('File Metadata Performance', () => {
        it('should retrieve metadata quickly', async () => {
            const fileSystem = new LargeDirectoryFileSystem();
            const adapter = new IFileSystemToProjFSAdapter_js_1.IFileSystemToProjFSAdapter(fileSystem, 'C:\\TestDrive');
            const times = [];
            // Get metadata for 100 files
            for (let i = 0; i < 100; i++) {
                const start = Date.now();
                await adapter.onGetPlaceholderInfo(`file_${i.toString().padStart(6, '0')}.txt`);
                times.push(Date.now() - start);
            }
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);
            (0, chai_1.expect)(avgTime).to.be.below(10); // Average should be under 10ms
            (0, chai_1.expect)(maxTime).to.be.below(100); // Max should be under 100ms (ProjFS requirement)
            console.log(`Metadata retrieval - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime}ms`);
        });
    });
    describe('Concurrent Access', () => {
        it('should handle concurrent requests efficiently', async () => {
            const fileSystem = new LargeDirectoryFileSystem();
            const adapter = new IFileSystemToProjFSAdapter_js_1.IFileSystemToProjFSAdapter(fileSystem, 'C:\\TestDrive');
            const start = Date.now();
            // Simulate concurrent access to different files
            const promises = [];
            for (let i = 0; i < 100; i++) {
                promises.push(adapter.onGetPlaceholderInfo(`file_${i.toString().padStart(6, '0')}.txt`));
                promises.push(adapter.onGetFileData(`file_${i.toString().padStart(6, '0')}.txt`, 0n, 1024));
            }
            await Promise.all(promises);
            const duration = Date.now() - start;
            (0, chai_1.expect)(duration).to.be.below(2000); // 200 operations should complete in under 2 seconds
            console.log(`Completed ${promises.length} concurrent operations in ${duration}ms`);
        });
    });
    describe('Memory Usage', () => {
        it('should maintain reasonable memory usage with cache limits', async () => {
            const fileSystem = new LargeDirectoryFileSystem();
            const adapter = new IFileSystemToProjFSAdapter_js_1.IFileSystemToProjFSAdapter(fileSystem, 'C:\\TestDrive', { cacheSize: 1 * 1024 * 1024 } // 1MB cache limit
            );
            // Access many files to test cache eviction
            for (let i = 0; i < 1000; i++) {
                await adapter.onGetPlaceholderInfo(`file_${i.toString().padStart(6, '0')}.txt`);
                await adapter.onGetFileData(`file_${i.toString().padStart(6, '0')}.txt`, 0n, 1024);
            }
            const stats = adapter.cache.getStats();
            (0, chai_1.expect)(stats.totalSizeBytes).to.be.below(1.5 * 1024 * 1024); // Should stay near 1MB limit
            console.log(`Cache stats after 1000 operations:`, stats);
        });
    });
});
