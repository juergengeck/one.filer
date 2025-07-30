import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, protocol } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as os from 'os';
import * as net from 'net';

// Direct imports from one.filer - no more WSL!
import { Replicant } from '../../src/Replicant.js';
import { FilerWithProjFS } from '../../src/filer/FilerWithProjFS.js';
import type { ReplicantConfig } from '../../src/ReplicantConfig.js';

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

// IPC server for inter-process communication
let ipcServer: net.Server | null = null;
const IPC_PORT = 17890;

interface Credentials {
  secret: string;
  configPath?: string;
}

interface LoginRequest {
  secret: string;
  configPath?: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  mountPoint?: string;
}

let mainWindow: BrowserWindow | null = null;
let credentials: Credentials | null = null;
let replicant: Replicant | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let replicantStartTime: Date | null = null;

// Metrics cache for monitoring
let metricsCache = {
  objectsStored: 0,
  objectsSynced: 0,
  syncQueue: 0,
  connections: 0,
  lastSync: null as Date | null,
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

// Load configuration
interface AppConfig {
  startMinimized?: boolean;
  showInSystemTray?: boolean;
  autoConnect?: boolean;
  dataDirectory?: string;
  projfsRoot?: string;
  mountPoint?: string;
}

let config: AppConfig = {
  startMinimized: false,
  showInSystemTray: true,
  autoConnect: false,
  dataDirectory: join(app.getPath('userData'), 'one-data'),
  projfsRoot: 'C:\\OneFiler',
  mountPoint: '/mnt/onefiler'
};

// Try to load config from file
const configPath = join(process.cwd(), 'config.json');
if (existsSync(configPath)) {
  try {
    const configData = readFileSync(configPath, 'utf8');
    config = { ...config, ...JSON.parse(configData) };
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    resizable: true,
    show: !config.startMinimized,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js')
    },
    icon: join(__dirname, '..', 'assets', 'icon.png')
  });

  // Load the React-based app
  mainWindow.loadFile(join(__dirname, '..', 'index-react.html'));
  
  // Hide menu bar
  mainWindow.setMenu(null);
  
  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
  
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

function createTray(): void {
  if (!config.showInSystemTray) return;
  
  const iconPath = join(__dirname, '..', 'assets', 'icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  
  tray = new Tray(trayIcon);
  tray.setToolTip('ONE Filer Service');
  
  updateTrayMenu();
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

function updateTrayMenu(): void {
  if (!tray) return;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        } else {
          createWindow();
        }
      }
    },
    {
      label: replicant ? 'Stop Service' : 'Start Service',
      click: async () => {
        if (replicant) {
          await stopReplicant();
        } else {
          // Need to get credentials from user
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
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

// Handle single instance
if (!gotTheLock) {
  console.log('Another instance of ONE Filer Service is already running');
  
  // Try to notify the existing instance
  const client = net.createConnection({ port: IPC_PORT }, () => {
    client.write(JSON.stringify({ command: 'show' }));
    client.end();
  });
  
  client.on('error', () => {
    console.error('Could not communicate with existing instance');
  });
  
  app.quit();
} else {
  // This is the primary instance
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
  
  // Start IPC server
  ipcServer = net.createServer((socket) => {
    socket.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.command === 'show') {
          if (mainWindow) {
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow();
          }
        }
      } catch (error) {
        console.error('IPC message error:', error);
      }
    });
  });
  
  ipcServer.listen(IPC_PORT, '127.0.0.1');
}

// Initialize one.core modules
async function initializeOneCore(): Promise<void> {
  // Load Node.js platform modules for one.core
  await import('@refinio/one.core/lib/system/load-nodejs.js');
}

app.whenReady().then(async () => {
  if (gotTheLock) {
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
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !config.showInSystemTray) {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  
  // Clean up IPC server
  if (ipcServer) {
    ipcServer.close();
    ipcServer = null;
  }
});

// Handle login request - now runs natively!
ipcMain.handle('login', async (event, loginData: LoginRequest): Promise<LoginResponse> => {
  try {
    credentials = { ...loginData };
    
    // Create replicant configuration
    const replicantConfig: Partial<ReplicantConfig> = {
      directory: config.dataDirectory || join(app.getPath('userData'), 'one-data'),
      useFiler: true,
      filerConfig: {
        useProjFS: true,  // Always use ProjFS on Windows
        projfsRoot: config.projfsRoot || 'C:\\OneFiler',
        mountPoint: config.mountPoint || '/mnt/onefiler',
        logCalls: false,
        pairingUrl: 'https://leute.refinio.one',
        iomMode: 'full'
      }
    };
    
    // Load config file if specified
    if (loginData.configPath && existsSync(loginData.configPath)) {
      try {
        const customConfig = JSON.parse(readFileSync(loginData.configPath, 'utf8'));
        Object.assign(replicantConfig, customConfig);
      } catch (error) {
        console.error('Failed to load custom config:', error);
      }
    }
    
    // Create and start replicant
    try {
      replicant = new Replicant(replicantConfig);
      await replicant.start(loginData.secret);
      
      replicantStartTime = new Date();
      
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to start replicant:', errorMessage);
      
      // Provide specific error messages
      if (errorMessage.includes('Invalid password') || errorMessage.includes('CYENC-SYMDEC')) {
        return {
          success: false,
          message: 'Invalid password. Please check your secret.'
        };
      } else if (errorMessage.includes('Permission denied')) {
        return {
          success: false,
          message: 'Permission denied. Please run as administrator.'
        };
      } else if (errorMessage.includes('ProjFS')) {
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
  } catch (error) {
    console.error('Login error:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
});

// Handle logout
ipcMain.handle('logout', async (): Promise<{ success: boolean; message?: string }> => {
  try {
    await stopReplicant();
    credentials = null;
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Logout failed' 
    };
  }
});

// Stop replicant
async function stopReplicant(): Promise<{ success: boolean; message?: string }> {
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
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to stop service'
    };
  }
}

ipcMain.handle('stop-replicant', stopReplicant);

// Check service status - much simpler now!
ipcMain.handle('check-replicant-status', async (): Promise<{ running: boolean; uptime?: number }> => {
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
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);
    
    // Get service metrics
    const serviceStatus = replicant ? 'running' : 'stopped';
    const uptime = replicantStartTime ? Math.floor((Date.now() - replicantStartTime.getTime()) / 1000) : 0;
    
    // If we have a running replicant with ProjFS, we can get stats
    let projfsStats = null;
    if (replicant && (replicant as any).filer?.isProjFSMode?.()) {
      projfsStats = (replicant as any).filer.getStats?.();
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
        status: serviceStatus as 'running' | 'stopped',
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
  } catch (error) {
    console.error('Failed to get metrics:', error);
    throw error;
  }
});

// Run diagnostics
ipcMain.handle('run-diagnostics', async (): Promise<Record<string, any>> => {
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
        cache: app.getPath('cache'),
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
      const { ProjFSFuse } = await import('projfs-fuse.one');
      diagnostics.projfs = {
        available: true,
        version: '1.0.0'
      };
    } catch (error) {
      diagnostics.projfs = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    return diagnostics;
  } catch (error) {
    console.error('Diagnostics error:', error);
    throw error;
  }
});

// Check WSL status - not needed anymore!
ipcMain.handle('check-wsl-status', async (): Promise<{ installed: boolean; running: boolean; distros: string[] }> => {
  // Always return "not needed" since we run natively
  return {
    installed: false,
    running: false,
    distros: []
  };
});

// Start WSL - not needed anymore!
ipcMain.handle('start-wsl', async (): Promise<{ success: boolean; message?: string }> => {
  return { 
    success: true, 
    message: 'WSL not needed - running natively on Windows!' 
  };
});