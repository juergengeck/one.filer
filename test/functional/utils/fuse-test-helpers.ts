import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface FuseTestConfig {
    mountPoint: string;
    dataDir: string;
    secret: string;
    configPath?: string;
    wslDistro?: string;
}

export class FuseTestHelper {
    private static isWindows = os.platform() === 'win32';
    private static isLinux = os.platform() === 'linux';
    private static isWSL = this.isLinux && fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');

    /**
     * Execute command in WSL or locally
     */
    static wslExec(command: string, options?: { encoding?: string; stdio?: any }): string | Buffer {
        if (this.isWindows) {
            return execSync(`wsl -d Ubuntu -- bash -c "${command}"`, options);
        } else {
            return execSync(command, options);
        }
    }

    /**
     * Check if a path is mounted with FUSE
     */
    static isFuseMounted(mountPoint: string): boolean {
        try {
            const result = this.wslExec(`mountpoint -q ${mountPoint} && echo "YES" || echo "NO"`, { encoding: 'utf8' });
            return result.toString().trim() === 'YES';
        } catch (e) {
            return false;
        }
    }

    /**
     * Wait for FUSE mount to be ready
     */
    static async waitForMount(mountPoint: string, timeout: number = 30000): Promise<boolean> {
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.isFuseMounted(mountPoint)) {
                    clearInterval(checkInterval);
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    resolve(false);
                }
            }, 1000);
        });
    }

    /**
     * Initialize a test ONE.core instance
     */
    static initializeTestInstance(config: FuseTestConfig): void {
        // Clean up existing data
        if (fs.existsSync(config.dataDir)) {
            this.wslExec(`rm -rf ${config.dataDir}`);
        }
        
        // Create data directory
        this.wslExec(`mkdir -p ${config.dataDir}`);
        
        // Initialize ONE.core
        this.wslExec(
            `cd ${config.dataDir} && npx one-core init --secret ${config.secret} create --username test@example.com --password test123`,
            { stdio: 'inherit' }
        );
    }

    /**
     * Start one.filer process
     */
    static startOneFiler(config: FuseTestConfig): ChildProcess | null {
        // Create config file if not provided
        if (!config.configPath) {
            config.configPath = path.join(config.dataDir, 'test-config.json');
            const configContent = {
                directory: config.dataDir,
                useFiler: true,
                filerConfig: {
                    mountPoint: config.mountPoint,
                    fuseOptions: {
                        allow_other: true,
                        default_permissions: false
                    }
                }
            };
            
            this.wslExec(`echo '${JSON.stringify(configContent, null, 2)}' > ${config.configPath}`);
        }
        
        // Start one.filer
        if (this.isWindows) {
            // Start in WSL from Windows
            const startCmd = `wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/juerg/source/one.filer && npm start -- start --secret ${config.secret} --config ${config.configPath}"`;
            return spawn('cmd', ['/c', 'start', '/min', 'cmd', '/c', startCmd], {
                detached: true,
                stdio: 'ignore'
            });
        } else {
            // Start locally
            return spawn('npm', ['start', '--', 'start', '--secret', config.secret, '--config', config.configPath], {
                cwd: process.cwd(),
                stdio: ['ignore', 'pipe', 'pipe']
            });
        }
    }

    /**
     * Stop one.filer and clean up
     */
    static cleanup(process: ChildProcess | null, config: FuseTestConfig): void {
        // Kill process
        if (process) {
            if (this.isWindows) {
                try {
                    execSync('taskkill /F /FI "WINDOWTITLE eq WSL one.filer*"', { stdio: 'ignore' });
                } catch (e) {}
            } else {
                process.kill();
            }
        }
        
        // Unmount
        try {
            this.wslExec(`fusermount -u ${config.mountPoint} 2>/dev/null || true`);
        } catch (e) {}
        
        // Clean up data
        try {
            this.wslExec(`rm -rf ${config.dataDir}`);
        } catch (e) {}
        
        // Remove mount point
        try {
            this.wslExec(`rmdir ${config.mountPoint} 2>/dev/null || true`);
        } catch (e) {}
    }

    /**
     * Map WSL path to Windows drive
     */
    static mapWindowsDrive(wslPath: string, driveLetter: string, distro: string = 'Ubuntu'): boolean {
        if (!this.isWindows) {
            throw new Error('mapWindowsDrive can only be called on Windows');
        }
        
        // Remove existing mapping
        try {
            execSync(`net use ${driveLetter}: /delete /y`, { stdio: 'ignore' });
        } catch (e) {}
        
        // Try different path formats
        const pathFormats = [
            `\\\\wsl.localhost\\${distro}${wslPath}`,
            `\\\\wsl$\\${distro}${wslPath}`
        ];
        
        for (const testPath of pathFormats) {
            try {
                execSync(`net use ${driveLetter}: "${testPath}" /persistent:no`);
                return true;
            } catch (e) {
                // Try next format
            }
        }
        
        return false;
    }

    /**
     * Get Windows path for WSL path
     */
    static getWindowsPath(wslPath: string, distro: string = 'Ubuntu'): string | null {
        if (!this.isWindows) {
            return null;
        }
        
        // Try different formats
        const pathFormats = [
            `\\\\wsl.localhost\\${distro}${wslPath}`,
            `\\\\wsl$\\${distro}${wslPath}`
        ];
        
        for (const testPath of pathFormats) {
            try {
                execSync(`dir "${testPath}" >nul 2>&1`);
                return testPath;
            } catch (e) {
                // Try next format
            }
        }
        
        return null;
    }

    /**
     * Create test files and directories
     */
    static createTestStructure(basePath: string): void {
        const structure = {
            'files': {
                'readme.txt': 'Test file content',
                'data.json': JSON.stringify({ test: true, timestamp: Date.now() }),
                'nested': {
                    'deep.txt': 'Deeply nested file'
                }
            },
            'objects': {
                'test-object.json': JSON.stringify({ type: 'test', id: 1 })
            }
        };
        
        this.createStructureRecursive(basePath, structure);
    }

    private static createStructureRecursive(basePath: string, structure: any): void {
        for (const [name, content] of Object.entries(structure)) {
            const fullPath = path.join(basePath, name);
            
            if (typeof content === 'string') {
                // It's a file
                fs.writeFileSync(fullPath, content);
            } else {
                // It's a directory
                fs.mkdirSync(fullPath, { recursive: true });
                this.createStructureRecursive(fullPath, content);
            }
        }
    }

    /**
     * Measure operation latency
     */
    static measureLatency(operation: () => void, iterations: number = 100): number {
        const start = Date.now();
        for (let i = 0; i < iterations; i++) {
            operation();
        }
        const duration = Date.now() - start;
        return duration / iterations;
    }

    /**
     * Generate random data
     */
    static generateRandomData(size: number): Buffer {
        const buffer = Buffer.alloc(size);
        for (let i = 0; i < size; i++) {
            buffer[i] = Math.floor(Math.random() * 256);
        }
        return buffer;
    }
}

/**
 * Test fixture for FUSE tests
 */
export class FuseTestFixture {
    private process: ChildProcess | null = null;
    
    constructor(private config: FuseTestConfig) {}
    
    async setup(): Promise<void> {
        // Initialize instance
        FuseTestHelper.initializeTestInstance(this.config);
        
        // Create mount point
        FuseTestHelper.wslExec(`mkdir -p ${this.config.mountPoint}`);
        
        // Start one.filer
        this.process = FuseTestHelper.startOneFiler(this.config);
        
        // Wait for mount
        const mounted = await FuseTestHelper.waitForMount(this.config.mountPoint);
        if (!mounted) {
            throw new Error('Failed to establish FUSE mount');
        }
    }
    
    async teardown(): Promise<void> {
        FuseTestHelper.cleanup(this.process, this.config);
    }
    
    getProcess(): ChildProcess | null {
        return this.process;
    }
}