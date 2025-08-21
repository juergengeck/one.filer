import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as os from 'os';
// Direct imports from one.filer - no more WSL!
import Replicant from '../../lib/Replicant.js';
import { SimpleTestRunner } from './simple-test-runner';
import { RealTestRunner } from './real-test-runner';
import { SingletonManager } from './services/SingletonManager';
// import { ONEInitializer } from './services/oneInitializer';
import * as http from 'http';
// Initialize singleton manager
const singletonManager = new SingletonManager({
    appName: 'one-filer',
    port: 17890,
    lockTimeout: 5000
});
let isMainInstance = false;
let mainWindow = null;
let credentials = null;
let replicant = null;
let tray = null;
let isQuitting = false;
let replicantStartTime = null;
// Metrics cache for monitoring
let metricsCache = {
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
let config = {
    startMinimized: false,
    showInSystemTray: true,
    autoConnect: false,
    dataDirectory: join(app.getPath('userData'), 'one-data'),
    projfsRoot: 'C:\\OneFiler',
    mountPoint: 'C:\\OneFiler', // No more WSL paths!
    // Default cache settings (all enabled)
    disableCowCache: false,
    disableInMemoryCache: false,
    verboseLogging: false,
    traceAllOperations: false
};
// Try to load config from file
const configPath = join(process.cwd(), 'config.json');
if (existsSync(configPath)) {
    try {
        const configData = readFileSync(configPath, 'utf8');
        config = { ...config, ...JSON.parse(configData) };
    }
    catch (error) {
        console.error('Failed to load config:', error);
    }
}
// Helper function to handle IPC messages
function handleIPCMessage(message) {
    console.log(`[${new Date().toISOString()}] Handling IPC message:`, message);
    if (message.command === 'show') {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            if (!mainWindow.isVisible())
                mainWindow.show();
            mainWindow.focus();
            // Flash the window to get user attention
            mainWindow.flashFrame(true);
            setTimeout(() => mainWindow?.flashFrame(false), 1000);
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
        app.quit();
    }
}
function createWindow() {
    mainWindow = new BrowserWindow({
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
            preload: join(__dirname, 'preload.js')
        },
        icon: join(__dirname, '..', 'assets', 'icon.png')
    });
    // Load the React-based app
    mainWindow.loadFile(join(__dirname, '..', 'index-react.html'));
    // Log any load errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
    });
    mainWindow.webContents.on('did-finish-load', () => {
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
    mainWindow.on('close', (event) => {
        if (!isQuitting && config.showInSystemTray) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function createTray() {
    if (!config.showInSystemTray)
        return;
    const iconPath = join(__dirname, '..', 'assets', 'icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    tray.setToolTip('ONE Filer Service');
    updateTrayMenu();
    tray.on('click', () => {
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
    if (!tray)
        return;
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show/Hide',
            click: () => {
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
            click: async () => {
                if (replicant) {
                    await stopReplicant();
                }
                else {
                    // Need to get credentials from user
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                    else {
                        createWindow();
                    }
                }
                updateTrayMenu();
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);
}
// Enhanced singleton handling
(async () => {
    isMainInstance = await singletonManager.acquireLock();
    if (!isMainInstance) {
        console.log(`[${new Date().toISOString()}] Another instance of ONE Filer is already running`);
        // Try to activate the existing instance
        const success = await singletonManager.sendToMainInstance({
            command: 'show',
            args: process.argv
        });
        if (success) {
            console.log('Successfully notified the main instance');
        }
        else {
            console.log('Could not communicate with the main instance (it may be starting up)');
        }
        // Exit this instance
        app.exit(0);
    }
    else {
        console.log(`[${new Date().toISOString()}] This is the main instance (PID: ${process.pid})`);
        // This is the primary instance
        app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
            console.log(`[${new Date().toISOString()}] Second instance detected:`, additionalData);
            if (mainWindow) {
                if (mainWindow.isMinimized())
                    mainWindow.restore();
                if (!mainWindow.isVisible())
                    mainWindow.show();
                mainWindow.focus();
                // Flash window to get attention
                mainWindow.flashFrame(true);
                setTimeout(() => mainWindow?.flashFrame(false), 1000);
            }
            else {
                createWindow();
            }
        });
        // Start IPC servers for better instance communication
        await singletonManager.startIPCServers((message) => {
            handleIPCMessage(message);
        });
    }
})();
// Initialize one.core modules
async function initializeOneCore() {
    // Load Node.js platform modules for one.core
    try {
        const loadNodejs = require('@refinio/one.core/lib/system/load-nodejs.js');
        console.log('ONE Core modules loaded successfully');
    }
    catch (error) {
        console.error('Failed to load ONE Core modules:', error);
    }
}
// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    dialog.showErrorBox('Unexpected Error', error.message);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    dialog.showErrorBox('Unhandled Promise Rejection', String(reason));
});
// Set Windows app identity for proper taskbar integration
app.setAppUserModelId('com.refinio.onefiler');
// Set app name
app.setName('ONE Filer');
// Disable hardware acceleration to reduce GPU usage (must be before app.whenReady)
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    if (isMainInstance) {
        // Initialize one.core
        await initializeOneCore();
        createTray();
        if (!config.startMinimized) {
            createWindow();
        }
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
        // Create test HTTP server for automation
        const testServer = http.createServer(async (req, res) => {
            if (req.url === '/test-login' && req.method === 'POST') {
                console.log('[TestAPI] Login request received');
                try {
                    // Use default test password test123
                    const loginResult = await handleLogin(null, {
                        secret: 'test123',
                        configPath: undefined
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(loginResult));
                    console.log('[TestAPI] Login result:', loginResult);
                }
                catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: error.message }));
                    console.error('[TestAPI] Login error:', error);
                }
            }
            else {
                res.writeHead(404);
                res.end('Not found');
            }
        });
        testServer.listen(17891, '127.0.0.1', () => {
            console.log('[TestAPI] Test server listening on http://127.0.0.1:17891');
            console.log('[TestAPI] Use POST http://127.0.0.1:17891/test-login to trigger login');
        });
    }
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !config.showInSystemTray) {
        app.quit();
    }
});
app.on('before-quit', async (event) => {
    if (!isQuitting) {
        isQuitting = true;
        // Prevent default quit to ensure cleanup
        event.preventDefault();
        console.log(`[${new Date().toISOString()}] Starting graceful shutdown...`);
        try {
            // Stop replicant and unmount ProjFS
            if (replicant) {
                console.log('Cleaning up ProjFS mount and stopping replicant...');
                await stopReplicant();
            }
            // Clean up singleton manager
            await singletonManager.cleanup();
            console.log('Singleton manager cleaned up');
            console.log('Cleanup complete, exiting...');
        }
        catch (error) {
            console.error('Error during cleanup:', error);
        }
        finally {
            // Force quit after cleanup
            app.exit(0);
        }
    }
});
// Shared login handler function
async function handleLogin(event, loginData) {
    console.log('[Login] Login request received with data:', { ...loginData, secret: '***' });
    try {
        credentials = { ...loginData };
        // Initialize ONE identity first
        // const initializer = new ONEInitializer({
        //   dataDirectory: config.dataDirectory || join(app.getPath('userData'), 'one-data'),
        //   secret: loginData.secret
        // });
        // const { identity, secret: finalSecret } = await initializer.initialize();
        // console.log('[Login] ONE identity initialized:', identity.personId);
        // For now, just use the provided secret
        const finalSecret = loginData.secret;
        // Create replicant configuration with COW cache debug options
        const replicantConfig = {
            directory: config.dataDirectory || join(app.getPath('userData'), 'one-data'),
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
        if (loginData.configPath && existsSync(loginData.configPath)) {
            try {
                const customConfig = JSON.parse(readFileSync(loginData.configPath, 'utf8'));
                Object.assign(replicantConfig, customConfig);
            }
            catch (error) {
                console.error('Failed to load custom config:', error);
            }
        }
        // Ensure ProjFS root directory exists before starting replicant
        try {
            const root = config.projfsRoot || 'C:\\OneFiler';
            if (!existsSync(root)) {
                console.log(`[Startup] Creating ProjFS root: ${root}`);
                const { mkdirSync } = await import('fs');
                mkdirSync(root, { recursive: true });
            }
            else {
                console.log(`[Startup] ProjFS root exists: ${root}`);
            }
        }
        catch (e) {
            console.error('[Startup] Failed to ensure ProjFS root exists:', e.message);
        }
        // Create and start replicant
        try {
            // If we fell back to a different root, update config here
            if (config.projfsRoot && config.mountPoint && replicantConfig.filerConfig) {
                replicantConfig.filerConfig.projfsRoot = config.projfsRoot;
                replicantConfig.filerConfig.mountPoint = config.mountPoint;
            }
            console.log('Creating Replicant with config:', JSON.stringify(replicantConfig, null, 2));
            replicant = new Replicant(replicantConfig);
            console.log('Starting Replicant with secret...');
            await replicant.start(finalSecret);
            console.log('Replicant started successfully');
            replicantStartTime = new Date();
            // Verify ProjFS mount if using ProjFS mode
            if (replicantConfig.filerConfig?.useProjFS) {
                const { verifyProjFSMount } = await import('./verify-mount.js');
                const mountPath = replicantConfig.filerConfig.projfsRoot || 'C:\\OneFiler';
                await verifyProjFSMount(mountPath);
            }
            // Subscribe to ONE message bus for debug messages
            try {
                const { createMessageBus } = await import('@refinio/one.core/lib/message-bus.js');
                const messageBusListener = createMessageBus('electron-debug-listener');
                // Listen for all debug messages
                messageBusListener.on('debug', (source, ...messages) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        const logEntry = {
                            timestamp: new Date().toISOString(),
                            level: 'debug',
                            source: source,
                            message: messages.join(' ')
                        };
                        mainWindow.webContents.send('debug-log', logEntry);
                    }
                });
                // Also listen for projfs-provider specific messages
                messageBusListener.on('projfs-provider', (msgType, ...messages) => {
                    if (mainWindow && !mainWindow.isDestroyed() && msgType === 'debug') {
                        const logEntry = {
                            timestamp: new Date().toISOString(),
                            level: 'debug',
                            source: 'projfs-provider',
                            message: messages.join(' ')
                        };
                        mainWindow.webContents.send('debug-log', logEntry);
                    }
                });
                console.log('Successfully subscribed to ONE message bus for debug messages');
            }
            catch (error) {
                console.error('Failed to subscribe to message bus:', error);
            }
            // Wait until prefetch completes so UI can keep spinner until ready
            try {
                const filer = replicant.filer;
                const provider = filer?.projfsProvider;
                const start = Date.now();
                const timeoutMs = 10000; // 10s max
                while (provider && typeof provider.isPrefetchComplete === 'function' && !provider.isPrefetchComplete()) {
                    if (Date.now() - start > timeoutMs) {
                        console.warn('[Startup] Prefetch readiness timeout exceeded');
                        break;
                    }
                    await new Promise(r => setTimeout(r, 100));
                }
            }
            catch (e) {
                console.warn('[Startup] Prefetch readiness check failed:', e.message);
            }
            // Send initial status update
            if (mainWindow) {
                mainWindow.webContents.send('service-status-update', {
                    name: 'replicant',
                    status: 'running',
                    message: 'ONE Filer Service started successfully'
                });
            }
            updateTrayMenu();
            return {
                success: true,
                message: 'Successfully started ONE Filer Service',
                mountPoint: config.projfsRoot || 'C:\\OneFiler'
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to start replicant:', errorMessage);
            console.error('Stack trace:', error.stack);
            // Provide specific error messages
            if (errorMessage.includes('Invalid password') || errorMessage.includes('CYENC-SYMDEC')) {
                return {
                    success: false,
                    message: 'Invalid password. Please check your secret.'
                };
            }
            else if (errorMessage.includes('Permission denied')) {
                return {
                    success: false,
                    message: 'Permission denied. Please run as administrator.'
                };
            }
            else if (errorMessage.includes('ProjFS not enabled') || errorMessage.includes('not available')) {
                return {
                    success: false,
                    message: 'Windows Projected File System (ProjFS) not enabled. Please enable it in Windows Features.'
                };
            }
            return {
                success: false,
                message: errorMessage
            };
        }
    }
    catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
// Handle login request via IPC
ipcMain.handle('login', handleLogin);
// Handle logout
ipcMain.handle('logout', async () => {
    try {
        await stopReplicant();
        credentials = null;
        return { success: true };
    }
    catch (error) {
        console.error('Logout error:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Logout failed'
        };
    }
});
// Stop replicant
async function stopReplicant() {
    try {
        if (replicant) {
            await replicant.stop();
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
        }
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to stop service'
        };
    }
}
ipcMain.handle('stop-replicant', stopReplicant);
// Check service status - much simpler now!
ipcMain.handle('check-replicant-status', async () => {
    return {
        running: replicant !== null,
        uptime: replicantStartTime ? Math.floor((Date.now() - replicantStartTime.getTime()) / 1000) : undefined
    };
});
// Get system metrics
ipcMain.handle('get-system-metrics', async () => {
    try {
        // Get system metrics
        const cpus = os.cpus();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        // Calculate CPU usage
        let totalIdle = 0;
        let totalTick = 0;
        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);
        // Get service metrics
        const serviceStatus = replicant ? 'running' : 'stopped';
        const uptime = replicantStartTime ? Math.floor((Date.now() - replicantStartTime.getTime()) / 1000) : 0;
        // Get ProjFS stats if available
        let projfsStats = null;
        try {
            if (replicant && replicant.filer?.isProjFSMode?.()) {
                const filer = replicant.filer;
                // Try to get stats from the underlying ProjFS provider
                if (filer.projfsProvider?.nativeProvider?.getStats) {
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
        return {
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
                uptime,
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
        };
    }
    catch (error) {
        console.error('Failed to get metrics:', error);
        throw error;
    }
});
// Run diagnostics
ipcMain.handle('run-diagnostics', async () => {
    try {
        const diagnostics = {
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
                userData: app.getPath('userData'),
                cache: app.getPath('temp'),
                logs: app.getPath('logs'),
                temp: app.getPath('temp')
            },
            service: {
                running: replicant !== null,
                uptime: replicantStartTime ? Math.floor((Date.now() - replicantStartTime.getTime()) / 1000) : 0
            }
        };
        // Check if ProjFS is available
        try {
            const nativeModule = require('@refinio/one.ifsprojfs/build/Release/ifsprojfs.node');
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
        return diagnostics;
    }
    catch (error) {
        console.error('Diagnostics error:', error);
        throw error;
    }
});
// Check ProjFS status - native Windows mode!
ipcMain.handle('check-wsl-status', async () => {
    // Report ProjFS as "WSL" for UI compatibility - ProjFS is our native filesystem
    try {
        // Check if ProjFS is available (we're always running native on Windows)
        const projfsAvailable = process.platform === 'win32';
        return {
            installed: projfsAvailable,
            running: projfsAvailable, // ProjFS is "running" if we're on Windows
            distros: projfsAvailable ? ['Native Windows (ProjFS)'] : []
        };
    }
    catch (error) {
        return {
            installed: false,
            running: false,
            distros: []
        };
    }
});
// Start WSL - not needed anymore!
ipcMain.handle('start-wsl', async () => {
    return {
        success: true,
        message: 'WSL not needed - running natively on Windows!'
    };
});
// Test runner IPC handlers
const testRunner = new SimpleTestRunner();
const realTestRunner = new RealTestRunner();
ipcMain.handle('run-tests', async () => {
    try {
        console.log('[TestRunner] Starting REAL test execution...');
        // Check if replicant is running first
        if (!replicant || !replicant.filer) {
            console.log('[TestRunner] Replicant not running, using mock tests');
            const results = await testRunner.runAllTests();
            return {
                success: true,
                results
            };
        }
        // Run real tests
        const results = await realTestRunner.runRealTests();
        console.log('[TestRunner] Real tests completed:', results);
        // Convert to expected format
        const formattedResults = results.map(suite => ({
            name: suite.name,
            tests: suite.tests.map(test => ({
                suite: suite.name,
                test: test.name,
                status: test.status,
                error: test.error,
                duration: test.duration
            })),
            passed: suite.passed,
            failed: suite.failed,
            skipped: 0,
            duration: suite.duration
        }));
        return {
            success: true,
            results: formattedResults
        };
    }
    catch (error) {
        console.error('[TestRunner] Test execution failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
ipcMain.handle('run-test-suite', async (event, suiteName) => {
    try {
        console.log(`[TestRunner] Running test suite: ${suiteName}`);
        const suite = {
            name: suiteName,
            files: []
        };
        // Map suite names to files
        switch (suiteName) {
            case 'Cache System':
                suite.files = [
                    'test/unit/PersistentCache.simple.test.ts',
                    'test/unit/SmartCacheManager.simple.test.ts'
                ];
                break;
            case 'Application Layer':
                suite.files = ['test/app/ElectronApp.test.ts'];
                break;
            case 'End-to-End':
                suite.files = ['test/e2e/FullStack.test.ts'];
                break;
            default:
                throw new Error(`Unknown test suite: ${suiteName}`);
        }
        const result = await testRunner.runTestSuite(suite);
        return {
            success: true,
            result
        };
    }
    catch (error) {
        console.error(`[TestRunner] Test suite failed:`, error);
        return {
            success: false,
            error: error.message
        };
    }
});
ipcMain.handle('get-test-diagnostics', async () => {
    try {
        const diagnostics = await testRunner.runSystemDiagnostics();
        return {
            success: true,
            diagnostics
        };
    }
    catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
});
// COW Cache debug configuration handlers
ipcMain.handle('get-cache-config', async () => {
    return {
        disableCowCache: config.disableCowCache || false,
        disableInMemoryCache: config.disableInMemoryCache || false,
        verboseLogging: config.verboseLogging || false,
        traceAllOperations: config.traceAllOperations || false
    };
});
ipcMain.handle('update-cache-config', async (event, newConfig) => {
    try {
        // Update config
        config = { ...config, ...newConfig };
        // Save to config file
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        return {
            success: true,
            message: 'Cache configuration updated. Restart the application to apply changes.',
            config: {
                disableCowCache: config.disableCowCache,
                disableInMemoryCache: config.disableInMemoryCache,
                verboseLogging: config.verboseLogging,
                traceAllOperations: config.traceAllOperations
            }
        };
    }
    catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
});
// Get ProjFS cache statistics
ipcMain.handle('get-cache-stats', async () => {
    try {
        // If replicant and filer are running, try to get cache stats
        if (replicant && replicant.filer?.projfsProvider) {
            const provider = replicant.filer.projfsProvider;
            const stats = provider.provider?.getCacheStats?.() || {
                fileInfoCount: 0,
                directoryCount: 0,
                contentCount: 0
            };
            return {
                success: true,
                stats,
                cacheEnabled: !config.disableCowCache,
                inMemoryCacheEnabled: !config.disableInMemoryCache
            };
        }
        return {
            success: false,
            message: 'ProjFS provider not running'
        };
    }
    catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
});
//# sourceMappingURL=main-native.js.map