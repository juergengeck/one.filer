import React from 'react';
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
    createDrive: (config: {
        name: string;
        path: string;
    }) => Promise<Drive>;
    startDrive: (driveId: string) => Promise<boolean>;
    stopDrive: (driveId: string) => Promise<boolean>;
    deleteDrive: (driveId: string) => Promise<boolean>;
    refreshDrives: () => Promise<void>;
}
export declare function DriveProvider({ children }: {
    children: React.ReactNode;
}): React.JSX.Element;
export declare function useDrives(): DriveContextType;
export {};
//# sourceMappingURL=DriveContext.d.ts.map