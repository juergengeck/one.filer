import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Drive management
    drive: {
        create: (config: { name: string; path: string }) => 
            ipcRenderer.invoke('drive:create', config),
        start: (driveId: string) => 
            ipcRenderer.invoke('drive:start', driveId),
        stop: (driveId: string) => 
            ipcRenderer.invoke('drive:stop', driveId),
        delete: (driveId: string) => 
            ipcRenderer.invoke('drive:delete', driveId),
        list: () => 
            ipcRenderer.invoke('drive:list'),
        getStats: (driveId: string) => 
            ipcRenderer.invoke('drive:stats', driveId),
        onStatsUpdate: (callback: (data: any) => void) => {
            ipcRenderer.on('drive:stats-update', (event, data) => callback(data));
            return () => ipcRenderer.removeAllListeners('drive:stats-update');
        }
    },

    // Settings
    settings: {
        get: (key: string) => 
            ipcRenderer.invoke('settings:get', key),
        set: (key: string, value: any) => 
            ipcRenderer.invoke('settings:set', key, value)
    },

    // System
    system: {
        openPath: (path: string) => 
            ipcRenderer.invoke('system:openPath', path),
        showItemInFolder: (path: string) => 
            ipcRenderer.invoke('system:showItemInFolder', path)
    },

    // Dialog
    dialog: {
        selectFolder: () => 
            ipcRenderer.invoke('dialog:selectFolder')
    },

    // Navigation
    onNavigate: (callback: (route: string) => void) => {
        ipcRenderer.on('navigate', (event, route) => callback(route));
        return () => ipcRenderer.removeAllListeners('navigate');
    }
});

// Type definitions for TypeScript
export interface ElectronAPI {
    drive: {
        create: (config: { name: string; path: string }) => Promise<any>;
        start: (driveId: string) => Promise<boolean>;
        stop: (driveId: string) => Promise<boolean>;
        delete: (driveId: string) => Promise<boolean>;
        list: () => Promise<any[]>;
        getStats: (driveId: string) => Promise<any>;
        onStatsUpdate: (callback: (data: any) => void) => () => void;
    };
    settings: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
    };
    system: {
        openPath: (path: string) => Promise<void>;
        showItemInFolder: (path: string) => Promise<void>;
    };
    dialog: {
        selectFolder: () => Promise<string | undefined>;
    };
    onNavigate: (callback: (route: string) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}