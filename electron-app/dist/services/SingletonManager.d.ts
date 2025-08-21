export interface SingletonOptions {
    appName: string;
    port?: number;
    pipeName?: string;
    lockTimeout?: number;
}
export interface SingletonMessage {
    command: string;
    from?: number;
    timestamp?: string;
    args?: string[];
    data?: any;
}
export declare class SingletonManager {
    private options;
    private lockFilePath;
    private projfsLockPath;
    private ipcServer;
    private pipeServer;
    private isMainInstance;
    private lockFileHandle;
    constructor(options: SingletonOptions);
    /**
     * Acquire singleton lock with enhanced checking
     */
    acquireLock(): Promise<boolean>;
    /**
     * Start IPC servers for communication between instances
     */
    startIPCServers(messageHandler: (message: SingletonMessage) => void): Promise<void>;
    /**
     * Send message to the main instance
     */
    sendToMainInstance(message: SingletonMessage): Promise<boolean>;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    /**
     * Clean up stale ProjFS lock files
     */
    private cleanupProjFSLock;
    private readProjFSLockFile;
    private sendViaPipe;
    private sendViaTCP;
    private writeLockFile;
    private readLockFile;
    private isProcessRunning;
    private setupCleanupHandlers;
}
//# sourceMappingURL=SingletonManager.d.ts.map