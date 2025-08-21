import { app } from 'electron';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
export class SingletonManager {
    options;
    lockFilePath;
    projfsLockPath;
    ipcServer = null;
    pipeServer = null;
    isMainInstance = false;
    lockFileHandle = null;
    constructor(options) {
        this.options = {
            appName: options.appName,
            port: options.port || 17890,
            pipeName: options.pipeName || `\\\\.\\pipe\\${options.appName}-singleton`,
            lockTimeout: options.lockTimeout || 5000
        };
        // Create lock file paths in user data directory
        const appData = app.getPath('userData');
        this.lockFilePath = path.join(appData, `${this.options.appName}.lock`);
        // Also manage ProjFS lock file
        this.projfsLockPath = path.join(appData, 'one-data', 'projfs.lock');
    }
    /**
     * Acquire singleton lock with enhanced checking
     */
    async acquireLock() {
        // First, use Electron's built-in single instance lock
        const electronLock = app.requestSingleInstanceLock({
            pid: process.pid,
            startTime: new Date().toISOString(),
            version: app.getVersion()
        });
        if (!electronLock) {
            console.log(`[SingletonManager] Electron lock failed - another instance exists`);
            return false;
        }
        // Additionally, create our own lock file for extra safety
        try {
            // Clean up stale ProjFS lock if needed
            this.cleanupProjFSLock();
            // Check if lock file exists and if it's stale
            if (fs.existsSync(this.lockFilePath)) {
                const lockData = this.readLockFile();
                if (lockData && lockData.pid) {
                    // Check if the process is still running
                    const isRunning = this.isProcessRunning(lockData.pid);
                    if (isRunning) {
                        console.log(`[SingletonManager] Active instance found with PID ${lockData.pid}`);
                        app.releaseSingleInstanceLock();
                        return false;
                    }
                    else {
                        console.log(`[SingletonManager] Stale lock file found (PID ${lockData.pid} not running), removing...`);
                        fs.unlinkSync(this.lockFilePath);
                    }
                }
            }
            // Create new lock file
            this.writeLockFile();
            this.isMainInstance = true;
            // Set up cleanup handlers
            this.setupCleanupHandlers();
            console.log(`[SingletonManager] Lock acquired successfully (PID: ${process.pid})`);
            return true;
        }
        catch (error) {
            console.error('[SingletonManager] Error acquiring lock:', error);
            app.releaseSingleInstanceLock();
            return false;
        }
    }
    /**
     * Start IPC servers for communication between instances
     */
    async startIPCServers(messageHandler) {
        if (!this.isMainInstance) {
            throw new Error('Cannot start IPC servers on non-main instance');
        }
        // Start named pipe server (primary on Windows)
        if (process.platform === 'win32') {
            try {
                this.pipeServer = net.createServer((socket) => {
                    socket.on('data', (data) => {
                        try {
                            const message = JSON.parse(data.toString());
                            console.log(`[SingletonManager] Named pipe message received:`, message);
                            messageHandler(message);
                            // Send acknowledgment
                            socket.write(JSON.stringify({ status: 'received' }));
                        }
                        catch (error) {
                            console.error('[SingletonManager] Failed to parse pipe message:', error);
                        }
                    });
                });
                this.pipeServer.listen(this.options.pipeName, () => {
                    console.log(`[SingletonManager] Named pipe server listening on ${this.options.pipeName}`);
                });
                this.pipeServer.on('error', (err) => {
                    console.warn('[SingletonManager] Named pipe server error:', err.message);
                });
            }
            catch (error) {
                console.error('[SingletonManager] Failed to create named pipe server:', error);
            }
        }
        // Start TCP server (fallback and cross-platform)
        try {
            this.ipcServer = net.createServer((socket) => {
                socket.on('data', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        console.log(`[SingletonManager] TCP message received:`, message);
                        messageHandler(message);
                        // Send acknowledgment
                        socket.write(JSON.stringify({ status: 'received' }));
                    }
                    catch (error) {
                        console.error('[SingletonManager] Failed to parse TCP message:', error);
                    }
                });
            });
            this.ipcServer.listen(this.options.port, '127.0.0.1', () => {
                console.log(`[SingletonManager] TCP server listening on 127.0.0.1:${this.options.port}`);
            });
            this.ipcServer.on('error', (err) => {
                console.error('[SingletonManager] TCP server error:', err);
            });
        }
        catch (error) {
            console.error('[SingletonManager] Failed to create TCP server:', error);
        }
    }
    /**
     * Send message to the main instance
     */
    async sendToMainInstance(message) {
        message.from = process.pid;
        message.timestamp = new Date().toISOString();
        // Try named pipe first on Windows
        if (process.platform === 'win32') {
            const pipeSuccess = await this.sendViaPipe(message);
            if (pipeSuccess)
                return true;
        }
        // Try TCP as fallback
        return await this.sendViaTCP(message);
    }
    /**
     * Clean up resources
     */
    async cleanup() {
        console.log(`[SingletonManager] Cleaning up resources...`);
        // Close IPC servers
        if (this.ipcServer) {
            this.ipcServer.close();
            this.ipcServer = null;
        }
        if (this.pipeServer) {
            this.pipeServer.close();
            this.pipeServer = null;
        }
        // Remove lock files
        if (this.isMainInstance) {
            // Remove app lock file
            if (fs.existsSync(this.lockFilePath)) {
                try {
                    fs.unlinkSync(this.lockFilePath);
                    console.log(`[SingletonManager] App lock file removed`);
                }
                catch (error) {
                    console.error('[SingletonManager] Failed to remove app lock file:', error);
                }
            }
            // Remove ProjFS lock file
            if (fs.existsSync(this.projfsLockPath)) {
                try {
                    fs.unlinkSync(this.projfsLockPath);
                    console.log(`[SingletonManager] ProjFS lock file removed`);
                }
                catch (error) {
                    console.error('[SingletonManager] Failed to remove ProjFS lock file:', error);
                }
            }
        }
        // Release Electron's single instance lock
        if (this.isMainInstance) {
            app.releaseSingleInstanceLock();
        }
    }
    // Private helper methods
    /**
     * Clean up stale ProjFS lock files
     */
    cleanupProjFSLock() {
        try {
            if (fs.existsSync(this.projfsLockPath)) {
                const lockData = this.readProjFSLockFile();
                if (lockData && lockData.pid) {
                    // Check if the process is still running
                    const isRunning = this.isProcessRunning(lockData.pid);
                    if (!isRunning) {
                        console.log(`[SingletonManager] Stale ProjFS lock found (PID ${lockData.pid} not running), removing...`);
                        fs.unlinkSync(this.projfsLockPath);
                    }
                    else {
                        // Check if lock is older than 5 minutes (might be from a crashed process)
                        const lockTime = new Date(lockData.timestamp || 0).getTime();
                        const now = Date.now();
                        const ageMs = now - lockTime;
                        if (ageMs > 5 * 60 * 1000) {
                            console.log(`[SingletonManager] ProjFS lock is older than 5 minutes, removing...`);
                            fs.unlinkSync(this.projfsLockPath);
                        }
                    }
                }
                else {
                    // Invalid lock file, remove it
                    console.log(`[SingletonManager] Invalid ProjFS lock file, removing...`);
                    fs.unlinkSync(this.projfsLockPath);
                }
            }
        }
        catch (error) {
            console.error('[SingletonManager] Error cleaning up ProjFS lock:', error);
        }
    }
    readProjFSLockFile() {
        try {
            const data = fs.readFileSync(this.projfsLockPath, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            return null;
        }
    }
    sendViaPipe(message) {
        return new Promise((resolve) => {
            const client = net.createConnection(this.options.pipeName, () => {
                console.log('[SingletonManager] Connected to main instance via named pipe');
                client.write(JSON.stringify(message));
                client.end();
                resolve(true);
            });
            client.on('error', () => {
                resolve(false);
            });
            setTimeout(() => {
                client.destroy();
                resolve(false);
            }, 1000);
        });
    }
    sendViaTCP(message) {
        return new Promise((resolve) => {
            const client = net.createConnection({ port: this.options.port, host: '127.0.0.1', timeout: 1000 }, () => {
                console.log('[SingletonManager] Connected to main instance via TCP');
                client.write(JSON.stringify(message));
                client.end();
                resolve(true);
            });
            client.on('error', () => {
                resolve(false);
            });
            client.on('timeout', () => {
                client.destroy();
                resolve(false);
            });
        });
    }
    writeLockFile() {
        const lockData = {
            pid: process.pid,
            startTime: new Date().toISOString(),
            version: app.getVersion(),
            platform: process.platform,
            hostname: os.hostname()
        };
        fs.writeFileSync(this.lockFilePath, JSON.stringify(lockData, null, 2));
    }
    readLockFile() {
        try {
            const data = fs.readFileSync(this.lockFilePath, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            return null;
        }
    }
    isProcessRunning(pid) {
        try {
            // Try to send signal 0 to check if process exists
            process.kill(pid, 0);
            return true;
        }
        catch (error) {
            // ESRCH means process doesn't exist
            return error.code !== 'ESRCH';
        }
    }
    setupCleanupHandlers() {
        // Clean up on app quit
        app.on('before-quit', () => {
            this.cleanup();
        });
        // Clean up on process exit
        process.on('exit', () => {
            this.cleanup();
        });
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('[SingletonManager] Uncaught exception:', error);
            this.cleanup();
        });
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('[SingletonManager] Unhandled rejection:', reason);
        });
        // Handle termination signals
        ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
            process.on(signal, () => {
                console.log(`[SingletonManager] Received ${signal}, cleaning up...`);
                this.cleanup();
                process.exit(0);
            });
        });
    }
}
//# sourceMappingURL=SingletonManager.js.map