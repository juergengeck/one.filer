import { contextBridge, ipcRenderer } from 'electron';
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Drive management
    drive: {
        create: (config) => ipcRenderer.invoke('drive:create', config),
        start: (driveId) => ipcRenderer.invoke('drive:start', driveId),
        stop: (driveId) => ipcRenderer.invoke('drive:stop', driveId),
        delete: (driveId) => ipcRenderer.invoke('drive:delete', driveId),
        list: () => ipcRenderer.invoke('drive:list'),
        getStats: (driveId) => ipcRenderer.invoke('drive:stats', driveId),
        onStatsUpdate: (callback) => {
            ipcRenderer.on('drive:stats-update', (event, data) => callback(data));
            return () => ipcRenderer.removeAllListeners('drive:stats-update');
        }
    },
    // Settings
    settings: {
        get: (key) => ipcRenderer.invoke('settings:get', key),
        set: (key, value) => ipcRenderer.invoke('settings:set', key, value)
    },
    // System
    system: {
        openPath: (path) => ipcRenderer.invoke('system:openPath', path),
        showItemInFolder: (path) => ipcRenderer.invoke('system:showItemInFolder', path)
    },
    // Dialog
    dialog: {
        selectFolder: () => ipcRenderer.invoke('dialog:selectFolder')
    },
    // Navigation
    onNavigate: (callback) => {
        ipcRenderer.on('navigate', (event, route) => callback(route));
        return () => ipcRenderer.removeAllListeners('navigate');
    }
});
//# sourceMappingURL=preload.js.map