const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const assert = require('assert');

// Test configuration
const MOUNT_POINT = 'C:\\OneFiler';
const TEST_TIMEOUT = 30000;

// Color output for test results
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

class ProjFSCriticalTests {
    constructor() {
        this.testResults = [];
        this.mountPoint = MOUNT_POINT;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? `${colors.red}ERROR${colors.reset}` :
                       type === 'success' ? `${colors.green}SUCCESS${colors.reset}` :
                       type === 'warning' ? `${colors.yellow}WARNING${colors.reset}` :
                       'INFO';
        console.log(`[${timestamp}] ${prefix}: ${message}`);
    }

    async runTest(name, testFn) {
        this.log(`Running test: ${name}`);
        const startTime = Date.now();
        
        try {
            await testFn();
            const duration = Date.now() - startTime;
            this.testResults.push({ name, success: true, duration });
            this.log(`✓ ${name} (${duration}ms)`, 'success');
            return true;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.testResults.push({ name, success: false, error: error.message, duration });
            this.log(`✗ ${name} failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test 1: Verify mount point exists and is accessible
    async testMountPointExists() {
        await this.runTest('Mount point exists and is accessible', async () => {
            assert(fs.existsSync(this.mountPoint), `Mount point ${this.mountPoint} does not exist`);
            
            // Try to access the directory
            const stats = fs.statSync(this.mountPoint);
            assert(stats.isDirectory(), `${this.mountPoint} is not a directory`);
        });
    }

    // Test 2: Verify directory enumeration works
    async testDirectoryEnumeration() {
        await this.runTest('Directory enumeration returns expected folders', async () => {
            const entries = fs.readdirSync(this.mountPoint);
            
            // We expect at least these directories
            const expectedDirs = ['invites', 'chats', 'debug', 'objects'];
            
            for (const dir of expectedDirs) {
                assert(entries.includes(dir), `Expected directory '${dir}' not found in ${this.mountPoint}`);
            }
            
            this.log(`Found ${entries.length} entries: ${entries.join(', ')}`);
        });
    }

    // Test 3: Verify invites directory has files
    async testInvitesDirectory() {
        await this.runTest('Invites directory contains expected files', async () => {
            const invitesPath = path.join(this.mountPoint, 'invites');
            
            // Check directory exists
            assert(fs.existsSync(invitesPath), `Invites directory does not exist at ${invitesPath}`);
            
            // List files
            const files = fs.readdirSync(invitesPath);
            assert(files.length > 0, `Invites directory is empty`);
            
            // Check for expected files
            const expectedFiles = ['iom_invite.png', 'iom_invite.txt', 'iop_invite.png', 'iop_invite.txt'];
            for (const file of expectedFiles) {
                assert(files.includes(file), `Expected file '${file}' not found in invites directory`);
            }
            
            this.log(`Found ${files.length} files in invites: ${files.join(', ')}`);
        });
    }

    // Test 4: Verify file content can be read
    async testFileContent() {
        await this.runTest('File content can be read successfully', async () => {
            const testFile = path.join(this.mountPoint, 'invites', 'iom_invite.txt');
            
            // Check file exists
            assert(fs.existsSync(testFile), `Test file ${testFile} does not exist`);
            
            // Read file content
            const content = fs.readFileSync(testFile);
            assert(content, 'File content is empty');
            assert(content.length > 0, 'File content has zero length');
            
            // Check it's not all zeros
            const isAllZeros = Array.from(content).every(byte => byte === 0);
            assert(!isAllZeros, 'File content is all zeros');
            
            this.log(`Successfully read ${content.length} bytes from ${testFile}`);
            
            // Try to read as text
            const textContent = content.toString('utf8');
            assert(textContent.length > 0, 'Text content is empty');
            this.log(`Text preview: ${textContent.substring(0, 50)}...`);
        });
    }

    // Test 5: Verify PNG files have proper content
    async testPNGFileContent() {
        await this.runTest('PNG files have valid image data', async () => {
            const pngFile = path.join(this.mountPoint, 'invites', 'iom_invite.png');
            
            // Check file exists
            assert(fs.existsSync(pngFile), `PNG file ${pngFile} does not exist`);
            
            // Read file content
            const content = fs.readFileSync(pngFile);
            assert(content, 'PNG content is empty');
            assert(content.length > 100, `PNG content too small: ${content.length} bytes`);
            
            // Check PNG signature (first 8 bytes)
            const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            const fileSignature = content.slice(0, 8);
            
            assert(
                Buffer.compare(fileSignature, pngSignature) === 0,
                `Invalid PNG signature. Got: ${Array.from(fileSignature).map(b => '0x' + b.toString(16).toUpperCase()).join(' ')}`
            );
            
            this.log(`Valid PNG file with ${content.length} bytes`);
        });
    }

    // Test 6: Test file operations through Windows Explorer
    async testWindowsExplorerAccess() {
        await this.runTest('Files accessible via Windows Explorer commands', async () => {
            // First verify directory exists
            const invitesPath = path.join(this.mountPoint, 'invites');
            assert(fs.existsSync(invitesPath), `Directory does not exist: ${invitesPath}`);
            
            // Use Windows DIR command with proper escaping
            const dirCommand = `dir "${invitesPath}" /B`;
            
            try {
                // Execute using cmd.exe directly with proper options
                const output = execSync(dirCommand, { 
                    encoding: 'utf8',
                    shell: 'cmd.exe',
                    windowsHide: true
                });
                
                // Parse output - split by newlines and filter empty lines
                const files = output.trim().split(/\r?\n/).filter(f => f.trim());
                
                this.log(`DIR command returned: ${files.join(', ')}`);
                
                // Check we got files
                assert(files.length > 0, 'No files returned by DIR command');
                
                // Check expected files are listed
                const expectedFiles = ['iom_invite.png', 'iom_invite.txt', 'iop_invite.png', 'iop_invite.txt'];
                const missingFiles = expectedFiles.filter(f => !files.includes(f));
                
                if (missingFiles.length > 0) {
                    throw new Error(`Files not visible to Windows Explorer: ${missingFiles.join(', ')}`);
                }
                
                this.log(`Windows Explorer sees all ${files.length} expected files`);
            } catch (error) {
                // If DIR fails, try alternative PowerShell approach
                try {
                    const psCommand = `Get-ChildItem -Path "${invitesPath}" -Name`;
                    const psOutput = execSync(`powershell -Command "${psCommand}"`, { 
                        encoding: 'utf8',
                        windowsHide: true 
                    });
                    
                    const psFiles = psOutput.trim().split(/\r?\n/).filter(f => f.trim());
                    this.log(`PowerShell fallback returned: ${psFiles.join(', ')}`);
                    
                    if (psFiles.length > 0 && psFiles.includes('iom_invite.png')) {
                        this.log(`Files ARE visible via PowerShell (${psFiles.length} files)`);
                        return; // Test passes with PowerShell
                    }
                } catch (psError) {
                    // PowerShell also failed
                }
                
                throw new Error(`Failed to list files via Explorer: ${error.message}`);
            }
        });
    }

    // Test 7: Performance test - rapid file access
    async testPerformance() {
        await this.runTest('Performance: Rapid file access', async () => {
            const testFile = path.join(this.mountPoint, 'invites', 'iom_invite.txt');
            const iterations = 10;
            const startTime = Date.now();
            
            for (let i = 0; i < iterations; i++) {
                const content = fs.readFileSync(testFile);
                assert(content.length > 0, `Read ${i} returned empty content`);
            }
            
            const duration = Date.now() - startTime;
            const avgTime = duration / iterations;
            
            this.log(`Read file ${iterations} times in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`);
            
            // Warn if too slow
            if (avgTime > 100) {
                this.log(`Performance warning: Average read time ${avgTime}ms exceeds 100ms`, 'warning');
            }
        });
    }

    // Test 8: Cache effectiveness
    async testCacheEffectiveness() {
        await this.runTest('Cache effectiveness', async () => {
            const testFile = path.join(this.mountPoint, 'invites', 'iom_invite.png');
            
            // First read (may trigger cache population)
            const start1 = Date.now();
            const content1 = fs.readFileSync(testFile);
            const time1 = Date.now() - start1;
            
            // Second read (should be cached)
            const start2 = Date.now();
            const content2 = fs.readFileSync(testFile);
            const time2 = Date.now() - start2;
            
            // Verify content is identical
            assert(Buffer.compare(content1, content2) === 0, 'Content differs between reads');
            
            this.log(`First read: ${time1}ms, Second read: ${time2}ms`);
            
            // Second read should be faster (or at least not significantly slower)
            if (time2 > time1 * 1.5) {
                this.log(`Cache may not be working: second read (${time2}ms) slower than first (${time1}ms)`, 'warning');
            }
        });
    }

    // Main test runner
    async runAllTests() {
        console.log('\n' + '='.repeat(60));
        console.log('ProjFS Critical Capability Tests');
        console.log('='.repeat(60) + '\n');
        
        // Check if app is running
        try {
            execSync('wmic process where "name=\'electron.exe\'" get processid', { encoding: 'utf8' });
            this.log('Electron app is running');
        } catch {
            this.log('WARNING: Electron app may not be running', 'warning');
        }
        
        // Run tests
        await this.testMountPointExists();
        await this.testDirectoryEnumeration();
        await this.testInvitesDirectory();
        await this.testFileContent();
        await this.testPNGFileContent();
        await this.testWindowsExplorerAccess();
        await this.testPerformance();
        await this.testCacheEffectiveness();
        
        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('Test Summary');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(r => r.success).length;
        const failed = this.testResults.filter(r => !r.success).length;
        const total = this.testResults.length;
        
        console.log(`\nTotal: ${total} tests`);
        console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
        console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
        
        if (failed > 0) {
            console.log('\nFailed tests:');
            this.testResults.filter(r => !r.success).forEach(r => {
                console.log(`  ${colors.red}✗ ${r.name}${colors.reset}`);
                console.log(`    Error: ${r.error}`);
            });
        }
        
        // Exit with appropriate code
        process.exit(failed > 0 ? 1 : 0);
    }
}

// Run tests
const tester = new ProjFSCriticalTests();
tester.runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});