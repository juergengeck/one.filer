"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
/**
 * Simple logger for debugging and monitoring ProjFS operations
 */
class Logger {
    prefix;
    level;
    constructor(prefix, level = 'info') {
        this.prefix = prefix;
        this.level = level;
    }
    debug(message, ...args) {
        if (this.shouldLog('debug')) {
            console.debug(`[${new Date().toISOString()}] [DEBUG] [${this.prefix}] ${message}`, ...args);
        }
    }
    info(message, ...args) {
        if (this.shouldLog('info')) {
            console.info(`[${new Date().toISOString()}] [INFO] [${this.prefix}] ${message}`, ...args);
        }
    }
    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            console.warn(`[${new Date().toISOString()}] [WARN] [${this.prefix}] ${message}`, ...args);
        }
    }
    error(message, error) {
        if (this.shouldLog('error')) {
            console.error(`[${new Date().toISOString()}] [ERROR] [${this.prefix}] ${message}`);
            if (error) {
                console.error(error);
            }
        }
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.level);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }
}
exports.Logger = Logger;
