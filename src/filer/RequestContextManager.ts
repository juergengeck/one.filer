import { randomUUID } from 'crypto';

export interface RequestContext {
    requestId: string;
    userId?: string;
    sessionId?: string;
    type: 'enumeration' | 'stat' | 'read' | 'write' | 'delete';
    depth: number;
    filters?: string[];
    priority: 'high' | 'normal' | 'low';
    timestamp: number;
    sourceFS?: string;
    virtualPath?: string;
    metadata?: Record<string, any>;
}

export interface TelemetryContext {
    requestId: string;
    parentRequestId?: string;
    startTime: number;
    endTime?: number;
    path: string;
    operation: string;
    result: 'success' | 'error' | 'cached';
    errorMessage?: string;
    cacheHit?: boolean;
    duration?: number;
}

export class RequestContextManager {
    private activeRequests = new Map<string, RequestContext>();
    private telemetryData = new Map<string, TelemetryContext>();
    private requestHierarchy = new Map<string, string[]>(); // parent -> children
    
    createContext(
        type: RequestContext['type'],
        path?: string,
        options: Partial<RequestContext> = {}
    ): RequestContext {
        const context: RequestContext = {
            requestId: randomUUID(),
            type,
            depth: options.depth || 0,
            priority: options.priority || 'normal',
            timestamp: Date.now(),
            virtualPath: path,
            ...options
        };
        
        this.activeRequests.set(context.requestId, context);
        return context;
    }
    
    startTelemetry(
        context: RequestContext,
        operation: string,
        parentRequestId?: string
    ): TelemetryContext {
        const telemetry: TelemetryContext = {
            requestId: context.requestId,
            parentRequestId,
            startTime: Date.now(),
            path: context.virtualPath || '',
            operation,
            result: 'success'
        };
        
        this.telemetryData.set(context.requestId, telemetry);
        
        // Track hierarchy
        if (parentRequestId) {
            const siblings = this.requestHierarchy.get(parentRequestId) || [];
            siblings.push(context.requestId);
            this.requestHierarchy.set(parentRequestId, siblings);
        }
        
        return telemetry;
    }
    
    endTelemetry(
        requestId: string,
        result: TelemetryContext['result'],
        errorMessage?: string
    ): void {
        const telemetry = this.telemetryData.get(requestId);
        if (telemetry) {
            telemetry.endTime = Date.now();
            telemetry.duration = telemetry.endTime - telemetry.startTime;
            telemetry.result = result;
            telemetry.errorMessage = errorMessage;
        }
        
        // Clean up active request
        this.activeRequests.delete(requestId);
    }
    
    getContext(requestId: string): RequestContext | undefined {
        return this.activeRequests.get(requestId);
    }
    
    getTelemetry(requestId: string): TelemetryContext | undefined {
        return this.telemetryData.get(requestId);
    }
    
    getRequestTree(requestId: string): Map<string, TelemetryContext> {
        const tree = new Map<string, TelemetryContext>();
        const collectChildren = (id: string) => {
            const telemetry = this.telemetryData.get(id);
            if (telemetry) {
                tree.set(id, telemetry);
            }
            const children = this.requestHierarchy.get(id) || [];
            children.forEach(childId => collectChildren(childId));
        };
        collectChildren(requestId);
        return tree;
    }
    
    getStats(): {
        activeRequests: number;
        totalRequests: number;
        averageDuration: number;
        errorRate: number;
        cacheHitRate: number;
    } {
        const completed = Array.from(this.telemetryData.values())
            .filter(t => t.endTime);
        
        const errors = completed.filter(t => t.result === 'error').length;
        const cacheHits = completed.filter(t => t.cacheHit).length;
        const totalDuration = completed.reduce((sum, t) => sum + (t.duration || 0), 0);
        
        return {
            activeRequests: this.activeRequests.size,
            totalRequests: this.telemetryData.size,
            averageDuration: completed.length > 0 ? totalDuration / completed.length : 0,
            errorRate: completed.length > 0 ? errors / completed.length : 0,
            cacheHitRate: completed.length > 0 ? cacheHits / completed.length : 0
        };
    }
    
    cleanup(olderThan: number = 3600000): void { // Default: 1 hour
        const cutoff = Date.now() - olderThan;
        
        // Clean up old telemetry
        for (const [id, telemetry] of this.telemetryData) {
            if (telemetry.startTime < cutoff) {
                this.telemetryData.delete(id);
                this.requestHierarchy.delete(id);
            }
        }
        
        // Clean up orphaned active requests
        for (const [id, context] of this.activeRequests) {
            if (context.timestamp < cutoff) {
                this.activeRequests.delete(id);
            }
        }
    }
}

// Singleton instance
export const contextManager = new RequestContextManager();