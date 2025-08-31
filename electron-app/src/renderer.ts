interface LoginFormElements extends HTMLFormElement {
  secret: HTMLInputElement;
  configPath: HTMLInputElement;
}

const loginForm = document.getElementById('loginForm') as LoginFormElements;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const connectedView = document.getElementById('connectedView') as HTMLDivElement;
const loginBtn = document.getElementById('loginBtn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
const testBtn = document.getElementById('testBtn') as HTMLButtonElement;
const wslStatusSpan = document.getElementById('wslStatus') as HTMLSpanElement;
const replicantStatusSpan = document.getElementById('replicantStatus') as HTMLSpanElement;

// Test view elements
const testView = document.getElementById('testView') as HTMLDivElement;
const runAllTestsBtn = document.getElementById('runAllTestsBtn') as HTMLButtonElement;
const runQuickTestsBtn = document.getElementById('runQuickTestsBtn') as HTMLButtonElement;
const backToMainBtn = document.getElementById('backToMainBtn') as HTMLButtonElement;
const testProgress = document.getElementById('testProgress') as HTMLDivElement;
const progressFill = document.getElementById('progressFill') as HTMLDivElement;
const progressText = document.getElementById('progressText') as HTMLDivElement;
const testSummary = document.getElementById('testSummary') as HTMLDivElement;
const testSuites = document.getElementById('testSuites') as HTMLDivElement;
const totalTests = document.getElementById('totalTests') as HTMLSpanElement;
const passedTests = document.getElementById('passedTests') as HTMLSpanElement;
const failedTests = document.getElementById('failedTests') as HTMLSpanElement;
const testDuration = document.getElementById('testDuration') as HTMLSpanElement;

let isConnected = false;
let statusCheckInterval: NodeJS.Timeout | null = null;

function showStatus(message: string, isError: boolean = false): void {
  statusDiv.className = isError ? 'status error' : 'status success';
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';
}

function hideStatus(): void {
  statusDiv.className = 'status';
  statusDiv.textContent = '';
  statusDiv.style.display = 'none';
}

// Check and update status indicators
async function updateStatus(): Promise<void> {
  try {
    // Check WSL status
    const wslStatus = await window.electronAPI.checkWslStatus();
    if (!wslStatus.installed) {
      wslStatusSpan.textContent = 'Not Installed';
      wslStatusSpan.className = 'status-value error';
    } else if (wslStatus.running) {
      wslStatusSpan.textContent = 'Running';
      wslStatusSpan.className = 'status-value success';
    } else {
      wslStatusSpan.textContent = 'Stopped';
      wslStatusSpan.className = 'status-value warning';
    }
    
    // Check replicant status
    const replicantStatus = await window.electronAPI.checkReplicantStatus();
    if (replicantStatus.running) {
      replicantStatusSpan.textContent = `Running (PID: ${replicantStatus.pid})`;
      replicantStatusSpan.className = 'status-value success';
    } else {
      replicantStatusSpan.textContent = 'Stopped';
      replicantStatusSpan.className = 'status-value error';
    }
  } catch (error) {
    console.error('Error checking status:', error);
  }
}

// Start periodic status updates
function startStatusUpdates(): void {
  updateStatus();
  statusCheckInterval = setInterval(updateStatus, 2000);
}

// Stop periodic status updates
function stopStatusUpdates(): void {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
}

loginForm.addEventListener('submit', async (e: Event) => {
  e.preventDefault();
  
  const secret = loginForm.secret.value;
  const configPath = loginForm.configPath.value.trim() || undefined;
  
  // Validate inputs
  if (!secret) {
    showStatus('Please enter your password', true);
    return;
  }
  
  // Check WSL status first
  const wslStatus = await window.electronAPI.checkWslStatus();
  if (!wslStatus.installed) {
    showStatus('WSL is not installed. Please install WSL first.', true);
    return;
  }
  
  if (!wslStatus.running) {
    showStatus('Starting WSL...', false);
    const startResult = await window.electronAPI.startWsl();
    if (!startResult.success) {
      showStatus(startResult.message || 'Failed to start WSL', true);
      return;
    }
  }
  
  // Disable form
  loginBtn.disabled = true;
  loginBtn.textContent = 'Starting...';
  hideStatus();
  
  try {
    const result = await window.electronAPI.login({
      secret,
      configPath
    });
    
    if (result.success) {
      // Show success
      showStatus(result.message, false);
      
      // Update mount path if provided
      if (result.mountPoint) {
        const mountPathElement = document.querySelector('.mount-path');
        if (mountPathElement) {
          mountPathElement.textContent = result.mountPoint;
        }
      }
      
      // Hide login form and show connected view
      setTimeout(() => {
        loginForm.style.display = 'none';
        hideStatus();
        connectedView.style.display = 'block';
        isConnected = true;
      }, 1500);
    } else {
      // Show error
      showStatus(result.message, true);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to start replicant';
    showStatus(errorMessage, true);
  } finally {
    // Re-enable form
    loginBtn.disabled = false;
    loginBtn.textContent = 'Start';
  }
});

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  logoutBtn.textContent = 'Stopping...';
  
  try {
    const result = await window.electronAPI.stopReplicant();
    
    if (result.success) {
      // Reset UI
      connectedView.style.display = 'none';
      loginForm.style.display = 'block';
      isConnected = false;
      
      // Clear sensitive data
      loginForm.secret.value = '';
      
      showStatus('Replicant stopped successfully', false);
      setTimeout(hideStatus, 2000);
    } else {
      showStatus(result.message || 'Failed to stop replicant', true);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to stop replicant';
    showStatus(errorMessage, true);
  } finally {
    logoutBtn.disabled = false;
    logoutBtn.textContent = 'Stop';
  }
});

// Refresh button handler
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing...';
  
  await updateStatus();
  
  setTimeout(() => {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh Status';
  }, 500);
});

// Handle window close
window.addEventListener('beforeunload', async (e: BeforeUnloadEvent) => {
  if (isConnected) {
    e.preventDefault();
    e.returnValue = '';
    
    // Attempt to stop replicant before closing
    await window.electronAPI.stopReplicant();
  }
});

// Start status monitoring when page loads
window.addEventListener('DOMContentLoaded', () => {
  startStatusUpdates();
  
  // Listen for test progress updates
  window.electronAPI.onTestProgress((progress: any) => {
    updateTestProgress(progress);
  });
});

// Stop status monitoring when page unloads
window.addEventListener('unload', () => {
  stopStatusUpdates();
});

// Test functionality
testBtn.addEventListener('click', () => {
  connectedView.style.display = 'none';
  testView.style.display = 'block';
  resetTestView();
});

backToMainBtn.addEventListener('click', () => {
  testView.style.display = 'none';
  connectedView.style.display = 'block';
});

runAllTestsBtn.addEventListener('click', async () => {
  await runTests('all');
});

runQuickTestsBtn.addEventListener('click', async () => {
  await runTests('quick');
});

function resetTestView(): void {
  testProgress.style.display = 'none';
  testSummary.style.display = 'none';
  testSuites.innerHTML = '';
  progressFill.style.width = '0%';
  progressText.textContent = 'Ready to run tests';
}

async function runTests(type: 'all' | 'quick'): Promise<void> {
  try {
    // Disable buttons and show progress
    runAllTestsBtn.disabled = true;
    runQuickTestsBtn.disabled = true;
    testProgress.style.display = 'block';
    testSummary.style.display = 'none';
    testSuites.innerHTML = '';
    
    // Start test execution
    const result = await window.electronAPI.runTests(type);
    
    if (result.success) {
      // Display results
      displayTestResults(result.results);
    } else {
      // Show error
      showTestError(result.error || 'Unknown test error');
    }
  } catch (error) {
    console.error('Error running tests:', error);
    showTestError(error instanceof Error ? error.message : 'Failed to run tests');
  } finally {
    // Re-enable buttons
    runAllTestsBtn.disabled = false;
    runQuickTestsBtn.disabled = false;
    testProgress.style.display = 'none';
  }
}

function updateTestProgress(progress: any): void {
  progressFill.style.width = `${progress.progress}%`;
  progressText.textContent = `${progress.currentSuite}: ${progress.currentTest} (${progress.completedSuites}/${progress.totalSuites})`;
}

function displayTestResults(results: any): void {
  const allSuites = results.suites || [];
  const startTime = Date.now();
  
  // Calculate totals
  let totalTestCount = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;
  
  allSuites.forEach((suite: any) => {
    totalTestCount += suite.tests.length;
    totalPassed += suite.passed;
    totalFailed += suite.failed;
    totalDuration += suite.duration;
  });
  
  // Update summary
  totalTests.textContent = totalTestCount.toString();
  passedTests.textContent = totalPassed.toString();
  failedTests.textContent = totalFailed.toString();
  testDuration.textContent = `${totalDuration}ms`;
  
  // Show summary
  testSummary.style.display = 'block';
  
  // Display suites
  testSuites.innerHTML = '';
  allSuites.forEach((suite: any) => {
    const suiteElement = createSuiteElement(suite);
    testSuites.appendChild(suiteElement);
  });
}

function createSuiteElement(suite: any): HTMLElement {
  const suiteDiv = document.createElement('div');
  suiteDiv.className = 'test-suite';
  
  // Suite header
  const headerDiv = document.createElement('div');
  headerDiv.className = 'suite-header';
  
  const titleSpan = document.createElement('span');
  titleSpan.className = 'suite-title';
  titleSpan.textContent = suite.name;
  
  const statusDiv = document.createElement('div');
  statusDiv.className = `suite-status ${suite.failed > 0 ? 'failed' : 'passed'}`;
  statusDiv.innerHTML = `
    <span>${suite.passed} passed, ${suite.failed} failed</span>
    <span class="test-duration">${suite.duration}ms</span>
  `;
  
  headerDiv.appendChild(titleSpan);
  headerDiv.appendChild(statusDiv);
  
  // Suite tests (collapsible)
  const testsDiv = document.createElement('div');
  testsDiv.className = 'suite-tests';
  testsDiv.style.display = suite.failed > 0 ? 'block' : 'none'; // Show failed suites by default
  
  suite.tests.forEach((test: any) => {
    const testDiv = document.createElement('div');
    testDiv.className = 'test-item';
    
    const testName = document.createElement('div');
    testName.className = 'test-name';
    testName.textContent = test.name;
    
    const testStatus = document.createElement('span');
    testStatus.className = `test-status ${test.status}`;
    testStatus.textContent = test.status;
    
    const testInfo = document.createElement('div');
    testInfo.style.display = 'flex';
    testInfo.style.alignItems = 'center';
    testInfo.appendChild(testStatus);
    
    if (test.duration) {
      const duration = document.createElement('span');
      duration.className = 'test-duration';
      duration.textContent = `${test.duration}ms`;
      testInfo.appendChild(duration);
    }
    
    testDiv.appendChild(testName);
    testDiv.appendChild(testInfo);
    
    // Add error if present
    if (test.error) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'test-error';
      errorDiv.textContent = test.error;
      testDiv.appendChild(errorDiv);
    }
    
    testsDiv.appendChild(testDiv);
  });
  
  // Make header clickable to toggle tests
  headerDiv.addEventListener('click', () => {
    testsDiv.style.display = testsDiv.style.display === 'none' ? 'block' : 'none';
  });
  
  suiteDiv.appendChild(headerDiv);
  suiteDiv.appendChild(testsDiv);
  
  return suiteDiv;
}

function showTestError(error: string): void {
  testSuites.innerHTML = `
    <div class="test-suite">
      <div class="suite-header">
        <span class="suite-title">Test Error</span>
        <div class="suite-status failed">Failed to run tests</div>
      </div>
      <div class="suite-tests" style="display: block;">
        <div class="test-item">
          <div class="test-name">Test execution failed</div>
          <span class="test-status fail">fail</span>
        </div>
        <div class="test-error">${error}</div>
      </div>
    </div>
  `;
}