/**
 * Simple logger for debugging and monitoring ProjFS operations
 */
export class Logger {
    private readonly prefix: string;
    private readonly level: LogLevel;
    
    constructor(prefix: string, level: LogLevel = 'info') {
        this.prefix = prefix;
        this.level = level;
    }
    
    debug(message: string, ...args: any[]): void {
        if (this.shouldLog('debug')) {
            console.debug(`[${new Date().toISOString()}] [DEBUG] [${this.prefix}] ${message}`, ...args);
        }
    }
    
    info(message: string, ...args: any[]): void {
        if (this.shouldLog('info')) {
            console.info(`[${new Date().toISOString()}] [INFO] [${this.prefix}] ${message}`, ...args);
        }
    }
    
    warn(message: string, ...args: any[]): void {
        if (this.shouldLog('warn')) {
            console.warn(`[${new Date().toISOString()}] [WARN] [${this.prefix}] ${message}`, ...args);
        }
    }
    
    error(message: string, error?: any): void {
        if (this.shouldLog('error')) {
            console.error(`[${new Date().toISOString()}] [ERROR] [${this.prefix}] ${message}`);
            if (error) {
                console.error(error);
            }
        }
    }
    
    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.level);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';