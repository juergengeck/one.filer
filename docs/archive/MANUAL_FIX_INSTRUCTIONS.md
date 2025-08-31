# 🎯 Manual Fix: Windows Access to ONE.filer FUSE Mount

## Problem
Windows Explorer cannot access the FUSE mount created by ONE.filer in WSL2.

## Solution Overview
Configure FUSE mount permissions and WSL2 settings to enable Windows cross-boundary access.

---

## 📋 Step-by-Step Manual Fix

### Step 1: Restart PowerShell/Terminal
1. **Close current PowerShell window completely**
2. **Open a new PowerShell window as Administrator**
3. **Navigate to project:** `cd C:\Users\juerg\source\one.filer`

### Step 2: Restart WSL2
```powershell
wsl --shutdown
```
Wait 5 seconds, then:
```powershell
wsl -d Ubuntu
```

### Step 3: Setup Project in Ubuntu
```bash
# In Ubuntu WSL2
mkdir -p /home/gecko/one.filer
cd /home/gecko/one.filer

# Copy files from Windows (if needed)
cp -r /mnt/c/Users/juerg/source/one.filer/* ./

# Set proper ownership
chown -R $USER:$USER /home/gecko/one.filer
```

### Step 4: Configure FUSE for Windows Access
```bash
# Enable FUSE for other users
echo "user_allow_other" | sudo tee -a /etc/fuse.conf

# Add user to fuse group
sudo usermod -a -G fuse $USER

# Create mount directory with proper permissions
sudo mkdir -p /mnt/one-files
sudo chown $USER:$USER /mnt/one-files
sudo chmod 755 /mnt/one-files
```

### Step 5: Install Dependencies
```bash
cd /home/gecko/one.filer
npm install
```

### Step 6: Start FUSE Mount with Windows-Compatible Settings
```bash
# Unmount any existing mounts
fusermount -u /mnt/one-files 2>/dev/null || true

# Start with explicit Windows-compatible options
node --enable-source-maps lib/index.js start \
  --secret test123 \
  --mount-dir /mnt/one-files \
  --allow-other \
  --default-permissions &
```

### Step 7: Test Windows Access
**In Windows Explorer, navigate to:**
```
\\wsl.localhost\Ubuntu\mnt\one-files
```

**Alternative path (if above doesn't work):**
```
\\wsl$\Ubuntu\mnt\one-files
```

---

## 🔧 Alternative: Using Configuration File

### Option A: Use the Windows-Accessible Config
```bash
node --enable-source-maps lib/index.js start \
  --secret test123 \
  -c /mnt/c/Users/juerg/source/one.filer/configs/filer-windows-accessible.json
```

### Option B: Manual Mount with Custom Options
```bash
# Create a custom FUSE mount
mkdir -p /tmp/one-test
node --enable-source-maps lib/index.js start \
  --secret test123 \
  --mount-dir /tmp/one-test \
  --fuse-opts "allow_other,default_permissions,uid=1000,gid=1000"
```

---

## 🎯 Quick Verification Commands

### Check if FUSE mount is active:
```bash
mount | grep fuse
df -h | grep one-files
ls -la /mnt/one-files
```

### Test Windows access from PowerShell:
```powershell
Test-Path "\\wsl.localhost\Ubuntu\mnt\one-files"
dir "\\wsl.localhost\Ubuntu\mnt\one-files"
```

---

## 🔍 Troubleshooting

### If Windows still can't access:

1. **Try different mount location:**
   ```bash
   # Use /tmp instead of /mnt
   mkdir -p /tmp/one-files
   # Mount there instead
   ```

2. **Check WSL2 file sharing:**
   ```powershell
   # In Windows, check Windows Features
   # Ensure "Virtual Machine Platform" is enabled
   ```

3. **Restart WSL completely:**
   ```powershell
   wsl --shutdown
   wsl --unregister Ubuntu
   # Reinstall Ubuntu from Microsoft Store
   ```

4. **Use different Windows path format:**
   - Try: `\\wsl$\Ubuntu\mnt\one-files`
   - Try: `\\localhost\wsl$\Ubuntu\mnt\one-files`

---

## ✅ Success Indicators

When working correctly, you should see:
- ✅ FUSE mount appears in `mount | grep fuse`
- ✅ Windows Explorer can browse to `\\wsl.localhost\Ubuntu\mnt\one-files`
- ✅ Files appear in Windows Explorer
- ✅ No permission errors

---

## 🎯 If All Else Fails: Network Mount Alternative

As a last resort, you can use a simple HTTP server:
```bash
cd /mnt/one-files
python3 -m http.server 8080
```
Then access via `http://localhost:8080` in Windows browser.

---

**Next Action:** Open a fresh PowerShell window and follow these steps manually! 