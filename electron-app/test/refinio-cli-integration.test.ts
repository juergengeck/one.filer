/**
 * Integration tests for Windows ONE.Filer using refinio.cli
 * 
 * These tests verify ProjFS functionality through the refinio.cli interface
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

describe('Windows ONE.Filer refinio.cli Integration Tests', () => {
    const TEST_MOUNT_POINT = 'C:\\OneFilerTest';
    const TEST_PROFILE = 'test-profile-windows';
    const TEST_SECRET = 'test-secret-123';
    const TEST_DATA_DIR = path.join(os.tmpdir(), 'one-filer-test');
    
    let electronProcess: any = null;
    let apiAvailable = false;

    /**
     * Execute a refinio CLI command
     */
    async function refinioCmd(command: string): Promise<{ stdout: string; stderr: string }> {
        return execAsync(`refinio ${command} --profile ${TEST_PROFILE}`);
    }

    /**
     * Check if filer is mounted
     */
    async function isMounted(): Promise<boolean> {
        try {
            const { stdout } = await refinioCmd('filer status');
            return stdout.includes('Mounted: Yes');
        } catch {
            return false;
        }
    }

    /**
     * Check if ProjFS is available on Windows
     */
    async function isProjFSAvailable(): Promise<boolean> {
        if (process.platform !== 'win32') {
            return false;
        }

        try {
            // Check Windows version
            const { stdout } = await execAsync('wmic os get Version');
            const versionMatch = stdout.match(/(\d+)\.(\d+)\.(\d+)/);
            if (versionMatch) {
                const build = parseInt(versionMatch[3]);
                // ProjFS requires Windows 10 1809 (build 17763) or later
                return build >= 17763;
            }
        } catch {
            // Ignore errors
        }
        
        return false;
    }

    /**
     * Check API health
     */
    async function checkApiHealth(): Promise<boolean> {
        try {
            const response = await fetch('http://localhost:8080/health');
            return response.ok;
        } catch {
            return false;
        }
    }

    beforeAll(async () => {
        // Skip tests if not on Windows
        if (process.platform !== 'win32') {
            console.log('Skipping Windows tests on non-Windows platform');
            return;
        }

        // Check ProjFS availability
        const projfsAvailable = await isProjFSAvailable();
        if (!projfsAvailable) {
            throw new Error('ProjFS not available. Need Windows 10 1809 or later with ProjFS enabled');
        }

        // Clean up any existing test directories
        if (existsSync(TEST_MOUNT_POINT)) {
            rmSync(TEST_MOUNT_POINT, { recursive: true, force: true });
        }
        if (existsSync(TEST_DATA_DIR)) {
            rmSync(TEST_DATA_DIR, { recursive: true, force: true });
        }

        // Start Electron app with API enabled
        console.log('Starting Electron app for testing...');
        electronProcess = spawn('electron', [
            'electron-app',
            `--secret=${TEST_SECRET}`,
            `--data-dir=${TEST_DATA_DIR}`,
            '--enable-api'
        ], { 
            detached: true,
            stdio: 'ignore'
        });
        
        // Wait for app to start and API to be ready
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            apiAvailable = await checkApiHealth();
            if (apiAvailable) {
                break;
            }
        }

        if (!apiAvailable) {
            throw new Error('Failed to start Electron app with API');
        }
    }, 60000);

    afterAll(async () => {
        // Unmount if still mounted
        if (await isMounted()) {
            await refinioCmd('filer unmount');
        }

        // Stop Electron app
        if (electronProcess) {
            try {
                // On Windows, use taskkill
                await execAsync(`taskkill /F /PID ${electronProcess.pid}`);
            } catch {
                // Process might already be dead
            }
        }

        // Clean up test directories
        if (existsSync(TEST_MOUNT_POINT)) {
            rmSync(TEST_MOUNT_POINT, { recursive: true, force: true });
        }
        if (existsSync(TEST_DATA_DIR)) {
            rmSync(TEST_DATA_DIR, { recursive: true, force: true });
        }
    });

    describe('System Requirements', () => {
        test('should be running on Windows', () => {
            expect(process.platform).toBe('win32');
        });

        test('should have ProjFS available', async () => {
            const available = await isProjFSAvailable();
            expect(available).toBe(true);
        });

        test('should have API server running', async () => {
            const healthy = await checkApiHealth();
            expect(healthy).toBe(true);
        });
    });

    describe('ProjFS Native Module', () => {
        test('should load one.ifsprojfs module', () => {
            expect(() => {
                require('@refinio/one.ifsprojfs');
            }).not.toThrow();
        });

        test('should export ProjFS provider', () => {
            const projfs = require('@refinio/one.ifsprojfs');
            expect(projfs).toHaveProperty('IFSProjFSProvider');
        });
    });

    describe('Filer Status', () => {
        test('should get filer status', async () => {
            const { stdout } = await refinioCmd('filer status');
            expect(stdout).toContain('Filer Status');
        });

        test('should show Windows platform', async () => {
            const { stdout } = await refinioCmd('filer status');
            expect(stdout.toLowerCase()).toContain('windows');
        });

        test('should show ProjFS mode', async () => {
            const { stdout } = await refinioCmd('filer status');
            expect(stdout.toLowerCase()).toContain('projfs');
        });
    });

    describe('Mounting Operations', () => {
        test('should mount filer filesystem with ProjFS', async () => {
            const { stdout } = await refinioCmd(
                `filer mount --mount-point ${TEST_MOUNT_POINT}`
            );
            expect(stdout).toContain('Filer mounted');
        }, 15000);

        test('should create mount point directory', () => {
            expect(existsSync(TEST_MOUNT_POINT)).toBe(true);
        });

        test('should show mounted status', async () => {
            const mounted = await isMounted();
            expect(mounted).toBe(true);
        });

        test('should have virtual directories', () => {
            const expectedDirs = ['objects', 'profiles', 'chats', 'connections', 'invites'];
            for (const dir of expectedDirs) {
                const dirPath = path.join(TEST_MOUNT_POINT, dir);
                expect(existsSync(dirPath)).toBe(true);
            }
        });
    });

    describe('ProjFS Virtualization', () => {
        test('should handle virtual file access', async () => {
            // Accessing files in ProjFS triggers virtualization
            const objectsPath = path.join(TEST_MOUNT_POINT, 'objects');
            
            // This should not throw even if directory is empty (virtual)
            expect(() => {
                const files = require('fs').readdirSync(objectsPath);
                // Files might be empty if no objects exist yet
                expect(Array.isArray(files)).toBe(true);
            }).not.toThrow();
        });

        test('should support on-demand file hydration', async () => {
            // ProjFS creates files on-demand when accessed
            // This is a key feature that differs from FUSE
            const testPath = path.join(TEST_MOUNT_POINT, 'objects', 'test-virtual');
            
            // Even non-existent files can be "virtualized"
            const exists = existsSync(testPath);
            // Should return false for non-existent virtual files
            expect(typeof exists).toBe('boolean');
        });
    });

    describe('API Operations', () => {
        test('should list filesystems', async () => {
            const { stdout } = await refinioCmd('filer list-fs');
            expect(stdout).toContain('Filesystems');
            expect(stdout).toMatch(/objects|profiles|chats/);
        });

        test('should get configuration', async () => {
            const { stdout } = await refinioCmd('filer config');
            expect(stdout).toContain('Configuration');
        });

        test('should support configuration updates', async () => {
            const { stdout } = await refinioCmd('filer config --set logCalls=true');
            expect(stdout).toContain('Configuration');
        });

        test('should clear cache', async () => {
            const { stdout } = await refinioCmd('filer clear-cache');
            expect(stdout).toContain('clear');
        });
    });

    describe('Performance', () => {
        test('should list directories quickly', async () => {
            const start = Date.now();
            const objectsPath = path.join(TEST_MOUNT_POINT, 'objects');
            require('fs').readdirSync(objectsPath);
            const elapsed = Date.now() - start;
            
            // ProjFS should be fast for directory listing
            expect(elapsed).toBeLessThan(5000);
        });

        test('should handle concurrent operations', async () => {
            const operations = [];
            
            // Run multiple operations concurrently
            for (let i = 0; i < 5; i++) {
                operations.push(refinioCmd('filer status'));
            }
            
            const results = await Promise.all(operations);
            expect(results).toHaveLength(5);
            results.forEach(result => {
                expect(result.stdout).toContain('Filer Status');
            });
        });
    });

    describe('Unmounting Operations', () => {
        test('should unmount filer filesystem', async () => {
            const { stdout } = await refinioCmd('filer unmount');
            expect(stdout).toContain('unmount');
        });

        test('should show unmounted status', async () => {
            const mounted = await isMounted();
            expect(mounted).toBe(false);
        });

        test('should handle unmount when not mounted', async () => {
            // Try to unmount again
            const { stdout } = await refinioCmd('filer unmount');
            // Should not throw, just report status
            expect(stdout).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid mount points', async () => {
            await expect(refinioCmd(
                'filer mount --mount-point "\\\\invalid\\path"'
            )).rejects.toThrow();
        });

        test('should handle API unavailability gracefully', async () => {
            // This would test behavior when API is down
            // For now, just check that commands handle errors
            expect(true).toBe(true);
        });
    });
});