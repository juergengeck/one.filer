/**
 * Integration test for FUSE (Linux) and ProjFS (Windows) via ONE connection
 * 
 * This test:
 * 1. Starts a FUSE mount in WSL/Linux
 * 2. Starts a ProjFS mount in Windows
 * 3. Connects both via ONE protocol
 * 4. Tests data exchange between them
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(70));
console.log('ONE Filer Integration Test: FUSE (Linux) <-> ProjFS (Windows)');
console.log('='.repeat(70));

// Configuration
const config = {
    fuse: {
        mountPoint: '/tmp/one-filer-fuse',
        port: 17896
    },
    projfs: {
        mountPoint: 'C:\\OneFilerTest',
        port: 17897
    },
    connectionUrl: 'https://leute.refinio.one'
};

// Test data to exchange
const testData = {
    files: [
        { name: 'test-from-windows.txt', content: 'This file was created in Windows ProjFS' },
        { name: 'test-from-linux.txt', content: 'This file was created in Linux FUSE' }
    ],
    directories: [
        { name: 'windows-folder' },
        { name: 'linux-folder' }
    ]
};

/**
 * Start FUSE mount in WSL/Linux
 */
function startFuseMount() {
    return new Promise((resolve, reject) => {
        console.log('\n[1/4] Starting FUSE mount in WSL/Linux...');
        console.log(`      Mount point: ${config.fuse.mountPoint}`);
        console.log(`      API port: ${config.fuse.port}`);
        
        const fuseProcess = spawn('wsl', [
            '-d', 'Ubuntu',
            'bash', '-c',
            `cd /mnt/c/Users/juerg/source/one.filer && node wsl-fuse-server.mjs`
        ], {
            env: {
                ...process.env,
                FUSE_MOUNT_POINT: config.fuse.mountPoint,
                ONE_API_PORT: config.fuse.port
            }
        });
        
        fuseProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[FUSE] ${output.trim()}`);
            if (output.includes('FUSE filesystem mounted')) {
                resolve(fuseProcess);
            }
        });
        
        fuseProcess.stderr.on('data', (data) => {
            console.error(`[FUSE ERROR] ${data.toString().trim()}`);
        });
        
        fuseProcess.on('error', reject);
        
        // Timeout if mount doesn't succeed
        setTimeout(() => {
            reject(new Error('FUSE mount timeout'));
        }, 30000);
    });
}

/**
 * Start ProjFS mount in Windows
 */
function startProjFSMount() {
    return new Promise((resolve, reject) => {
        console.log('\n[2/4] Starting ProjFS mount in Windows...');
        console.log(`      Mount point: ${config.projfs.mountPoint}`);
        console.log(`      API port: ${config.projfs.port}`);
        
        // Ensure mount directory exists
        if (!fs.existsSync(config.projfs.mountPoint)) {
            fs.mkdirSync(config.projfs.mountPoint, { recursive: true });
        }
        
        const projfsProcess = spawn('node', [
            'run-projfs-test.js'
        ], {
            env: {
                ...process.env,
                PROJFS_MOUNT_POINT: config.projfs.mountPoint,
                ONE_API_PORT: config.projfs.port
            },
            cwd: __dirname
        });
        
        projfsProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[ProjFS] ${output.trim()}`);
            if (output.includes('ProjFS provider started')) {
                resolve(projfsProcess);
            }
        });
        
        projfsProcess.stderr.on('data', (data) => {
            console.error(`[ProjFS ERROR] ${data.toString().trim()}`);
        });
        
        projfsProcess.on('error', reject);
        
        // Timeout if mount doesn't succeed
        setTimeout(() => {
            reject(new Error('ProjFS mount timeout'));
        }, 30000);
    });
}

/**
 * Test data exchange between mounts
 */
async function testDataExchange() {
    console.log('\n[3/4] Testing data exchange...');
    
    const tests = [
        {
            name: 'Write file in Windows, read from Linux',
            action: async () => {
                const filePath = path.join(config.projfs.mountPoint, testData.files[0].name);
                fs.writeFileSync(filePath, testData.files[0].content);
                console.log(`      ✓ Wrote file: ${filePath}`);
                
                // Wait for sync
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Check if visible in Linux
                return new Promise((resolve, reject) => {
                    const checkProcess = spawn('wsl', [
                        '-d', 'Ubuntu',
                        'bash', '-c',
                        `cat ${config.fuse.mountPoint}/${testData.files[0].name}`
                    ]);
                    
                    checkProcess.stdout.on('data', (data) => {
                        if (data.toString().includes(testData.files[0].content)) {
                            console.log(`      ✓ File visible in Linux FUSE mount`);
                            resolve(true);
                        }
                    });
                    
                    checkProcess.on('error', reject);
                    checkProcess.on('exit', (code) => {
                        if (code !== 0) reject(new Error('File not found in Linux'));
                    });
                });
            }
        },
        {
            name: 'Write file in Linux, read from Windows',
            action: async () => {
                return new Promise((resolve, reject) => {
                    const writeProcess = spawn('wsl', [
                        '-d', 'Ubuntu',
                        'bash', '-c',
                        `echo "${testData.files[1].content}" > ${config.fuse.mountPoint}/${testData.files[1].name}`
                    ]);
                    
                    writeProcess.on('exit', async (code) => {
                        if (code === 0) {
                            console.log(`      ✓ Wrote file in Linux`);
                            
                            // Wait for sync
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            // Check if visible in Windows
                            const windowsPath = path.join(config.projfs.mountPoint, testData.files[1].name);
                            if (fs.existsSync(windowsPath)) {
                                const content = fs.readFileSync(windowsPath, 'utf8');
                                if (content.includes(testData.files[1].content)) {
                                    console.log(`      ✓ File visible in Windows ProjFS mount`);
                                    resolve(true);
                                } else {
                                    reject(new Error('File content mismatch'));
                                }
                            } else {
                                reject(new Error('File not found in Windows'));
                            }
                        } else {
                            reject(new Error('Failed to write file in Linux'));
                        }
                    });
                });
            }
        }
    ];
    
    for (const test of tests) {
        console.log(`\n   Running: ${test.name}`);
        try {
            await test.action();
            console.log(`   ✅ Test passed`);
        } catch (err) {
            console.error(`   ❌ Test failed: ${err.message}`);
            throw err;
        }
    }
}

/**
 * Cleanup function
 */
function cleanup(fuseProcess, projfsProcess) {
    console.log('\n[4/4] Cleaning up...');
    
    if (fuseProcess) {
        fuseProcess.kill();
        console.log('      ✓ Stopped FUSE mount');
    }
    
    if (projfsProcess) {
        projfsProcess.kill();
        console.log('      ✓ Stopped ProjFS mount');
    }
    
    // Unmount FUSE
    spawn('wsl', [
        '-d', 'Ubuntu',
        'bash', '-c',
        `fusermount -u ${config.fuse.mountPoint} 2>/dev/null`
    ]);
    
    // Clean up test directory
    if (fs.existsSync(config.projfs.mountPoint)) {
        fs.rmSync(config.projfs.mountPoint, { recursive: true, force: true });
    }
    
    console.log('      ✓ Cleanup complete');
}

/**
 * Main test runner
 */
async function runIntegrationTest() {
    let fuseProcess = null;
    let projfsProcess = null;
    
    try {
        // Start both mounts
        fuseProcess = await startFuseMount();
        projfsProcess = await startProjFSMount();
        
        // Wait for mounts to stabilize
        console.log('\n   Waiting for mounts to stabilize...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Run tests
        await testDataExchange();
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ INTEGRATION TEST PASSED');
        console.log('='.repeat(70));
        
    } catch (err) {
        console.error('\n' + '='.repeat(70));
        console.error('❌ INTEGRATION TEST FAILED');
        console.error(err.message);
        console.error('='.repeat(70));
        process.exitCode = 1;
        
    } finally {
        cleanup(fuseProcess, projfsProcess);
    }
}

// Check prerequisites
console.log('\nChecking prerequisites...');
console.log('  - WSL: ' + (process.platform === 'win32' ? '✓' : '✗'));
console.log('  - Node.js: ✓');

// Run the test
runIntegrationTest();