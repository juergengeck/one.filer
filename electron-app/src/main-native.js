"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var electron_1 = require("electron");
var path_1 = require("path");
var fs_1 = require("fs");
var os = require("os");
// Direct imports from one.filer - no more WSL!
var Replicant_js_1 = require("../../lib/Replicant.js");
var simple_test_runner_1 = require("./simple-test-runner");
var real_test_runner_1 = require("./real-test-runner");
var SingletonManager_1 = require("./services/SingletonManager");
// import { ONEInitializer } from './services/oneInitializer';
var http = require("http");
// Initialize singleton manager
var singletonManager = new SingletonManager_1.SingletonManager({
    appName: 'one-filer',
    port: 17890,
    lockTimeout: 5000
});
var isMainInstance = false;
var mainWindow = null;
var credentials = null;
var replicant = null;
var tray = null;
var isQuitting = false;
var replicantStartTime = null;
// Metrics cache for monitoring
var metricsCache = {
    objectsStored: 0,
    objectsSynced: 0,
    syncQueue: 0,
    connections: 0,
    lastSync: null,
    errors: 0,
    bandwidth: {
        upload: 0,
        download: 0
    },
    operations: {
        reads: 0,
        writes: 0,
        deletes: 0
    },
    performance: {
        avgResponseTime: 0,
        requestsPerSecond: 0
    }
};
var config = {
    startMinimized: false,
    showInSystemTray: true,
    autoConnect: false,
    dataDirectory: (0, path_1.join)(electron_1.app.getPath('userData'), 'one-data'),
    projfsRoot: 'C:\\OneFiler',
    mountPoint: 'C:\\OneFiler', // No more WSL paths!
    // Default cache settings (all enabled)
    disableCowCache: false,
    disableInMemoryCache: false,
    verboseLogging: false,
    traceAllOperations: false
};
// Try to load config from file
var configPath = (0, path_1.join)(process.cwd(), 'config.json');
if ((0, fs_1.existsSync)(configPath)) {
    try {
        var configData = (0, fs_1.readFileSync)(configPath, 'utf8');
        config = __assign(__assign({}, config), JSON.parse(configData));
    }
    catch (error) {
        console.error('Failed to load config:', error);
    }
}
// Helper function to handle IPC messages
function handleIPCMessage(message) {
    console.log("[".concat(new Date().toISOString(), "] Handling IPC message:"), message);
    if (message.command === 'show') {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            if (!mainWindow.isVisible())
                mainWindow.show();
            mainWindow.focus();
            // Flash the window to get user attention
            mainWindow.flashFrame(true);
            setTimeout(function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.flashFrame(false); }, 1000);
            // Show tray notification if available
            if (tray && process.platform === 'win32') {
                tray.displayBalloon({
                    title: 'ONE Filer',
                    content: 'Application brought to foreground',
                    iconType: 'info'
                });
            }
        }
        else {
            createWindow();
        }
    }
    else if (message.command === 'status') {
        // Return status (though this is one-way IPC)
        console.log('Status requested:', {
            running: true,
            pid: process.pid,
            replicant: replicant !== null,
            window: mainWindow !== null,
            uptime: replicantStartTime ? Date.now() - replicantStartTime.getTime() : 0
        });
    }
    else if (message.command === 'quit') {
        isQuitting = true;
        electron_1.app.quit();
    }
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        resizable: true,
        show: !config.startMinimized,
        title: 'ONE Filer',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: (0, path_1.join)(__dirname, 'preload.js')
        },
        icon: (0, path_1.join)(__dirname, '..', 'assets', 'icon.png')
    });
    // Load the React-based app
    mainWindow.loadFile((0, path_1.join)(__dirname, '..', 'index-react.html'));
    // Log any load errors
    mainWindow.webContents.on('did-fail-load', function (event, errorCode, errorDescription) {
        console.error('Failed to load:', errorCode, errorDescription);
    });
    mainWindow.webContents.on('did-finish-load', function () {
        console.log('Page loaded successfully');
    });
    // Hide menu bar
    mainWindow.setMenu(null);
    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
    // Always open DevTools for debugging
    mainWindow.webContents.openDevTools();
    // Handle window close
    mainWindow.on('close', function (event) {
        if (!isQuitting && config.showInSystemTray) {
            event.preventDefault();
            mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.hide();
        }
    });
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}
function createTray() {
    if (!config.showInSystemTray)
        return;
    var iconPath = (0, path_1.join)(__dirname, '..', 'assets', 'icon.png');
    var trayIcon = electron_1.nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new electron_1.Tray(trayIcon);
    tray.setToolTip('ONE Filer Service');
    updateTrayMenu();
    tray.on('click', function () {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            }
            else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
        else {
            createWindow();
        }
    });
}
function updateTrayMenu() {
    var _this = this;
    if (!tray)
        return;
    var contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Show/Hide',
            click: function () {
                if (mainWindow) {
                    if (mainWindow.isVisible()) {
                        mainWindow.hide();
                    }
                    else {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
                else {
                    createWindow();
                }
            }
        },
        {
            label: replicant ? 'Stop Service' : 'Start Service',
            click: function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!replicant) return [3 /*break*/, 2];
                            return [4 /*yield*/, stopReplicant()];
                        case 1:
                            _a.sent();
                            return [3 /*break*/, 3];
                        case 2:
                            // Need to get credentials from user
                            if (mainWindow) {
                                mainWindow.show();
                                mainWindow.focus();
                            }
                            else {
                                createWindow();
                            }
                            _a.label = 3;
                        case 3:
                            updateTrayMenu();
                            return [2 /*return*/];
                    }
                });
            }); }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: function () {
                isQuitting = true;
                electron_1.app.quit();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);
}
// Enhanced singleton handling
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var success;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, singletonManager.acquireLock()];
            case 1:
                isMainInstance = _a.sent();
                if (!!isMainInstance) return [3 /*break*/, 3];
                console.log("[".concat(new Date().toISOString(), "] Another instance of ONE Filer is already running"));
                return [4 /*yield*/, singletonManager.sendToMainInstance({
                        command: 'show',
                        args: process.argv
                    })];
            case 2:
                success = _a.sent();
                if (success) {
                    console.log('Successfully notified the main instance');
                }
                else {
                    console.log('Could not communicate with the main instance (it may be starting up)');
                }
                // Exit this instance
                electron_1.app.exit(0);
                return [3 /*break*/, 5];
            case 3:
                console.log("[".concat(new Date().toISOString(), "] This is the main instance (PID: ").concat(process.pid, ")"));
                // This is the primary instance
                electron_1.app.on('second-instance', function (event, commandLine, workingDirectory, additionalData) {
                    console.log("[".concat(new Date().toISOString(), "] Second instance detected:"), additionalData);
                    if (mainWindow) {
                        if (mainWindow.isMinimized())
                            mainWindow.restore();
                        if (!mainWindow.isVisible())
                            mainWindow.show();
                        mainWindow.focus();
                        // Flash window to get attention
                        mainWindow.flashFrame(true);
                        setTimeout(function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.flashFrame(false); }, 1000);
                    }
                    else {
                        createWindow();
                    }
                });
                // Start IPC servers for better instance communication
                return [4 /*yield*/, singletonManager.startIPCServers(function (message) {
                        handleIPCMessage(message);
                    })];
            case 4:
                // Start IPC servers for better instance communication
                _a.sent();
                _a.label = 5;
            case 5: return [2 /*return*/];
        }
    });
}); })();
// Initialize one.core modules
function initializeOneCore() {
    return __awaiter(this, void 0, void 0, function () {
        var loadNodejs;
        return __generator(this, function (_a) {
            // Load Node.js platform modules for one.core
            try {
                loadNodejs = require('@refinio/one.core/lib/system/load-nodejs.js');
                console.log('ONE Core modules loaded successfully');
            }
            catch (error) {
                console.error('Failed to load ONE Core modules:', error);
            }
            return [2 /*return*/];
        });
    });
}
// Global error handlers
process.on('uncaughtException', function (error) {
    console.error('Uncaught Exception:', error);
    electron_1.dialog.showErrorBox('Unexpected Error', error.message);
});
process.on('unhandledRejection', function (reason, promise) {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    electron_1.dialog.showErrorBox('Unhandled Promise Rejection', String(reason));
});
// Set Windows app identity for proper taskbar integration
electron_1.app.setAppUserModelId('com.refinio.onefiler');
// Set app name
electron_1.app.setName('ONE Filer');
// Disable hardware acceleration to reduce GPU usage (must be before app.whenReady)
electron_1.app.disableHardwareAcceleration();
electron_1.app.whenReady().then(function () { return __awaiter(void 0, void 0, void 0, function () {
    var testServer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!isMainInstance) return [3 /*break*/, 2];
                // Initialize one.core
                return [4 /*yield*/, initializeOneCore()];
            case 1:
                // Initialize one.core
                _a.sent();
                createTray();
                if (!config.startMinimized) {
                    createWindow();
                }
                electron_1.app.on('activate', function () {
                    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                        createWindow();
                    }
                });
                testServer = http.createServer(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
                    var loginResult, error_1;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!(req.url === '/test-login' && req.method === 'POST')) return [3 /*break*/, 5];
                                console.log('[TestAPI] Login request received');
                                _a.label = 1;
                            case 1:
                                _a.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, handleLogin(null, {
                                        secret: 'test123',
                                        configPath: undefined
                                    })];
                            case 2:
                                loginResult = _a.sent();
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify(loginResult));
                                console.log('[TestAPI] Login result:', loginResult);
                                return [3 /*break*/, 4];
                            case 3:
                                error_1 = _a.sent();
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: false, message: error_1.message }));
                                console.error('[TestAPI] Login error:', error_1);
                                return [3 /*break*/, 4];
                            case 4: return [3 /*break*/, 6];
                            case 5:
                                res.writeHead(404);
                                res.end('Not found');
                                _a.label = 6;
                            case 6: return [2 /*return*/];
                        }
                    });
                }); });
                testServer.listen(17891, '127.0.0.1', function () {
                    console.log('[TestAPI] Test server listening on http://127.0.0.1:17891');
                    console.log('[TestAPI] Use POST http://127.0.0.1:17891/test-login to trigger login');
                });
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); });
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin' && !config.showInSystemTray) {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!!isQuitting) return [3 /*break*/, 7];
                isQuitting = true;
                // Prevent default quit to ensure cleanup
                event.preventDefault();
                console.log("[".concat(new Date().toISOString(), "] Starting graceful shutdown..."));
                _a.label = 1;
            case 1:
                _a.trys.push([1, 5, 6, 7]);
                if (!replicant) return [3 /*break*/, 3];
                console.log('Cleaning up ProjFS mount and stopping replicant...');
                return [4 /*yield*/, stopReplicant()];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3: 
            // Clean up singleton manager
            return [4 /*yield*/, singletonManager.cleanup()];
            case 4:
                // Clean up singleton manager
                _a.sent();
                console.log('Singleton manager cleaned up');
                console.log('Cleanup complete, exiting...');
                return [3 /*break*/, 7];
            case 5:
                error_2 = _a.sent();
                console.error('Error during cleanup:', error_2);
                return [3 /*break*/, 7];
            case 6:
                // Force quit after cleanup
                electron_1.app.exit(0);
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
// Shared login handler function
function handleLogin(event, loginData) {
    return __awaiter(this, void 0, void 0, function () {
        var finalSecret, replicantConfig, customConfig, root, mkdirSync, e_1, verifyProjFSMount, mountPath, createMessageBus, messageBusListener, error_3, filer, provider, start, timeoutMs, e_2, error_4, errorMessage, error_5;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('[Login] Login request received with data:', __assign(__assign({}, loginData), { secret: '***' }));
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 22, , 23]);
                    credentials = __assign({}, loginData);
                    finalSecret = loginData.secret;
                    replicantConfig = {
                        directory: config.dataDirectory || (0, path_1.join)(electron_1.app.getPath('userData'), 'one-data'),
                        useFiler: true,
                        filerConfig: {
                            useProjFS: true, // Use ProjFS mode with our new one.ifsprojfs native module
                            projfsRoot: config.projfsRoot || 'C:\\OneFiler', // ProjFS mount point
                            mountPoint: config.mountPoint || 'C:\\OneFiler', // Keep for compatibility
                            logCalls: false,
                            pairingUrl: 'https://leute.refinio.one',
                            iomMode: 'full',
                            // COW cache debug options
                            disableCowCache: config.disableCowCache || false,
                            disableInMemoryCache: config.disableInMemoryCache || false,
                            verboseLogging: config.verboseLogging || false,
                            traceAllOperations: config.traceAllOperations || false
                        }
                    };
                    // Load config file if specified
                    if (loginData.configPath && (0, fs_1.existsSync)(loginData.configPath)) {
                        try {
                            customConfig = JSON.parse((0, fs_1.readFileSync)(loginData.configPath, 'utf8'));
                            Object.assign(replicantConfig, customConfig);
                        }
                        catch (error) {
                            console.error('Failed to load custom config:', error);
                        }
                    }
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 6, , 7]);
                    root = config.projfsRoot || 'C:\\OneFiler';
                    if (!!(0, fs_1.existsSync)(root)) return [3 /*break*/, 4];
                    console.log("[Startup] Creating ProjFS root: ".concat(root));
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
                case 3:
                    mkdirSync = (_b.sent()).mkdirSync;
                    mkdirSync(root, { recursive: true });
                    return [3 /*break*/, 5];
                case 4:
                    console.log("[Startup] ProjFS root exists: ".concat(root));
                    _b.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    e_1 = _b.sent();
                    console.error('[Startup] Failed to ensure ProjFS root exists:', e_1.message);
                    return [3 /*break*/, 7];
                case 7:
                    _b.trys.push([7, 20, , 21]);
                    // If we fell back to a different root, update config here
                    if (config.projfsRoot && config.mountPoint && replicantConfig.filerConfig) {
                        replicantConfig.filerConfig.projfsRoot = config.projfsRoot;
                        replicantConfig.filerConfig.mountPoint = config.mountPoint;
                    }
                    console.log('Creating Replicant with config:', JSON.stringify(replicantConfig, null, 2));
                    replicant = new Replicant_js_1.default(replicantConfig);
                    console.log('Starting Replicant with secret...');
                    return [4 /*yield*/, replicant.start(finalSecret)];
                case 8:
                    _b.sent();
                    console.log('Replicant started successfully');
                    replicantStartTime = new Date();
                    if (!((_a = replicantConfig.filerConfig) === null || _a === void 0 ? void 0 : _a.useProjFS)) return [3 /*break*/, 11];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('./verify-mount.js'); })];
                case 9:
                    verifyProjFSMount = (_b.sent()).verifyProjFSMount;
                    mountPath = replicantConfig.filerConfig.projfsRoot || 'C:\\OneFiler';
                    return [4 /*yield*/, verifyProjFSMount(mountPath)];
                case 10:
                    _b.sent();
                    _b.label = 11;
                case 11:
                    _b.trys.push([11, 13, , 14]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@refinio/one.core/lib/message-bus.js'); })];
                case 12:
                    createMessageBus = (_b.sent()).createMessageBus;
                    messageBusListener = createMessageBus('electron-debug-listener');
                    // Listen for all debug messages
                    messageBusListener.on('debug', function (source) {
                        var messages = [];
                        for (var _i = 1; _i < arguments.length; _i++) {
                            messages[_i - 1] = arguments[_i];
                        }
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            var logEntry = {
                                timestamp: new Date().toISOString(),
                                level: 'debug',
                                source: source,
                                message: messages.join(' ')
                            };
                            mainWindow.webContents.send('debug-log', logEntry);
                        }
                    });
                    // Also listen for projfs-provider specific messages
                    messageBusListener.on('projfs-provider', function (msgType) {
                        var messages = [];
                        for (var _i = 1; _i < arguments.length; _i++) {
                            messages[_i - 1] = arguments[_i];
                        }
                        if (mainWindow && !mainWindow.isDestroyed() && msgType === 'debug') {
                            var logEntry = {
                                timestamp: new Date().toISOString(),
                                level: 'debug',
                                source: 'projfs-provider',
                                message: messages.join(' ')
                            };
                            mainWindow.webContents.send('debug-log', logEntry);
                        }
                    });
                    console.log('Successfully subscribed to ONE message bus for debug messages');
                    return [3 /*break*/, 14];
                case 13:
                    error_3 = _b.sent();
                    console.error('Failed to subscribe to message bus:', error_3);
                    return [3 /*break*/, 14];
                case 14:
                    _b.trys.push([14, 18, , 19]);
                    filer = replicant.filer;
                    provider = filer === null || filer === void 0 ? void 0 : filer.projfsProvider;
                    start = Date.now();
                    timeoutMs = 10000;
                    _b.label = 15;
                case 15:
                    if (!(provider && typeof provider.isPrefetchComplete === 'function' && !provider.isPrefetchComplete())) return [3 /*break*/, 17];
                    if (Date.now() - start > timeoutMs) {
                        console.warn('[Startup] Prefetch readiness timeout exceeded');
                        return [3 /*break*/, 17];
                    }
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 100); })];
                case 16:
                    _b.sent();
                    return [3 /*break*/, 15];
                case 17: return [3 /*break*/, 19];
                case 18:
                    e_2 = _b.sent();
                    console.warn('[Startup] Prefetch readiness check failed:', e_2.message);
                    return [3 /*break*/, 19];
                case 19:
                    // Send initial status update
                    if (mainWindow) {
                        mainWindow.webContents.send('service-status-update', {
                            name: 'replicant',
                            status: 'running',
                            message: 'ONE Filer Service started successfully'
                        });
                    }
                    updateTrayMenu();
                    return [2 /*return*/, {
                            success: true,
                            message: 'Successfully started ONE Filer Service',
                            mountPoint: config.projfsRoot || 'C:\\OneFiler'
                        }];
                case 20:
                    error_4 = _b.sent();
                    errorMessage = error_4 instanceof Error ? error_4.message : 'Unknown error';
                    console.error('Failed to start replicant:', errorMessage);
                    console.error('Stack trace:', error_4.stack);
                    // Provide specific error messages
                    if (errorMessage.includes('Invalid password') || errorMessage.includes('CYENC-SYMDEC')) {
                        return [2 /*return*/, {
                                success: false,
                                message: 'Invalid password. Please check your secret.'
                            }];
                    }
                    else if (errorMessage.includes('Permission denied')) {
                        return [2 /*return*/, {
                                success: false,
                                message: 'Permission denied. Please run as administrator.'
                            }];
                    }
                    else if (errorMessage.includes('ProjFS not enabled') || errorMessage.includes('not available')) {
                        return [2 /*return*/, {
                                success: false,
                                message: 'Windows Projected File System (ProjFS) not enabled. Please enable it in Windows Features.'
                            }];
                    }
                    return [2 /*return*/, {
                            success: false,
                            message: errorMessage
                        }];
                case 21: return [3 /*break*/, 23];
                case 22:
                    error_5 = _b.sent();
                    console.error('Login error:', error_5);
                    return [2 /*return*/, {
                            success: false,
                            message: error_5 instanceof Error ? error_5.message : 'Unknown error occurred'
                        }];
                case 23: return [2 /*return*/];
            }
        });
    });
}
// Handle login request via IPC
electron_1.ipcMain.handle('login', handleLogin);
// Handle logout
electron_1.ipcMain.handle('logout', function () { return __awaiter(void 0, void 0, void 0, function () {
    var error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, stopReplicant()];
            case 1:
                _a.sent();
                credentials = null;
                return [2 /*return*/, { success: true }];
            case 2:
                error_6 = _a.sent();
                console.error('Logout error:', error_6);
                return [2 /*return*/, {
                        success: false,
                        message: error_6 instanceof Error ? error_6.message : 'Logout failed'
                    }];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Stop replicant
function stopReplicant() {
    return __awaiter(this, void 0, void 0, function () {
        var error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    if (!replicant) return [3 /*break*/, 2];
                    return [4 /*yield*/, replicant.stop()];
                case 1:
                    _a.sent();
                    replicant = null;
                    replicantStartTime = null;
                    if (mainWindow) {
                        mainWindow.webContents.send('service-status-update', {
                            name: 'replicant',
                            status: 'stopped',
                            message: 'ONE Filer Service stopped'
                        });
                    }
                    updateTrayMenu();
                    _a.label = 2;
                case 2: return [2 /*return*/, { success: true }];
                case 3:
                    error_7 = _a.sent();
                    return [2 /*return*/, {
                            success: false,
                            message: error_7 instanceof Error ? error_7.message : 'Failed to stop service'
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
electron_1.ipcMain.handle('stop-replicant', stopReplicant);
// Check service status - much simpler now!
electron_1.ipcMain.handle('check-replicant-status', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, {
                running: replicant !== null,
                uptime: replicantStartTime ? Math.floor((Date.now() - replicantStartTime.getTime()) / 1000) : undefined
            }];
    });
}); });
// Get system metrics
electron_1.ipcMain.handle('get-system-metrics', function () { return __awaiter(void 0, void 0, void 0, function () {
    var cpus, totalMemory, freeMemory, usedMemory, totalIdle_1, totalTick_1, cpuUsage, serviceStatus, uptime, projfsStats, filer;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        try {
            cpus = os.cpus();
            totalMemory = os.totalmem();
            freeMemory = os.freemem();
            usedMemory = totalMemory - freeMemory;
            totalIdle_1 = 0;
            totalTick_1 = 0;
            cpus.forEach(function (cpu) {
                for (var type in cpu.times) {
                    totalTick_1 += cpu.times[type];
                }
                totalIdle_1 += cpu.times.idle;
            });
            cpuUsage = 100 - ~~(100 * totalIdle_1 / totalTick_1);
            serviceStatus = replicant ? 'running' : 'stopped';
            uptime = replicantStartTime ? Math.floor((Date.now() - replicantStartTime.getTime()) / 1000) : 0;
            projfsStats = null;
            try {
                if (replicant && ((_b = (_a = replicant.filer) === null || _a === void 0 ? void 0 : _a.isProjFSMode) === null || _b === void 0 ? void 0 : _b.call(_a))) {
                    filer = replicant.filer;
                    // Try to get stats from the underlying ProjFS provider
                    if ((_d = (_c = filer.projfsProvider) === null || _c === void 0 ? void 0 : _c.nativeProvider) === null || _d === void 0 ? void 0 : _d.getStats) {
                        projfsStats = filer.projfsProvider.nativeProvider.getStats();
                    }
                    else if (filer.getStats) {
                        projfsStats = filer.getStats();
                    }
                }
            }
            catch (error) {
                // Silently ignore stats errors - they're not critical
                console.warn('Failed to get ProjFS stats:', error);
            }
            return [2 /*return*/, {
                    system: {
                        cpu: cpuUsage,
                        memory: {
                            used: usedMemory,
                            total: totalMemory,
                            percentage: Math.round((usedMemory / totalMemory) * 100)
                        },
                        disk: { used: 0, total: 0, percentage: 0 }, // TODO: Implement disk usage
                        network: { bytesIn: 0, bytesOut: 0 }
                    },
                    replicant: {
                        status: serviceStatus,
                        uptime: uptime,
                        connections: metricsCache.connections,
                        objectsStored: metricsCache.objectsStored,
                        objectsSynced: metricsCache.objectsSynced,
                        syncQueue: metricsCache.syncQueue,
                        errors: metricsCache.errors,
                        lastSync: metricsCache.lastSync,
                        bandwidth: metricsCache.bandwidth,
                        operations: metricsCache.operations,
                        performance: metricsCache.performance,
                        projfs: projfsStats
                    }
                }];
        }
        catch (error) {
            console.error('Failed to get metrics:', error);
            throw error;
        }
        return [2 /*return*/];
    });
}); });
// Run diagnostics
electron_1.ipcMain.handle('run-diagnostics', function () { return __awaiter(void 0, void 0, void 0, function () {
    var diagnostics, nativeModule;
    return __generator(this, function (_a) {
        try {
            diagnostics = {
                system: {
                    platform: process.platform,
                    arch: process.arch,
                    nodeVersion: process.version,
                    electronVersion: process.versions.electron,
                    chromeVersion: process.versions.chrome,
                    v8Version: process.versions.v8
                },
                config: {
                    dataDirectory: config.dataDirectory,
                    projfsRoot: config.projfsRoot,
                    mountPoint: config.mountPoint,
                    startMinimized: config.startMinimized,
                    showInSystemTray: config.showInSystemTray,
                    autoConnect: config.autoConnect
                },
                paths: {
                    userData: electron_1.app.getPath('userData'),
                    cache: electron_1.app.getPath('temp'),
                    logs: electron_1.app.getPath('logs'),
                    temp: electron_1.app.getPath('temp')
                },
                service: {
                    running: replicant !== null,
                    uptime: replicantStartTime ? Math.floor((Date.now() - replicantStartTime.getTime()) / 1000) : 0
                }
            };
            // Check if ProjFS is available
            try {
                nativeModule = require('@refinio/one.ifsprojfs/build/Release/ifsprojfs.node');
                diagnostics.projfs = {
                    available: true,
                    version: '2.0.0' // New native implementation
                };
            }
            catch (error) {
                diagnostics.projfs = {
                    available: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
            return [2 /*return*/, diagnostics];
        }
        catch (error) {
            console.error('Diagnostics error:', error);
            throw error;
        }
        return [2 /*return*/];
    });
}); });
// Check ProjFS status - native Windows mode!
electron_1.ipcMain.handle('check-wsl-status', function () { return __awaiter(void 0, void 0, void 0, function () {
    var projfsAvailable;
    return __generator(this, function (_a) {
        // Report ProjFS as "WSL" for UI compatibility - ProjFS is our native filesystem
        try {
            projfsAvailable = process.platform === 'win32';
            return [2 /*return*/, {
                    installed: projfsAvailable,
                    running: projfsAvailable, // ProjFS is "running" if we're on Windows
                    distros: projfsAvailable ? ['Native Windows (ProjFS)'] : []
                }];
        }
        catch (error) {
            return [2 /*return*/, {
                    installed: false,
                    running: false,
                    distros: []
                }];
        }
        return [2 /*return*/];
    });
}); });
// Start WSL - not needed anymore!
electron_1.ipcMain.handle('start-wsl', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, {
                success: true,
                message: 'WSL not needed - running natively on Windows!'
            }];
    });
}); });
// Test runner IPC handlers
var testRunner = new simple_test_runner_1.SimpleTestRunner();
var realTestRunner = new real_test_runner_1.RealTestRunner();
electron_1.ipcMain.handle('run-tests', function () { return __awaiter(void 0, void 0, void 0, function () {
    var results_1, results, formattedResults, error_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                console.log('[TestRunner] Starting REAL test execution...');
                if (!(!replicant || !replicant.filer)) return [3 /*break*/, 2];
                console.log('[TestRunner] Replicant not running, using mock tests');
                return [4 /*yield*/, testRunner.runAllTests()];
            case 1:
                results_1 = _a.sent();
                return [2 /*return*/, {
                        success: true,
                        results: results_1
                    }];
            case 2: return [4 /*yield*/, realTestRunner.runRealTests()];
            case 3:
                results = _a.sent();
                console.log('[TestRunner] Real tests completed:', results);
                formattedResults = results.map(function (suite) { return ({
                    name: suite.name,
                    tests: suite.tests.map(function (test) { return ({
                        suite: suite.name,
                        test: test.name,
                        status: test.status,
                        error: test.error,
                        duration: test.duration
                    }); }),
                    passed: suite.passed,
                    failed: suite.failed,
                    skipped: 0,
                    duration: suite.duration
                }); });
                return [2 /*return*/, {
                        success: true,
                        results: formattedResults
                    }];
            case 4:
                error_8 = _a.sent();
                console.error('[TestRunner] Test execution failed:', error_8);
                return [2 /*return*/, {
                        success: false,
                        error: error_8.message
                    }];
            case 5: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('run-test-suite', function (event, suiteName) { return __awaiter(void 0, void 0, void 0, function () {
    var suite_1, result, error_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log("[TestRunner] Running test suite: ".concat(suiteName));
                suite_1 = {
                    name: suiteName,
                    files: []
                };
                // Map suite names to files
                switch (suiteName) {
                    case 'Cache System':
                        suite_1.files = [
                            'test/unit/PersistentCache.simple.test.ts',
                            'test/unit/SmartCacheManager.simple.test.ts'
                        ];
                        break;
                    case 'Application Layer':
                        suite_1.files = ['test/app/ElectronApp.test.ts'];
                        break;
                    case 'End-to-End':
                        suite_1.files = ['test/e2e/FullStack.test.ts'];
                        break;
                    default:
                        throw new Error("Unknown test suite: ".concat(suiteName));
                }
                return [4 /*yield*/, testRunner.runTestSuite(suite_1)];
            case 1:
                result = _a.sent();
                return [2 /*return*/, {
                        success: true,
                        result: result
                    }];
            case 2:
                error_9 = _a.sent();
                console.error("[TestRunner] Test suite failed:", error_9);
                return [2 /*return*/, {
                        success: false,
                        error: error_9.message
                    }];
            case 3: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('get-test-diagnostics', function () { return __awaiter(void 0, void 0, void 0, function () {
    var diagnostics, error_10;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, testRunner.runSystemDiagnostics()];
            case 1:
                diagnostics = _a.sent();
                return [2 /*return*/, {
                        success: true,
                        diagnostics: diagnostics
                    }];
            case 2:
                error_10 = _a.sent();
                return [2 /*return*/, {
                        success: false,
                        error: error_10.message
                    }];
            case 3: return [2 /*return*/];
        }
    });
}); });
// COW Cache debug configuration handlers
electron_1.ipcMain.handle('get-cache-config', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, {
                disableCowCache: config.disableCowCache || false,
                disableInMemoryCache: config.disableInMemoryCache || false,
                verboseLogging: config.verboseLogging || false,
                traceAllOperations: config.traceAllOperations || false
            }];
    });
}); });
electron_1.ipcMain.handle('update-cache-config', function (event, newConfig) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        try {
            // Update config
            config = __assign(__assign({}, config), newConfig);
            // Save to config file
            (0, fs_1.writeFileSync)(configPath, JSON.stringify(config, null, 2));
            return [2 /*return*/, {
                    success: true,
                    message: 'Cache configuration updated. Restart the application to apply changes.',
                    config: {
                        disableCowCache: config.disableCowCache,
                        disableInMemoryCache: config.disableInMemoryCache,
                        verboseLogging: config.verboseLogging,
                        traceAllOperations: config.traceAllOperations
                    }
                }];
        }
        catch (error) {
            return [2 /*return*/, {
                    success: false,
                    error: error.message
                }];
        }
        return [2 /*return*/];
    });
}); });
// Get ProjFS cache statistics
electron_1.ipcMain.handle('get-cache-stats', function () { return __awaiter(void 0, void 0, void 0, function () {
    var provider, stats;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        try {
            // If replicant and filer are running, try to get cache stats
            if (replicant && ((_a = replicant.filer) === null || _a === void 0 ? void 0 : _a.projfsProvider)) {
                provider = replicant.filer.projfsProvider;
                stats = ((_c = (_b = provider.provider) === null || _b === void 0 ? void 0 : _b.getCacheStats) === null || _c === void 0 ? void 0 : _c.call(_b)) || {
                    fileInfoCount: 0,
                    directoryCount: 0,
                    contentCount: 0
                };
                return [2 /*return*/, {
                        success: true,
                        stats: stats,
                        cacheEnabled: !config.disableCowCache,
                        inMemoryCacheEnabled: !config.disableInMemoryCache
                    }];
            }
            return [2 /*return*/, {
                    success: false,
                    message: 'ProjFS provider not running'
                }];
        }
        catch (error) {
            return [2 /*return*/, {
                    success: false,
                    error: error.message
                }];
        }
        return [2 /*return*/];
    });
}); });
