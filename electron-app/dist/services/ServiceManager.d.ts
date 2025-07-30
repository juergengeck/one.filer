import { EventEmitter } from 'events';
export interface ServiceStatus {
    name: string;
    status: 'starting' | 'running' | 'stopped' | 'error';
    pid?: number;
    error?: string;
    lastCheck: Date;
    output?: string;
}
export interface ServiceConfig {
    name: string;
    checkCommand: string;
    startCommand: string;
    stopCommand?: string;
    healthCheck?: () => Promise<boolean>;
    requiredServices?: string[];
    retryAttempts?: number;
    retryDelay?: number;
}
export declare class ServiceManager extends EventEmitter {
    private services;
    private processes;
    private configs;
    constructor();
    registerService(config: ServiceConfig): void;
    checkService(name: string): Promise<ServiceStatus>;
    startService(name: string, params?: Record<string, string>): Promise<ServiceStatus>;
    private waitForStartup;
    private checkStartupSuccess;
    private checkKnownErrors;
    stopService(name: string): Promise<void>;
    runDiagnostics(): Promise<Record<string, any>>;
    getAllStatuses(): ServiceStatus[];
    getStatus(name: string): ServiceStatus | undefined;
}
export default ServiceManager;
//# sourceMappingURL=ServiceManager.d.ts.map