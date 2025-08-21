import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

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

export class ServiceManager extends EventEmitter {
  private services: Map<string, ServiceStatus> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private configs: Map<string, ServiceConfig> = new Map();

  constructor() {
    super();
  }

  registerService(config: ServiceConfig): void {
    this.configs.set(config.name, config);
    this.services.set(config.name, {
      name: config.name,
      status: 'stopped',
      lastCheck: new Date()
    });
  }

  async checkService(name: string): Promise<ServiceStatus> {
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Service ${name} not registered`);
    }

    const status = this.services.get(name)!;
    
    try {
      // Run the check command
      const { stdout, stderr } = await exec(config.checkCommand);
      
      // If check command succeeds, service is running
      status.status = 'running';
      status.output = stdout;
      status.error = undefined;
      
      // Extract PID if possible
      const pidMatch = stdout.match(/\b(\d+)\b/);
      if (pidMatch) {
        status.pid = parseInt(pidMatch[1]);
      }
      
      // Run custom health check if provided
      if (config.healthCheck) {
        const isHealthy = await config.healthCheck();
        if (!isHealthy) {
          status.status = 'error';
          status.error = 'Health check failed';
        }
      }
    } catch (error) {
      status.status = 'stopped';
      status.error = error instanceof Error ? error.message : 'Unknown error';
      status.pid = undefined;
    }
    
    status.lastCheck = new Date();
    this.emit('service-status-changed', status);
    return status;
  }

  async startService(name: string, params?: Record<string, string>): Promise<ServiceStatus> {
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Service ${name} not registered`);
    }

    const status = this.services.get(name)!;
    
    // Check if already running
    await this.checkService(name);
    if (status.status === 'running') {
      return status;
    }
    
    // Check required services
    if (config.requiredServices) {
      for (const reqService of config.requiredServices) {
        const reqStatus = await this.checkService(reqService);
        if (reqStatus.status !== 'running') {
          throw new Error(`Required service ${reqService} is not running`);
        }
      }
    }
    
    status.status = 'starting';
    this.emit('service-status-changed', status);
    
    let attempts = 0;
    const maxAttempts = config.retryAttempts || 3;
    const retryDelay = config.retryDelay || 2000;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        
        // Parse and execute start command
        let command = config.startCommand;
        if (params) {
          for (const [key, value] of Object.entries(params)) {
            command = command.replace(`{{${key}}}`, value);
          }
        }
        
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        
        const process = spawn(cmd, args, {
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        this.processes.set(name, process);
        
        // Wait for service to start
        const startupResult = await this.waitForStartup(name, process, config);
        
        if (startupResult.success) {
          status.status = 'running';
          status.pid = process.pid;
          status.error = undefined;
          this.emit('service-started', status);
          return status;
        } else {
          throw new Error(startupResult.error || 'Service failed to start');
        }
      } catch (error) {
        status.error = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempts < maxAttempts) {
          this.emit('service-retry', { service: name, attempt: attempts, maxAttempts });
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          status.status = 'error';
          this.emit('service-failed', status);
          throw error;
        }
      }
    }
    
    return status;
  }

  private async waitForStartup(
    name: string, 
    process: ChildProcess, 
    config: ServiceConfig
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          process.kill();
          resolve({ 
            success: false, 
            error: 'Service startup timeout' 
          });
        }
      }, 30000); // 30 second timeout
      
      if (process.stdout) {
        process.stdout.on('data', (data) => {
          output += data.toString();
          this.emit('service-output', { service: name, data: data.toString() });
          
          // Check for success indicators
          if (this.checkStartupSuccess(name, output)) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve({ success: true });
            }
          }
        });
      }
      
      if (process.stderr) {
        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
          this.emit('service-error', { service: name, data: data.toString() });
          
          // Check for known errors
          const knownError = this.checkKnownErrors(name, errorOutput);
          if (knownError && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            process.kill();
            resolve({ success: false, error: knownError });
          }
        });
      }
      
      process.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ 
            success: false, 
            error: `Process exited with code ${code}` 
          });
        }
      });
      
      process.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ 
            success: false, 
            error: err.message 
          });
        }
      });
    });
  }

  private checkStartupSuccess(service: string, output: string): boolean {
    const successPatterns: Record<string, RegExp[]> = {
      'wsl': [
        /WSL.*started/i,
        /Linux.*ready/i
      ],
      'replicant': [
        /Replicant started successfully/i,
        /Loaded FUSE3 N-API addon/i,
        /FUSE.*started successfully/i,
        /mount.*successful/i
      ]
    };
    
    const patterns = successPatterns[service] || [];
    return patterns.some(pattern => pattern.test(output));
  }

  private checkKnownErrors(service: string, output: string): string | null {
    const errorPatterns: Record<string, Array<[RegExp, string]>> = {
      'wsl': [
        [/WSL.*not.*installed/i, 'WSL is not installed'],
        [/no.*distro.*found/i, 'No WSL distribution found'],
        [/access.*denied/i, 'Access denied to WSL']
      ],
      'replicant': [
        [/invalid.*password/i, 'Invalid password'],
        [/CYENC-SYMDEC/i, 'Decryption failed - invalid secret'],
        [/module.*not.*found/i, 'Required module not found'],
        [/permission.*denied/i, 'Permission denied'],
        [/address.*in.*use/i, 'Port already in use']
      ]
    };
    
    const patterns = errorPatterns[service] || [];
    for (const [pattern, message] of patterns) {
      if (pattern.test(output)) {
        return message;
      }
    }
    
    return null;
  }

  async stopService(name: string): Promise<void> {
    const config = this.configs.get(name);
    const process = this.processes.get(name);
    const status = this.services.get(name);
    
    if (!config || !status) {
      throw new Error(`Service ${name} not registered`);
    }
    
    if (process) {
      process.kill();
      this.processes.delete(name);
    }
    
    if (config.stopCommand) {
      try {
        await exec(config.stopCommand);
      } catch (error) {
        // Ignore stop command errors
      }
    }
    
    status.status = 'stopped';
    status.pid = undefined;
    this.emit('service-stopped', status);
  }

  async runDiagnostics(): Promise<Record<string, any>> {
    const diagnostics: Record<string, any> = {
      timestamp: new Date(),
      services: {}
    };
    
    for (const [name, config] of this.configs) {
      const status = await this.checkService(name);
      diagnostics.services[name] = {
        ...status,
        config: {
          hasHealthCheck: !!config.healthCheck,
          hasRequiredServices: !!config.requiredServices,
          retryAttempts: config.retryAttempts || 3
        }
      };
    }
    
    return diagnostics;
  }

  getAllStatuses(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  getStatus(name: string): ServiceStatus | undefined {
    return this.services.get(name);
  }
}

export default ServiceManager;