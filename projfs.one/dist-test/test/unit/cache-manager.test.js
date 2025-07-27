"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const CacheManager_js_1 = require("../../src/cache/CacheManager.js");
describe('CacheManager', () => {
    let cache;
    beforeEach(() => {
        cache = new CacheManager_js_1.CacheManager(1024 * 1024); // 1MB
    });
    describe('File Info Cache', () => {
        it('should store and retrieve file info', async () => {
            const info = {
                isDirectory: false,
                fileSize: 1024n,
                creationTime: new Date(),
                lastAccessTime: new Date(),
                lastWriteTime: new Date(),
                changeTime: new Date(),
                fileAttributes: 0
            };
            await cache.putFileInfo('/test.txt', info);
            const retrieved = await cache.getFileInfo('/test.txt');
            (0, chai_1.expect)(retrieved).to.deep.equal(info);
        });
        it('should return undefined for missing file info', async () => {
            const result = await cache.getFileInfo('/missing.txt');
            (0, chai_1.expect)(result).to.be.undefined;
        });
        it('should update existing file info', async () => {
            const info1 = {
                isDirectory: false,
                fileSize: 1024n,
                creationTime: new Date(),
                lastAccessTime: new Date(),
                lastWriteTime: new Date(),
                changeTime: new Date(),
                fileAttributes: 0
            };
            const info2 = {
                ...info1,
                fileSize: 2048n
            };
            await cache.putFileInfo('/test.txt', info1);
            await cache.putFileInfo('/test.txt', info2);
            const retrieved = await cache.getFileInfo('/test.txt');
            (0, chai_1.expect)(retrieved?.fileSize).to.equal(2048n);
        });
    });
    describe('Directory Listing Cache', () => {
        it('should store and retrieve directory listings', async () => {
            const entries = [
                {
                    fileName: 'file1.txt',
                    isDirectory: false,
                    fileSize: 100n,
                    creationTime: new Date(),
                    lastAccessTime: new Date(),
                    lastWriteTime: new Date(),
                    changeTime: new Date(),
                    fileAttributes: 0
                },
                {
                    fileName: 'subfolder',
                    isDirectory: true,
                    fileSize: 0n,
                    creationTime: new Date(),
                    lastAccessTime: new Date(),
                    lastWriteTime: new Date(),
                    changeTime: new Date(),
                    fileAttributes: 16 // FILE_ATTRIBUTE_DIRECTORY
                }
            ];
            await cache.putDirectoryListing('/folder', entries);
            const retrieved = await cache.getDirectoryListing('/folder');
            (0, chai_1.expect)(retrieved).to.have.length(2);
            (0, chai_1.expect)(retrieved).to.deep.equal(entries);
        });
        it('should handle empty directories', async () => {
            await cache.putDirectoryListing('/empty', []);
            const retrieved = await cache.getDirectoryListing('/empty');
            (0, chai_1.expect)(retrieved).to.be.an('array').that.is.empty;
        });
    });
    describe('Content Cache', () => {
        it('should store and retrieve content chunks', async () => {
            const chunk = Buffer.from([1, 2, 3, 4, 5]);
            await cache.putFileContent('/file.txt', 0, chunk);
            const retrieved = await cache.getFileContent('/file.txt', 0, 5);
            (0, chai_1.expect)(retrieved).to.deep.equal(chunk);
        });
        it('should handle partial chunk retrieval', async () => {
            const chunk = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
            await cache.putFileContent('/file.txt', 0, chunk);
            const retrieved = await cache.getFileContent('/file.txt', 2, 3);
            (0, chai_1.expect)(retrieved).to.deep.equal(Buffer.from([3, 4, 5]));
        });
        it('should merge adjacent chunks', async () => {
            const chunk1 = Buffer.from([1, 2, 3, 4]);
            const chunk2 = Buffer.from([5, 6, 7, 8]);
            await cache.putFileContent('/file.txt', 0, chunk1);
            await cache.putFileContent('/file.txt', 4, chunk2);
            const retrieved = await cache.getFileContent('/file.txt', 0, 8);
            (0, chai_1.expect)(retrieved).to.deep.equal(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
        });
        it('should handle overlapping chunks', async () => {
            const chunk1 = Buffer.from([1, 2, 3, 4, 5]);
            const chunk2 = Buffer.from([4, 5, 6, 7, 8]);
            await cache.putFileContent('/file.txt', 0, chunk1);
            await cache.putFileContent('/file.txt', 3, chunk2);
            const retrieved = await cache.getFileContent('/file.txt', 0, 8);
            (0, chai_1.expect)(retrieved).to.deep.equal(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
        });
    });
    describe('Path Invalidation', () => {
        it('should invalidate single path', async () => {
            const info = {
                isDirectory: false,
                fileSize: 1024n,
                creationTime: new Date(),
                lastAccessTime: new Date(),
                lastWriteTime: new Date(),
                changeTime: new Date(),
                fileAttributes: 0
            };
            await cache.putFileInfo('/test.txt', info);
            await cache.invalidatePath('/test.txt');
            const retrieved = await cache.getFileInfo('/test.txt');
            (0, chai_1.expect)(retrieved).to.be.undefined;
        });
        it('should invalidate all children of a path', async () => {
            await cache.putFileInfo('/folder/file1.txt', {});
            await cache.putFileInfo('/folder/file2.txt', {});
            await cache.putFileInfo('/folder/subfolder/file3.txt', {});
            await cache.putFileInfo('/other/file.txt', {});
            await cache.invalidatePath('/folder');
            (0, chai_1.expect)(await cache.getFileInfo('/folder/file1.txt')).to.be.undefined;
            (0, chai_1.expect)(await cache.getFileInfo('/folder/file2.txt')).to.be.undefined;
            (0, chai_1.expect)(await cache.getFileInfo('/folder/subfolder/file3.txt')).to.be.undefined;
            (0, chai_1.expect)(await cache.getFileInfo('/other/file.txt')).to.not.be.undefined;
        });
    });
    describe('Cache Statistics', () => {
        it('should track cache statistics', () => {
            const stats = cache.getStats();
            (0, chai_1.expect)(stats).to.have.property('metadataEntries');
            (0, chai_1.expect)(stats).to.have.property('directoryEntries');
            (0, chai_1.expect)(stats).to.have.property('contentEntries');
            (0, chai_1.expect)(stats).to.have.property('metadataSize');
            (0, chai_1.expect)(stats).to.have.property('directorySize');
            (0, chai_1.expect)(stats).to.have.property('contentSize');
        });
        it('should clear cache when requested', async () => {
            await cache.putFileInfo('/test.txt', {});
            await cache.putDirectoryListing('/folder', []);
            await cache.putFileContent('/file.txt', 0, Buffer.from([1, 2, 3]));
            await cache.clear();
            const stats = cache.getStats();
            (0, chai_1.expect)(stats.metadataEntries).to.equal(0);
            (0, chai_1.expect)(stats.directoryEntries).to.equal(0);
            (0, chai_1.expect)(stats.contentEntries).to.equal(0);
        });
    });
});
