import fs from 'fs';
import path from 'path';
import FuseApiToIFileSystemAdapter from './FuseApiToIFileSystemAdapter';
import { splitRoutePath } from '../misc/fuseHelper';
import { isFunction } from '../utils/typeChecks';
import { getFuse } from '../fuse/index.js';
/**
 *  This is a fuse frontend.
 */
export class FuseFrontend {
    fuseInstance = null;
    Fuse;
    /** Start the fuse frontend.
     *
     *  @param rootFileSystem - The file system implementation that should be mounted
     *  @param mountPoint - Specifies the mount point where to mount the filesystem
     *  @param logCalls - If true log all calls to console
     *  @param fuseOptions - FUSE mount options for Windows/WSL2 compatibility
     */
    async start(rootFileSystem, mountPoint, logCalls = false, fuseOptions = {}) {
        if (this.fuseInstance) {
            throw Error('Fuse frontend already started');
        }
        // Get the platform-appropriate FUSE implementation
        this.Fuse = await getFuse();
        // Resolve mount point to absolute path
        const absoluteMountPoint = path.resolve(mountPoint);
        console.log(`🔧 Resolved mount point: ${mountPoint} -> ${absoluteMountPoint}`);
        FuseFrontend.setupMountPoint(absoluteMountPoint);
        // If we plan to have multiple implementations of the fuse API, then we need to move
        // this part outside this class. But at the moment we don't plan to do it (The
        // IFileSystem hopefully fits all), so it is easier not to expose this extra layer to
        // the outside.
        const fuseFileSystemAdapter = new FuseApiToIFileSystemAdapter(rootFileSystem, absoluteMountPoint, logCalls);
        // Why fuseHandlers: Fuse.OPERATIONS
        // THE TYPE HAS BEEN ADDED TO THAT THE FUNCTIONS ARE CHECKED AGAINST Fuse.OPERATIONS
        // Fuse.OPERATIONS has all members set to "optional", which makes the type for
        // fuseHandlers less exact, but the advantages of getting the API of the functions
        // checked is higher than the inconvenience of getting an additional "undefined" into
        // this type (which needs type assertion workarounds down in "if (logCalls)").
        // Create map of file system handlers for fuse instance
        const fuseHandlers = {
            init: (cb) => {
                console.log('🔧 FUSE init called');
                fuseFileSystemAdapter.fuseInit(cb);
            },
            error: (err) => {
                console.error('🔧 FUSE error called:', err);
                fuseFileSystemAdapter.fuseError(() => { });
            },
            getattr: (path, cb) => {
                console.log('🔧 FUSE getattr called:', path);
                fuseFileSystemAdapter.fuseGetattr(path, cb);
            },
            readdir: (path, cb) => {
                console.log('🔧 FUSE readdir called:', path);
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
            getxattr: (path, name, cb) => {
                if (typeof cb !== 'function') {
                    console.warn('🔧 FUSE getxattr called without callback:', { path, name });
                    return;
                }
                fuseFileSystemAdapter.fuseGetxattr(path, name, 0, (err, xattr) => {
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
            utimens: (path, atime, mtime, cb) => {
                fuseFileSystemAdapter.fuseUtimens(path, new Date(atime * 1000), new Date(mtime * 1000), cb);
            },
            unlink: fuseFileSystemAdapter.fuseUnlink.bind(fuseFileSystemAdapter),
            rename: fuseFileSystemAdapter.fuseRename.bind(fuseFileSystemAdapter),
            link: fuseFileSystemAdapter.fuseLink.bind(fuseFileSystemAdapter),
            symlink: fuseFileSystemAdapter.fuseSymlink.bind(fuseFileSystemAdapter),
            mkdir: fuseFileSystemAdapter.fuseMkdir.bind(fuseFileSystemAdapter),
            rmdir: fuseFileSystemAdapter.fuseRmdir.bind(fuseFileSystemAdapter)
        };
        if (logCalls) {
            for (const handlerId in fuseHandlers) {
                const oldHandler = fuseHandlers[handlerId];
                if (handlerId === 'init') {
                    fuseHandlers[handlerId] = (...args) => FuseFrontend.logFuseCall(oldHandler, ...args);
                }
                else {
                    fuseHandlers[handlerId] = (...args) => FuseFrontend.logFuseCallCB(handlerId, oldHandler, ...args);
                }
            }
        }
        // Merge user-provided FUSE options with defaults
        const mountOptions = {
            displayFolder: 'One FUSE',
            ...fuseOptions
        };
        console.log('🔧 FUSE mount options:', mountOptions);
        this.fuseInstance = new this.Fuse(absoluteMountPoint, fuseHandlers, mountOptions);
        await new Promise((resolve, reject) => {
            if (this.fuseInstance === null) {
                reject(Error('Fuse frontend not yet started'));
            }
            else {
                this.fuseInstance.mount((err) => (err === null ? resolve() : reject(err)));
            }
        });
    }
    /** Stop the fuse frontend. */
    async stop() {
        if (this.fuseInstance) {
            return new Promise((resolve, reject) => {
                if (this.fuseInstance === null) {
                    reject(Error('Fuse frontend not yet started'));
                }
                else {
                    this.fuseInstance.unmount((err) => (err === null ? resolve() : reject(err)));
                }
            });
        }
    }
    static async isFuseNativeConfigured() {
        const Fuse = await getFuse();
        return new Promise((resolve, reject) => {
            Fuse.isConfigured((err, isConfigured) => {
                if (err !== null) {
                    reject(err);
                }
                resolve(isConfigured);
            });
        });
    }
    static async configureFuseNative() {
        const Fuse = await getFuse();
        return new Promise((resolve, reject) => {
            Fuse.configure(errConfigure => {
                if (errConfigure) {
                    reject(new Error(`\x1b[31mError: ${errConfigure.message}\x1b[0m`));
                }
                else {
                    resolve();
                }
            });
        });
    }
    // ############### PRIVATE Interface ###############
    /**
     * Sets up the mount point correctly for the current platform.
     *
     * @param mountPoint
     */
    static setupMountPoint(mountPoint) {
        switch (process.platform) {
            case 'win32':
                // the mounting folder must not exist on win32
                if (fs.existsSync(mountPoint)) {
                    fs.rmdirSync(mountPoint);
                }
                break;
            default:
                if (!fs.existsSync(mountPoint)) {
                    fs.mkdirSync(mountPoint);
                }
                break;
        }
    }
    /** Function that logs a fuse call and forwards all arguments to the real handler.
     *
     *  This function is registered as fuse-native callback instead of the callback methods in this
     *  class. It then logs the call and forwards it to the real callback
     *
     *  @param  handler - -  The callback implemented by this class. Calls are forwarded to this
     *  handler
     *  @param  args   -  Arguments that shall be passed to the handler
     */
    static logFuseCall(handler, ...args) {
        handler(...args);
    }
    /** Function that logs a fuse call with callback and forwards all arguments to the real handler.
     *
     *  This function is registered as fuse-native callback instead of the callback methods in this
     *  class. It then logs the call and forwards it to the real callback. It is also possible to
     *  log the return values, but this is disabled at the moment because of a bug when executing
     *  the application in the webstorm terminal
     *
     *  @param  name -  Name of fuse callback that is called by fuse-native
     *  @param  handler - The callback implemented by this class. Calls are forwarded to it
     *  @param  args -  Arguments that shall be passed to the handler
     */
    static logFuseCallCB(name, handler, ...args) {
        const normalArgs = args.slice(0, -1);
        const cbArg = args[args.length - 1];
        if (!isFunction(cbArg)) {
            throw new Error(`cbArg is not a function but ${typeof cbArg}: ${String(cbArg)}`);
        }
        // Call the normal arguments and with a special callback functions to intercept the answers
        handler(...normalArgs, (...argscb) => {
            /*
             * Enabling logging of return values triggers a bug in Jetbrains for the getattr call
             * when the *time fields contain a date object (only if you execute the process in
             *  the jetbrains terminal).
             * The result is jetbrains and the node process hangs.
             * I have absolutely no idea why, but consider this when enabling this line
             */
            const returnedCode = parseInt(argscb[0], 10);
            const route = String(normalArgs[0]) === '/'
                ? '\x1b[40mroot\x1b[0m'
                : String(normalArgs[0]).includes('/')
                    ? `\x1b[40m${splitRoutePath(normalArgs[0]).prefix}\x1b[0m`
                    : '';
            if (route === '.git') {
                cbArg(...argscb);
                return;
            }
            // it returned an error code
            if (returnedCode < 0) {
                console.log('\x1b[33m[WARN]:\x1b[0m', route, `| \x1b[33m${name}(${String(normalArgs)}) -> `, `\x1b[35m${String(argscb[0])}\x1b[0m`);
            }
            else {
                console.log('\x1b[32m[INFO]:\x1b[0m', route, `| ${name}(${String(normalArgs)}) -> \x1b[35m${String(argscb[0])}\x1b[0m`);
            }
            cbArg(...argscb);
        });
    }
}
//# sourceMappingURL=FuseFrontend.js.map