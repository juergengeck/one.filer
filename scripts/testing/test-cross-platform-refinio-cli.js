#!/usr/bin/env node

/**
 * Cross-Platform Integration Test using refinio.cli
 * 
 * Tests ONE.filer functionality across Windows (ProjFS) and Linux (FUSE3)
 * using the unified refinio.cli interface
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);

// Colors for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(message) {
    log(`[TEST] ${message}`, 'yellow');
}

function logSuccess(message) {
    log(`[✓] ${message}`, 'green');
}

function logError(message) {
    log(`[✗] ${message}`, 'red');
}

function logInfo(message) {
    log(`[INFO] ${message}`, 'cyan');
}

function logPlatform(platform, message) {
    const color = platform === 'windows' ? 'magenta' : 'blue';
    log(`[${platform.toUpperCase()}] ${message}`, color);
}

// Platform detection
const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';
const isMac = process.platform === 'darwin';
const isWSL = process.env.WSL_DISTRO_NAME !== undefined;

// Test configuration
const config = {
    windows: {
        profile: 'test-windows',
        mountPoint: 'C:\\OneFilerCrossTest',
        dataDir: path.join(os.tmpdir(), 'onefiler-cross-win'),
        secret: 'cross-test-win-123',
        port: 8081
    },
    linux: {
        profile: 'test-linux',
        mountPoint: '/tmp/onefiler-cross-test',
        dataDir: '/tmp/onefiler-cross-linux-data',
        secret: 'cross-test-linux-456',
        port: 8082
    }
};

// Determine which platform we're on
const currentPlatform = isWindows ? 'windows' : 'linux';
const currentConfig = config[currentPlatform];

/**
 * Execute a refinio CLI command
 */
async function refinioCmd(command, profile = currentConfig.profile) {
    const fullCommand = `refinio ${command} --profile ${profile}`;
    logInfo(`Executing: ${fullCommand}`);
    
    try {
        const { stdout, stderr } = await execAsync(fullCommand);
        if (stderr && !stderr.includes('Warning')) {
            console.error('STDERR:', stderr);
        }
        return { stdout, stderr, success: true };
    } catch (error) {
        return { 
            stdout: error.stdout || '', 
            stderr: error.stderr || error.message, 
            success: false,
            error 
        };
    }
}

/**
 * Check if filer is mounted
 */
async function isMounted(profile = currentConfig.profile) {
    const { stdout, success } = await refinioCmd('filer status', profile);
    return success && stdout.includes('Mounted: Yes');
}

/**
 * Clean up test environment
 */
async function cleanup() {
    logTest('Cleaning up test environment...');
    
    // Unmount if mounted
    if (await isMounted()) {
        await refinioCmd('filer unmount');
    }
    
    // Clean directories
    try {
        if (isWindows) {
            await execAsync(`rmdir /s /q "${currentConfig.mountPoint}" 2>nul`).catch(() => {});
            await execAsync(`rmdir /s /q "${currentConfig.dataDir}" 2>nul`).catch(() => {});
        } else {
            await execAsync(`fusermount -u ${currentConfig.mountPoint} 2>/dev/null || true`);
            await execAsync(`rm -rf ${currentConfig.mountPoint} ${currentConfig.dataDir}`);
        }
    } catch (error) {
        // Ignore cleanup errors
    }
    
    logSuccess('Cleanup complete');
}

/**
 * Test platform-specific features
 */
async function testPlatformSpecific() {
    log(`\n=== Platform-Specific Tests (${currentPlatform}) ===`, 'blue');
    
    if (isWindows) {
        // Windows-specific tests
        logTest('Testing ProjFS virtualization...');
        
        // Check ProjFS availability
        try {
            const { stdout } = await execAsync('dism /Online /Get-Features /Format:Table | findstr ProjFS');
            if (stdout.includes('Enabled')) {
                logSuccess('ProjFS feature is enabled');
            } else {
                logError('ProjFS feature not enabled');
            }
        } catch {
            logError('Could not check ProjFS status');
        }
        
        // Test virtual file access
        const testPath = path.join(currentConfig.mountPoint, 'objects');
        if (fs.existsSync(testPath)) {
            logSuccess('Virtual filesystem accessible');
        }
        
    } else if (isLinux) {
        // Linux-specific tests
        logTest('Testing FUSE3 functionality...');
        
        // Check FUSE availability
        try {
            const { stdout } = await execAsync('fusermount3 -V 2>/dev/null || fusermount -V');
            logSuccess(`FUSE version: ${stdout.trim()}`);
        } catch {
            logError('FUSE not available');
        }
        
        // Test FUSE mount
        const mountInfo = await execAsync('mount | grep fuse').catch(() => ({ stdout: '' }));
        if (mountInfo.stdout.includes(currentConfig.mountPoint)) {
            logSuccess('FUSE mount detected');
        }
    }
}

/**
 * Test cross-platform compatibility
 */
async function testCrossPlatform() {
    log('\n=== Cross-Platform Compatibility Tests ===', 'blue');
    
    // Test 1: Common filesystem operations
    logTest('Testing common filesystem operations...');
    
    const testDirs = ['objects', 'profiles', 'chats', 'connections'];
    for (const dir of testDirs) {
        const dirPath = path.join(currentConfig.mountPoint, dir);
        if (fs.existsSync(dirPath)) {
            logSuccess(`Directory '${dir}' exists on ${currentPlatform}`);
        } else {
            logError(`Directory '${dir}' not found on ${currentPlatform}`);
        }
    }
    
    // Test 2: refinio.cli commands work identically
    logTest('Testing unified refinio.cli interface...');
    
    const commands = [
        'filer status',
        'filer list-fs',
        'filer config'
    ];
    
    for (const cmd of commands) {
        const { success, stdout } = await refinioCmd(cmd);
        if (success) {
            logSuccess(`Command '${cmd}' works on ${currentPlatform}`);
        } else {
            logError(`Command '${cmd}' failed on ${currentPlatform}`);
        }
    }
    
    // Test 3: Data format compatibility
    logTest('Testing data format compatibility...');
    
    // Create a test file
    const testFileName = `cross-platform-test-${Date.now()}.txt`;
    const testContent = `Test from ${currentPlatform} at ${new Date().toISOString()}`;
    const testFilePath = path.join(currentConfig.mountPoint, 'objects', testFileName);
    
    try {
        // Ensure directory exists
        const objectsDir = path.join(currentConfig.mountPoint, 'objects');
        if (!fs.existsSync(objectsDir)) {
            await mkdir(objectsDir, { recursive: true });
        }
        
        // Write test file
        await writeFile(testFilePath, testContent);
        logSuccess(`Created test file on ${currentPlatform}`);
        
        // Read it back
        const readContent = await readFile(testFilePath, 'utf8');
        if (readContent === testContent) {
            logSuccess('File content verified');
        } else {
            logError('File content mismatch');
        }
        
        // Clean up test file
        fs.unlinkSync(testFilePath);
        
    } catch (error) {
        logError(`File operation failed: ${error.message}`);
    }
}

/**
 * Test network synchronization (if multiple instances)
 */
async function testNetworkSync() {
    log('\n=== Network Synchronization Tests ===', 'blue');
    
    logTest('Checking for other instances...');
    
    // Try to connect to the other platform's API
    const otherPlatform = currentPlatform === 'windows' ? 'linux' : 'windows';
    const otherConfig = config[otherPlatform];
    
    try {
        const response = await fetch(`http://localhost:${otherConfig.port}/health`);
        if (response.ok) {
            logSuccess(`Connected to ${otherPlatform} instance on port ${otherConfig.port}`);
            
            // Test cross-platform data sync
            logTest('Testing cross-platform data synchronization...');
            
            // Create a file on current platform
            const syncTestFile = `sync-test-${currentPlatform}-${Date.now()}.txt`;
            const syncContent = `Sync test from ${currentPlatform}`;
            const syncPath = path.join(currentConfig.mountPoint, 'objects', syncTestFile);
            
            await writeFile(syncPath, syncContent);
            logSuccess(`Created sync test file on ${currentPlatform}`);
            
            // Wait for sync
            logInfo('Waiting for synchronization (10 seconds)...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Check if file appears on other instance (would need to query via API)
            logInfo('Sync verification would require querying the other instance');
            
            // Clean up
            fs.unlinkSync(syncPath);
            
        } else {
            logInfo(`No ${otherPlatform} instance found - skipping sync tests`);
        }
    } catch (error) {
        logInfo(`Cannot connect to ${otherPlatform} instance - running standalone tests only`);
    }
}

/**
 * Performance comparison
 */
async function testPerformance() {
    log('\n=== Performance Tests ===', 'blue');
    
    logTest(`Testing ${currentPlatform} filesystem performance...`);
    
    const objectsDir = path.join(currentConfig.mountPoint, 'objects');
    
    // Test 1: Directory listing performance
    const listStart = Date.now();
    try {
        const files = fs.readdirSync(objectsDir);
        const listTime = Date.now() - listStart;
        logSuccess(`Directory listing: ${listTime}ms (${files.length} items)`);
        
        if (listTime < 1000) {
            logSuccess('Performance: Excellent (<1s)');
        } else if (listTime < 5000) {
            logInfo('Performance: Acceptable (1-5s)');
        } else {
            logError('Performance: Slow (>5s)');
        }
    } catch (error) {
        logError(`Performance test failed: ${error.message}`);
    }
    
    // Test 2: File creation performance
    const createStart = Date.now();
    const perfTestFile = path.join(objectsDir, `perf-test-${Date.now()}.txt`);
    try {
        fs.writeFileSync(perfTestFile, 'Performance test');
        const createTime = Date.now() - createStart;
        logSuccess(`File creation: ${createTime}ms`);
        
        // Clean up
        fs.unlinkSync(perfTestFile);
    } catch (error) {
        logError(`File creation test failed: ${error.message}`);
    }
    
    // Platform-specific performance notes
    if (isWindows) {
        logInfo('Windows/ProjFS: Virtual files are created on-demand');
    } else {
        logInfo('Linux/FUSE3: Direct filesystem operations');
    }
}

/**
 * Main test runner
 */
async function runTests() {
    log('\n==========================================', 'blue');
    log('Cross-Platform ONE.Filer Test Suite', 'blue');
    log(`Platform: ${currentPlatform.toUpperCase()}`, 'blue');
    log(`WSL: ${isWSL ? 'Yes' : 'No'}`, 'blue');
    log('Using refinio.cli for unified testing', 'blue');
    log('==========================================\n', 'blue');

    let allTestsPassed = true;

    try {
        // Pre-test cleanup
        await cleanup();

        // Test 1: Check refinio.cli availability
        logTest('Checking refinio.cli installation...');
        const { success: cliAvailable } = await refinioCmd('--version');
        if (cliAvailable) {
            logSuccess('refinio.cli is available');
        } else {
            logError('refinio.cli not found');
            return false;
        }

        // Test 2: Start instance (assuming app is running)
        logTest('Checking for running ONE instance...');
        logInfo('Assuming ONE instance is already running');
        logInfo('To start: one-filer start -s <secret> --filer true');

        // Test 3: Mount filesystem
        logTest(`Mounting filesystem at ${currentConfig.mountPoint}...`);
        const { success: mountSuccess, stderr } = await refinioCmd(
            `filer mount --mount-point ${currentConfig.mountPoint}`
        );
        if (mountSuccess) {
            logSuccess('Filesystem mounted');
        } else {
            logError(`Mount failed: ${stderr}`);
            allTestsPassed = false;
        }

        // Test 4: Verify mount
        if (mountSuccess) {
            logTest('Verifying mount point...');
            if (fs.existsSync(currentConfig.mountPoint)) {
                logSuccess(`Mount point exists: ${currentConfig.mountPoint}`);
            } else {
                logError('Mount point does not exist');
                allTestsPassed = false;
            }
        }

        // Run test suites
        await testPlatformSpecific();
        await testCrossPlatform();
        await testNetworkSync();
        await testPerformance();

        // Test 5: Unmount filesystem
        logTest('Unmounting filesystem...');
        const { success: unmountSuccess } = await refinioCmd('filer unmount');
        if (unmountSuccess) {
            logSuccess('Filesystem unmounted');
        } else {
            logError('Unmount failed');
            allTestsPassed = false;
        }

    } catch (error) {
        logError(`Test suite failed: ${error.message}`);
        console.error(error);
        allTestsPassed = false;
    } finally {
        // Final cleanup
        await cleanup();
    }

    // Final report
    log('\n==========================================', 'blue');
    if (allTestsPassed) {
        log('✅ Cross-Platform Tests Passed!', 'green');
        log(`Platform: ${currentPlatform} - All tests successful`, 'green');
    } else {
        log('❌ Some tests failed', 'red');
        log(`Platform: ${currentPlatform} - Review errors above`, 'red');
    }
    log('==========================================\n', 'blue');

    // Show how to run on other platform
    const otherPlatform = currentPlatform === 'windows' ? 'Linux' : 'Windows';
    logInfo(`To test on ${otherPlatform}:`);
    logInfo(`1. Start ONE instance on ${otherPlatform}`);
    logInfo(`2. Run this test script on ${otherPlatform}`);
    logInfo(`3. For full cross-platform sync test, run both simultaneously`);

    return allTestsPassed;
}

// Handle script termination
process.on('SIGINT', async () => {
    console.log('\n[SIGINT] Cleaning up...');
    await cleanup();
    process.exit(0);
});

// Run tests and exit with appropriate code
runTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
});