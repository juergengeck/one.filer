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
export declare class RealTestRunner {
    private mountPoint;
    runRealTests(): Promise<RealTestSuite[]>;
    private testProjFSMount;
    private testDirectoryOperations;
    private testFileOperations;
    private testCacheSystem;
    private checkProviderStatus;
}
//# sourceMappingURL=real-test-runner.d.ts.map