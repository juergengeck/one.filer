/**
 * RefinioApiService - Integrates refinio.api for management operations
 * 
 * This service provides the management API for the Windows version,
 * allowing configuration and control through refinio.api/refinio.cli
 */

import { startApiServer, type ApiHandlers } from '@juergengeck/refinio-api';
import type { FilerModels } from '../../../lib/filer/Filer';
import type Replicant from '../../../lib/Replicant';
import type { FilerWithProjFS } from '../../../lib/filer/FilerWithProjFS';

export interface RefinioApiConfig {
    enabled: boolean;
    port?: number;
    host?: string;
}

export class RefinioApiService {
    private apiServer: any = null;
    private replicant: Replicant | null = null;
    private filer: FilerWithProjFS | null = null;
    private config: RefinioApiConfig;
    private isRunning: boolean = false;

    constructor(config: RefinioApiConfig = { enabled: true }) {
        this.config = {
            enabled: config.enabled,
            port: config.port || 8080,
            host: config.host || 'localhost'
        };
    }

    /**
     * Set the replicant instance to manage
     */
    setReplicant(replicant: Replicant): void {
        this.replicant = replicant;
        // Access the filer if it exists
        if ((replicant as any).filer) {
            this.filer = (replicant as any).filer as FilerWithProjFS;
        }
    }

    /**
     * Start the API server
     */
    async start(): Promise<void> {
        if (!this.config.enabled || this.isRunning) {
            return;
        }

        if (!this.replicant) {
            throw new Error('Replicant not set. Call setReplicant() first.');
        }

        try {
            console.log('🌐 Starting refinio.api server for Windows...');
            
            // Get models from replicant
            const models = this.getModelsFromReplicant();
            
            // Start the API server with custom handlers
            this.apiServer = await startApiServer(models, {
                handlers: this.createHandlers()
            });

            this.isRunning = true;
            console.log(`✅ refinio.api server running on ${this.config.host}:${this.config.port}`);
            
        } catch (error) {
            console.error('❌ Failed to start refinio.api server:', error);
            throw error;
        }
    }

    /**
     * Stop the API server
     */
    async stop(): Promise<void> {
        if (!this.isRunning || !this.apiServer) {
            return;
        }

        try {
            if (this.apiServer.server && this.apiServer.server.stop) {
                await this.apiServer.server.stop();
            }
            this.apiServer = null;
            this.isRunning = false;
            console.log('✅ refinio.api server stopped');
        } catch (error) {
            console.error('⚠️ Error stopping refinio.api server:', error);
        }
    }

    /**
     * Get models from the replicant instance
     */
    private getModelsFromReplicant(): FilerModels {
        if (!this.replicant) {
            throw new Error('Replicant not available');
        }

        // Access models from replicant (they're private, so we need to use any)
        const r = this.replicant as any;
        
        return {
            channelManager: r.channelManager,
            connections: r.connections,
            leuteModel: r.leuteModel,
            notifications: r.notifications,
            topicModel: r.topicModel,
            iomManager: r.iomManager,
            journalModel: r.journalModel,
            questionnaireModel: r.questionnaires,
            consentModel: r.consentFile
        };
    }

    /**
     * Create custom handlers for Windows-specific operations
     */
    private createHandlers(): Partial<ApiHandlers> {
        return {
            // Filer-specific handlers for Windows/ProjFS
            filer: {
                mount: async (params: any) => {
                    if (!this.filer) {
                        throw new Error('Filer not available');
                    }
                    
                    // For Windows with ProjFS, mounting is automatic
                    return {
                        mounted: true,
                        mountPoint: (this.filer as any).config.projfsRoot || 'C:\\OneFiler',
                        platform: 'windows',
                        mode: 'projfs'
                    };
                },

                unmount: async () => {
                    if (!this.filer) {
                        throw new Error('Filer not available');
                    }
                    
                    // ProjFS doesn't really unmount, but we can stop the provider
                    await this.filer.shutdown();
                    return {
                        mounted: false
                    };
                },

                status: async () => {
                    const mounted = this.filer !== null && (this.filer as any).provider !== null;
                    return {
                        mounted,
                        mountPoint: mounted ? (this.filer as any).config.projfsRoot : null,
                        platform: 'windows',
                        mode: 'projfs',
                        config: mounted ? (this.filer as any).config : null
                    };
                },

                refresh: async () => {
                    if (!this.filer) {
                        throw new Error('Filer not available');
                    }
                    
                    // Refresh ProjFS provider
                    await this.filer.shutdown();
                    await this.filer.init();
                    
                    return {
                        mounted: true,
                        mountPoint: (this.filer as any).config.projfsRoot,
                        platform: 'windows',
                        mode: 'projfs'
                    };
                },

                listFileSystems: async () => {
                    if (!this.filer) {
                        return [];
                    }
                    
                    // Return available filesystems
                    return [
                        '/objects',
                        '/profiles', 
                        '/chats',
                        '/connections',
                        '/invites'
                    ];
                },

                config: async (params: any) => {
                    if (!this.filer) {
                        throw new Error('Filer not available');
                    }
                    
                    const config = (this.filer as any).config;
                    
                    if (params && params.config) {
                        // Update configuration
                        Object.assign(config, params.config);
                    }
                    
                    return config;
                }
            },

            // Windows-specific system operations
            system: {
                getPlatformInfo: async () => {
                    return {
                        platform: 'win32',
                        arch: process.arch,
                        version: process.versions.node,
                        electron: process.versions.electron,
                        projfs: true,
                        mountPoint: this.filer ? (this.filer as any).config.projfsRoot : null
                    };
                },

                getMetrics: async () => {
                    // Return performance metrics
                    return {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        cpu: process.cpuUsage(),
                        filerActive: this.filer !== null
                    };
                }
            }
        };
    }

    /**
     * Check if the API server is running
     */
    getStatus(): { running: boolean; port?: number; host?: string } {
        return {
            running: this.isRunning,
            port: this.config.port,
            host: this.config.host
        };
    }
}