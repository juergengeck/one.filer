import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
const DriveContext = createContext(undefined);
export function DriveProvider({ children }) {
    const [drives, setDrives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Load drives on mount
    useEffect(() => {
        refreshDrives();
    }, []);
    // Subscribe to stats updates
    useEffect(() => {
        const unsubscribe = window.electronAPI.drive.onStatsUpdate(({ driveId, stats }) => {
            setDrives(prevDrives => prevDrives.map(drive => drive.id === driveId ? { ...drive, stats } : drive));
        });
        return unsubscribe;
    }, []);
    const refreshDrives = useCallback(async () => {
        try {
            setLoading(true);
            const driveList = await window.electronAPI.drive.list();
            setDrives(driveList);
            setError(null);
        }
        catch (err) {
            setError(err.message || 'Failed to load drives');
        }
        finally {
            setLoading(false);
        }
    }, []);
    const createDrive = useCallback(async (config) => {
        const newDrive = await window.electronAPI.drive.create(config);
        await refreshDrives();
        return newDrive;
    }, [refreshDrives]);
    const startDrive = useCallback(async (driveId) => {
        const success = await window.electronAPI.drive.start(driveId);
        if (success) {
            await refreshDrives();
        }
        return success;
    }, [refreshDrives]);
    const stopDrive = useCallback(async (driveId) => {
        const success = await window.electronAPI.drive.stop(driveId);
        if (success) {
            await refreshDrives();
        }
        return success;
    }, [refreshDrives]);
    const deleteDrive = useCallback(async (driveId) => {
        const success = await window.electronAPI.drive.delete(driveId);
        if (success) {
            await refreshDrives();
        }
        return success;
    }, [refreshDrives]);
    const value = {
        drives,
        loading,
        error,
        createDrive,
        startDrive,
        stopDrive,
        deleteDrive,
        refreshDrives
    };
    return (React.createElement(DriveContext.Provider, { value: value }, children));
}
export function useDrives() {
    const context = useContext(DriveContext);
    if (!context) {
        throw new Error('useDrives must be used within a DriveProvider');
    }
    return context;
}
//# sourceMappingURL=DriveContext.js.map