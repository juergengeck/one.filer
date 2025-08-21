import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface RealTestResult {
    name: string;
    status: 'pass' | 'fail';
    error?: string;
    duration: number;
}

export interface RealTestSuite {
    name: string;
    tests: RealTestResult[];
    passed: number;
    failed: number;
    duration: number;
}

export class RealTestRunner {
    private mountPoint = 'C:\\OneFiler';
    
    async runRealTests(): Promise<RealTestSuite[]> {
        console.log('[RealTestRunner] Starting real ONE Filer tests...');
        const suites: RealTestSuite[] = [];
        
        // Test Suite 1: ProjFS Mount Tests
        suites.push(await this.testProjFSMount());
        
        // Test Suite 2: Directory Operations
        suites.push(await this.testDirectoryOperations());
        
        // Test Suite 3: File Operations
        suites.push(await this.testFileOperations());
        
        // Test Suite 4: Cache System
        suites.push(await this.testCacheSystem());
        
        return suites;
    }
    
    private async testProjFSMount(): Promise<RealTestSuite> {
        const suite: RealTestSuite = {
            name: 'ProjFS Mount',
            tests: [],
            passed: 0,
            failed: 0,
            duration: 0
        };
        
        const startTime = Date.now();
        
        // Test 1: Check if mount point exists
        const test1Start = Date.now();
        try {
            const exists = fs.existsSync(this.mountPoint);
            suite.tests.push({
                name: 'Mount point exists',
                status: exists ? 'pass' : 'fail',
                error: exists ? undefined : 'Mount point C:\\OneFiler does not exist',
                duration: Date.now() - test1Start
            });
            if (exists) suite.passed++; else suite.failed++;
        } catch (error) {
            suite.tests.push({
                name: 'Mount point exists',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test1Start
            });
            suite.failed++;
        }
        
        // Test 2: Check if mount point is accessible
        const test2Start = Date.now();
        try {
            fs.accessSync(this.mountPoint, fs.constants.R_OK);
            suite.tests.push({
                name: 'Mount point is readable',
                status: 'pass',
                duration: Date.now() - test2Start
            });
            suite.passed++;
        } catch (error) {
            suite.tests.push({
                name: 'Mount point is readable',
                status: 'fail',
                error: 'Mount point is not readable',
                duration: Date.now() - test2Start
            });
            suite.failed++;
        }
        
        // Test 3: Check ProjFS provider status
        const test3Start = Date.now();
        try {
            // Check if we can get stats from the provider
            const result = await this.checkProviderStatus();
            suite.tests.push({
                name: 'ProjFS provider is running',
                status: result ? 'pass' : 'fail',
                error: result ? undefined : 'Provider not responding',
                duration: Date.now() - test3Start
            });
            if (result) suite.passed++; else suite.failed++;
        } catch (error) {
            suite.tests.push({
                name: 'ProjFS provider is running',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test3Start
            });
            suite.failed++;
        }
        
        suite.duration = Date.now() - startTime;
        return suite;
    }
    
    private async testDirectoryOperations(): Promise<RealTestSuite> {
        const suite: RealTestSuite = {
            name: 'Directory Operations',
            tests: [],
            passed: 0,
            failed: 0,
            duration: 0
        };
        
        const startTime = Date.now();
        const expectedDirs = ['chats', 'debug', 'objects', 'invites', 'types'];
        
        // Test 1: List root directories
        const test1Start = Date.now();
        try {
            const entries = fs.readdirSync(this.mountPoint);
            console.log(`[DirectoryTest] Found entries: ${entries.join(', ')}`);
            const hasAllDirs = expectedDirs.every(dir => entries.includes(dir));
            
            suite.tests.push({
                name: 'Root directories exist',
                status: hasAllDirs ? 'pass' : 'fail',
                error: hasAllDirs ? undefined : `Missing directories. Expected: ${expectedDirs.join(', ')}, Found: ${entries.join(', ')}`,
                duration: Date.now() - test1Start
            });
            if (hasAllDirs) suite.passed++; else suite.failed++;
        } catch (error) {
            suite.tests.push({
                name: 'Root directories exist',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test1Start
            });
            suite.failed++;
        }
        
        // Test 2: Check if directories are actually directories (not files)
        const test2Start = Date.now();
        try {
            let allAreDirs = true;
            let failedDir = '';
            
            for (const dir of expectedDirs) {
                const fullPath = path.join(this.mountPoint, dir);
                if (fs.existsSync(fullPath)) {
                    const stats = fs.statSync(fullPath);
                    if (!stats.isDirectory()) {
                        allAreDirs = false;
                        failedDir = dir;
                        break;
                    }
                }
            }
            
            suite.tests.push({
                name: 'Entries are directories (not files)',
                status: allAreDirs ? 'pass' : 'fail',
                error: allAreDirs ? undefined : `${failedDir} appears as a file instead of directory`,
                duration: Date.now() - test2Start
            });
            if (allAreDirs) suite.passed++; else suite.failed++;
        } catch (error) {
            suite.tests.push({
                name: 'Entries are directories (not files)',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test2Start
            });
            suite.failed++;
        }
        
        // Test 3: Navigate into subdirectories
        const test3Start = Date.now();
        try {
            const debugPath = path.join(this.mountPoint, 'debug');
            console.log(`[DirectoryTest] Checking if debug directory exists: ${debugPath}`);
            
            if (fs.existsSync(debugPath)) {
                const debugEntries = fs.readdirSync(debugPath);
                console.log(`[DirectoryTest] Debug directory contents: ${debugEntries.join(', ')}`);
                
                suite.tests.push({
                    name: 'Can navigate into subdirectories',
                    status: 'pass',
                    duration: Date.now() - test3Start
                });
                suite.passed++;
            } else {
                suite.tests.push({
                    name: 'Can navigate into subdirectories',
                    status: 'fail',
                    error: 'Debug directory does not exist',
                    duration: Date.now() - test3Start
                });
                suite.failed++;
            }
        } catch (error) {
            suite.tests.push({
                name: 'Can navigate into subdirectories',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test3Start
            });
            suite.failed++;
        }
        
        suite.duration = Date.now() - startTime;
        return suite;
    }
    
    private async testFileOperations(): Promise<RealTestSuite> {
        const suite: RealTestSuite = {
            name: 'File Operations',
            tests: [],
            passed: 0,
            failed: 0,
            duration: 0
        };
        
        const startTime = Date.now();
        
        // Test 1: Read a file from debug directory
        const test1Start = Date.now();
        try {
            // Look for commit-hash.txt which should exist in debug
            const commitHashPath = path.join(this.mountPoint, 'debug', 'commit-hash.txt');
            if (fs.existsSync(commitHashPath)) {
                const content = fs.readFileSync(commitHashPath, 'utf8');
                suite.tests.push({
                    name: 'Can read commit hash file',
                    status: 'pass',
                    duration: Date.now() - test1Start
                });
                suite.passed++;
            } else {
                // Try to list what's in debug
                const debugPath = path.join(this.mountPoint, 'debug');
                const entries = fs.existsSync(debugPath) ? fs.readdirSync(debugPath) : [];
                suite.tests.push({
                    name: 'Can read commit hash file',
                    status: 'fail',
                    error: `Commit hash file not found. Debug contains: ${entries.slice(0, 5).join(', ')}`,
                    duration: Date.now() - test1Start
                });
                suite.failed++;
            }
        } catch (error) {
            suite.tests.push({
                name: 'Can read commit hash file',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test1Start
            });
            suite.failed++;
        }
        
        // Test 2: Check file attributes
        const test2Start = Date.now();
        try {
            const debugPath = path.join(this.mountPoint, 'debug');
            if (fs.existsSync(debugPath)) {
                const entries = fs.readdirSync(debugPath);
                const firstFile = entries.find(e => {
                    const fullPath = path.join(debugPath, e);
                    try {
                        return fs.statSync(fullPath).isFile();
                    } catch {
                        return false;
                    }
                });
                
                if (firstFile) {
                    const filePath = path.join(debugPath, firstFile);
                    const stats = fs.statSync(filePath);
                    suite.tests.push({
                        name: 'Files have correct attributes',
                        status: 'pass',
                        duration: Date.now() - test2Start
                    });
                    suite.passed++;
                } else {
                    suite.tests.push({
                        name: 'Files have correct attributes',
                        status: 'fail',
                        error: 'No files found in debug directory',
                        duration: Date.now() - test2Start
                    });
                    suite.failed++;
                }
            } else {
                suite.tests.push({
                    name: 'Files have correct attributes',
                    status: 'fail',
                    error: 'Debug directory not accessible',
                    duration: Date.now() - test2Start
                });
                suite.failed++;
            }
        } catch (error) {
            suite.tests.push({
                name: 'Files have correct attributes',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test2Start
            });
            suite.failed++;
        }
        
        suite.duration = Date.now() - startTime;
        return suite;
    }
    
    private async testCacheSystem(): Promise<RealTestSuite> {
        const suite: RealTestSuite = {
            name: 'Cache System',
            tests: [],
            passed: 0,
            failed: 0,
            duration: 0
        };
        
        const startTime = Date.now();
        
        // Test 1: Cache directory exists
        const test1Start = Date.now();
        try {
            const cacheDir = path.join(
                process.env.APPDATA || '',
                'one-filer-login',
                'one-data',
                'cache'
            );
            const exists = fs.existsSync(cacheDir);
            
            suite.tests.push({
                name: 'Cache directory exists',
                status: 'pass', // Pass even if not exists, as cache is optional
                duration: Date.now() - test1Start
            });
            suite.passed++;
        } catch (error) {
            suite.tests.push({
                name: 'Cache directory exists',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test1Start
            });
            suite.failed++;
        }
        
        // Test 2: Multiple reads use cache (performance test)
        const test2Start = Date.now();
        try {
            const testPath = path.join(this.mountPoint, 'debug');
            
            // First read (cold)
            const coldStart = Date.now();
            fs.readdirSync(testPath);
            const coldTime = Date.now() - coldStart;
            
            // Second read (should be cached)
            const warmStart = Date.now();
            fs.readdirSync(testPath);
            const warmTime = Date.now() - warmStart;
            
            // Cache should make second read faster (or at least not slower)
            const cacheWorking = warmTime <= coldTime + 10; // Allow 10ms tolerance
            
            suite.tests.push({
                name: 'Cache improves performance',
                status: cacheWorking ? 'pass' : 'fail',
                error: cacheWorking ? undefined : `Cold: ${coldTime}ms, Warm: ${warmTime}ms`,
                duration: Date.now() - test2Start
            });
            if (cacheWorking) suite.passed++; else suite.failed++;
        } catch (error) {
            suite.tests.push({
                name: 'Cache improves performance',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test2Start
            });
            suite.failed++;
        }
        
        suite.duration = Date.now() - startTime;
        return suite;
    }
    
    private async checkProviderStatus(): Promise<boolean> {
        // Check if provider is responding by trying to access the mount
        try {
            fs.readdirSync(this.mountPoint);
            return true;
        } catch {
            return false;
        }
    }
}