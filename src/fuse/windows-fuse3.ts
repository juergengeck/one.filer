/**
 * Windows FUSE3 Implementation
 * 
 * This provides a FUSE3-compatible API on Windows by using ProjectedFS as the backend.
 * Applications can use the same FUSE3 interface on both Linux and Windows.
 */

import { EventEmitter } from 'events';
import type { Stats, FuseOperations } from './types.js';
import path from 'path';

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
    // @ts-ignore - unused parameter, kept for interface compatibility
    private _options: any;
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
        this._options = options;
        
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
            // Dynamically load projfs-fuse.one
            // const { ProjFSFuse } = await import('projfs-fuse.one');
            throw new Error('projfs-fuse.one disabled - use ProjFS mode instead');
            
            // Convert callback-based FUSE operations to projfs-fuse.one's synchronous API
            // const adaptedOperations = this.adaptFuseOperations(this.operations);
            
            // Create ProjFS instance - projfs-fuse.one handles all the FUSE operations internally
            // this.projfsInstance = new ProjFSFuse(this.virtualRoot, adaptedOperations, this.options);
            
            // Mount the filesystem
            // await this.projfsInstance.mount();
            
            this.mounted = true;
            this.emit('mount');
            
            console.log(`✅ Windows FUSE3 filesystem mounted at ${this.virtualRoot}`);
            console.log(`📁 Access through Windows Explorer or any Windows application`);
            
            // Call init if provided
            if (this.operations.init) {
                this.operations.init?.((err) => {
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
                await this.projfsInstance.unmount();
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

    // projfs-fuse.one handles all the ProjFS callbacks and error handling internally
    
    /**
     * Adapt callback-based FUSE operations to projfs-fuse.one's synchronous API
     */
    // @ts-ignore - unused method, kept for potential future use
    private _adaptFuseOperations(operations: FuseOperations): any {
        const adapted: any = {};
        
        // Convert init from callback to synchronous
        if (operations.init) {
            adapted.init = () => {
                // Call original init with dummy callback
                operations.init!((err) => {
                    if (err) {
                        console.error('FUSE init error:', err);
                    }
                });
            };
        }
        
        // Convert getattr from callback to synchronous return
        if (operations.getattr) {
            adapted.getattr = (path: string) => {
                let result: Stats | null = null;
                let syncComplete = false;
                
                operations.getattr!(path, (err: number, stat?: Stats) => {
                    if (!err && stat) {
                        result = stat;
                    }
                    syncComplete = true;
                });
                
                // Spin until callback completes (not ideal but works for now)
                while (!syncComplete) {
                    // Wait
                }
                
                return result;
            };
        }
        
        // Convert readdir from callback to synchronous return
        if (operations.readdir) {
            adapted.readdir = (path: string) => {
                let result: string[] = [];
                let syncComplete = false;
                
                operations.readdir!(path, (err: number, files?: string[]) => {
                    if (!err && files) {
                        result = files;
                    }
                    syncComplete = true;
                });
                
                while (!syncComplete) {
                    // Wait
                }
                
                return result;
            };
        }
        
        // Convert read from callback to synchronous return
        if (operations.read && operations.open && operations.release) {
            adapted.read = (path: string, size: number, offset: number) => {
                let result: Buffer | null = null;
                let syncComplete = false;
                
                // First open the file
                operations.open!(path, 0, (openErr: number, fd?: number) => {
                    if (openErr || fd === undefined) {
                        syncComplete = true;
                        return;
                    }
                    
                    // Read data
                    const buffer = Buffer.alloc(size);
                    operations.read!(path, fd, buffer, size, offset, (readErr: number, bytesRead?: number) => {
                        // Close file
                        if (operations.release) {
                            operations.release(path, fd, () => {});
                        }
                        
                        if (!readErr && bytesRead !== undefined) {
                            result = buffer.slice(0, bytesRead);
                        }
                        syncComplete = true;
                    });
                });
                
                while (!syncComplete) {
                    // Wait
                }
                
                return result;
            };
        }
        
        // Add other operations as needed
        if (operations.mkdir) {
            adapted.mkdir = (path: string, mode: number) => {
                operations.mkdir!(path, mode, () => {});
            };
        }
        
        if (operations.unlink) {
            adapted.unlink = (path: string) => {
                operations.unlink!(path, () => {});
            };
        }
        
        if (operations.rmdir) {
            adapted.rmdir = (path: string) => {
                operations.rmdir!(path, () => {});
            };
        }
        
        if (operations.rename) {
            adapted.rename = (oldPath: string, newPath: string) => {
                operations.rename!(oldPath, newPath, () => {});
            };
        }
        
        return adapted;
    }

    get mnt(): string {
        // Return the mount path - projfs-fuse.one might have a getMountPath method
        if (this.projfsInstance && this.projfsInstance.getMountPath) {
            return this.projfsInstance.getMountPath();
        }
        return this.virtualRoot;
    }

    static unmount(mountPath: string, callback: (err?: Error | null) => void): void {
        // Convert path if needed
        const windowsPath = mountPath.includes(':\\') ? 
            mountPath : `C:\\Fuse\\${path.basename(mountPath)}`;
        
        // Try to find and unmount through active mounts
        const mount = activeMounts.get(windowsPath);
        if (mount) {
            mount.unmount(callback);
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

        // We no longer use FUSE3 on Windows - using ProjFS directly
        callback(null, false);
    }

    static configure(callback: (err?: Error) => void): void {
        // No configuration needed - projfs-fuse.one should work if installed
        callback();
    }
}

// Export as default Fuse class on Windows
export { WindowsFuse as Fuse };