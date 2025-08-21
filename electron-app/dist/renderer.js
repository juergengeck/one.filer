"use strict";
const loginForm = document.getElementById('loginForm');
const statusDiv = document.getElementById('status');
const connectedView = document.getElementById('connectedView');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const wslStatusSpan = document.getElementById('wslStatus');
const replicantStatusSpan = document.getElementById('replicantStatus');
let isConnected = false;
let statusCheckInterval = null;
function showStatus(message, isError = false) {
    statusDiv.className = isError ? 'status error' : 'status success';
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
}
function hideStatus() {
    statusDiv.className = 'status';
    statusDiv.textContent = '';
    statusDiv.style.display = 'none';
}
// Check and update status indicators
async function updateStatus() {
    try {
        // Check WSL status
        const wslStatus = await window.electronAPI.checkWslStatus();
        if (!wslStatus.installed) {
            wslStatusSpan.textContent = 'Not Installed';
            wslStatusSpan.className = 'status-value error';
        }
        else if (wslStatus.running) {
            wslStatusSpan.textContent = 'Running';
            wslStatusSpan.className = 'status-value success';
        }
        else {
            wslStatusSpan.textContent = 'Stopped';
            wslStatusSpan.className = 'status-value warning';
        }
        // Check replicant status
        const replicantStatus = await window.electronAPI.checkReplicantStatus();
        if (replicantStatus.running) {
            replicantStatusSpan.textContent = `Running (PID: ${replicantStatus.pid})`;
            replicantStatusSpan.className = 'status-value success';
        }
        else {
            replicantStatusSpan.textContent = 'Stopped';
            replicantStatusSpan.className = 'status-value error';
        }
    }
    catch (error) {
        console.error('Error checking status:', error);
    }
}
// Start periodic status updates
function startStatusUpdates() {
    updateStatus();
    statusCheckInterval = setInterval(updateStatus, 2000);
}
// Stop periodic status updates
function stopStatusUpdates() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}
loginForm.addEventListener('submit', async (e) => {
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
        }
        else {
            // Show error
            showStatus(result.message, true);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start replicant';
        showStatus(errorMessage, true);
    }
    finally {
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
        }
        else {
            showStatus(result.message || 'Failed to stop replicant', true);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to stop replicant';
        showStatus(errorMessage, true);
    }
    finally {
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
window.addEventListener('beforeunload', async (e) => {
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
});
// Stop status monitoring when page unloads
window.addEventListener('unload', () => {
    stopStatusUpdates();
});
//# sourceMappingURL=renderer.js.map