export interface ElectronAPI {
    drive: {
        create: (config: {
            name: string;
            path: string;
        }) => Promise<any>;
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
//# sourceMappingURL=preload.d.ts.map