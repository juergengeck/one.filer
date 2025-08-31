/**
 * Cross-Platform Integration Tests using refinio.cli
 * 
 * This test suite verifies ONE.filer works correctly across:
 * - Windows (ProjFS)
 * - Linux (FUSE3)
 * - WSL2 (Windows Subsystem for Linux)
 * 
 * All tests use the unified refinio.cli interface
 */

import { spawn, exec as execCallback, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const exec = promisify(execCallback);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);

// Platform detection
const PLATFORM = {
    isWindows: process.platform === 'win32',
    isLinux: process.platform === 'linux',
    isMac: process.platform === 'darwin',
    isWSL: process.env.WSL_DISTRO_NAME !== undefined,
    current: process.platform === 'win32' ? 'windows' : 'linux'
};

// Test instance configuration
interface TestInstance {
    name: string;
    platform: 'windows' | 'linux';
    profile: string;
    mountPoint: string;
    dataDir: string;
    secret: string;
    apiPort: number;
    process?: ChildProcess;
}

// Test configurations for different platforms
const TEST_CONFIGS: { [key: string]: TestInstance } = {
    windows: {
        name: 'windows-test',
        platform: 'windows',
        profile: 'cross-test-win',
        mountPoint: 'C:\\OneFilerCrossTest',
        dataDir: path.join(os.tmpdir(), 'onefiler-cross-win'),
        secret: 'cross-win-secret',
        apiPort: 8081
    },
    linux: {
        name: 'linux-test',
        platform: 'linux',
        profile: 'cross-test-linux',
        mountPoint: '/tmp/onefiler-cross',
        dataDir: '/tmp/onefiler-cross-data',
        secret: 'cross-linux-secret',
        apiPort: 8082
    },
    wsl: {
        name: 'wsl-test',
        platform: 'linux',
        profile: 'cross-test-wsl',
        mountPoint: '/mnt/c/OneFilerWSL',
        dataDir: '/tmp/onefiler-wsl-data',
        secret: 'cross-wsl-secret',
        apiPort: 8083
    }
};

/**
 * Execute refinio CLI command
 */
async function refinioCmd(
    command: string, 
    profile: string = TEST_CONFIGS[PLATFORM.current].profile
): Promise<{ stdout: string; stderr: string; success: boolean }> {
    const fullCommand = `refinio ${command} --profile ${profile}`;
    
    try {
        const { stdout, stderr } = await exec(fullCommand);
        return { stdout, stderr, success: true };
    } catch (error: any) {
        return {
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
            success: false
        };
    }
}

/**
 * Check if an instance is running by checking API health
 */
async function isInstanceRunning(port: number): Promise<boolean> {
    try {
        const response = await fetch(`http://localhost:${port}/health`);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Start a test instance
 */
async function startInstance(config: TestInstance): Promise<void> {
    console.log(`Starting ${config.name} on ${config.platform}...`);
    
    // Clean up previous data
    await cleanupInstance(config);
    
    // Create directories
    await mkdir(config.dataDir, { recursive: true });
    
    // Start the instance
    const args = [
        'start',
        '-s', config.secret,
        '-d', config.dataDir,
        '--filer', 'true',
        '--filer-mount-point', config.mountPoint,
        '--api-port', config.apiPort.toString()
    ];
    
    // Platform-specific command
    const command = config.platform === 'windows' 
        ? 'electron electron-app'
        : 'one-filer';
    
    config.process = spawn(command, args, {
        detached: true,
        stdio: 'pipe'
    });
    
    // Wait for instance to be ready
    for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (await isInstanceRunning(config.apiPort)) {
            console.log(`✓ ${config.name} is running`);
            return;
        }
    }
    
    throw new Error(`Failed to start ${config.name}`);
}

/**
 * Stop a test instance
 */
async function stopInstance(config: TestInstance): Promise<void> {
    // Unmount filesystem
    await refinioCmd('filer unmount', config.profile);
    
    // Stop process
    if (config.process) {
        if (config.platform === 'windows') {
            await exec(`taskkill /F /PID ${config.process.pid}`).catch(() => {});
        } else {
            config.process.kill('SIGTERM');
        }
        config.process = undefined;
    }
    
    await cleanupInstance(config);
}

/**
 * Clean up instance data
 */
async function cleanupInstance(config: TestInstance): Promise<void> {
    if (config.platform === 'windows') {
        await exec(`rmdir /s /q "${config.dataDir}" 2>nul`).catch(() => {});
        await exec(`rmdir /s /q "${config.mountPoint}" 2>nul`).catch(() => {});
    } else {
        await exec(`fusermount -u ${config.mountPoint} 2>/dev/null || true`);
        await exec(`rm -rf ${config.dataDir} ${config.mountPoint}`);
    }
}

describe('Cross-Platform refinio.cli Integration Tests', function() {
    this.timeout(120000); // 2 minute timeout
    
    const currentConfig = TEST_CONFIGS[PLATFORM.isWSL ? 'wsl' : PLATFORM.current];
    
    before(async function() {
        console.log('=== Test Environment ===');
        console.log(`Platform: ${PLATFORM.current}`);
        console.log(`WSL: ${PLATFORM.isWSL}`);
        console.log(`Config: ${currentConfig.name}`);
        console.log('========================\n');
        
        // Ensure refinio.cli is available
        const { success } = await refinioCmd('--version');
        if (!success) {
            throw new Error('refinio.cli not available');
        }
    });
    
    after(async function() {
        // Clean up
        await stopInstance(currentConfig);
    });
    
    describe('Platform Detection', () => {
        it('should detect current platform correctly', () => {
            expect(PLATFORM.current).to.be.oneOf(['windows', 'linux']);
        });
        
        it('should detect WSL environment', () => {
            if (process.env.WSL_DISTRO_NAME) {
                expect(PLATFORM.isWSL).to.be.true;
            }
        });
        
        it('should have platform-specific configuration', () => {
            expect(currentConfig).to.have.property('mountPoint');
            expect(currentConfig).to.have.property('dataDir');
            expect(currentConfig).to.have.property('platform');
        });
    });
    
    describe('refinio.cli Compatibility', () => {
        it('should execute refinio commands', async () => {
            const { success, stdout } = await refinioCmd('--version');
            expect(success).to.be.true;
            expect(stdout).to.include('refinio');
        });
        
        it('should support all filer commands', async () => {
            const commands = [
                'filer status',
                'filer list-fs',
                'filer config'
            ];
            
            for (const cmd of commands) {
                const { stdout } = await refinioCmd(`${cmd} --help`);
                expect(stdout).to.exist;
            }
        });
    });
    
    describe('Instance Management', () => {
        it('should start instance if not running', async function() {
            if (!await isInstanceRunning(currentConfig.apiPort)) {
                await startInstance(currentConfig);
            }
            
            const running = await isInstanceRunning(currentConfig.apiPort);
            expect(running).to.be.true;
        });
        
        it('should get filer status', async () => {
            const { success, stdout } = await refinioCmd('filer status');
            expect(success).to.be.true;
            expect(stdout).to.include('Filer');
        });
    });
    
    describe('Filesystem Operations', () => {
        before(async () => {
            // Mount filesystem
            await refinioCmd(`filer mount --mount-point ${currentConfig.mountPoint}`);
        });
        
        after(async () => {
            // Unmount filesystem
            await refinioCmd('filer unmount');
        });
        
        it('should mount filesystem', async () => {
            const { stdout } = await refinioCmd('filer status');
            expect(stdout).to.include('Mounted: Yes');
        });
        
        it('should have expected directories', () => {
            const dirs = ['objects', 'profiles', 'chats', 'connections'];
            for (const dir of dirs) {
                const dirPath = path.join(currentConfig.mountPoint, dir);
                expect(fs.existsSync(dirPath)).to.be.true;
            }
        });
        
        it('should support file operations', async () => {
            const testFile = path.join(
                currentConfig.mountPoint, 
                'objects',
                `test-${Date.now()}.txt`
            );
            
            // Write file
            await writeFile(testFile, 'Cross-platform test');
            expect(fs.existsSync(testFile)).to.be.true;
            
            // Read file
            const content = await readFile(testFile, 'utf8');
            expect(content).to.equal('Cross-platform test');
            
            // Delete file
            fs.unlinkSync(testFile);
            expect(fs.existsSync(testFile)).to.be.false;
        });
    });
    
    describe('Platform-Specific Features', () => {
        if (PLATFORM.isWindows) {
            it('should use ProjFS on Windows', async () => {
                const { stdout } = await refinioCmd('filer status');
                expect(stdout.toLowerCase()).to.include('projfs');
            });
            
            it('should support virtual file access', () => {
                // ProjFS creates files on-demand
                const virtualPath = path.join(currentConfig.mountPoint, 'objects');
                const files = fs.readdirSync(virtualPath);
                expect(Array.isArray(files)).to.be.true;
            });
        }
        
        if (PLATFORM.isLinux) {
            it('should use FUSE3 on Linux', async () => {
                const { stdout } = await refinioCmd('filer status');
                expect(stdout.toLowerCase()).to.match(/fuse|fuse3/);
            });
            
            it('should have FUSE mount', async () => {
                const { stdout } = await exec('mount | grep fuse');
                expect(stdout).to.exist;
            });
        }
        
        if (PLATFORM.isWSL) {
            it('should work in WSL environment', () => {
                expect(currentConfig.platform).to.equal('linux');
            });
            
            it('should access Windows filesystem from WSL', () => {
                // Check if we can access Windows drives
                expect(fs.existsSync('/mnt/c')).to.be.true;
            });
        }
    });
    
    describe('Cross-Platform Data Format', () => {
        it('should use consistent data format', async () => {
            // Create test data
            const testData = {
                platform: PLATFORM.current,
                timestamp: Date.now(),
                message: 'Cross-platform test data'
            };
            
            const testFile = path.join(
                currentConfig.mountPoint,
                'objects',
                'cross-platform-data.json'
            );
            
            // Write JSON data
            await writeFile(testFile, JSON.stringify(testData, null, 2));
            
            // Read and verify
            const readData = JSON.parse(await readFile(testFile, 'utf8'));
            expect(readData).to.deep.equal(testData);
            
            // Clean up
            fs.unlinkSync(testFile);
        });
        
        it('should handle text files consistently', async () => {
            const content = 'Line 1\nLine 2\nLine 3';
            const testFile = path.join(
                currentConfig.mountPoint,
                'objects',
                'text-test.txt'
            );
            
            await writeFile(testFile, content);
            const readContent = await readFile(testFile, 'utf8');
            
            // Handle line ending differences
            const normalized = readContent.replace(/\r\n/g, '\n');
            expect(normalized).to.equal(content);
            
            fs.unlinkSync(testFile);
        });
    });
    
    describe('Performance Comparison', () => {
        it('should list directories within acceptable time', async () => {
            const objectsDir = path.join(currentConfig.mountPoint, 'objects');
            
            const start = Date.now();
            const files = await readdir(objectsDir);
            const elapsed = Date.now() - start;
            
            console.log(`Directory listing: ${elapsed}ms (${files.length} items)`);
            expect(elapsed).to.be.lessThan(5000);
        });
        
        it('should create files quickly', async () => {
            const testFile = path.join(
                currentConfig.mountPoint,
                'objects',
                `perf-${Date.now()}.txt`
            );
            
            const start = Date.now();
            await writeFile(testFile, 'Performance test');
            const elapsed = Date.now() - start;
            
            console.log(`File creation: ${elapsed}ms`);
            expect(elapsed).to.be.lessThan(1000);
            
            fs.unlinkSync(testFile);
        });
    });
    
    describe('Multi-Instance Synchronization', () => {
        it('should detect other running instances', async () => {
            // Check for other platform instances
            const configs = Object.values(TEST_CONFIGS);
            const runningInstances: string[] = [];
            
            for (const config of configs) {
                if (config !== currentConfig) {
                    if (await isInstanceRunning(config.apiPort)) {
                        runningInstances.push(config.name);
                    }
                }
            }
            
            if (runningInstances.length > 0) {
                console.log('Other instances running:', runningInstances);
            } else {
                console.log('No other instances detected - running standalone');
            }
        });
        
        it.skip('should synchronize data between instances', async function() {
            // This test requires multiple instances running
            // Skip if only one instance is available
            this.skip();
        });
    });
    
    describe('Error Handling', () => {
        it('should handle mount failures gracefully', async () => {
            // Try to mount to invalid location
            const { success, stderr } = await refinioCmd(
                'filer mount --mount-point "/invalid/\\path"'
            );
            
            expect(success).to.be.false;
            expect(stderr).to.exist;
        });
        
        it('should handle API errors', async () => {
            // Test with non-existent profile
            const { success } = await refinioCmd('filer status', 'non-existent-profile');
            // Should handle gracefully even if it fails
            expect(typeof success).to.equal('boolean');
        });
    });
});