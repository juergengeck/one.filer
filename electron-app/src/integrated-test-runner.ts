import { RealTestRunner, RealTestSuite, RealTestResult } from './real-test-runner';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess, exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

export interface TestProgress {
    currentSuite: string;
    currentTest: string;
    progress: number; // 0-100
    totalSuites: number;
    completedSuites: number;
}

export interface CrossPlatformTestResult {
    name: string;
    status: 'pass' | 'fail' | 'running';
    error?: string;
    duration: number;
}

export interface CrossPlatformTestSuite {
    name: string;
    tests: CrossPlatformTestResult[];
    passed: number;
    failed: number;
    duration: number;
    platform: 'windows' | 'linux' | 'cross-platform';
}

export class IntegratedTestRunner {
    private realTestRunner: RealTestRunner;
    private onProgress?: (progress: TestProgress) => void;
    private currentProgress: TestProgress = {
        currentSuite: '',
        currentTest: '',
        progress: 0,
        totalSuites: 0,
        completedSuites: 0
    };
    
    constructor() {
        this.realTestRunner = new RealTestRunner();
    }
    
    setProgressCallback(callback: (progress: TestProgress) => void): void {
        this.onProgress = callback;
    }
    
    private updateProgress(update: Partial<TestProgress>): void {
        this.currentProgress = { ...this.currentProgress, ...update };
        this.onProgress?.(this.currentProgress);
    }
    
    async runAllTests(): Promise<RealTestSuite[]> {
        console.log('[IntegratedTestRunner] Starting comprehensive test suite...');
        
        const allSuites: RealTestSuite[] = [];
        
        // Calculate total suites
        const totalSuites = 8; // 6 from RealTestRunner + 2 cross-platform
        this.updateProgress({ totalSuites, completedSuites: 0, progress: 0 });
        
        try {
            // Run the real filesystem tests first
            this.updateProgress({ 
                currentSuite: 'Real Filesystem Tests', 
                currentTest: 'Initializing...', 
                progress: 5 
            });
            
            const realSuites = await this.realTestRunner.runRealTests();
            allSuites.push(...realSuites);
            
            this.updateProgress({ 
                completedSuites: 6, 
                progress: 75 
            });
            
            // Run cross-platform basic connectivity test
            this.updateProgress({ 
                currentSuite: 'Cross-Platform Tests', 
                currentTest: 'Basic Connectivity', 
                progress: 80 
            });
            
            const connectivitySuite = await this.runBasicConnectivityTest();
            allSuites.push(connectivitySuite);
            
            this.updateProgress({ 
                completedSuites: 7, 
                progress: 90 
            });
            
            // Run cross-platform script integration test
            this.updateProgress({ 
                currentSuite: 'Script Integration', 
                currentTest: 'Running combined tests script', 
                progress: 95 
            });
            
            const scriptSuite = await this.runScriptIntegrationTest();
            allSuites.push(scriptSuite);
            
            this.updateProgress({ 
                completedSuites: 8, 
                progress: 100,
                currentSuite: 'Complete',
                currentTest: 'All tests finished'
            });
            
        } catch (error) {
            console.error('[IntegratedTestRunner] Error during test execution:', error);
            
            // Add error suite
            allSuites.push({
                name: 'Test Runner Error',
                tests: [{
                    name: 'Test execution failed',
                    status: 'fail',
                    error: (error as Error).message,
                    duration: 0
                }],
                passed: 0,
                failed: 1,
                duration: 0
            });
        }
        
        return allSuites;
    }
    
    async runQuickTests(): Promise<RealTestSuite[]> {
        console.log('[IntegratedTestRunner] Running quick test suite...');
        
        const quickSuites: RealTestSuite[] = [];
        
        // Only run essential tests for quick mode
        const totalSuites = 4;
        this.updateProgress({ totalSuites, completedSuites: 0, progress: 0 });
        
        try {
            // Mount and basic connectivity
            this.updateProgress({ 
                currentSuite: 'Mount Tests', 
                currentTest: 'Checking mount point', 
                progress: 10 
            });
            
            const mountSuite = await this.realTestRunner['testProjFSMount']();
            quickSuites.push(mountSuite);
            
            this.updateProgress({ 
                completedSuites: 1, 
                progress: 25 
            });
            
            // Directory operations
            this.updateProgress({ 
                currentSuite: 'Directory Tests', 
                currentTest: 'Testing directory access', 
                progress: 50 
            });
            
            const dirSuite = await this.realTestRunner['testDirectoryOperations']();
            quickSuites.push(dirSuite);
            
            this.updateProgress({ 
                completedSuites: 2, 
                progress: 75 
            });
            
            // Basic file operations
            this.updateProgress({ 
                currentSuite: 'File Tests', 
                currentTest: 'Testing file access', 
                progress: 90 
            });
            
            const fileSuite = await this.realTestRunner['testFileOperations']();
            quickSuites.push(fileSuite);
            
            this.updateProgress({ 
                completedSuites: 3, 
                progress: 95 
            });
            
            // Quick connectivity check
            const connectivitySuite = await this.runBasicConnectivityTest();
            quickSuites.push(connectivitySuite);
            
            this.updateProgress({ 
                completedSuites: 4, 
                progress: 100,
                currentSuite: 'Complete',
                currentTest: 'Quick tests finished'
            });
            
        } catch (error) {
            console.error('[IntegratedTestRunner] Error during quick tests:', error);
        }
        
        return quickSuites;
    }
    
    private async runBasicConnectivityTest(): Promise<RealTestSuite> {
        const suite: RealTestSuite = {
            name: 'Basic Connectivity',
            tests: [],
            passed: 0,
            failed: 0,
            duration: 0
        };
        
        const startTime = Date.now();
        
        // Test 1: Check if we can detect platform
        const test1Start = Date.now();
        try {
            const platform = process.platform;
            const isWindows = platform === 'win32';
            const isLinux = platform === 'linux';
            
            suite.tests.push({
                name: 'Platform Detection',
                status: (isWindows || isLinux) ? 'pass' : 'fail',
                error: (isWindows || isLinux) ? undefined : `Unsupported platform: ${platform}`,
                duration: Date.now() - test1Start
            });
            
            if (isWindows || isLinux) suite.passed++; else suite.failed++;
        } catch (error) {
            suite.tests.push({
                name: 'Platform Detection',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test1Start
            });
            suite.failed++;
        }
        
        // Test 2: Check if ONE Filer processes can start
        const test2Start = Date.now();
        try {
            // Simple check for node availability and script presence
            const mainScript = path.join(process.cwd(), '..', 'lib', 'index.js');
            const scriptExists = fs.existsSync(mainScript);
            
            suite.tests.push({
                name: 'ONE Filer Script Available',
                status: scriptExists ? 'pass' : 'fail',
                error: scriptExists ? undefined : `Script not found at: ${mainScript}`,
                duration: Date.now() - test2Start
            });
            
            if (scriptExists) suite.passed++; else suite.failed++;
        } catch (error) {
            suite.tests.push({
                name: 'ONE Filer Script Available',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test2Start
            });
            suite.failed++;
        }
        
        // Test 3: Check if test scripts are available
        const test3Start = Date.now();
        try {
            const testScript = path.join(process.cwd(), '..', 'run-combined-tests.sh');
            const scriptExists = fs.existsSync(testScript);
            
            suite.tests.push({
                name: 'Combined Test Script Available',
                status: scriptExists ? 'pass' : 'fail',
                error: scriptExists ? undefined : `Test script not found at: ${testScript}`,
                duration: Date.now() - test3Start
            });
            
            if (scriptExists) suite.passed++; else suite.failed++;
        } catch (error) {
            suite.tests.push({
                name: 'Combined Test Script Available',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test3Start
            });
            suite.failed++;
        }
        
        suite.duration = Date.now() - startTime;
        return suite;
    }
    
    private async runScriptIntegrationTest(): Promise<RealTestSuite> {
        const suite: RealTestSuite = {
            name: 'Script Integration',
            tests: [],
            passed: 0,
            failed: 0,
            duration: 0
        };
        
        const startTime = Date.now();
        
        // Test 1: Try to run the combined test script in quick mode
        const test1Start = Date.now();
        try {
            const testScript = path.join(process.cwd(), '..', 'run-combined-tests.sh');
            
            if (fs.existsSync(testScript)) {
                // Run in quick mode with timeout
                const result = await this.runCommandWithTimeout(
                    'bash',
                    [testScript, '--quick', '--skip-build'],
                    { cwd: path.dirname(testScript) },
                    30000 // 30 second timeout
                );
                
                const success = result.code === 0;
                suite.tests.push({
                    name: 'Run Combined Tests (Quick)',
                    status: success ? 'pass' : 'fail',
                    error: success ? undefined : `Exit code: ${result.code}, Output: ${result.stderr || result.stdout}`,
                    duration: Date.now() - test1Start
                });
                
                if (success) suite.passed++; else suite.failed++;
            } else {
                suite.tests.push({
                    name: 'Run Combined Tests (Quick)',
                    status: 'fail',
                    error: 'Test script not found',
                    duration: Date.now() - test1Start
                });
                suite.failed++;
            }
        } catch (error) {
            suite.tests.push({
                name: 'Run Combined Tests (Quick)',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test1Start
            });
            suite.failed++;
        }
        
        // Test 2: Check for test report file
        const test2Start = Date.now();
        try {
            const reportPath = path.join(process.cwd(), '..', 'combined-test-report.txt');
            const reportExists = fs.existsSync(reportPath);
            
            let reportContent = '';
            if (reportExists) {
                reportContent = fs.readFileSync(reportPath, 'utf8');
            }
            
            suite.tests.push({
                name: 'Test Report Generated',
                status: reportExists ? 'pass' : 'fail',
                error: reportExists ? undefined : 'Test report file not found after script execution',
                duration: Date.now() - test2Start
            });
            
            if (reportExists) suite.passed++; else suite.failed++;
        } catch (error) {
            suite.tests.push({
                name: 'Test Report Generated',
                status: 'fail',
                error: (error as Error).message,
                duration: Date.now() - test2Start
            });
            suite.failed++;
        }
        
        suite.duration = Date.now() - startTime;
        return suite;
    }
    
    private async runCommandWithTimeout(
        command: string, 
        args: string[], 
        options: any, 
        timeout: number
    ): Promise<{ code: number | null; stdout: string; stderr: string }> {
        return new Promise((resolve) => {
            const child = spawn(command, args, options);
            let stdout = '';
            let stderr = '';
            let resolved = false;
            
            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            
            child.on('exit', (code) => {
                if (!resolved) {
                    resolved = true;
                    resolve({ code, stdout, stderr });
                }
            });
            
            child.on('error', (error) => {
                if (!resolved) {
                    resolved = true;
                    resolve({ code: -1, stdout, stderr: error.message });
                }
            });
            
            // Timeout handling
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    child.kill();
                    resolve({ code: -1, stdout, stderr: 'Command timed out' });
                }
            }, timeout);
        });
    }
}