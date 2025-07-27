/**
 * Windows FUSE3 Implementation
 * 
 * This provides a FUSE3-compatible API on Windows by using ProjectedFS as the backend.
 * Applications can use the same FUSE3 interface on both Linux and Windows.
 */

import { EventEmitter } from 'events';
import type { Stats, FuseOperations } from './native-fuse3.js';
import path from 'path';

interface FuseError extends Error {
    code: string;
    path?: string;
}

// Store active FUSE operations for each mount
const activeMounts = new Map<string, WindowsFuse>();

/**
 * Windows implementation of FUSE3 using ProjectedFS as backend
 * 
 * This class provides the exact same API as the Linux FUSE3 implementation,
 * but internally uses Windows ProjectedFS to implement the filesystem.
 */
export class WindowsFuse extends EventEmitter {
    private projfsInstance: any;
    private readonly mountPath: string;
    private operations: FuseOperations;
    private options: any;
    private mounted = false;
    private virtualRoot: string;

    // Static error codes (same as Linux FUSE)
    static EPERM = 1;
    static ENOENT = 2;
    static EIO = 5;
    static EACCES = 13;
    static EEXIST = 17;
    static ENOTDIR = 20;
    static EISDIR = 21;
    static EINVAL = 22;
    static ENOSPC = 28;
    static EROFS = 30;
    static EBUSY = 16;
    static ENOTEMPTY = 39;

    constructor(_mountPath: string, operations: FuseOperations, options: any = {}) {
        super();
        
        if (process.platform !== 'win32') {
            throw new Error('WindowsFuse only works on Windows. Use native FUSE3 on Linux.');
        }

        this.mountPath = _mountPath;
        this.operations = operations;
        this.options = options;
        
        // Convert Unix-style mount path to Windows path
        this.virtualRoot = this.convertToWindowsPath(this.mountPath);
        
        // Store this instance for ProjFS callbacks
        activeMounts.set(this.virtualRoot, this);
    }

    private convertToWindowsPath(unixPath: string): string {
        // Convert /mnt/fuse to C:\fuse or similar
        if (unixPath.startsWith('/mnt/')) {
            return `C:\\${unixPath.substring(5).replace(/\//g, '\\')}`;
        }
        // Default: use C:\Fuse\[mountname]
        const mountName = path.basename(unixPath);
        return `C:\\Fuse\\${mountName}`;
    }

    async mount(callback: (err?: Error | null) => void): Promise<void> {
        console.log(`🪟 Mounting Windows FUSE3 filesystem at ${this.virtualRoot}`);
        console.log(`📂 Available FUSE operations: ${Object.keys(this.operations).join(', ')}`);
        
        try {
            // Dynamically load ProjFS wrapper
            const { ProjFSWrapper } = await import('../../one.projfs/src/native/index.js');
            
            // Create ProjFS instance
            this.projfsInstance = new ProjFSWrapper(this.virtualRoot);
            
            // Create callbacks that bridge to FUSE operations
            const projfsCallbacks = {
                onGetPlaceholderInfo: this.handleGetPlaceholderInfo.bind(this),
                onGetFileData: this.handleGetFileData.bind(this),
                onGetDirectoryEnumeration: this.handleGetDirectoryEnumeration.bind(this),
                onNotification: this.handleNotification.bind(this)
            };
            
            // ProjFS options
            const projfsOptions = {
                virtualizationRootPath: this.virtualRoot,
                poolThreadCount: this.options.threadCount || 4,
                enableNegativePathCache: true,
                ...this.options.projfs
            };
            
            // Start ProjFS
            await this.projfsInstance.start(projfsCallbacks, projfsOptions);
            
            this.mounted = true;
            this.emit('mount');
            
            console.log(`✅ Windows FUSE3 filesystem mounted at ${this.virtualRoot}`);
            console.log(`📁 Access through Windows Explorer or any Windows application`);
            
            // Call init if provided
            if (this.operations.init) {
                this.operations.init((err) => {
                    if (err) {
                        console.error('FUSE init failed:', err);
                    }
                });
            }
            
            callback(null);
        } catch (error) {
            console.error(`❌ Windows FUSE3 mount failed:`, error);
            activeMounts.delete(this.virtualRoot);
            callback(error as Error);
        }
    }

    async unmount(callback: (err?: Error | null) => void): Promise<void> {
        if (!this.mounted) {
            callback(new Error('Filesystem not mounted'));
            return;
        }

        console.log(`🔧 Unmounting Windows FUSE3 filesystem at ${this.virtualRoot}`);
        
        try {
            if (this.projfsInstance) {
                await this.projfsInstance.stop();
            }
            
            activeMounts.delete(this.virtualRoot);
            this.mounted = false;
            this.emit('unmount');
            
            console.log(`✅ Windows FUSE3 filesystem unmounted from ${this.virtualRoot}`);
            callback(null);
        } catch (error) {
            console.error(`❌ Windows FUSE3 unmount failed:`, error);
            callback(error as Error);
        }
    }

    // ProjFS callback handlers that translate to FUSE operations

    private async handleGetPlaceholderInfo(relativePath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.operations.getattr) {
                reject(new Error('FUSE getattr not implemented'));
                return;
            }

            // Convert Windows path separators to Unix style for FUSE
            const fusePath = '/' + relativePath.replace(/\\/g, '/');

            this.operations.getattr(fusePath, (err: number, stat?: Stats) => {
                if (err || !stat) {
                    reject(this.createFuseError(err || WindowsFuse.ENOENT, fusePath));
                    return;
                }

                // Convert FUSE stat to ProjFS PlaceholderInfo
                resolve({
                    fileSize: BigInt(stat.size),
                    isDirectory: (stat.mode & 0o040000) !== 0,
                    creationTime: stat.ctime || new Date(),
                    lastWriteTime: stat.mtime || new Date(),
                    lastAccessTime: stat.atime || new Date(),
                    changeTime: stat.ctime || new Date(),
                    fileAttributes: this.convertModeToWindowsAttributes(stat.mode)
                });
            });
        });
    }

    private async handleGetFileData(
        relativePath: string,
        byteOffset: bigint,
        length: number
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            if (!this.operations.open || !this.operations.read) {
                reject(new Error('FUSE open/read not implemented'));
                return;
            }

            const fusePath = '/' + relativePath.replace(/\\/g, '/');
            
            // Open file
            this.operations.open(fusePath, 0, (openErr: number, fd?: number) => {
                if (openErr || fd === undefined) {
                    reject(this.createFuseError(openErr || WindowsFuse.EIO, fusePath));
                    return;
                }

                // Read data
                const buffer = Buffer.alloc(length);
                this.operations.read!(
                    fusePath,
                    fd,
                    buffer,
                    length,
                    Number(byteOffset),
                    (readErr: number, bytesRead?: number) => {
                        // Close file
                        if (this.operations.release) {
                            this.operations.release(fusePath, fd, () => {});
                        }

                        if (readErr) {
                            reject(this.createFuseError(readErr, fusePath));
                            return;
                        }

                        resolve(buffer.slice(0, bytesRead || 0));
                    }
                );
            });
        });
    }

    private async handleGetDirectoryEnumeration(
        relativePath: string,
        searchPattern?: string
    ): Promise<any[]> {
        return new Promise((resolve, reject) => {
            if (!this.operations.readdir) {
                reject(new Error('FUSE readdir not implemented'));
                return;
            }

            const fusePath = '/' + relativePath.replace(/\\/g, '/');

            this.operations.readdir(fusePath, (err: number, files?: string[], stats?: Stats[]) => {
                if (err) {
                    reject(this.createFuseError(err, fusePath));
                    return;
                }

                const entries: any[] = [];
                
                if (files) {
                    files.forEach((name, index) => {
                        // Skip . and ..
                        if (name === '.' || name === '..') return;

                        // Apply search pattern if provided
                        if (searchPattern && !this.matchWildcard(name, searchPattern)) {
                            return;
                        }

                        entries.push({
                            fileName: name,
                            isDirectory: stats && stats[index] ? 
                                (stats[index].mode & 0o040000) !== 0 : false,
                            fileSize: stats && stats[index] ? 
                                BigInt(stats[index].size) : BigInt(0)
                        });
                    });
                }

                resolve(entries);
            });
        });
    }

    private async handleNotification(
        relativePath: string,
        isDirectory: boolean,
        notificationType: number,
        newPath?: string
    ): Promise<void> {
        // Handle ProjFS notifications by calling appropriate FUSE operations
        // const fusePath = '/' + relativePath.replace(/\\/g, '/');
        
        // Most notifications don't need handling as FUSE operations
        // are called directly when files are accessed
        if (this.operations.error) {
            // Could emit errors for debugging
        }
    }

    // Utility methods

    private convertModeToWindowsAttributes(mode: number): number {
        let attrs = 0;
        
        if (mode & 0o040000) attrs |= 0x10; // FILE_ATTRIBUTE_DIRECTORY
        if (!(mode & 0o200)) attrs |= 0x01; // FILE_ATTRIBUTE_READONLY
        if (attrs === 0) attrs = 0x80; // FILE_ATTRIBUTE_NORMAL
        
        return attrs;
    }

    private matchWildcard(filename: string, pattern: string): boolean {
        const regex = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        
        return new RegExp(`^${regex}$`, 'i').test(filename);
    }

    private createFuseError(code: number, path?: string): Error {
        const error = new Error(this.getErrorMessage(code)) as FuseError;
        error.code = this.getErrorCode(code);
        if (path) error.path = path;
        return error;
    }

    private getErrorCode(code: number): string {
        const codes: Record<number, string> = {
            1: 'EPERM',
            2: 'ENOENT',
            5: 'EIO',
            13: 'EACCES',
            17: 'EEXIST',
            20: 'ENOTDIR',
            21: 'EISDIR',
            22: 'EINVAL',
            28: 'ENOSPC',
            30: 'EROFS',
            16: 'EBUSY',
            39: 'ENOTEMPTY'
        };
        return codes[code] || 'UNKNOWN';
    }

    private getErrorMessage(code: number): string {
        const messages: Record<number, string> = {
            1: 'Operation not permitted',
            2: 'No such file or directory',
            5: 'I/O error',
            13: 'Permission denied',
            17: 'File exists',
            20: 'Not a directory',
            21: 'Is a directory',
            22: 'Invalid argument',
            28: 'No space left on device',
            30: 'Read-only file system',
            16: 'Device or resource busy',
            39: 'Directory not empty'
        };
        return messages[code] || `Error ${code}`;
    }

    get mnt(): string {
        return this.virtualRoot;
    }

    static unmount(mountPath: string, callback: (err?: Error | null) => void): void {
        // Convert path and find mount
        const windowsPath = mountPath.includes(':\\') ? 
            mountPath : `C:\\Fuse\\${path.basename(mountPath)}`;
        
        const mount = activeMounts.get(windowsPath);
        if (mount) {
            mount.unmount((err?: Error | null) => callback(err || undefined));
        } else {
            callback(new Error('Mount not found'));
        }
    }

    static isConfigured(callback: (err: Error | null, isConfigured: boolean) => void): void {
        // Check if ProjFS is available on Windows
        if (process.platform !== 'win32') {
            callback(new Error('Not running on Windows'), false);
            return;
        }

        // TODO: Check if ProjFS driver is installed
        callback(null, true);
    }

    static configure(callback: (err?: Error) => void): void {
        // No configuration needed - ProjFS should be available on Windows 10+
        callback();
    }
}

// Export as default Fuse class on Windows
export { WindowsFuse as Fuse };