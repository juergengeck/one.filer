import { expect } from 'chai';
import * as sinon from 'sinon';
import { IFileSystemToProjFSAdapter } from '../../src/provider/IFileSystemToProjFSAdapter.js';
import type { IFileSystem, FileSystemFile, FileSystemDirectory, FileDescription } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import type { NotificationType } from '../../src/native/projfs-types.js';

/**
 * Mock IFileSystem for testing file modification handling
 */
class MockModifiableFileSystem implements IFileSystem {
    private files = new Map<string, {
        content: Uint8Array;
        mode: number;
        deleted?: boolean;
    }>();
    
    public unlinkCalls: string[] = [];
    public rmdirCalls: string[] = [];
    public renameCalls: Array<{ src: string; dest: string }> = [];
    public createDirCalls: Array<{ path: string; mode: number }> = [];
    
    constructor() {
        // Initialize with test data
        this.files.set('/', { content: new Uint8Array(0), mode: 0o040755 });
        this.files.set('/test.txt', {
            content: new TextEncoder().encode('Original content'),
            mode: 0o100644
        });
        this.files.set('/docs', { content: new Uint8Array(0), mode: 0o040755 });
    }
    
    async createDir(directoryPath: string, dirMode: number): Promise<void> {
        this.createDirCalls.push({ path: directoryPath, mode: dirMode });
        this.files.set(directoryPath, {
            content: new Uint8Array(0),
            mode: dirMode
        });
    }
    
    async createFile(
        directoryPath: string,
        _fileHash: string,
        fileName: string,
        fileMode: number
    ): Promise<void> {
        const fullPath = directoryPath + '/' + fileName;
        this.files.set(fullPath, {
            content: new TextEncoder().encode(`Created file: ${fileName}`),
            mode: fileMode
        });
    }
    
    async readDir(dirPath: string): Promise<FileSystemDirectory> {
        const children: string[] = [];
        const normalizedPath = dirPath.endsWith('/') && dirPath !== '/' 
            ? dirPath.slice(0, -1) 
            : dirPath;
        
        for (const [path, file] of this.files) {
            if (file.deleted) continue;
            if (path === normalizedPath) continue;
            
            const isChild = path.startsWith(normalizedPath + '/') &&
                           !path.slice(normalizedPath.length + 1).includes('/');
            if (isChild) {
                children.push(path.slice(normalizedPath.length + 1));
            }
        }
        
        return { children };
    }
    
    async readFile(filePath: string): Promise<FileSystemFile> {
        const file = this.files.get(filePath);
        if (!file || file.deleted) {
            throw new Error(`File not found: ${filePath}`);
        }
        return { content: file.content };
    }
    
    async readlink(_filePath: string): Promise<FileSystemFile> {
        throw new Error('Not implemented');
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
    
    supportsChunkedReading(_path?: string): boolean {
        return true;
    }
    
    async stat(path: string): Promise<FileDescription> {
        const file = this.files.get(path);
        if (!file || file.deleted) {
            throw new Error(`Path not found: ${path}`);
        }
        
        return {
            mode: file.mode,
            size: file.content.length
        };
    }
    
    async rmdir(pathName: string): Promise<number> {
        this.rmdirCalls.push(pathName);
        const file = this.files.get(pathName);
        if (!file || (file.mode & 0o040000) === 0) {
            return -1;
        }
        file.deleted = true;
        return 0;
    }
    
    async unlink(pathName: string): Promise<number> {
        this.unlinkCalls.push(pathName);
        const file = this.files.get(pathName);
        if (!file || (file.mode & 0o040000) !== 0) {
            return -1;
        }
        file.deleted = true;
        return 0;
    }
    
    async symlink(_src: string, _dest: string): Promise<void> {
        throw new Error('Not implemented');
    }
    
    async rename(src: string, dest: string): Promise<number> {
        this.renameCalls.push({ src, dest });
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

describe('File Modification Handling', () => {
    let fileSystem: MockModifiableFileSystem;
    let adapter: IFileSystemToProjFSAdapter;
    
    beforeEach(() => {
        fileSystem = new MockModifiableFileSystem();
        adapter = new IFileSystemToProjFSAdapter(
            fileSystem,
            'C:\\TestDrive'
        );
    });
    
    describe('File Deletion', () => {
        it('should handle file deletion notification', async () => {
            await adapter.onNotifyFileHandleClosedFileModified(
                'test.txt',
                false, // isDirectory
                true,  // isFileDeleted
                0 as NotificationType
            );
            
            expect(fileSystem.unlinkCalls).to.deep.equal(['/test.txt']);
        });
        
        it('should handle directory deletion notification', async () => {
            await adapter.onNotifyFileHandleClosedFileModified(
                'docs',
                true,  // isDirectory
                true,  // isFileDeleted
                0 as NotificationType
            );
            
            // Directories are only cache-invalidated in this notification
            expect(fileSystem.rmdirCalls).to.be.empty;
        });
    });
    
    describe('File Rename', () => {
        it('should handle file rename notification', async () => {
            await adapter.onNotifyFileRenamed(
                'test.txt',
                'renamed.txt',
                false, // isDirectory
                0 as NotificationType
            );
            
            expect(fileSystem.renameCalls).to.deep.equal([{
                src: '/test.txt',
                dest: '/renamed.txt'
            }]);
        });
        
        it('should handle directory rename notification', async () => {
            await adapter.onNotifyFileRenamed(
                'docs',
                'documents',
                true, // isDirectory
                0 as NotificationType
            );
            
            expect(fileSystem.renameCalls).to.deep.equal([{
                src: '/docs',
                dest: '/documents'
            }]);
        });
        
        it('should handle rename to different directory', async () => {
            await adapter.onNotifyFileRenamed(
                'test.txt',
                'docs\\moved.txt',
                false,
                0 as NotificationType
            );
            
            expect(fileSystem.renameCalls).to.deep.equal([{
                src: '/test.txt',
                dest: '/docs/moved.txt'
            }]);
        });
    });
    
    describe('File Creation', () => {
        it('should handle new directory creation', async () => {
            await adapter.onNotifyNewFileCreated(
                'newfolder',
                true, // isDirectory
                0 as NotificationType
            );
            
            expect(fileSystem.createDirCalls).to.deep.equal([{
                path: '/newfolder',
                mode: 0o755
            }]);
        });
        
        it('should handle new file creation notification', async () => {
            await adapter.onNotifyNewFileCreated(
                'newfile.txt',
                false, // isDirectory
                0 as NotificationType
            );
            
            // Files wait for content in onNotifyFileHandleClosedFileModified
            expect(fileSystem.createDirCalls).to.be.empty;
        });
    });
    
    describe('Pre-Delete Notification', () => {
        it('should handle pre-delete for files', async () => {
            await adapter.onNotifyPreDelete(
                'test.txt',
                false, // isDirectory
                0 as NotificationType
            );
            
            expect(fileSystem.unlinkCalls).to.deep.equal(['/test.txt']);
        });
        
        it('should handle pre-delete for directories', async () => {
            await adapter.onNotifyPreDelete(
                'docs',
                true, // isDirectory
                0 as NotificationType
            );
            
            expect(fileSystem.rmdirCalls).to.deep.equal(['/docs']);
        });
    });
    
    describe('Cache Invalidation', () => {
        it('should invalidate cache on file modification', async () => {
            // First cache some data
            await adapter.onGetPlaceholderInfo('test.txt');
            
            // Spy on cache invalidation
            const cacheInvalidateSpy = sinon.spy((adapter as any).cache, 'invalidatePath');
            
            // Trigger modification
            await adapter.onNotifyFileHandleClosedFileModified(
                'test.txt',
                false,
                false, // not deleted, just modified
                0 as NotificationType
            );
            
            // Should invalidate the file and its parent
            expect(cacheInvalidateSpy.calledWith('/test.txt')).to.be.true;
            expect(cacheInvalidateSpy.calledWith('/')).to.be.true;
            
            cacheInvalidateSpy.restore();
        });
        
        it('should invalidate cache on rename', async () => {
            const cacheInvalidateSpy = sinon.spy((adapter as any).cache, 'invalidatePath');
            
            await adapter.onNotifyFileRenamed(
                'test.txt',
                'docs\\moved.txt',
                false,
                0 as NotificationType
            );
            
            // Should invalidate source, dest, and both parents
            expect(cacheInvalidateSpy.calledWith('/test.txt')).to.be.true;
            expect(cacheInvalidateSpy.calledWith('/docs/moved.txt')).to.be.true;
            expect(cacheInvalidateSpy.calledWith('/')).to.be.true;
            expect(cacheInvalidateSpy.calledWith('/docs')).to.be.true;
            
            cacheInvalidateSpy.restore();
        });
    });
    
    describe('Error Handling', () => {
        it('should handle unlink failure gracefully', async () => {
            // Make unlink fail
            sinon.stub(fileSystem, 'unlink').resolves(-1);
            
            try {
                await adapter.onNotifyFileHandleClosedFileModified(
                    'test.txt',
                    false,
                    true, // isFileDeleted
                    0 as NotificationType
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                expect(error.message).to.include('Failed to delete file');
            }
        });
        
        it('should handle rename failure gracefully', async () => {
            // Make rename fail
            sinon.stub(fileSystem, 'rename').resolves(-1);
            
            try {
                await adapter.onNotifyFileRenamed(
                    'test.txt',
                    'renamed.txt',
                    false,
                    0 as NotificationType
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                expect(error.message).to.include('Failed to rename');
            }
        });
    });
});