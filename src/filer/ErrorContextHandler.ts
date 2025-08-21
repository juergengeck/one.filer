export interface ErrorContext {
    operation: string;
    path: string;
    requestId?: string;
    sourceFS?: string;
    originalError: Error;
    timestamp: number;
    stack?: string;
    metadata?: Record<string, any>;
}

export class ContextualError extends Error {
    public context: ErrorContext;
    
    constructor(message: string, context: ErrorContext) {
        super(message);
        this.name = 'ContextualError';
        this.context = context;
        
        // Preserve original stack trace
        if (context.originalError.stack) {
            this.stack = `${this.stack}\nCaused by: ${context.originalError.stack}`;
        }
    }
    
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            context: this.context,
            stack: this.stack
        };
    }
}

export class ErrorContextHandler {
    private errorLog: ErrorContext[] = [];
    private maxLogSize = 1000;
    
    wrapError(
        error: Error,
        operation: string,
        path: string,
        additionalContext?: Partial<ErrorContext>
    ): ContextualError {
        const context: ErrorContext = {
            operation,
            path,
            originalError: error,
            timestamp: Date.now(),
            stack: error.stack,
            ...additionalContext
        };
        
        // Log the error
        this.logError(context);
        
        // Create contextual error with detailed message
        const message = this.formatErrorMessage(error, context);
        return new ContextualError(message, context);
    }
    
    private formatErrorMessage(error: Error, context: ErrorContext): string {
        const parts = [
            `[${context.operation}]`,
            `Path: ${context.path}`
        ];
        
        if (context.sourceFS) {
            parts.push(`FS: ${context.sourceFS}`);
        }
        
        if (context.requestId) {
            parts.push(`ReqID: ${context.requestId}`);
        }
        
        parts.push(`Error: ${error.message}`);
        
        return parts.join(' | ');
    }
    
    private logError(context: ErrorContext): void {
        this.errorLog.push(context);
        
        // Trim log if too large
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(-this.maxLogSize);
        }
        
        // Log to console with full context
        console.error(`[ErrorContext] ${this.formatErrorMessage(context.originalError, context)}`);
        if (context.metadata) {
            console.error('[ErrorContext] Metadata:', context.metadata);
        }
    }
    
    getRecentErrors(count: number = 10): ErrorContext[] {
        return this.errorLog.slice(-count);
    }
    
    getErrorsByPath(path: string): ErrorContext[] {
        return this.errorLog.filter(e => e.path === path || e.path.startsWith(path));
    }
    
    getErrorsByOperation(operation: string): ErrorContext[] {
        return this.errorLog.filter(e => e.operation === operation);
    }
    
    getErrorStats(): {
        total: number;
        byOperation: Record<string, number>;
        bySourceFS: Record<string, number>;
        recentRate: number; // errors per minute in last 5 minutes
    } {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const recentErrors = this.errorLog.filter(e => e.timestamp > fiveMinutesAgo);
        
        const byOperation: Record<string, number> = {};
        const bySourceFS: Record<string, number> = {};
        
        for (const error of this.errorLog) {
            byOperation[error.operation] = (byOperation[error.operation] || 0) + 1;
            if (error.sourceFS) {
                bySourceFS[error.sourceFS] = (bySourceFS[error.sourceFS] || 0) + 1;
            }
        }
        
        return {
            total: this.errorLog.length,
            byOperation,
            bySourceFS,
            recentRate: recentErrors.length / 5 // per minute
        };
    }
    
    clearOldErrors(olderThan: number = 3600000): void { // Default: 1 hour
        const cutoff = Date.now() - olderThan;
        this.errorLog = this.errorLog.filter(e => e.timestamp > cutoff);
    }
}

// Singleton instance
export const errorHandler = new ErrorContextHandler();