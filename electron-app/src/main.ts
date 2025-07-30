import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, protocol } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as os from 'os';
import * as net from 'net';
import { ServiceManager } from './services/ServiceManager';

const exec = promisify(execCallback);
// For CommonJS, __dirname is already available

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

// IPC server for inter-process communication
let ipcServer: net.Server | null = null;
const IPC_PORT = 17890; // Fixed port for IPC communication

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
let replicantProcess: ChildProcess | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let replicantStartTime: Date | null = null;
let serviceManager: ServiceManager;
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
  wslDistro?: string;
  replicantPath?: string;
}

let config: AppConfig = {
  startMinimized: false,
  showInSystemTray: true,
  autoConnect: false,
  wslDistro: 'Ubuntu',
  replicantPath: '/home/juerg/source/one.filer'
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

  // Load the React-based app for better monitoring capabilities
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
  tray.setToolTip('ONE Filer Control');
  
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
      label: replicantProcess ? 'Stop Replicant' : 'Start Replicant',
      click: async () => {
        if (replicantProcess) {
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
      label: 'Check for Updates',
      click: async () => {
        await checkForUpdates();
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
  // Another instance is already running
  console.log('Another instance of ONE Filer is already running');
  
  // Try to notify the existing instance
  const client = net.createConnection({ port: IPC_PORT }, () => {
    client.write(JSON.stringify({ command: 'show' }));
    client.end();
  });
  
  client.on('error', () => {
    // Couldn't connect to existing instance
    console.error('Could not communicate with existing instance');
  });
  
  app.quit();
} else {
  // This is the primary instance
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
  
  // Start IPC server for inter-process communication
  ipcServer = net.createServer((socket) => {
    socket.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.command === 'show') {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
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
  
  ipcServer.listen(IPC_PORT, '127.0.0.1', () => {
    console.log(`IPC server listening on port ${IPC_PORT}`);
  });
  
  ipcServer.on('error', (err) => {
    console.error('IPC server error:', err);
  });
}

// Initialize ServiceManager early to ensure availability for IPC handlers
if (gotTheLock) {
  initializeServiceManager();
}

// Set app name for notifications
app.setAppUserModelId('com.onefiler.login');

// Set proper paths for app data to avoid permission issues
const userDataPath = join(app.getPath('userData'), 'ONE-Filer');
app.setPath('userData', userDataPath);
app.setPath('cache', join(userDataPath, 'Cache'));

// Ensure directories exist with proper permissions
try {
  const { mkdirSync } = require('fs');
  mkdirSync(userDataPath, { recursive: true });
  mkdirSync(join(userDataPath, 'Cache'), { recursive: true });
} catch (error) {
  console.error('Failed to create app directories:', error);
}

// Initialize ServiceManager
function initializeServiceManager(): void {
  serviceManager = new ServiceManager();
  
  // Register WSL service
  serviceManager.registerService({
    name: 'wsl',
    checkCommand: 'wsl --list --running',
    startCommand: 'wsl -e echo "WSL started"',
    healthCheck: async () => {
      try {
        const { stdout } = await exec('wsl --list --running');
        return stdout.includes(config.wslDistro || 'Ubuntu');
      } catch {
        return false;
      }
    },
    retryAttempts: 3,
    retryDelay: 2000
  });
  
  // Register Replicant service
  serviceManager.registerService({
    name: 'replicant',
    checkCommand: `wsl -d ${config.wslDistro || 'Ubuntu'} -e bash -c "pgrep -f 'node.*one-filer.*start' || echo ''"`,
    startCommand: 'wsl -d {{distro}} -e bash -c "{{command}}"',
    stopCommand: `wsl -d ${config.wslDistro || 'Ubuntu'} -e bash -c "pkill -f 'node.*one-filer.*start' || true"`,
    requiredServices: ['wsl'],
    healthCheck: async () => {
      try {
        const status = await serviceManager.checkService('replicant');
        return status.status === 'running' && !!status.pid;
      } catch {
        return false;
      }
    },
    retryAttempts: 3,
    retryDelay: 3000
  });
  
  // Set up event listeners
  serviceManager.on('service-status-changed', (status) => {
    console.log(`Service ${status.name} status changed to ${status.status}`);
    if (mainWindow) {
      mainWindow.webContents.send('service-status-update', status);
    }
  });
  
  serviceManager.on('service-output', ({ service, data }) => {
    console.log(`[${service}] ${data}`);
    if (service === 'replicant') {
      parseReplicantOutput(data);
    }
  });
  
  serviceManager.on('service-error', ({ service, data }) => {
    console.error(`[${service}] ERROR: ${data}`);
  });
  
  serviceManager.on('service-retry', ({ service, attempt, maxAttempts }) => {
    console.log(`Retrying ${service} (${attempt}/${maxAttempts})...`);
  });
  
  serviceManager.on('service-failed', (status) => {
    console.error(`Service ${status.name} failed to start: ${status.error}`);
    if (mainWindow) {
      mainWindow.webContents.send('service-error', {
        service: status.name,
        error: status.error
      });
    }
  });
}

app.whenReady().then(() => {
  if (gotTheLock) {
    // ServiceManager already initialized earlier
    
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

// Handle login request
ipcMain.handle('login', async (event, loginData: LoginRequest): Promise<LoginResponse> => {
  try {
    // Store credentials
    credentials = { ...loginData };
    
    // Check WSL using ServiceManager
    const wslStatus = await serviceManager.checkService('wsl');
    
    if (wslStatus.status !== 'running') {
      console.log('WSL not running, attempting to start...');
      try {
        await serviceManager.startService('wsl');
      } catch (error) {
        return {
          success: false,
          message: `Failed to start WSL: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
    
    // Prepare replicant command
    const replicantPath = config.replicantPath || '/mnt/c/Users/juerg/source/one.filer';
    const configArg = loginData.configPath ? 
      `--config "${loginData.configPath}"` : 
      `--config "${replicantPath}/configs/demo-config.json"`;
    const command = `cd ${replicantPath} && node lib/index.js start --secret "${loginData.secret}" --filer true ${configArg}`;
    
    // Start replicant using ServiceManager
    try {
      const result = await serviceManager.startService('replicant', {
        distro: config.wslDistro || 'Ubuntu',
        command: command
      });
      
      if (result.status === 'running') {
        replicantStartTime = new Date();
        replicantProcess = (serviceManager as any).processes.get('replicant') || null;
        
        return { 
          success: true, 
          message: 'Successfully started ONE Filer replicant',
          mountPoint: 'Check WSL for mount location'
        };
      } else {
        return { 
          success: false, 
          message: result.error || 'Failed to start replicant' 
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to start replicant:', errorMessage);
      
      // Provide specific error messages
      if (errorMessage.includes('Invalid password')) {
        return {
          success: false,
          message: 'Invalid password. Please check your secret.'
        };
      } else if (errorMessage.includes('Permission denied')) {
        return {
          success: false,
          message: 'Permission denied. Please check file permissions.'
        };
      } else if (errorMessage.includes('not found')) {
        return {
          success: false,
          message: 'ONE Filer installation not found. Please check the installation path.'
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

// Start replicant in WSL
async function startReplicantInWSL(secret: string, configPath?: string): Promise<{ success: boolean; message?: string; mountPoint?: string }> {
  try {
    // Kill any existing replicant process
    if (replicantProcess) {
      console.log('Killing existing replicant process...');
      replicantProcess.kill();
      replicantProcess = null;
    }
    
    // Also kill any orphaned processes in WSL
    try {
      await exec(`wsl -d ${config.wslDistro || 'Ubuntu'} -e bash -c "pkill -f 'node.*one-filer.*start' || true"`);
    } catch {
      // Ignore errors - process might not exist
    }
    
    // Build the command to run the replicant in WSL
    // Use the local installation path instead of global command
    const replicantPath = '/mnt/c/Users/juerg/source/one.filer';
    // Use demo config if no config specified
    const configArg = configPath ? `--config "${configPath}"` : `--config "${replicantPath}/configs/demo-config.json"`;
    const command = `cd ${replicantPath} && node lib/index.js start --secret "${secret}" --filer true ${configArg}`;
    
    // Start the replicant process in WSL
    const wslDistro = config.wslDistro || 'Ubuntu';
    console.log(`Starting replicant with command: ${command}`);
    console.log(`Using WSL distro: ${wslDistro}`);
    
    replicantProcess = spawn('wsl', ['-d', wslDistro, '-e', 'bash', '-c', command], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';
      let resolved = false;
      
      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (replicantProcess) {
            replicantProcess.kill();
            replicantProcess = null;
          }
          resolve({
            success: false,
            message: 'Timeout: Replicant failed to start within 10 seconds'
          });
        }
      }, 10000);
      
      if (replicantProcess && replicantProcess.stdout) {
        replicantProcess.stdout.on('data', (data) => {
          const dataStr = data.toString();
          output += dataStr;
          console.log('Replicant output:', dataStr);
          
          // Parse metrics from output
          parseReplicantOutput(dataStr);
          
          // Check if replicant started successfully
          if ((output.includes('[info]: Replicant started successfully') || 
               output.includes('✅ Loaded FUSE3 N-API addon') ||
               output.includes('WSL2 Windows Filer started successfully')) && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            
            // Try to extract mount point from output
            const mountMatch = output.match(/mount.*?([A-Z]:\\[^\s]+|\/[^\s]+)/i);
            const mountPoint = mountMatch ? mountMatch[1] : undefined;
            
            // Update tray menu to reflect running state
            updateTrayMenu();
            replicantStartTime = new Date();
            
            resolve({
              success: true,
              message: 'Replicant started successfully',
              mountPoint
            });
          }
        });
      }
      
      if (replicantProcess && replicantProcess.stderr) {
        replicantProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
          console.error('Replicant error:', data.toString());
          
          // Check for specific errors
          if ((errorOutput.includes('Error: invalid password') || 
               errorOutput.includes('CYENC-SYMDEC')) && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            if (replicantProcess) {
              replicantProcess.kill();
              replicantProcess = null;
            }
            resolve({
              success: false,
              message: 'Invalid password. Please check your secret.'
            });
          }
        });
      }
      
      if (replicantProcess) {
        replicantProcess.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          replicantProcess = null;
          resolve({
            success: false,
            message: `Replicant process exited with code ${code}`
          });
        }
        });
        
        replicantProcess.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          replicantProcess = null;
          resolve({
            success: false,
            message: `Failed to start replicant: ${err.message}`
          });
          }
        });
      }
    });
  } catch (error) {
    console.error('Error starting replicant:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start replicant'
    };
  }
}

// Handle logout
ipcMain.handle('logout', async (): Promise<{ success: boolean; message?: string }> => {
  try {
    // Stop the replicant process
    if (replicantProcess) {
      replicantProcess.kill();
      replicantProcess = null;
    }
    
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

// Check WSL status
ipcMain.handle('check-wsl-status', async (): Promise<{ installed: boolean; running: boolean; distros: string[] }> => {
  try {
    const wslStatus = await serviceManager.checkService('wsl');
    
    // Get list of distros
    const { stdout } = await exec('wsl --list --verbose');
    const lines = stdout.split('\n').filter(line => line.trim());
    const distros: string[] = [];
    
    // Parse WSL output
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          distros.push(parts[0].replace('*', '').trim());
        }
      }
    }
    
    return {
      installed: distros.length > 0,
      running: wslStatus.status === 'running',
      distros
    };
  } catch (error) {
    // WSL not installed
    return {
      installed: false,
      running: false,
      distros: []
    };
  }
});

// Check replicant status
ipcMain.handle('check-replicant-status', async (): Promise<{ running: boolean; pid?: number }> => {
  try {
    const status = await serviceManager.checkService('replicant');
    
    return {
      running: status.status === 'running',
      pid: status.pid
    };
  } catch (error) {
    console.error('Error checking replicant status:', error);
    return {
      running: false
    };
  }
});

// Start WSL if not running
ipcMain.handle('start-wsl', async (): Promise<{ success: boolean; message?: string }> => {
  try {
    // Start default WSL distro
    await exec('wsl -e echo "WSL started"');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start WSL'
    };
  }
});

// Stop replicant process
async function stopReplicant(): Promise<{ success: boolean; message?: string }> {
  try {
    await serviceManager.stopService('replicant');
    
    replicantProcess = null;
    replicantStartTime = null;
    
    // Update tray menu
    updateTrayMenu();
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to stop replicant'
    };
  }
}

ipcMain.handle('stop-replicant', stopReplicant);

// Run service diagnostics
ipcMain.handle('run-diagnostics', async (): Promise<Record<string, any>> => {
  try {
    const diagnostics = await serviceManager.runDiagnostics();
    
    // Add additional system diagnostics
    const systemDiagnostics = {
      ...diagnostics,
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        v8Version: process.versions.v8
      },
      config: {
        wslDistro: config.wslDistro,
        replicantPath: config.replicantPath,
        startMinimized: config.startMinimized,
        showInSystemTray: config.showInSystemTray,
        autoConnect: config.autoConnect
      },
      paths: {
        userData: app.getPath('userData'),
        cache: join(userDataPath, 'Cache'),
        logs: app.getPath('logs'),
        temp: app.getPath('temp')
      }
    };
    
    return systemDiagnostics;
  } catch (error) {
    console.error('Diagnostics error:', error);
    throw error;
  }
});

// Check for updates
async function checkForUpdates(): Promise<void> {
  try {
    // Simple update check - in production, this would check GitHub releases or similar
    const result = await dialog.showMessageBox(mainWindow || new BrowserWindow({ show: false }), {
      type: 'info',
      title: 'Check for Updates',
      message: 'Update check not implemented yet.',
      detail: 'In production, this would check for new versions of ONE Filer.',
      buttons: ['OK']
    });
  } catch (error) {
    console.error('Update check failed:', error);
  }
}

// Parse replicant output to extract metrics
function parseReplicantOutput(output: string): void {
  try {
    // Parse connection count
    const connectionMatch = output.match(/connections?:\s*(\d+)/i);
    if (connectionMatch) {
      metricsCache.connections = parseInt(connectionMatch[1]);
    }
    
    // Parse object counts
    const objectsStoredMatch = output.match(/objects?\s+stored:\s*(\d+)/i);
    if (objectsStoredMatch) {
      metricsCache.objectsStored = parseInt(objectsStoredMatch[1]);
    }
    
    const objectsSyncedMatch = output.match(/objects?\s+synced:\s*(\d+)/i);
    if (objectsSyncedMatch) {
      metricsCache.objectsSynced = parseInt(objectsSyncedMatch[1]);
    }
    
    const syncQueueMatch = output.match(/sync\s+queue:\s*(\d+)/i);
    if (syncQueueMatch) {
      metricsCache.syncQueue = parseInt(syncQueueMatch[1]);
    }
    
    // Parse bandwidth metrics
    const uploadMatch = output.match(/upload:\s*([\d.]+)\s*(KB|MB|GB)/i);
    if (uploadMatch) {
      const value = parseFloat(uploadMatch[1]);
      const unit = uploadMatch[2].toUpperCase();
      metricsCache.bandwidth.upload = unit === 'KB' ? value * 1024 : 
                                      unit === 'MB' ? value * 1024 * 1024 : 
                                      value * 1024 * 1024 * 1024;
    }
    
    const downloadMatch = output.match(/download:\s*([\d.]+)\s*(KB|MB|GB)/i);
    if (downloadMatch) {
      const value = parseFloat(downloadMatch[1]);
      const unit = downloadMatch[2].toUpperCase();
      metricsCache.bandwidth.download = unit === 'KB' ? value * 1024 : 
                                        unit === 'MB' ? value * 1024 * 1024 : 
                                        value * 1024 * 1024 * 1024;
    }
    
    // Parse operation counts
    const readsMatch = output.match(/reads?:\s*(\d+)/i);
    if (readsMatch) {
      metricsCache.operations.reads = parseInt(readsMatch[1]);
    }
    
    const writesMatch = output.match(/writes?:\s*(\d+)/i);
    if (writesMatch) {
      metricsCache.operations.writes = parseInt(writesMatch[1]);
    }
    
    const deletesMatch = output.match(/deletes?:\s*(\d+)/i);
    if (deletesMatch) {
      metricsCache.operations.deletes = parseInt(deletesMatch[1]);
    }
    
    // Parse performance metrics
    const responseTimeMatch = output.match(/avg.*response.*time:\s*([\d.]+)\s*ms/i);
    if (responseTimeMatch) {
      metricsCache.performance.avgResponseTime = parseFloat(responseTimeMatch[1]);
    }
    
    const rpsMatch = output.match(/requests?\s*per\s*second:\s*([\d.]+)/i);
    if (rpsMatch) {
      metricsCache.performance.requestsPerSecond = parseFloat(rpsMatch[1]);
    }
    
    // Parse errors
    const errorsMatch = output.match(/errors?:\s*(\d+)/i);
    if (errorsMatch) {
      metricsCache.errors = parseInt(errorsMatch[1]);
    }
    
    // Update last sync time if we see sync activity
    if (output.includes('sync completed') || output.includes('synced successfully')) {
      metricsCache.lastSync = new Date();
    }
  } catch (error) {
    console.error('Error parsing replicant output:', error);
  }
}

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
    
    // Get disk usage (Windows specific)
    let diskUsage = { used: 0, total: 0, percentage: 0 };
    try {
      const { stdout } = await exec('wmic logicaldisk get size,freespace,caption');
      const lines = stdout.split('\n').filter(line => line.trim());
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 3 && parts[0] === 'C:') {
          const free = parseInt(parts[1]);
          const size = parseInt(parts[2]);
          if (!isNaN(free) && !isNaN(size)) {
            diskUsage = {
              total: size,
              used: size - free,
              percentage: Math.round(((size - free) / size) * 100)
            };
          }
        }
      }
    } catch (error) {
      console.error('Failed to get disk usage:', error);
    }
    
    // Get network stats (simplified)
    const networkStats = { bytesIn: 0, bytesOut: 0 };
    
    // Get replicant metrics
    const replicantStatus = replicantProcess && !replicantProcess.killed ? 'running' : 'stopped';
    const uptime = replicantStartTime ? Math.floor((Date.now() - replicantStartTime.getTime()) / 1000) : 0;
    
    // Get WSL metrics
    let wslMetrics = {
      status: 'stopped' as 'running' | 'stopped',
      distro: config.wslDistro || 'Ubuntu',
      version: '12',
      memory: 0,
      processes: 0
    };
    
    try {
      const { stdout: wslStatus } = await exec('wsl --list --running');
      if (wslStatus.includes(config.wslDistro || 'Ubuntu')) {
        wslMetrics.status = 'running';
        
        // Get WSL memory usage
        try {
          const { stdout: memInfo } = await exec(`wsl -d ${config.wslDistro || 'Ubuntu'} -e cat /proc/meminfo`);
          const totalMatch = memInfo.match(/MemTotal:\s+(\d+)/);
          const availMatch = memInfo.match(/MemAvailable:\s+(\d+)/);
          if (totalMatch && availMatch) {
            const total = parseInt(totalMatch[1]) * 1024;
            const avail = parseInt(availMatch[1]) * 1024;
            wslMetrics.memory = total - avail;
          }
        } catch (error) {
          // Ignore
        }
        
        // Get WSL process count
        try {
          const { stdout: psCount } = await exec(`wsl -d ${config.wslDistro || 'Ubuntu'} -e bash -c "ps aux | wc -l"`);
          wslMetrics.processes = parseInt(psCount.trim()) - 1; // Subtract header line
        } catch (error) {
          // Ignore
        }
      }
    } catch (error) {
      // Ignore
    }
    
    return {
      system: {
        cpu: cpuUsage,
        memory: {
          used: usedMemory,
          total: totalMemory,
          percentage: Math.round((usedMemory / totalMemory) * 100)
        },
        disk: diskUsage,
        network: networkStats
      },
      replicant: {
        status: replicantStatus as 'running' | 'stopped' | 'error',
        uptime,
        connections: metricsCache.connections,
        objectsStored: metricsCache.objectsStored,
        objectsSynced: metricsCache.objectsSynced,
        syncQueue: metricsCache.syncQueue,
        errors: metricsCache.errors,
        lastSync: metricsCache.lastSync,
        bandwidth: metricsCache.bandwidth,
        operations: metricsCache.operations,
        performance: metricsCache.performance
      },
      wsl: wslMetrics
    };
  } catch (error) {
    console.error('Failed to get metrics:', error);
    throw error;
  }
});