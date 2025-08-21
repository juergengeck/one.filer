import { ServiceManager } from '../ServiceManager';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process');

import * as childProcess from 'child_process';

describe('ServiceManager', () => {
  let serviceManager: ServiceManager;
  const mockExec = childProcess.exec as jest.MockedFunction<typeof childProcess.exec>;

  beforeEach(() => {
    serviceManager = new ServiceManager();
    jest.clearAllMocks();
  });

  describe('registerService', () => {
    it('should register a service successfully', () => {
      const config = {
        name: 'test-service',
        checkCommand: 'ps aux | grep test',
        startCommand: 'test-service start',
      };

      serviceManager.registerService(config);
      const status = serviceManager.getStatus('test-service');

      expect(status).toBeDefined();
      expect(status?.name).toBe('test-service');
      expect(status?.status).toBe('stopped');
    });
  });

  describe('checkService', () => {
    beforeEach(() => {
      serviceManager.registerService({
        name: 'wsl',
        checkCommand: 'wsl --list --running',
        startCommand: 'wsl -e echo "WSL started"',
      });
    });

    it('should detect running service', async () => {
      mockExec.mockImplementation((cmd: string, callback?: any) => {
        if (callback) {
          callback(null, { stdout: 'Ubuntu Running 12345', stderr: '' });
        }
        return null as any;
      });

      const status = await serviceManager.checkService('wsl');

      expect(status.status).toBe('running');
      expect(status.pid).toBe(12345);
      expect(status.error).toBeUndefined();
    });

    it('should detect stopped service', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('No running distributions'), { stdout: '', stderr: 'Error' });
      });

      const status = await serviceManager.checkService('wsl');

      expect(status.status).toBe('stopped');
      expect(status.error).toContain('No running distributions');
    });

    it('should run health check if provided', async () => {
      const healthCheck = jest.fn().mockResolvedValue(false);
      
      serviceManager.registerService({
        name: 'health-test',
        checkCommand: 'echo "running"',
        startCommand: 'echo "start"',
        healthCheck,
      });

      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: 'running', stderr: '' });
      });

      const status = await serviceManager.checkService('health-test');

      expect(healthCheck).toHaveBeenCalled();
      expect(status.status).toBe('error');
      expect(status.error).toBe('Health check failed');
    });
  });

  describe('startService', () => {
    let mockSpawn: jest.Mock;

    beforeEach(() => {
      mockSpawn = require('child_process').spawn;
      
      serviceManager.registerService({
        name: 'replicant',
        checkCommand: 'pgrep -f "one-filer"',
        startCommand: 'node start {{secret}}',
        requiredServices: ['wsl'],
        retryAttempts: 2,
        retryDelay: 100,
      });

      serviceManager.registerService({
        name: 'wsl',
        checkCommand: 'wsl --list --running',
        startCommand: 'wsl -e echo "started"',
      });
    });

    it('should not start if already running', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: '12345', stderr: '' });
      });

      const status = await serviceManager.startService('replicant');

      expect(status.status).toBe('running');
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should check required services before starting', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        if (cmd.includes('wsl')) {
          callback(new Error('WSL not running'), { stdout: '', stderr: '' });
        } else {
          callback(new Error('Not running'), { stdout: '', stderr: '' });
        }
      });

      await expect(serviceManager.startService('replicant')).rejects.toThrow(
        'Required service wsl is not running'
      );
    });

    it('should retry on failure', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('Not running'), { stdout: '', stderr: '' });
      });

      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.pid = 12345;

      let spawnCount = 0;
      mockSpawn.mockImplementation(() => {
        spawnCount++;
        if (spawnCount === 1) {
          // First attempt fails
          setTimeout(() => mockProcess.emit('exit', 1), 10);
        } else {
          // Second attempt succeeds
          setTimeout(() => {
            mockProcess.stdout.emit('data', 'Replicant started successfully');
          }, 10);
        }
        return mockProcess;
      });

      const retryHandler = jest.fn();
      serviceManager.on('service-retry', retryHandler);

      const status = await serviceManager.startService('replicant', { secret: 'test123' });

      expect(status.status).toBe('running');
      expect(spawnCount).toBe(2);
      expect(retryHandler).toHaveBeenCalledWith({
        service: 'replicant',
        attempt: 1,
        maxAttempts: 2,
      });
    });

    it('should detect known errors', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('Not running'), { stdout: '', stderr: '' });
      });

      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();

      mockSpawn.mockImplementation(() => {
        setTimeout(() => {
          mockProcess.stderr.emit('data', 'Error: invalid password for decryption');
        }, 10);
        return mockProcess;
      });

      await expect(serviceManager.startService('replicant')).rejects.toThrow(
        'Invalid password'
      );
    });

    it('should timeout if service does not start', async () => {
      jest.setTimeout(35000);

      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('Not running'), { stdout: '', stderr: '' });
      });

      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();

      mockSpawn.mockImplementation(() => mockProcess);

      // Override timeout for testing
      const originalTimeout = setTimeout;
      global.setTimeout = ((fn: Function, ms: number) => {
        if (ms === 30000) ms = 100; // Speed up timeout for test
        return originalTimeout(fn, ms);
      }) as any;

      await expect(serviceManager.startService('replicant')).rejects.toThrow(
        'Service startup timeout'
      );

      expect(mockProcess.kill).toHaveBeenCalled();
      
      global.setTimeout = originalTimeout;
    });
  });

  describe('stopService', () => {
    it('should stop running service', async () => {
      const mockProcess = { kill: jest.fn() };
      
      serviceManager.registerService({
        name: 'test',
        checkCommand: 'echo "check"',
        startCommand: 'echo "start"',
        stopCommand: 'echo "stop"',
      });

      // Simulate running process
      (serviceManager as any).processes.set('test', mockProcess);
      const status = serviceManager.getStatus('test')!;
      status.status = 'running';
      status.pid = 12345;

      await serviceManager.stopService('test');

      expect(mockProcess.kill).toHaveBeenCalled();
      expect(status.status).toBe('stopped');
      expect(status.pid).toBeUndefined();
    });
  });

  describe('runDiagnostics', () => {
    it('should return comprehensive diagnostics', async () => {
      serviceManager.registerService({
        name: 'wsl',
        checkCommand: 'wsl --list --running',
        startCommand: 'wsl -e echo "start"',
        healthCheck: async () => true,
        requiredServices: ['network'],
        retryAttempts: 5,
      });

      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: 'Ubuntu Running', stderr: '' });
      });

      const diagnostics = await serviceManager.runDiagnostics();

      expect(diagnostics.timestamp).toBeInstanceOf(Date);
      expect(diagnostics.services.wsl).toBeDefined();
      expect(diagnostics.services.wsl.status).toBe('running');
      expect(diagnostics.services.wsl.config.hasHealthCheck).toBe(true);
      expect(diagnostics.services.wsl.config.hasRequiredServices).toBe(true);
      expect(diagnostics.services.wsl.config.retryAttempts).toBe(5);
    });
  });

  describe('event emissions', () => {
    it('should emit status change events', async () => {
      const statusHandler = jest.fn();
      serviceManager.on('service-status-changed', statusHandler);

      serviceManager.registerService({
        name: 'test',
        checkCommand: 'echo "test"',
        startCommand: 'echo "start"',
      });

      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: 'running', stderr: '' });
      });

      await serviceManager.checkService('test');

      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test',
          status: 'running',
        })
      );
    });

    it('should emit service output events', async () => {
      const outputHandler = jest.fn();
      serviceManager.on('service-output', outputHandler);

      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('Not running'), { stdout: '', stderr: '' });
      });

      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();

      const mockSpawn = require('child_process').spawn;
      mockSpawn.mockImplementation(() => {
        setTimeout(() => {
          mockProcess.stdout.emit('data', 'Test output');
          mockProcess.stdout.emit('data', 'Replicant started successfully');
        }, 10);
        return mockProcess;
      });

      serviceManager.registerService({
        name: 'test',
        checkCommand: 'echo "check"',
        startCommand: 'echo "start"',
      });

      await serviceManager.startService('test');

      expect(outputHandler).toHaveBeenCalledWith({
        service: 'test',
        data: 'Test output',
      });
    });
  });
});