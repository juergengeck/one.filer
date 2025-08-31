#!/usr/bin/env node

/**
 * Unified Test Runner for ONE.filer
 * 
 * Combines comprehensive component/integration tests with existing unit/functional tests
 * to provide complete test coverage across both Windows (ProjFS) and Linux (FUSE3) implementations.
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import chalk from 'chalk';

interface TestCategory {
    name: string;
    description: string;
    suites: TestSuite[];
}

interface TestSuite {
    name: string;
    file: string;
    type: 'unit' | 'integration' | 'component' | 'functional' | 'e2e';
    platform: 'windows' | 'linux' | 'all';
    framework: 'mocha' | 'custom';
    timeout?: number;
    enabled?: boolean;
    requiresBuild?: boolean;
}

interface TestResult {
    category: string;
    suite: string;
    type: string;
    passed: boolean;
    skipped: boolean;
    duration: number;
    tests?: {
        total: number;
        passed: number;
        failed: number;
    };
    error?: string;
}

class UnifiedTestRunner {
    private results: TestResult[] = [];
    private currentPlatform: string;
    private isWindows: boolean;
    private isLinux: boolean;
    private isWSL: boolean;
    private verbose: boolean = false;
    
    // Test categories organized by purpose
    private testCategories: TestCategory[] = [
        {
            name: 'Unit Tests',
            description: 'Core functionality and component isolation tests',
            suites: [
                {
                    name: 'Persistent Cache Unit Tests',
                    file: 'test/unit/PersistentCache.test.ts',
                    type: 'unit',
                    platform: 'all',
                    framework: 'mocha',
                    timeout: 10000
                },
                {
                    name: 'Smart Cache Manager Unit Tests',
                    file: 'test/unit/SmartCacheManager.test.ts',
                    type: 'unit',
                    platform: 'all',
                    framework: 'mocha',
                    timeout: 10000
                },
                {
                    name: 'Simple Cache Tests',
                    file: 'test/unit/*.simple.test.ts',
                    type: 'unit',
                    platform: 'all',
                    framework: 'mocha',
                    timeout: 5000
                }
            ]
        },
        {
            name: 'Component Tests',
            description: 'Platform-specific filesystem implementation tests',
            suites: [
                {
                    name: 'Linux FUSE3 Component Tests',
                    file: 'test/fuse-linux.test.js',
                    type: 'component',
                    platform: 'linux',
                    framework: 'mocha',
                    timeout: 60000,
                    requiresBuild: true
                },
                {
                    name: 'Windows ProjFS Component Tests',
                    file: 'test/projfs-windows.test.js',
                    type: 'component',
                    platform: 'windows',
                    framework: 'mocha',
                    timeout: 60000,
                    requiresBuild: true
                }
            ]
        },
        {
            name: 'Integration Tests',
            description: 'Module integration and interaction tests',
            suites: [
                {
                    name: 'Cached ProjFS Provider Integration',
                    file: 'test/integration/CachedProjFSProvider.test.ts',
                    type: 'integration',
                    platform: 'windows',
                    framework: 'mocha',
                    timeout: 30000
                },
                {
                    name: 'Filer with ProjFS Integration',
                    file: 'test/integration/FilerWithProjFS.test.ts',
                    type: 'integration',
                    platform: 'windows',
                    framework: 'mocha',
                    timeout: 30000
                },
                {
                    name: 'Cross-Platform Integration Tests',
                    file: 'test/cross-platform-integration.test.js',
                    type: 'integration',
                    platform: 'all',
                    framework: 'mocha',
                    timeout: 120000,
                    requiresBuild: true
                }
            ]
        },
        {
            name: 'Functional Tests',
            description: 'End-to-end functional verification',
            suites: [
                {
                    name: 'FUSE Linux Functional Tests',
                    file: 'test/functional/fuse-linux.test.ts',
                    type: 'functional',
                    platform: 'linux',
                    framework: 'mocha',
                    timeout: 120000,
                    enabled: false // Only if exists
                },
                {
                    name: 'Windows Access Functional Tests',
                    file: 'test/functional/fuse-windows-access.test.ts',
                    type: 'functional',
                    platform: 'windows',
                    framework: 'mocha',
                    timeout: 120000,
                    enabled: false // Only if exists
                }
            ]
        }
    ];
    
    constructor(options: { verbose?: boolean } = {}) {
        this.currentPlatform = process.platform;
        this.isWindows = this.currentPlatform === 'win32';
        this.isLinux = this.currentPlatform === 'linux';
        this.isWSL = this.isLinux && fs.existsSync('/mnt/c');
        this.verbose = options.verbose || false;
        
        // Enable tests based on file existence
        this.enableExistingTests();
    }
    
    private enableExistingTests(): void {
        for (const category of this.testCategories) {
            for (const suite of category.suites) {
                if (suite.enabled === false) {
                    // Check if file exists
                    const testPath = path.resolve(suite.file);
                    if (fs.existsSync(testPath)) {
                        suite.enabled = true;
                    }
                } else {
                    suite.enabled = true;
                }
            }
        }
    }
    
    private log(message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
        const prefix = {
            info: chalk.blue('ℹ'),
            success: chalk.green('✓'),
            warning: chalk.yellow('⚠'),
            error: chalk.red('✗')
        };
        
        console.log(`${prefix[level]} ${message}`);
    }
    
    private shouldRunSuite(suite: TestSuite): boolean {
        if (!suite.enabled) return false;
        if (suite.platform === 'all') return true;
        if (suite.platform === 'windows' && (this.isWindows || this.isWSL)) return true;
        if (suite.platform === 'linux' && this.isLinux) return true;
        return false;
    }
    
    private async ensureBuilt(): Promise<void> {
        this.log('Building project...', 'info');
        
        return new Promise((resolve, reject) => {
            const build = spawn('npm', ['run', 'build'], {
                stdio: this.verbose ? 'inherit' : 'pipe',
                shell: true
            });
            
            build.on('exit', (code) => {
                if (code === 0) {
                    this.log('Build completed successfully', 'success');
                    resolve();
                } else {
                    reject(new Error(`Build failed with code ${code}`));
                }
            });
            
            build.on('error', reject);
        });
    }
    
    private async compileTests(): Promise<void> {
        this.log('Compiling TypeScript tests...', 'info');
        
        // Check if test tsconfig exists
        const testTsConfig = path.join('test', 'tsconfig.json');
        if (!fs.existsSync(testTsConfig)) {
            this.log('No test tsconfig found, skipping test compilation', 'warning');
            return;
        }
        
        return new Promise((resolve, reject) => {
            const tsc = spawn('npx', ['tsc', '--project', testTsConfig], {
                stdio: this.verbose ? 'inherit' : 'pipe',
                shell: true
            });
            
            tsc.on('exit', (code) => {
                if (code === 0) {
                    this.log('Test compilation completed', 'success');
                    resolve();
                } else {
                    this.log('Test compilation failed but continuing...', 'warning');
                    resolve(); // Continue anyway
                }
            });
            
            tsc.on('error', (err) => {
                this.log(`Compilation error: ${err.message}`, 'warning');
                resolve(); // Continue anyway
            });
        });
    }
    
    private async runTestSuite(category: string, suite: TestSuite): Promise<TestResult> {
        const startTime = Date.now();
        
        this.log(`Running ${suite.name}...`, 'info');
        
        if (!this.shouldRunSuite(suite)) {
            this.log(`Skipping ${suite.name} (not applicable for ${this.currentPlatform})`, 'warning');
            return {
                category,
                suite: suite.name,
                type: suite.type,
                passed: true,
                skipped: true,
                duration: 0
            };
        }
        
        // Check if test file exists
        const testFile = suite.file.includes('*') ? suite.file : path.resolve(suite.file);
        if (!suite.file.includes('*') && !fs.existsSync(testFile) && !fs.existsSync(testFile.replace('.js', '.ts'))) {
            this.log(`Test file not found: ${suite.file}`, 'warning');
            return {
                category,
                suite: suite.name,
                type: suite.type,
                passed: true,
                skipped: true,
                duration: 0,
                error: 'Test file not found'
            };
        }
        
        return new Promise((resolve) => {
            const args = [
                suite.file,
                '--timeout', (suite.timeout || 60000).toString(),
                '--reporter', this.verbose ? 'spec' : 'dot' // Use visual reporter for better feedback
            ];
            
            const mocha = spawn('npx', ['mocha', ...args], {
                cwd: suite.file.includes('*') ? process.cwd() : undefined,
                stdio: this.verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'], // Show output in verbose mode
                shell: true
            });
            
            let output = '';
            let errorOutput = '';
            let testCount = 0;
            let passedCount = 0;
            let failedCount = 0;
            
            // Progress indicators
            let progressInterval: NodeJS.Timeout | null = null;
            let dotCount = 0;
            
            if (!this.verbose) {
                // Show progress dots every 2 seconds
                progressInterval = setInterval(() => {
                    process.stdout.write(chalk.blue('.'));
                    dotCount++;
                    if (dotCount % 30 === 0) {
                        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                        console.log(chalk.gray(` ${elapsed}s`));
                    }
                }, 2000);
            }
            
            if (!this.verbose) {
                mocha.stdout?.on('data', (data) => {
                    const dataStr = data.toString();
                    output += dataStr;
                    
                    // Look for test progress indicators in the output
                    const passMatches = dataStr.match(/✓/g);
                    const failMatches = dataStr.match(/✗|×/g);
                    
                    if (passMatches) {
                        passedCount += passMatches.length;
                        process.stdout.write(chalk.green('.'));
                    }
                    if (failMatches) {
                        failedCount += failMatches.length;
                        process.stdout.write(chalk.red('×'));
                    }
                });
                
                mocha.stderr?.on('data', (data) => {
                    errorOutput += data.toString();
                    // Show critical errors immediately
                    const errorStr = data.toString();
                    if (errorStr.includes('Error:') || errorStr.includes('AssertionError:')) {
                        console.log(chalk.red('\n⚠ Test error detected'));
                    }
                });
            }
            
            mocha.on('exit', (code) => {
                if (progressInterval) {
                    clearInterval(progressInterval);
                }
                
                const duration = Date.now() - startTime;
                
                // Clear progress line if not verbose
                if (!this.verbose && dotCount > 0) {
                    console.log(''); // New line after progress dots
                }
                
                // Try to parse test statistics from output
                let testStats = { total: 0, passed: passedCount, failed: failedCount };
                
                // Try to extract test counts from output
                const totalMatch = output.match(/(\d+) passing|(\d+) failing|(\d+) pending/g);
                if (totalMatch) {
                    let total = 0;
                    let passed = 0;
                    let failed = 0;
                    
                    totalMatch.forEach(match => {
                        const num = parseInt(match.match(/\d+/)?.[0] || '0');
                        if (match.includes('passing')) passed = num;
                        else if (match.includes('failing')) failed = num;
                        total += num;
                    });
                    
                    testStats = { total, passed, failed };
                }
                
                const passed = code === 0;
                
                if (passed) {
                    this.log(`${suite.name} completed successfully (${(duration / 1000).toFixed(1)}s)`, 'success');
                    if (testStats.total > 0) {
                        console.log(chalk.gray(`    ${testStats.passed}/${testStats.total} tests passed`));
                    }
                } else {
                    this.log(`${suite.name} failed (${(duration / 1000).toFixed(1)}s)`, 'error');
                    if (testStats.total > 0) {
                        console.log(chalk.gray(`    ${testStats.failed}/${testStats.total} tests failed`));
                    }
                    if (errorOutput && this.verbose) {
                        console.error(chalk.red('Error details:'), errorOutput);
                    }
                }
                
                resolve({
                    category,
                    suite: suite.name,
                    type: suite.type,
                    passed,
                    skipped: false,
                    duration,
                    tests: testStats,
                    error: passed ? undefined : errorOutput || 'Test failed'
                });
            });
            
            mocha.on('error', (error) => {
                if (progressInterval) {
                    clearInterval(progressInterval);
                }
                this.log(`Error running ${suite.name}: ${error.message}`, 'error');
                resolve({
                    category,
                    suite: suite.name,
                    type: suite.type,
                    passed: false,
                    skipped: false,
                    duration: Date.now() - startTime,
                    error: error.message
                });
            });
            
            // Timeout warning and handling
            const timeoutMs = (suite.timeout || 60000);
            const warningTime = Math.max(timeoutMs * 0.75, timeoutMs - 30000); // 75% or 30s before timeout
            
            setTimeout(() => {
                if (!mocha.killed) {
                    this.log(`${suite.name} is taking longer than expected (${(warningTime / 1000).toFixed(0)}s)...`, 'warning');
                }
            }, warningTime);
            
            setTimeout(() => {
                if (!mocha.killed) {
                    if (progressInterval) {
                        clearInterval(progressInterval);
                    }
                    mocha.kill();
                    this.log(`${suite.name} timed out after ${(timeoutMs / 1000).toFixed(0)}s`, 'error');
                    resolve({
                        category,
                        suite: suite.name,
                        type: suite.type,
                        passed: false,
                        skipped: false,
                        duration: timeoutMs,
                        error: 'Test suite timeout'
                    });
                }
            }, timeoutMs + 10000);
        });
    }
    
    private async runCategory(category: TestCategory): Promise<void> {
        console.log('\n' + '═'.repeat(60));
        console.log(chalk.bold.cyan(`📦 ${category.name}`));
        console.log(chalk.gray(category.description));
        console.log('─'.repeat(60));
        
        for (const suite of category.suites) {
            if (suite.enabled !== false) {
                const result = await this.runTestSuite(category.name, suite);
                this.results.push(result);
            }
        }
    }
    
    private generateReport(): void {
        console.log('\n' + '═'.repeat(60));
        console.log(chalk.bold.cyan('📊 UNIFIED TEST RESULTS'));
        console.log('═'.repeat(60));
        
        // Group results by category
        const byCategory = new Map<string, TestResult[]>();
        for (const result of this.results) {
            if (!byCategory.has(result.category)) {
                byCategory.set(result.category, []);
            }
            byCategory.get(result.category)!.push(result);
        }
        
        // Summary statistics
        let totalSuites = 0;
        let passedSuites = 0;
        let failedSuites = 0;
        let skippedSuites = 0;
        let totalTests = 0;
        let passedTests = 0;
        let failedTests = 0;
        
        // Display by category
        for (const [category, results] of byCategory) {
            console.log('\n' + chalk.bold.yellow(`${category}:`));
            
            for (const result of results) {
                const icon = result.skipped ? '⏭️' : (result.passed ? '✅' : '❌');
                const duration = result.skipped ? 'N/A' : `${(result.duration / 1000).toFixed(1)}s`;
                
                console.log(`  ${icon} ${result.suite}`);
                console.log(chalk.gray(`     Type: ${result.type} | Duration: ${duration}`));
                
                if (result.tests && !result.skipped) {
                    console.log(chalk.gray(`     Tests: ${result.tests.passed}/${result.tests.total} passed`));
                    totalTests += result.tests.total;
                    passedTests += result.tests.passed;
                    failedTests += result.tests.failed;
                }
                
                if (result.error && !result.skipped) {
                    console.log(chalk.red(`     Error: ${result.error.split('\n')[0]}`));
                }
                
                totalSuites++;
                if (result.skipped) {
                    skippedSuites++;
                } else if (result.passed) {
                    passedSuites++;
                } else {
                    failedSuites++;
                }
            }
        }
        
        // Overall summary
        console.log('\n' + '─'.repeat(60));
        console.log(chalk.bold('Summary:'));
        console.log(`  Platform: ${this.currentPlatform}${this.isWSL ? ' (WSL)' : ''}`);
        console.log(`  Test Suites: ${passedSuites}/${totalSuites} passed, ${failedSuites} failed, ${skippedSuites} skipped`);
        if (totalTests > 0) {
            console.log(`  Individual Tests: ${passedTests}/${totalTests} passed, ${failedTests} failed`);
        }
        console.log(`  Total Duration: ${(this.results.reduce((sum, r) => sum + r.duration, 0) / 1000).toFixed(1)}s`);
        
        // Save detailed JSON report
        const reportPath = path.join(process.cwd(), 'unified-test-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            platform: {
                os: this.currentPlatform,
                isWindows: this.isWindows,
                isLinux: this.isLinux,
                isWSL: this.isWSL
            },
            nodeVersion: process.version,
            summary: {
                suites: {
                    total: totalSuites,
                    passed: passedSuites,
                    failed: failedSuites,
                    skipped: skippedSuites
                },
                tests: totalTests > 0 ? {
                    total: totalTests,
                    passed: passedTests,
                    failed: failedTests
                } : null
            },
            categories: Object.fromEntries(byCategory),
            results: this.results
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(chalk.gray(`\n📄 Detailed report saved to: ${reportPath}`));
        
        // Final status
        console.log('\n' + '═'.repeat(60));
        if (failedSuites === 0) {
            console.log(chalk.bold.green('🎉 ALL TESTS PASSED!'));
        } else {
            console.log(chalk.bold.red(`⚠️  ${failedSuites} TEST SUITE(S) FAILED`));
        }
        console.log('═'.repeat(60));
    }
    
    async runAllTests(options: { 
        skipBuild?: boolean;
        categories?: string[];
        types?: string[];
    } = {}): Promise<boolean> {
        console.log(chalk.bold.cyan('\n🚀 ONE.filer Unified Test Runner'));
        console.log('═'.repeat(60));
        console.log(`Platform: ${chalk.yellow(this.currentPlatform)}${this.isWSL ? chalk.gray(' (WSL)') : ''}`);
        console.log(`Node: ${chalk.yellow(process.version)}`);
        console.log(`Time: ${chalk.gray(new Date().toISOString())}`);
        
        try {
            // Build project if needed
            if (!options.skipBuild) {
                const needsBuild = this.testCategories.some(cat => 
                    cat.suites.some(suite => suite.requiresBuild && this.shouldRunSuite(suite))
                );
                
                if (needsBuild) {
                    await this.ensureBuilt();
                }
            }
            
            // Compile TypeScript tests
            await this.compileTests();
            
            // Run test categories
            for (const category of this.testCategories) {
                // Filter by category name if specified
                if (options.categories && !options.categories.includes(category.name)) {
                    continue;
                }
                
                // Filter by test type if specified
                const suitesToRun = category.suites.filter(suite => 
                    !options.types || options.types.includes(suite.type)
                );
                
                if (suitesToRun.length > 0) {
                    // Update category with filtered suites temporarily
                    const originalSuites = category.suites;
                    category.suites = suitesToRun;
                    await this.runCategory(category);
                    category.suites = originalSuites;
                }
            }
            
            // Generate report
            this.generateReport();
            
            // Return success/failure
            const failed = this.results.filter(r => !r.passed && !r.skipped).length;
            return failed === 0;
            
        } catch (error: any) {
            this.log(`Fatal error: ${error.message}`, 'error');
            console.error(error);
            return false;
        }
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options: any = {
        verbose: args.includes('--verbose') || args.includes('-v'),
        skipBuild: args.includes('--skip-build'),
        categories: [],
        types: []
    };
    
    // Parse category filter
    const categoryIndex = args.indexOf('--category');
    if (categoryIndex >= 0 && args[categoryIndex + 1]) {
        options.categories = args[categoryIndex + 1].split(',');
    }
    
    // Parse type filter
    const typeIndex = args.indexOf('--type');
    if (typeIndex >= 0 && args[typeIndex + 1]) {
        options.types = args[typeIndex + 1].split(',');
    }
    
    // Show help
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
ONE.filer Unified Test Runner

Usage: node test/unified-test-runner.js [options]

Options:
  --verbose, -v       Show detailed output
  --skip-build        Skip building the project
  --category <names>  Run only specified categories (comma-separated)
                      Categories: Unit Tests, Component Tests, Integration Tests, Functional Tests
  --type <types>      Run only specified test types (comma-separated)  
                      Types: unit, component, integration, functional, e2e
  --help, -h          Show this help message

Examples:
  node test/unified-test-runner.js                    # Run all tests
  node test/unified-test-runner.js --type unit        # Run only unit tests
  node test/unified-test-runner.js --category "Component Tests"  # Run component tests
  node test/unified-test-runner.js --skip-build --verbose        # Skip build, verbose output
        `);
        process.exit(0);
    }
    
    const runner = new UnifiedTestRunner({ verbose: options.verbose });
    runner.runAllTests(options).then((success) => {
        process.exit(success ? 0 : 1);
    }).catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { UnifiedTestRunner };