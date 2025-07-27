"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const sinon = __importStar(require("sinon"));
const IFileSystemToProjFSAdapter_js_1 = require("../../src/provider/IFileSystemToProjFSAdapter.js");
/**
 * Mock IFileSystem for testing file modification handling
 */
class MockModifiableFileSystem {
    files = new Map();
    unlinkCalls = [];
    rmdirCalls = [];
    renameCalls = [];
    createDirCalls = [];
    constructor() {
        // Initialize with test data
        this.files.set('/', { content: new Uint8Array(0), mode: 0o040755 });
        this.files.set('/test.txt', {
            content: new TextEncoder().encode('Original content'),
            mode: 0o100644
        });
        this.files.set('/docs', { content: new Uint8Array(0), mode: 0o040755 });
    }
    async createDir(directoryPath, dirMode) {
        this.createDirCalls.push({ path: directoryPath, mode: dirMode });
        this.files.set(directoryPath, {
            content: new Uint8Array(0),
            mode: dirMode
        });
    }
    async createFile(directoryPath, _fileHash, fileName, fileMode) {
        const fullPath = directoryPath + '/' + fileName;
        this.files.set(fullPath, {
            content: new TextEncoder().encode(`Created file: ${fileName}`),
            mode: fileMode
        });
    }
    async readDir(dirPath) {
        const children = [];
        const normalizedPath = dirPath.endsWith('/') && dirPath !== '/'
            ? dirPath.slice(0, -1)
            : dirPath;
        for (const [path, file] of this.files) {
            if (file.deleted)
                continue;
            if (path === normalizedPath)
                continue;
            const isChild = path.startsWith(normalizedPath + '/') &&
                !path.slice(normalizedPath.length + 1).includes('/');
            if (isChild) {
                children.push(path.slice(normalizedPath.length + 1));
            }
        }
        return { children };
    }
    async readFile(filePath) {
        const file = this.files.get(filePath);
        if (!file || file.deleted) {
            throw new Error(`File not found: ${filePath}`);
        }
        return { content: file.content };
    }
    async readlink(_filePath) {
        throw new Error('Not implemented');
    }
    async readFileInChunks(filePath, length, position) {
        const file = await this.readFile(filePath);
        return {
            content: file.content.slice(position, position + length)
        };
    }
    supportsChunkedReading(_path) {
        return true;
    }
    async stat(path) {
        const file = this.files.get(path);
        if (!file || file.deleted) {
            throw new Error(`Path not found: ${path}`);
        }
        return {
            mode: file.mode,
            size: file.content.length
        };
    }
    async rmdir(pathName) {
        this.rmdirCalls.push(pathName);
        const file = this.files.get(pathName);
        if (!file || (file.mode & 0o040000) === 0) {
            return -1;
        }
        file.deleted = true;
        return 0;
    }
    async unlink(pathName) {
        this.unlinkCalls.push(pathName);
        const file = this.files.get(pathName);
        if (!file || (file.mode & 0o040000) !== 0) {
            return -1;
        }
        file.deleted = true;
        return 0;
    }
    async symlink(_src, _dest) {
        throw new Error('Not implemented');
    }
    async rename(src, dest) {
        this.renameCalls.push({ src, dest });
        const file = this.files.get(src);
        if (!file) {
            return -1;
        }
        this.files.set(dest, file);
        this.files.delete(src);
        return 0;
    }
    async chmod(pathName, mode) {
        const file = this.files.get(pathName);
        if (!file) {
            return -1;
        }
        file.mode = mode;
        return 0;
    }
}
describe('File Modification Handling', () => {
    let fileSystem;
    let adapter;
    beforeEach(() => {
        fileSystem = new MockModifiableFileSystem();
        adapter = new IFileSystemToProjFSAdapter_js_1.IFileSystemToProjFSAdapter(fileSystem, 'C:\\TestDrive');
    });
    describe('File Deletion', () => {
        it('should handle file deletion notification', async () => {
            await adapter.onNotifyFileHandleClosedFileModified('test.txt', false, // isDirectory
            true, // isFileDeleted
            0);
            (0, chai_1.expect)(fileSystem.unlinkCalls).to.deep.equal(['/test.txt']);
        });
        it('should handle directory deletion notification', async () => {
            await adapter.onNotifyFileHandleClosedFileModified('docs', true, // isDirectory
            true, // isFileDeleted
            0);
            // Directories are only cache-invalidated in this notification
            (0, chai_1.expect)(fileSystem.rmdirCalls).to.be.empty;
        });
    });
    describe('File Rename', () => {
        it('should handle file rename notification', async () => {
            await adapter.onNotifyFileRenamed('test.txt', 'renamed.txt', false, // isDirectory
            0);
            (0, chai_1.expect)(fileSystem.renameCalls).to.deep.equal([{
                    src: '/test.txt',
                    dest: '/renamed.txt'
                }]);
        });
        it('should handle directory rename notification', async () => {
            await adapter.onNotifyFileRenamed('docs', 'documents', true, // isDirectory
            0);
            (0, chai_1.expect)(fileSystem.renameCalls).to.deep.equal([{
                    src: '/docs',
                    dest: '/documents'
                }]);
        });
        it('should handle rename to different directory', async () => {
            await adapter.onNotifyFileRenamed('test.txt', 'docs\\moved.txt', false, 0);
            (0, chai_1.expect)(fileSystem.renameCalls).to.deep.equal([{
                    src: '/test.txt',
                    dest: '/docs/moved.txt'
                }]);
        });
    });
    describe('File Creation', () => {
        it('should handle new directory creation', async () => {
            await adapter.onNotifyNewFileCreated('newfolder', true, // isDirectory
            0);
            (0, chai_1.expect)(fileSystem.createDirCalls).to.deep.equal([{
                    path: '/newfolder',
                    mode: 0o755
                }]);
        });
        it('should handle new file creation notification', async () => {
            await adapter.onNotifyNewFileCreated('newfile.txt', false, // isDirectory
            0);
            // Files wait for content in onNotifyFileHandleClosedFileModified
            (0, chai_1.expect)(fileSystem.createDirCalls).to.be.empty;
        });
    });
    describe('Pre-Delete Notification', () => {
        it('should handle pre-delete for files', async () => {
            await adapter.onNotifyPreDelete('test.txt', false, // isDirectory
            0);
            (0, chai_1.expect)(fileSystem.unlinkCalls).to.deep.equal(['/test.txt']);
        });
        it('should handle pre-delete for directories', async () => {
            await adapter.onNotifyPreDelete('docs', true, // isDirectory
            0);
            (0, chai_1.expect)(fileSystem.rmdirCalls).to.deep.equal(['/docs']);
        });
    });
    describe('Cache Invalidation', () => {
        it('should invalidate cache on file modification', async () => {
            // First cache some data
            await adapter.onGetPlaceholderInfo('test.txt');
            // Spy on cache invalidation
            const cacheInvalidateSpy = sinon.spy(adapter.cache, 'invalidatePath');
            // Trigger modification
            await adapter.onNotifyFileHandleClosedFileModified('test.txt', false, false, // not deleted, just modified
            0);
            // Should invalidate the file and its parent
            (0, chai_1.expect)(cacheInvalidateSpy.calledWith('/test.txt')).to.be.true;
            (0, chai_1.expect)(cacheInvalidateSpy.calledWith('/')).to.be.true;
            cacheInvalidateSpy.restore();
        });
        it('should invalidate cache on rename', async () => {
            const cacheInvalidateSpy = sinon.spy(adapter.cache, 'invalidatePath');
            await adapter.onNotifyFileRenamed('test.txt', 'docs\\moved.txt', false, 0);
            // Should invalidate source, dest, and both parents
            (0, chai_1.expect)(cacheInvalidateSpy.calledWith('/test.txt')).to.be.true;
            (0, chai_1.expect)(cacheInvalidateSpy.calledWith('/docs/moved.txt')).to.be.true;
            (0, chai_1.expect)(cacheInvalidateSpy.calledWith('/')).to.be.true;
            (0, chai_1.expect)(cacheInvalidateSpy.calledWith('/docs')).to.be.true;
            cacheInvalidateSpy.restore();
        });
    });
    describe('Error Handling', () => {
        it('should handle unlink failure gracefully', async () => {
            // Make unlink fail
            sinon.stub(fileSystem, 'unlink').resolves(-1);
            try {
                await adapter.onNotifyFileHandleClosedFileModified('test.txt', false, true, // isFileDeleted
                0);
                chai_1.expect.fail('Should have thrown error');
            }
            catch (error) {
                (0, chai_1.expect)(error.message).to.include('Failed to delete file');
            }
        });
        it('should handle rename failure gracefully', async () => {
            // Make rename fail
            sinon.stub(fileSystem, 'rename').resolves(-1);
            try {
                await adapter.onNotifyFileRenamed('test.txt', 'renamed.txt', false, 0);
                chai_1.expect.fail('Should have thrown error');
            }
            catch (error) {
                (0, chai_1.expect)(error.message).to.include('Failed to rename');
            }
        });
    });
});
