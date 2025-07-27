import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface Drive {
    id: string;
    name: string;
    path: string;
    isRunning: boolean;
    stats?: {
        placeholderInfoRequests: number;
        fileDataRequests: number;
        directoryEnumerations: number;
        fileModifications: number;
        cacheMisses: number;
        cacheHits: number;
        totalBytesRead: bigint;
        totalBytesWritten: bigint;
        uptime: number;
    };
}

interface DriveContextType {
    drives: Drive[];
    loading: boolean;
    error: string | null;
    createDrive: (config: { name: string; path: string }) => Promise<Drive>;
    startDrive: (driveId: string) => Promise<boolean>;
    stopDrive: (driveId: string) => Promise<boolean>;
    deleteDrive: (driveId: string) => Promise<boolean>;
    refreshDrives: () => Promise<void>;
}

const DriveContext = createContext<DriveContextType | undefined>(undefined);

export function DriveProvider({ children }: { children: React.ReactNode }) {
    const [drives, setDrives] = useState<Drive[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load drives on mount
    useEffect(() => {
        refreshDrives();
    }, []);

    // Subscribe to stats updates
    useEffect(() => {
        const unsubscribe = window.electronAPI.drive.onStatsUpdate(({ driveId, stats }) => {
            setDrives(prevDrives => 
                prevDrives.map(drive => 
                    drive.id === driveId ? { ...drive, stats } : drive
                )
            );
        });

        return unsubscribe;
    }, []);

    const refreshDrives = useCallback(async () => {
        try {
            setLoading(true);
            const driveList = await window.electronAPI.drive.list();
            setDrives(driveList);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load drives');
        } finally {
            setLoading(false);
        }
    }, []);

    const createDrive = useCallback(async (config: { name: string; path: string }) => {
        const newDrive = await window.electronAPI.drive.create(config);
        await refreshDrives();
        return newDrive;
    }, [refreshDrives]);

    const startDrive = useCallback(async (driveId: string) => {
        const success = await window.electronAPI.drive.start(driveId);
        if (success) {
            await refreshDrives();
        }
        return success;
    }, [refreshDrives]);

    const stopDrive = useCallback(async (driveId: string) => {
        const success = await window.electronAPI.drive.stop(driveId);
        if (success) {
            await refreshDrives();
        }
        return success;
    }, [refreshDrives]);

    const deleteDrive = useCallback(async (driveId: string) => {
        const success = await window.electronAPI.drive.delete(driveId);
        if (success) {
            await refreshDrives();
        }
        return success;
    }, [refreshDrives]);

    const value: DriveContextType = {
        drives,
        loading,
        error,
        createDrive,
        startDrive,
        stopDrive,
        deleteDrive,
        refreshDrives
    };

    return (
        <DriveContext.Provider value={value}>
            {children}
        </DriveContext.Provider>
    );
}

export function useDrives() {
    const context = useContext(DriveContext);
    if (!context) {
        throw new Error('useDrives must be used within a DriveProvider');
    }
    return context;
}