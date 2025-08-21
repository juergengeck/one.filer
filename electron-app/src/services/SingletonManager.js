"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingletonManager = void 0;
var electron_1 = require("electron");
var net = require("net");
var fs = require("fs");
var path = require("path");
var os = require("os");
var SingletonManager = /** @class */ (function () {
    function SingletonManager(options) {
        this.ipcServer = null;
        this.pipeServer = null;
        this.isMainInstance = false;
        this.lockFileHandle = null;
        this.options = {
            appName: options.appName,
            port: options.port || 17890,
            pipeName: options.pipeName || "\\\\.\\pipe\\".concat(options.appName, "-singleton"),
            lockTimeout: options.lockTimeout || 5000
        };
        // Create lock file paths in user data directory
        var appData = electron_1.app.getPath('userData');
        this.lockFilePath = path.join(appData, "".concat(this.options.appName, ".lock"));
        // Also manage ProjFS lock file
        this.projfsLockPath = path.join(appData, 'one-data', 'projfs.lock');
    }
    /**
     * Acquire singleton lock with enhanced checking
     */
    SingletonManager.prototype.acquireLock = function () {
        return __awaiter(this, void 0, void 0, function () {
            var electronLock, lockData, isRunning;
            return __generator(this, function (_a) {
                electronLock = electron_1.app.requestSingleInstanceLock({
                    pid: process.pid,
                    startTime: new Date().toISOString(),
                    version: electron_1.app.getVersion()
                });
                if (!electronLock) {
                    console.log("[SingletonManager] Electron lock failed - another instance exists");
                    return [2 /*return*/, false];
                }
                // Additionally, create our own lock file for extra safety
                try {
                    // Clean up stale ProjFS lock if needed
                    this.cleanupProjFSLock();
                    // Check if lock file exists and if it's stale
                    if (fs.existsSync(this.lockFilePath)) {
                        lockData = this.readLockFile();
                        if (lockData && lockData.pid) {
                            isRunning = this.isProcessRunning(lockData.pid);
                            if (isRunning) {
                                console.log("[SingletonManager] Active instance found with PID ".concat(lockData.pid));
                                electron_1.app.releaseSingleInstanceLock();
                                return [2 /*return*/, false];
                            }
                            else {
                                console.log("[SingletonManager] Stale lock file found (PID ".concat(lockData.pid, " not running), removing..."));
                                fs.unlinkSync(this.lockFilePath);
                            }
                        }
                    }
                    // Create new lock file
                    this.writeLockFile();
                    this.isMainInstance = true;
                    // Set up cleanup handlers
                    this.setupCleanupHandlers();
                    console.log("[SingletonManager] Lock acquired successfully (PID: ".concat(process.pid, ")"));
                    return [2 /*return*/, true];
                }
                catch (error) {
                    console.error('[SingletonManager] Error acquiring lock:', error);
                    electron_1.app.releaseSingleInstanceLock();
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Start IPC servers for communication between instances
     */
    SingletonManager.prototype.startIPCServers = function (messageHandler) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (!this.isMainInstance) {
                    throw new Error('Cannot start IPC servers on non-main instance');
                }
                // Start named pipe server (primary on Windows)
                if (process.platform === 'win32') {
                    try {
                        this.pipeServer = net.createServer(function (socket) {
                            socket.on('data', function (data) {
                                try {
                                    var message = JSON.parse(data.toString());
                                    console.log("[SingletonManager] Named pipe message received:", message);
                                    messageHandler(message);
                                    // Send acknowledgment
                                    socket.write(JSON.stringify({ status: 'received' }));
                                }
                                catch (error) {
                                    console.error('[SingletonManager] Failed to parse pipe message:', error);
                                }
                            });
                        });
                        this.pipeServer.listen(this.options.pipeName, function () {
                            console.log("[SingletonManager] Named pipe server listening on ".concat(_this.options.pipeName));
                        });
                        this.pipeServer.on('error', function (err) {
                            console.warn('[SingletonManager] Named pipe server error:', err.message);
                        });
                    }
                    catch (error) {
                        console.error('[SingletonManager] Failed to create named pipe server:', error);
                    }
                }
                // Start TCP server (fallback and cross-platform)
                try {
                    this.ipcServer = net.createServer(function (socket) {
                        socket.on('data', function (data) {
                            try {
                                var message = JSON.parse(data.toString());
                                console.log("[SingletonManager] TCP message received:", message);
                                messageHandler(message);
                                // Send acknowledgment
                                socket.write(JSON.stringify({ status: 'received' }));
                            }
                            catch (error) {
                                console.error('[SingletonManager] Failed to parse TCP message:', error);
                            }
                        });
                    });
                    this.ipcServer.listen(this.options.port, '127.0.0.1', function () {
                        console.log("[SingletonManager] TCP server listening on 127.0.0.1:".concat(_this.options.port));
                    });
                    this.ipcServer.on('error', function (err) {
                        console.error('[SingletonManager] TCP server error:', err);
                    });
                }
                catch (error) {
                    console.error('[SingletonManager] Failed to create TCP server:', error);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Send message to the main instance
     */
    SingletonManager.prototype.sendToMainInstance = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var pipeSuccess;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        message.from = process.pid;
                        message.timestamp = new Date().toISOString();
                        if (!(process.platform === 'win32')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.sendViaPipe(message)];
                    case 1:
                        pipeSuccess = _a.sent();
                        if (pipeSuccess)
                            return [2 /*return*/, true];
                        _a.label = 2;
                    case 2: return [4 /*yield*/, this.sendViaTCP(message)];
                    case 3: 
                    // Try TCP as fallback
                    return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Clean up resources
     */
    SingletonManager.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                console.log("[SingletonManager] Cleaning up resources...");
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
                            console.log("[SingletonManager] App lock file removed");
                        }
                        catch (error) {
                            console.error('[SingletonManager] Failed to remove app lock file:', error);
                        }
                    }
                    // Remove ProjFS lock file
                    if (fs.existsSync(this.projfsLockPath)) {
                        try {
                            fs.unlinkSync(this.projfsLockPath);
                            console.log("[SingletonManager] ProjFS lock file removed");
                        }
                        catch (error) {
                            console.error('[SingletonManager] Failed to remove ProjFS lock file:', error);
                        }
                    }
                }
                // Release Electron's single instance lock
                if (this.isMainInstance) {
                    electron_1.app.releaseSingleInstanceLock();
                }
                return [2 /*return*/];
            });
        });
    };
    // Private helper methods
    /**
     * Clean up stale ProjFS lock files
     */
    SingletonManager.prototype.cleanupProjFSLock = function () {
        try {
            if (fs.existsSync(this.projfsLockPath)) {
                var lockData = this.readProjFSLockFile();
                if (lockData && lockData.pid) {
                    // Check if the process is still running
                    var isRunning = this.isProcessRunning(lockData.pid);
                    if (!isRunning) {
                        console.log("[SingletonManager] Stale ProjFS lock found (PID ".concat(lockData.pid, " not running), removing..."));
                        fs.unlinkSync(this.projfsLockPath);
                    }
                    else {
                        // Check if lock is older than 5 minutes (might be from a crashed process)
                        var lockTime = new Date(lockData.timestamp || 0).getTime();
                        var now = Date.now();
                        var ageMs = now - lockTime;
                        if (ageMs > 5 * 60 * 1000) {
                            console.log("[SingletonManager] ProjFS lock is older than 5 minutes, removing...");
                            fs.unlinkSync(this.projfsLockPath);
                        }
                    }
                }
                else {
                    // Invalid lock file, remove it
                    console.log("[SingletonManager] Invalid ProjFS lock file, removing...");
                    fs.unlinkSync(this.projfsLockPath);
                }
            }
        }
        catch (error) {
            console.error('[SingletonManager] Error cleaning up ProjFS lock:', error);
        }
    };
    SingletonManager.prototype.readProjFSLockFile = function () {
        try {
            var data = fs.readFileSync(this.projfsLockPath, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            return null;
        }
    };
    SingletonManager.prototype.sendViaPipe = function (message) {
        var _this = this;
        return new Promise(function (resolve) {
            var client = net.createConnection(_this.options.pipeName, function () {
                console.log('[SingletonManager] Connected to main instance via named pipe');
                client.write(JSON.stringify(message));
                client.end();
                resolve(true);
            });
            client.on('error', function () {
                resolve(false);
            });
            setTimeout(function () {
                client.destroy();
                resolve(false);
            }, 1000);
        });
    };
    SingletonManager.prototype.sendViaTCP = function (message) {
        var _this = this;
        return new Promise(function (resolve) {
            var client = net.createConnection({ port: _this.options.port, host: '127.0.0.1', timeout: 1000 }, function () {
                console.log('[SingletonManager] Connected to main instance via TCP');
                client.write(JSON.stringify(message));
                client.end();
                resolve(true);
            });
            client.on('error', function () {
                resolve(false);
            });
            client.on('timeout', function () {
                client.destroy();
                resolve(false);
            });
        });
    };
    SingletonManager.prototype.writeLockFile = function () {
        var lockData = {
            pid: process.pid,
            startTime: new Date().toISOString(),
            version: electron_1.app.getVersion(),
            platform: process.platform,
            hostname: os.hostname()
        };
        fs.writeFileSync(this.lockFilePath, JSON.stringify(lockData, null, 2));
    };
    SingletonManager.prototype.readLockFile = function () {
        try {
            var data = fs.readFileSync(this.lockFilePath, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            return null;
        }
    };
    SingletonManager.prototype.isProcessRunning = function (pid) {
        try {
            // Try to send signal 0 to check if process exists
            process.kill(pid, 0);
            return true;
        }
        catch (error) {
            // ESRCH means process doesn't exist
            return error.code !== 'ESRCH';
        }
    };
    SingletonManager.prototype.setupCleanupHandlers = function () {
        var _this = this;
        // Clean up on app quit
        electron_1.app.on('before-quit', function () {
            _this.cleanup();
        });
        // Clean up on process exit
        process.on('exit', function () {
            _this.cleanup();
        });
        // Handle uncaught exceptions
        process.on('uncaughtException', function (error) {
            console.error('[SingletonManager] Uncaught exception:', error);
            _this.cleanup();
        });
        // Handle unhandled promise rejections
        process.on('unhandledRejection', function (reason, promise) {
            console.error('[SingletonManager] Unhandled rejection:', reason);
        });
        // Handle termination signals
        ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(function (signal) {
            process.on(signal, function () {
                console.log("[SingletonManager] Received ".concat(signal, ", cleaning up..."));
                _this.cleanup();
                process.exit(0);
            });
        });
    };
    return SingletonManager;
}());
exports.SingletonManager = SingletonManager;
