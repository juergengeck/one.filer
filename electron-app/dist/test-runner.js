import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
export class TestRunner {
    testSuites = [
        {
            name: 'Cache System',
            files: [
                'test/unit/PersistentCache.simple.test.ts',
                'test/unit/SmartCacheManager.simple.test.ts'
            ]
        },
        {
            name: 'Application Layer',
            files: [
                'test/app/ElectronApp.test.ts'
            ]
        },
        {
            name: 'End-to-End',
            files: [
                'test/e2e/FullStack.test.ts'
            ]
        }
    ];
    async runAllTests() {
        const results = [];
        for (const suite of this.testSuites) {
            const suiteResult = await this.runTestSuite(suite);
            results.push(suiteResult);
        }
        return results;
    }
    async runTestSuite(suite) {
        const result = {
            name: suite.name,
            tests: [],
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0
        };
        const startTime = Date.now();
        for (const file of suite.files) {
            const testResults = await this.runTestFile(file);
            result.tests.push(...testResults);
        }
        result.duration = Date.now() - startTime;
        result.passed = result.tests.filter(t => t.status === 'pass').length;
        result.failed = result.tests.filter(t => t.status === 'fail').length;
        result.skipped = result.tests.filter(t => t.status === 'skip').length;
        return result;
    }
    runTestFile(filePath) {
        return new Promise((resolve) => {
            const results = [];
            // Get the actual project root (one level up from electron-app)
            const projectRoot = path.resolve(path.join(__dirname, '..', '..'));
            const fullPath = path.join(projectRoot, filePath);
            // Check if file exists
            if (!fs.existsSync(fullPath)) {
                results.push({
                    suite: filePath,
                    test: 'File not found',
                    status: 'fail',
                    error: `Test file not found: ${filePath}`
                });
                resolve(results);
                return;
            }
            const child = spawn('npx', [
                'mocha',
                filePath,
                '--require',
                'ts-node/register',
                '--timeout',
                '10000',
                '--reporter',
                'json'
            ], {
                cwd: projectRoot,
                shell: true
            });
            let output = '';
            let errorOutput = '';
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            child.on('close', (code) => {
                try {
                    // Try to parse JSON output
                    const jsonResult = JSON.parse(output);
                    if (jsonResult.tests && Array.isArray(jsonResult.tests)) {
                        for (const test of jsonResult.tests) {
                            results.push({
                                suite: test.fullTitle?.split(' ')[0] || filePath,
                                test: test.title || 'Unknown test',
                                status: test.state === 'passed' ? 'pass' : 'fail',
                                error: test.err?.message,
                                duration: test.duration
                            });
                        }
                    }
                }
                catch (error) {
                    // If JSON parsing fails, create a summary result
                    if (code === 0) {
                        // Tests passed but couldn't parse output
                        results.push({
                            suite: filePath,
                            test: 'All tests',
                            status: 'pass'
                        });
                    }
                    else {
                        // Tests failed
                        results.push({
                            suite: filePath,
                            test: 'Test execution',
                            status: 'fail',
                            error: errorOutput || 'Test execution failed'
                        });
                    }
                }
                resolve(results);
            });
            // Timeout after 30 seconds
            setTimeout(() => {
                child.kill();
                results.push({
                    suite: filePath,
                    test: 'Test execution',
                    status: 'fail',
                    error: 'Test timeout (30s)'
                });
                resolve(results);
            }, 30000);
        });
    }
    async runSystemDiagnostics() {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            system: {},
            cache: {},
            projfs: {},
            app: {}
        };
        try {
            // System info
            diagnostics.system = {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                memory: process.memoryUsage(),
                uptime: process.uptime()
            };
            // Cache info
            const cacheDir = path.join(process.cwd(), 'test-cache-instance');
            if (fs.existsSync(cacheDir)) {
                const stats = fs.statSync(cacheDir);
                diagnostics.cache = {
                    exists: true,
                    size: this.getDirectorySize(cacheDir),
                    modified: stats.mtime
                };
            }
            else {
                diagnostics.cache = { exists: false };
            }
            // ProjFS status
            diagnostics.projfs = {
                mountPoint: 'C:\\OneFiler',
                exists: fs.existsSync('C:\\OneFiler'),
                provider: 'ProjFS'
            };
            // App status
            diagnostics.app = {
                running: true,
                pid: process.pid,
                cwd: process.cwd()
            };
        }
        catch (error) {
            diagnostics.error = error.message;
        }
        return diagnostics;
    }
    getDirectorySize(dir) {
        let size = 0;
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    size += this.getDirectorySize(filePath);
                }
                else {
                    size += stats.size;
                }
            }
        }
        catch (error) {
            // Ignore errors
        }
        return size;
    }
}
//# sourceMappingURL=test-runner.js.map