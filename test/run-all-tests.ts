#!/usr/bin/env node

/**
 * Test Automation Pipeline
 * 
 * Runs all component and integration tests for ONE.filer
 * across different platforms and configurations.
 */

import * as path from 'path';
import { spawn } from 'child_process';
import * as fs from 'fs';

interface TestSuite {
    name: string;
    file: string;
    platform: 'windows' | 'linux' | 'all';
    type: 'component' | 'integration';
    timeout?: number;
}

const TEST_SUITES: TestSuite[] = [
    {
        name: 'Linux FUSE3 Component Tests',
        file: './fuse-linux.test.js',
        platform: 'linux',
        type: 'component',
        timeout: 60000
    },
    {
        name: 'Windows ProjFS Component Tests',
        file: './projfs-windows.test.js',
        platform: 'windows',
        type: 'component',
        timeout: 60000
    },
    {
        name: 'Cross-Platform Integration Tests',
        file: './cross-platform-integration.test.js',
        platform: 'all',
        type: 'integration',
        timeout: 120000
    }
];

interface TestResult {
    suite: string;
    passed: boolean;
    duration: number;
    error?: string;
    skipped?: boolean;
}

class TestRunner {
    private results: TestResult[] = [];
    private currentPlatform: string;
    
    constructor() {
        this.currentPlatform = process.platform;
    }
    
    async runAllTests(): Promise<void> {
        console.log('🚀 ONE.filer Test Automation Pipeline');
        console.log('=====================================');
        console.log(`Platform: ${this.currentPlatform}`);
        console.log(`Node Version: ${process.version}`);
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log('');
        
        // Compile TypeScript tests if needed
        await this.compileTests();
        
        // Run each test suite
        for (const suite of TEST_SUITES) {
            if (this.shouldRunSuite(suite)) {
                await this.runTestSuite(suite);
            } else {
                this.results.push({
                    suite: suite.name,
                    passed: true,
                    duration: 0,
                    skipped: true
                });
                console.log(`⏭️  Skipping ${suite.name} (not applicable for ${this.currentPlatform})`);
            }
        }
        
        // Generate report
        this.generateReport();
        
        // Exit with appropriate code
        const failed = this.results.filter(r => !r.passed && !r.skipped).length;
        process.exit(failed > 0 ? 1 : 0);
    }
    
    private shouldRunSuite(suite: TestSuite): boolean {
        if (suite.platform === 'all') return true;
        if (suite.platform === 'windows' && this.currentPlatform === 'win32') return true;
        if (suite.platform === 'linux' && this.currentPlatform === 'linux') return true;
        return false;
    }
    
    private async compileTests(): Promise<void> {
        console.log('📦 Compiling TypeScript tests...');
        
        return new Promise((resolve, reject) => {
            const tsc = spawn('npx', ['tsc', '--project', 'test/tsconfig.json'], {
                stdio: 'inherit',
                shell: true
            });
            
            tsc.on('exit', (code) => {
                if (code === 0) {
                    console.log('✅ Tests compiled successfully\n');
                    resolve();
                } else {
                    console.error('❌ Test compilation failed');
                    reject(new Error('TypeScript compilation failed'));
                }
            });
            
            tsc.on('error', reject);
        });
    }
    
    private async runTestSuite(suite: TestSuite): Promise<void> {
        console.log(`\n🧪 Running ${suite.name}`);
        console.log('-'.repeat(50));
        
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const mocha = spawn('npx', [
                'mocha',
                suite.file,
                '--timeout', suite.timeout?.toString() || '60000',
                '--reporter', 'spec',
                '--colors'
            ], {
                cwd: path.join(process.cwd(), 'test'),
                stdio: 'inherit',
                shell: true
            });
            
            // Progress reporting with timeout warnings
            const timeoutMs = suite.timeout || 60000;
            const warningTime = Math.max(timeoutMs * 0.75, timeoutMs - 30000); // 75% or 30s before timeout
            
            const warningTimer = setTimeout(() => {
                if (!mocha.killed) {
                    console.log(`⚠️  ${suite.name} is taking longer than expected (${(warningTime / 1000).toFixed(0)}s elapsed)...`);
                    console.log(`   This test suite has a ${(timeoutMs / 1000).toFixed(0)}s timeout`);
                }
            }, warningTime);
            
            mocha.on('exit', (code) => {
                clearTimeout(warningTimer);
                const duration = Date.now() - startTime;
                
                this.results.push({
                    suite: suite.name,
                    passed: code === 0,
                    duration: duration
                });
                
                if (code === 0) {
                    console.log(`\n✅ ${suite.name} completed successfully (${(duration / 1000).toFixed(1)}s)`);
                } else {
                    console.log(`\n❌ ${suite.name} failed (${(duration / 1000).toFixed(1)}s)`);
                }
                
                resolve();
            });
            
            mocha.on('error', (error) => {
                clearTimeout(warningTimer);
                this.results.push({
                    suite: suite.name,
                    passed: false,
                    duration: Date.now() - startTime,
                    error: error.message
                });
                console.error(`❌ ${suite.name} error: ${error.message}`);
                resolve();
            });
            
            // Timeout handler with clear messaging
            const timeoutTimer = setTimeout(() => {
                clearTimeout(warningTimer);
                if (!mocha.killed) {
                    mocha.kill();
                    this.results.push({
                        suite: suite.name,
                        passed: false,
                        duration: timeoutMs,
                        error: 'Test suite timeout'
                    });
                    console.error(`\n❌ ${suite.name} timed out after ${(timeoutMs / 1000).toFixed(0)}s`);
                    console.error(`   Consider increasing the timeout if tests need more time`);
                }
                resolve();
            }, timeoutMs + 10000); // Add 10s buffer
        });
    }
    
    private generateReport(): void {
        console.log('\n');
        console.log('='.repeat(60));
        console.log('📊 Test Results Summary');
        console.log('='.repeat(60));
        
        const total = this.results.length;
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed && !r.skipped).length;
        const skipped = this.results.filter(r => r.skipped).length;
        
        console.log(`Total Suites: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️  Skipped: ${skipped}`);
        console.log('');
        
        // Detailed results
        console.log('Detailed Results:');
        console.log('-----------------');
        
        for (const result of this.results) {
            const status = result.skipped ? '⏭️' : (result.passed ? '✅' : '❌');
            const duration = result.skipped ? 'N/A' : `${(result.duration / 1000).toFixed(1)}s`;
            
            console.log(`${status} ${result.suite}`);
            console.log(`   Duration: ${duration}`);
            
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        }
        
        console.log('');
        
        // Save JSON report
        const reportPath = path.join(process.cwd(), 'test-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            platform: this.currentPlatform,
            nodeVersion: process.version,
            results: this.results,
            summary: {
                total,
                passed,
                failed,
                skipped
            }
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Detailed report saved to: ${reportPath}`);
        
        // Overall result
        console.log('');
        if (failed === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log(`⚠️  ${failed} test suite(s) failed`);
        }
    }
}

// Main execution
if (require.main === module) {
    const runner = new TestRunner();
    runner.runAllTests().catch((error) => {
        console.error('Fatal error running tests:', error);
        process.exit(1);
    });
}

export { TestRunner };