// Local error creation function for standalone ESM
function createError(code: string, details?: {message?: string; path?: string}): Error {
    const error = new Error(details?.message || code);
    (error as any).code = code;
    if (details?.path) {
        (error as any).path = details.path;
    }
    return error;
}

import { Fuse } from '../fuse/native-fuse3.js';

export interface FuseOperations {
    readdir?: (path: string, cb: (err: number, names?: string[]) => void) => void;
    getattr?: (path: string, cb: (err: number, stat?: any) => void) => void;
    open?: (path: string, mode: number, cb: (err: number, fd?: number) => void) => void;
    read?: (path: string, fd: number, buffer: Buffer, length: number, position: number, cb: (err: number, bytesRead?: number) => void) => void;
    release?: (path: string, fd: number, cb: (err: number) => void) => void;
}

export class SimpleFuseFrontend {
    private mountedPath: string | null = null;
    private fuseInstance: Fuse | null = null;

    /**
     * Configure fuse-native (may require sudo privileges)
     */
    static async configureFuseNative(): Promise<void> {
        return new Promise((resolve, reject) => {
            Fuse.configure((err) => {
                if (err) {
                    reject(createError('FUSE_CONFIG_ERROR', {
                        message: `Failed to configure fuse-native: ${err}`
                    }));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Check if fuse-native is already configured
     */
    static async isFuseNativeConfigured(): Promise<boolean> {
        return new Promise((resolve) => {
            Fuse.isConfigured((err, result) => {
                resolve(!err && result);
            });
        });
    }

    /**
     * Start the FUSE mount with basic file system operations
     */
    async start(mountPoint: string, operations: FuseOperations = {}): Promise<void> {
        if (this.mountedPath) {
            throw createError('ALREADY_MOUNTED', {
                message: `Already mounted at ${this.mountedPath}`
            });
        }

        console.log(`Starting FUSE mount at: ${mountPoint}`);

        const fuseOperations = {
            readdir: operations.readdir || this.defaultReaddir.bind(this),
            getattr: operations.getattr || this.defaultGetattr.bind(this),
            open: operations.open || this.defaultOpen.bind(this),
            read: operations.read || this.defaultRead.bind(this),
            release: operations.release || this.defaultRelease.bind(this)
        };

        try {
            // Windows-compatible FUSE mount options
            const mountOptions = {
                debug: true,
                force: true,
                // Enable access for other users (essential for Windows through WSL bridge)
                allowOther: true
            };

            this.fuseInstance = new Fuse(mountPoint, fuseOperations, mountOptions);

            await new Promise<void>((resolve, reject) => {
                this.fuseInstance!.mount((err) => {
                    if (err) {
                        reject(createError('FUSE_MOUNT_ERROR', {
                            message: `Failed to mount FUSE at ${mountPoint}: ${err}`
                        }));
                    } else {
                        resolve();
                    }
                });
            });

            this.mountedPath = mountPoint;

            // Handle process termination
            process.on('SIGINT', () => {
                console.log('Received SIGINT, unmounting...');
                this.stop();
                process.exit(0);
            });

            console.log(`✅ FUSE mount active at: ${mountPoint}`);
            console.log(`🔗 Windows access: \\\\wsl.localhost\\Ubuntu${mountPoint}`);
            console.log(`🔗 Legacy access: \\\\wsl$\\Ubuntu${mountPoint}`);
            console.log('Press Ctrl+C to unmount and exit');

        } catch (error) {
            throw createError('FUSE_MOUNT_ERROR', {
                message: `Failed to mount FUSE at ${mountPoint}: ${error}`
            });
        }
    }

    /**
     * Stop the FUSE mount
     */
    async stop(): Promise<void> {
        if (!this.mountedPath || !this.fuseInstance) {
            return;
        }

        try {
            console.log(`Unmounting FUSE from: ${this.mountedPath}`);
            await new Promise<void>((resolve) => {
                this.fuseInstance!.unmount((err) => {
                    if (err) {
                        console.error(`Error unmounting: ${err}`);
                    }
                    resolve();
                });
            });
            this.mountedPath = null;
            this.fuseInstance = null;
        } catch (error) {
            console.error(`Error unmounting: ${error}`);
        }
    }

    // Default FUSE operations for basic testing
    private defaultReaddir(path: string, cb: (err: number, names?: string[]) => void): void {
        console.log(`FUSE readdir: ${path}`);
        if (path === '/') {
            cb(0, ['hello.txt', 'test.txt']);
        } else {
            cb(0, []);
        }
    }

    private defaultGetattr(path: string, cb: (err: number, stat?: any) => void): void {
        console.log(`FUSE getattr: ${path}`);
        
        // Get current user/group for consistent permissions
        const uid = process.getuid ? process.getuid() : 1000;
        const gid = process.getgid ? process.getgid() : 1000;
        
        if (path === '/') {
            cb(0, {
                mtime: new Date(),
                atime: new Date(),
                ctime: new Date(),
                size: 0,
                mode: 16877, // 0o40755 - directory (readable by all)
                uid: uid,
                gid: gid
            });
        } else if (path === '/hello.txt' || path === '/test.txt') {
            const content = path === '/hello.txt' ? 'Hello from ONE.filer ESM stack!\nFUSE is working correctly.' : 'Test file content from the minimal FUSE implementation.';
            cb(0, {
                mtime: new Date(),
                atime: new Date(),
                ctime: new Date(),
                size: Buffer.from(content).length,
                mode: 33188, // 0o100644 - regular file (readable by all)
                uid: uid,
                gid: gid
            });
        } else {
            // File not found
            cb(Fuse.ENOENT);
        }
    }

    private defaultOpen(path: string, mode: number, cb: (err: number, fd?: number) => void): void {
        console.log(`FUSE open: ${path}, mode: ${mode}`);
        cb(0, 42); // Return a dummy file descriptor
    }

    private defaultRead(path: string, fd: number, buffer: Buffer, length: number, position: number, cb: (err: number, bytesRead?: number) => void): void {
        console.log(`FUSE read: ${path}, fd: ${fd}, len: ${length}, pos: ${position}`);
        
        let content = '';
        if (path === '/hello.txt') {
            content = 'Hello from ONE.filer ESM stack!\nFUSE is working correctly.';
        } else if (path === '/test.txt') {
            content = 'Test file content from the minimal FUSE implementation.';
        }

        const data = Buffer.from(content);
        const slice = data.slice(position, position + length);
        slice.copy(buffer);
        cb(0, slice.length);
    }

    private defaultRelease(path: string, fd: number, cb: (err: number) => void): void {
        console.log(`FUSE release: ${path}, fd: ${fd}`);
        cb(0); // Success
    }
} 