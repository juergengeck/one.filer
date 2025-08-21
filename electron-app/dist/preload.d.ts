export interface SystemMetrics {
    cpu: number;
    memory: {
        used: number;
        total: number;
        percentage: number;
    };
    disk: {
        used: number;
        total: number;
        percentage: number;
    };
    network: {
        bytesIn: number;
        bytesOut: number;
    };
}
export interface ReplicantMetrics {
    status: 'running' | 'stopped' | 'error';
    uptime: number;
    connections: number;
    objectsStored: number;
    objectsSynced: number;
    syncQueue: number;
    errors: number;
    lastSync: Date | null;
    bandwidth: {
        upload: number;
        download: number;
    };
    operations: {
        reads: number;
        writes: number;
        deletes: number;
    };
    performance: {
        avgResponseTime: number;
        requestsPerSecond: number;
    };
}
export interface WSLMetrics {
    status: 'running' | 'stopped';
    distro: string;
    version: string;
    memory: number;
    processes: number;
}
export interface LogEntry {
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    source: string;
    message: string;
}
export interface TestResult {
    suite: string;
    test: string;
    status: 'pass' | 'fail' | 'skip';
    error?: string;
    duration?: number;
}
export interface TestSuiteResult {
    name: string;
    tests: TestResult[];
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
}
export interface ElectronAPI {
    login: (credentials: {
        secret: string;
        configPath?: string;
    }) => Promise<{
        success: boolean;
        message: string;
        mountPoint?: string;
    }>;
    logout: () => Promise<{
        success: boolean;
        message?: string;
    }>;
    checkWslStatus: () => Promise<{
        installed: boolean;
        running: boolean;
        distros: string[];
    }>;
    checkReplicantStatus: () => Promise<{
        running: boolean;
        pid?: number;
    }>;
    startWsl: () => Promise<{
        success: boolean;
        message?: string;
    }>;
    stopReplicant: () => Promise<{
        success: boolean;
        message?: string;
    }>;
    getSystemMetrics: () => Promise<{
        system: SystemMetrics;
        replicant: ReplicantMetrics;
        wsl: WSLMetrics;
    }>;
    runDiagnostics: () => Promise<Record<string, any>>;
    onDebugLog: (callback: (log: LogEntry) => void) => void;
    removeDebugLogListener: (callback: (log: LogEntry) => void) => void;
    runTests: () => Promise<{
        success: boolean;
        results?: TestSuiteResult[];
        error?: string;
    }>;
    runTestSuite: (suiteName: string) => Promise<{
        success: boolean;
        result?: TestSuiteResult;
        error?: string;
    }>;
    getTestDiagnostics: () => Promise<{
        success: boolean;
        diagnostics?: any;
        error?: string;
    }>;
}
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
//# sourceMappingURL=preload.d.ts.map