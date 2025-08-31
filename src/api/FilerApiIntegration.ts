import { startApiServer } from '../../refinio.api/dist/index.js';
import type { FilerModels } from '../filer/Filer.js';
import type { FilerHandler } from '../../refinio.api/dist/handlers/FilerHandler.js';

/**
 * Integration module to start one.filer with refinio.api admin interface
 */
export class FilerApiIntegration {
  private server: any;
  private instance: any;
  private filerHandler?: FilerHandler;

  async start(): Promise<void> {
    if (this.server) {
      console.warn('FilerApiIntegration: Server already running');
      return;
    }

    try {
      const result = await startApiServer();
      this.server = result.server;
      this.instance = result.instance;
      this.filerHandler = result.filerHandler;
      
      console.log('FilerApiIntegration: API server started');
    } catch (error) {
      console.error('FilerApiIntegration: Failed to start API server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      try {
        await this.server.stop();
        this.server = undefined;
        this.instance = undefined;
        this.filerHandler = undefined;
        console.log('FilerApiIntegration: API server stopped');
      } catch (error) {
        console.error('FilerApiIntegration: Failed to stop API server:', error);
      }
    }
  }

  isRunning(): boolean {
    return !!this.server;
  }

  getFilerHandler(): FilerHandler | undefined {
    return this.filerHandler;
  }
}

export async function createFilerApiIntegration(
  models: FilerModels,
  config?: any
): Promise<FilerApiIntegration> {
  const integration = new FilerApiIntegration();
  return integration;
}