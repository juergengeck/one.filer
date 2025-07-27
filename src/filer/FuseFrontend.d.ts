import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
/**
 *  This is a fuse frontend.
 */
export declare class FuseFrontend {
    private fuseInstance;
    /** Start the fuse frontend.
     *
     *  @param rootFileSystem - The file system implementation that should be mounted
     *  @param mountPoint - Specifies the mount point where to mount the filesystem
     *  @param logCalls - If true log all calls to console
     *  @param fuseOptions - FUSE mount options for Windows/WSL2 compatibility
     */
    start(rootFileSystem: IFileSystem, mountPoint: string, logCalls?: boolean, fuseOptions?: Record<string, any>): Promise<void>;
    /** Stop the fuse frontend. */
    stop(): Promise<void>;
    static isFuseNativeConfigured(): Promise<boolean>;
    static configureFuseNative(): Promise<void>;
    /**
     * Sets up the mount point correctly for the current platform.
     *
     * @param mountPoint
     */
    private static setupMountPoint;
    /** Function that logs a fuse call and forwards all arguments to the real handler.
     *
     *  This function is registered as fuse-native callback instead of the callback methods in this
     *  class. It then logs the call and forwards it to the real callback
     *
     *  @param  handler - -  The callback implemented by this class. Calls are forwarded to this
     *  handler
     *  @param  args   -  Arguments that shall be passed to the handler
     */
    private static logFuseCall;
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
    private static logFuseCallCB;
}
//# sourceMappingURL=FuseFrontend.d.ts.map