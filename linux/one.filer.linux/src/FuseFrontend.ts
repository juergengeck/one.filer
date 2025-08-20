/**
 * FUSE Frontend for ONE.filer - Using @refinio/fuse3
 * 
 * This class provides the bridge between FUSE3 and ONE.filer's filesystem implementation.
 * Matches the current project's FuseFrontend but uses @refinio/fuse3 instead of custom fuse.
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import { Fuse, type FuseOperations } from '@refinio/fuse3';
import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import FuseApiToIFileSystemAdapter from './FuseApiToIFileSystemAdapter.js';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

// Helper function to check if value is a function
function isFunction(value: any): value is Function {
    return typeof value === 'function';
}

export interface FuseFrontendOptions {
    logCalls?: boolean;
    force?: boolean;
    debug?: boolean;
}

export class FuseFrontend extends EventEmitter {
    private fuseInstance: null | any = null;
    private Fuse: any;

    constructor() {
        super();
    }

    /**
     * Start the fuse frontend - matches current project's API
     * 
     * @param rootFileSystem - The file system implementation that should be mounted
     * @param mountPoint - Specifies the mount point where to mount the filesystem
     * @param logCalls - If true log all calls to console
     * @param fuseOptions - FUSE mount options
     */
    public async start(
        rootFileSystem: IFileSystem,
        mountPoint: string,
        logCalls: boolean = false,
        fuseOptions: Record<string, any> = {}
    ): Promise<void> {
        if (this.fuseInstance) {
            throw Error('Fuse frontend already started');
        }

        // Use @refinio/fuse3
        this.Fuse = Fuse;

        // Resolve mount point to absolute path
        const absoluteMountPoint = path.resolve(mountPoint);
        console.log(`🔧 Resolved mount point: ${mountPoint} -> ${absoluteMountPoint}`);

        FuseFrontend.setupMountPoint(absoluteMountPoint);

        // Create the adapter that bridges FUSE to IFileSystem
        const fuseFileSystemAdapter = new FuseApiToIFileSystemAdapter(
            rootFileSystem,
            absoluteMountPoint,
            logCalls
        );

        // Create map of file system handlers for fuse instance
        // This matches the current project's structure
        const fuseHandlers: any = {
            init: (cb: (err: number) => void) => {
                console.log('🔧 FUSE init called');
                fuseFileSystemAdapter.fuseInit(cb);
            },
            error: (err: Error) => {
                console.error('🔧 FUSE error called:', err);
                fuseFileSystemAdapter.fuseError(() => {});
            },
            getattr: (path: string, cb: (err: number, stat?: any) => void) => {
                if (logCalls) console.log('🔧 FUSE getattr called:', path);
                fuseFileSystemAdapter.fuseGetattr(path, cb);
            },
            readdir: (path: string, cb: (err: number, files?: string[]) => void) => {
                if (logCalls) console.log('🔧 FUSE readdir called:', path);
                fuseFileSystemAdapter.fuseReaddir(path, cb);
            },
            access: fuseFileSystemAdapter.fuseAccess.bind(fuseFileSystemAdapter),
            statfs: fuseFileSystemAdapter.fuseStatfs.bind(fuseFileSystemAdapter),
            fgetattr: fuseFileSystemAdapter.fuseFgetattr.bind(fuseFileSystemAdapter),
            flush: fuseFileSystemAdapter.fuseFlush.bind(fuseFileSystemAdapter),
            fsync: fuseFileSystemAdapter.fuseFsync.bind(fuseFileSystemAdapter),
            fsyncdir: fuseFileSystemAdapter.fuseFsyncdir.bind(fuseFileSystemAdapter),
            truncate: fuseFileSystemAdapter.fuseTruncate.bind(fuseFileSystemAdapter),
            ftruncate: fuseFileSystemAdapter.fuseFtruncate.bind(fuseFileSystemAdapter),
            readlink: fuseFileSystemAdapter.fuseReadlink.bind(fuseFileSystemAdapter),
            chown: fuseFileSystemAdapter.fuseChown.bind(fuseFileSystemAdapter),
            chmod: fuseFileSystemAdapter.fuseChmod.bind(fuseFileSystemAdapter),
            mknod: fuseFileSystemAdapter.fuseMknod.bind(fuseFileSystemAdapter),
            setxattr: fuseFileSystemAdapter.fuseSetxattr.bind(fuseFileSystemAdapter),
            getxattr: (path: string, name: string, cb: (err: number, value?: Buffer) => void) => {
                if (typeof cb !== 'function') {
                    console.warn('🔧 FUSE getxattr called without callback:', { path, name });
                    return;
                }
                fuseFileSystemAdapter.fuseGetxattr(path, name, 0, (err: number, xattr?: Buffer | null) => {
                    cb(err, xattr || undefined);
                });
            },
            listxattr: fuseFileSystemAdapter.fuseListxattr.bind(fuseFileSystemAdapter),
            removexattr: fuseFileSystemAdapter.fuseRemovexattr.bind(fuseFileSystemAdapter),
            open: fuseFileSystemAdapter.fuseOpen.bind(fuseFileSystemAdapter),
            opendir: fuseFileSystemAdapter.fuseOpendir.bind(fuseFileSystemAdapter),
            read: fuseFileSystemAdapter.fuseRead.bind(fuseFileSystemAdapter),
            write: fuseFileSystemAdapter.fuseWrite.bind(fuseFileSystemAdapter),
            release: fuseFileSystemAdapter.fuseRelease.bind(fuseFileSystemAdapter),
            releasedir: fuseFileSystemAdapter.fuseReleasedir.bind(fuseFileSystemAdapter),
            create: fuseFileSystemAdapter.fuseCreate.bind(fuseFileSystemAdapter),
            utimens: fuseFileSystemAdapter.fuseUtimens.bind(fuseFileSystemAdapter),
            unlink: fuseFileSystemAdapter.fuseUnlink.bind(fuseFileSystemAdapter),
            rename: fuseFileSystemAdapter.fuseRename.bind(fuseFileSystemAdapter),
            link: fuseFileSystemAdapter.fuseLink.bind(fuseFileSystemAdapter),
            symlink: fuseFileSystemAdapter.fuseSymlink.bind(fuseFileSystemAdapter),
            mkdir: fuseFileSystemAdapter.fuseMkdir.bind(fuseFileSystemAdapter),
            rmdir: fuseFileSystemAdapter.fuseRmdir.bind(fuseFileSystemAdapter)
        };

        // Add logging wrapper if logCalls is enabled
        if (logCalls) {
            for (const key in fuseHandlers) {
                if (isFunction(fuseHandlers[key]) && key !== 'init' && key !== 'error') {
                    const prevHandler = fuseHandlers[key];
                    fuseHandlers[key] = function (...args: any[]) {
                        console.log(`🔧 FUSE ${key} called with:`, args.slice(0, -1));
                        return prevHandler(...args);
                    };
                }
            }
        }

        // Create and mount FUSE instance using @refinio/fuse3
        this.fuseInstance = new this.Fuse(absoluteMountPoint, fuseHandlers, {
            force: fuseOptions.force !== undefined ? fuseOptions.force : true,
            debug: fuseOptions.debug || false,
            ...fuseOptions
        });

        return new Promise((resolve, reject) => {
            this.fuseInstance!.mount((err: any) => {
                if (err) {
                    this.fuseInstance = null;
                    console.error('❌ FUSE mount failed:', err);
                    reject(err);
                } else {
                    console.log(`✅ FUSE filesystem mounted at ${absoluteMountPoint}`);
                    this.emit('mount');
                    resolve();
                }
            });
        });
    }

    /**
     * Stop the fuse frontend - matches current project's API
     */
    public async stop(): Promise<void> {
        if (!this.fuseInstance) {
            console.log('⚠️ FUSE frontend not started or already stopped');
            return;
        }

        return new Promise((resolve, reject) => {
            this.fuseInstance!.unmount((err: any) => {
                if (err) {
                    console.error('❌ FUSE unmount failed:', err);
                    reject(err);
                } else {
                    console.log('✅ FUSE filesystem unmounted');
                    this.fuseInstance = null;
                    this.emit('unmount');
                    resolve();
                }
            });
        });
    }

    /**
     * Setup mount point directory - matches current project's API
     */
    private static setupMountPoint(mountPoint: string): void {
        try {
            if (!fs.existsSync(mountPoint)) {
                fs.mkdirSync(mountPoint, { recursive: true });
                console.log(`📁 Created mount point: ${mountPoint}`);
            } else {
                console.log(`📁 Mount point exists: ${mountPoint}`);
            }
        } catch (err) {
            console.warn(`⚠️ Could not create mount point ${mountPoint}:`, err);
        }
    }

    /**
     * Check if filesystem is mounted
     */
    isMounted(): boolean {
        return this.fuseInstance !== null;
    }

    /**
     * Get the mount path
     */
    getMountPath(): string | undefined {
        return this.fuseInstance ? this.fuseInstance.mnt : undefined;
    }
}