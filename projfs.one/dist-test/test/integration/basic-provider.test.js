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
const index_js_1 = require("../../src/index.js");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs_1 = require("fs");
/**
 * Mock IFileSystem implementation for testing
 */
class MockFileSystem {
    files = new Map();
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
    async createDir(directoryPath, dirMode) {
        this.files.set(directoryPath, {
            content: new Uint8Array(0),
            mode: dirMode,
            type: 'directory'
        });
    }
    async createFile(directoryPath, fileHash, fileName, fileMode) {
        const fullPath = path.posix.join(directoryPath, fileName);
        this.files.set(fullPath, {
            content: new TextEncoder().encode(`Mock content for ${fileName}`),
            mode: fileMode,
            type: 'file'
        });
    }
    async readDir(dirPath) {
        const children = [];
        const normalizedPath = dirPath.endsWith('/') && dirPath !== '/'
            ? dirPath.slice(0, -1)
            : dirPath;
        for (const [filePath,] of this.files) {
            if (filePath === normalizedPath)
                continue;
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
    async readFile(filePath) {
        const file = this.files.get(filePath);
        if (!file || file.type !== 'file') {
            throw new Error(`File not found: ${filePath}`);
        }
        return { content: file.content };
    }
    async readlink(filePath) {
        const file = this.files.get(filePath);
        if (!file || file.type !== 'symlink') {
            throw new Error(`Symlink not found: ${filePath}`);
        }
        return { content: new TextEncoder().encode(file.target || '') };
    }
    async readFileInChunks(filePath, length, position) {
        const file = await this.readFile(filePath);
        return {
            content: file.content.slice(position, position + length)
        };
    }
    supportsChunkedReading(path) {
        return true;
    }
    async stat(path) {
        const file = this.files.get(path);
        if (!file) {
            throw new Error(`Path not found: ${path}`);
        }
        return {
            mode: file.mode,
            size: file.type === 'directory' ? 0 : file.content.length
        };
    }
    async rmdir(pathName) {
        const file = this.files.get(pathName);
        if (!file || file.type !== 'directory') {
            return -1;
        }
        this.files.delete(pathName);
        return 0;
    }
    async unlink(pathName) {
        const file = this.files.get(pathName);
        if (!file || file.type === 'directory') {
            return -1;
        }
        this.files.delete(pathName);
        return 0;
    }
    async symlink(src, dest) {
        this.files.set(dest, {
            content: new Uint8Array(0),
            mode: 0o120777,
            type: 'symlink',
            target: src
        });
    }
    async rename(src, dest) {
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
describe('ProjFS Provider Integration Tests', function () {
    this.timeout(10000);
    let provider;
    let testRoot;
    before(async function () {
        // Skip if not on Windows
        if (os.platform() !== 'win32') {
            this.skip();
            return;
        }
        // Create test directory
        testRoot = path.join(os.tmpdir(), `projfs-test-${Date.now()}`);
        await fs_1.promises.mkdir(testRoot, { recursive: true });
    });
    after(async function () {
        // Cleanup
        if (provider?.isRunning()) {
            await provider.stop();
        }
        if (testRoot) {
            try {
                await fs_1.promises.rmdir(testRoot, { recursive: true });
            }
            catch (e) {
                // Ignore cleanup errors
            }
        }
    });
    describe('Provider Lifecycle', () => {
        it('should create provider instance', () => {
            const fileSystem = new MockFileSystem();
            provider = new index_js_1.ProjFSProvider(fileSystem, {
                logLevel: 'error'
            });
            (0, chai_1.expect)(provider).to.be.instanceOf(index_js_1.ProjFSProvider);
            (0, chai_1.expect)(provider.isRunning()).to.be.false;
        });
        it('should fail to start without native module', async () => {
            const fileSystem = new MockFileSystem();
            provider = new index_js_1.ProjFSProvider(fileSystem);
            try {
                await provider.start({
                    virtualizationRootPath: testRoot
                });
                // If we get here, native module loaded (unexpected in test)
                (0, chai_1.expect)(provider.isRunning()).to.be.true;
                await provider.stop();
            }
            catch (error) {
                // Expected: native module not loaded
                (0, chai_1.expect)(error.message).to.include('Native module not loaded');
            }
        });
        it('should get empty stats when not running', () => {
            const fileSystem = new MockFileSystem();
            provider = new index_js_1.ProjFSProvider(fileSystem);
            const stats = provider.getStats();
            (0, chai_1.expect)(stats).to.deep.include({
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
            const adapter = new (await Promise.resolve().then(() => __importStar(require('../../src/provider/IFileSystemToProjFSAdapter.js')))).IFileSystemToProjFSAdapter(fileSystem, 'C:\\TestDrive');
            // Test root path
            const rootInfo = await adapter.onGetPlaceholderInfo('');
            (0, chai_1.expect)(rootInfo.isDirectory).to.be.true;
            // Test file
            const fileInfo = await adapter.onGetPlaceholderInfo('test.txt');
            (0, chai_1.expect)(fileInfo.isDirectory).to.be.false;
            (0, chai_1.expect)(fileInfo.fileSize).to.equal(13n); // "Hello, World!"
        });
        it('should enumerate directories', async () => {
            const fileSystem = new MockFileSystem();
            const adapter = new (await Promise.resolve().then(() => __importStar(require('../../src/provider/IFileSystemToProjFSAdapter.js')))).IFileSystemToProjFSAdapter(fileSystem, 'C:\\TestDrive');
            const entries = await adapter.onGetDirectoryEnumeration('');
            (0, chai_1.expect)(entries).to.have.length(2);
            const names = entries.map(e => e.fileName).sort();
            (0, chai_1.expect)(names).to.deep.equal(['documents', 'test.txt']);
        });
        it('should read file data', async () => {
            const fileSystem = new MockFileSystem();
            const adapter = new (await Promise.resolve().then(() => __importStar(require('../../src/provider/IFileSystemToProjFSAdapter.js')))).IFileSystemToProjFSAdapter(fileSystem, 'C:\\TestDrive');
            // Read entire file
            const data = await adapter.onGetFileData('test.txt', 0n, 100);
            (0, chai_1.expect)(data.toString()).to.equal('Hello, World!');
            // Read partial
            const partial = await adapter.onGetFileData('test.txt', 7n, 5);
            (0, chai_1.expect)(partial.toString()).to.equal('World');
        });
    });
    describe('Cache Behavior', () => {
        it('should cache file metadata', async () => {
            const fileSystem = new MockFileSystem();
            let statCalls = 0;
            // Wrap stat to count calls
            const originalStat = fileSystem.stat.bind(fileSystem);
            fileSystem.stat = async (path) => {
                statCalls++;
                return originalStat(path);
            };
            const adapter = new (await Promise.resolve().then(() => __importStar(require('../../src/provider/IFileSystemToProjFSAdapter.js')))).IFileSystemToProjFSAdapter(fileSystem, 'C:\\TestDrive', { cacheSize: 1024 * 1024 });
            // First call - cache miss
            await adapter.onGetPlaceholderInfo('test.txt');
            (0, chai_1.expect)(statCalls).to.equal(1);
            // Second call - cache hit
            await adapter.onGetPlaceholderInfo('test.txt');
            (0, chai_1.expect)(statCalls).to.equal(1);
        });
    });
});
