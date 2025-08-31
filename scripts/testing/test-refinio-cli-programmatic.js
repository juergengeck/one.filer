#!/usr/bin/env node

/**
 * Programmatic test of one.filer using refinio.cli commands
 * This demonstrates how to use refinio.cli for automated testing
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// Test configuration
const TEST_MOUNT_POINT = '/tmp/one-filer-test-prog';
const TEST_PROFILE = 'test-profile';

// Colors for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
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

/**
 * Execute a refinio CLI command
 */
async function refinioCmd(command) {
    const fullCommand = `refinio ${command} --profile ${TEST_PROFILE}`;
    logTest(`Running: ${fullCommand}`);
    
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
 * Run all tests
 */
async function runTests() {
    log('\n========================================', 'blue');
    log('ONE.Filer Programmatic Test Suite', 'blue');
    log('Using refinio.cli for testing', 'blue');
    log('========================================\n', 'blue');

    let allTestsPassed = true;

    try {
        // Test 1: Check refinio.cli availability
        logTest('Checking refinio.cli installation...');
        const { success: cliAvailable } = await refinioCmd('--version');
        if (cliAvailable) {
            logSuccess('refinio.cli is available');
        } else {
            logError('refinio.cli not found');
            return false;
        }

        // Test 2: Test FUSE3 addon
        logTest('Testing FUSE3 N-API addon...');
        try {
            const fuse3Path = path.join(__dirname, 'packages/one.filer.linux/fuse3-napi/build/Release/fuse3_napi.node');
            if (fs.existsSync(fuse3Path)) {
                const fuse3 = require(fuse3Path);
                logSuccess(`FUSE3 addon loaded. Exports: ${Object.keys(fuse3).join(', ')}`);
            } else {
                logError('FUSE3 addon not found at expected path');
            }
        } catch (error) {
            logError(`FUSE3 addon failed: ${error.message}`);
        }

        // Test 3: Get initial status
        logTest('Getting initial filer status...');
        const { stdout: statusBefore, success: statusSuccess } = await refinioCmd('filer status');
        if (statusSuccess) {
            logSuccess('Status retrieved');
            const isMounted = statusBefore.includes('Mounted: Yes');
            log(`  Initial state: ${isMounted ? 'Mounted' : 'Not mounted'}`);
            
            // Unmount if already mounted
            if (isMounted) {
                logTest('Unmounting existing filesystem...');
                await refinioCmd('filer unmount');
            }
        }

        // Test 4: Mount filesystem
        logTest(`Mounting filesystem at ${TEST_MOUNT_POINT}...`);
        const { success: mountSuccess, stderr: mountError } = await refinioCmd(
            `filer mount --mount-point ${TEST_MOUNT_POINT} --iom-mode light`
        );
        if (mountSuccess) {
            logSuccess('Filesystem mounted');
        } else {
            logError(`Mount failed: ${mountError}`);
            allTestsPassed = false;
        }

        // Test 5: Verify mount
        if (mountSuccess) {
            logTest('Verifying mount point...');
            if (fs.existsSync(TEST_MOUNT_POINT)) {
                logSuccess(`Mount point exists: ${TEST_MOUNT_POINT}`);
                
                // Check for expected directories
                const expectedDirs = ['objects', 'profiles', 'chats', 'connections'];
                for (const dir of expectedDirs) {
                    const dirPath = path.join(TEST_MOUNT_POINT, dir);
                    if (fs.existsSync(dirPath)) {
                        logSuccess(`  ✓ Directory '${dir}' exists`);
                    } else {
                        logError(`  ✗ Directory '${dir}' not found`);
                        allTestsPassed = false;
                    }
                }
            } else {
                logError('Mount point does not exist');
                allTestsPassed = false;
            }
        }

        // Test 6: List filesystems
        logTest('Listing mounted filesystems...');
        const { stdout: fsList, success: listSuccess } = await refinioCmd('filer list-fs');
        if (listSuccess) {
            logSuccess('Filesystems listed');
            console.log(fsList.split('\n').slice(0, 5).join('\n'));
        }

        // Test 7: Get filesystem info
        logTest('Getting filesystem info for /objects...');
        const { success: infoSuccess } = await refinioCmd('filer fs-info /objects');
        if (infoSuccess) {
            logSuccess('Filesystem info retrieved');
        }

        // Test 8: Configuration management
        logTest('Testing configuration...');
        const { stdout: config, success: configSuccess } = await refinioCmd('filer config');
        if (configSuccess) {
            logSuccess('Configuration retrieved');
        }

        // Test 9: Clear cache
        logTest('Clearing cache...');
        const { success: cacheSuccess } = await refinioCmd('filer clear-cache');
        if (cacheSuccess) {
            logSuccess('Cache cleared');
        }

        // Test 10: Refresh filesystem
        logTest('Refreshing filesystem...');
        const { success: refreshSuccess } = await refinioCmd('filer refresh');
        if (refreshSuccess) {
            logSuccess('Filesystem refreshed');
        }

        // Test 11: Unmount filesystem
        logTest('Unmounting filesystem...');
        const { success: unmountSuccess } = await refinioCmd('filer unmount');
        if (unmountSuccess) {
            logSuccess('Filesystem unmounted');
        } else {
            allTestsPassed = false;
        }

        // Test 12: Verify unmount
        logTest('Verifying unmount...');
        const { stdout: statusAfter } = await refinioCmd('filer status');
        if (statusAfter.includes('Mounted: No') || statusAfter.includes('not mounted')) {
            logSuccess('Filesystem successfully unmounted');
        } else {
            logError('Filesystem still appears to be mounted');
            allTestsPassed = false;
        }

    } catch (error) {
        logError(`Test suite failed: ${error.message}`);
        console.error(error);
        allTestsPassed = false;
    }

    // Clean up
    try {
        if (fs.existsSync(TEST_MOUNT_POINT)) {
            fs.rmSync(TEST_MOUNT_POINT, { recursive: true, force: true });
            logSuccess('Cleaned up test mount point');
        }
    } catch (error) {
        logError(`Cleanup failed: ${error.message}`);
    }

    // Final report
    log('\n========================================', 'blue');
    if (allTestsPassed) {
        log('✅ All tests passed!', 'green');
    } else {
        log('❌ Some tests failed', 'red');
    }
    log('========================================\n', 'blue');

    return allTestsPassed;
}

// Run tests and exit with appropriate code
runTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
});