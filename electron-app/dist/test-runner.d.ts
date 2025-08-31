export interface TestResult {
    suite: string;
    test: string;
    status: 'pass' | 'fail' | 'skip';
    error?: string;
    duration?: number;
}
export interface TestSuiteResult {
    name: string;
    tests: TestResult[];
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
}
export declare class TestRunner {
    private testSuites;
    runAllTests(): Promise<TestSuiteResult[]>;
    runTestSuite(suite: {
        name: string;
        files: string[];
    }): Promise<TestSuiteResult>;
    private runTestFile;
    runSystemDiagnostics(): Promise<any>;
    private getDirectorySize;
}
//# sourceMappingURL=test-runner.d.ts.map