#!/bin/bash

# ONE Filer FUSE Server for WSL2
# This runs the FUSE filesystem in WSL and exposes it for Windows access

echo "🐧 ONE Filer WSL FUSE Server"
echo "============================"

# Configuration
MOUNT_POINT="/tmp/one-filer-mount"
DATA_DIR="$HOME/.one-filer-data"
LOG_FILE="/tmp/one-filer.log"
PORT=17895  # Port for IPC communication with Windows

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in WSL
if ! grep -qi microsoft /proc/version; then
    echo -e "${RED}❌ This script must be run in WSL2${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Running in WSL2${NC}"

# Install dependencies if needed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v fusermount &> /dev/null; then
    echo -e "${YELLOW}📦 Installing FUSE...${NC}"
    sudo apt-get update
    sudo apt-get install -y fuse libfuse2
fi

# Create directories
mkdir -p "$MOUNT_POINT"
mkdir -p "$DATA_DIR"

# Clean up any existing mounts
if mountpoint -q "$MOUNT_POINT"; then
    echo -e "${YELLOW}🔧 Unmounting existing FUSE mount...${NC}"
    fusermount -u "$MOUNT_POINT" 2>/dev/null || true
fi

# Get the Windows path and convert to WSL path
WIN_PROJECT_PATH="/mnt/c/Users/juerg/source/one.filer"

if [ ! -d "$WIN_PROJECT_PATH" ]; then
    echo -e "${RED}❌ Project not found at $WIN_PROJECT_PATH${NC}"
    exit 1
fi

cd "$WIN_PROJECT_PATH"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Build if needed
if [ ! -d "lib" ]; then
    echo -e "${YELLOW}🔨 Building project...${NC}"
    npm run build
fi

# Create a simple Node.js script to run the FUSE server
cat > /tmp/run-fuse-server.js << 'EOF'
const Replicant = require('./lib/Replicant.js').default;
const http = require('http');
const fs = require('fs');

const config = {
    directory: process.env.DATA_DIR || '/home/one-filer-data',
    useFiler: true,
    filerConfig: {
        mountPoint: process.env.MOUNT_POINT || '/tmp/one-filer-mount',
        logCalls: false,
        pairingUrl: 'https://leute.refinio.one',
        iomMode: 'full'
    }
};

async function startServer() {
    console.log('🚀 Starting ONE Filer FUSE Server...');
    console.log(`📂 Mount point: ${config.filerConfig.mountPoint}`);
    console.log(`💾 Data directory: ${config.directory}`);
    
    // Create replicant
    const replicant = new Replicant(config);
    
    // Start with a default secret (should be provided via API)
    const secret = process.env.ONE_SECRET || 'test123';
    await replicant.start(secret);
    
    console.log('✅ FUSE filesystem mounted successfully');
    
    // Create HTTP server for Windows communication
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        
        if (req.url === '/status') {
            res.end(JSON.stringify({
                status: 'running',
                mountPoint: config.filerConfig.mountPoint,
                dataDir: config.directory,
                pid: process.pid
            }));
        } else if (req.url === '/shutdown') {
            console.log('📴 Shutdown requested...');
            replicant.stop().then(() => {
                res.end(JSON.stringify({ status: 'stopped' }));
                process.exit(0);
            });
        } else {
            res.end(JSON.stringify({ error: 'Unknown endpoint' }));
        }
    });
    
    const PORT = process.env.PORT || 17895;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 API server listening on http://0.0.0.0:${PORT}`);
        console.log('💡 Windows can access the mount at \\\\wsl$\\Ubuntu\\tmp\\one-filer-mount');
    });
    
    // Handle shutdown
    process.on('SIGTERM', async () => {
        console.log('Shutting down...');
        await replicant.stop();
        process.exit(0);
    });
}

startServer().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});
EOF

echo -e "${GREEN}🎯 Starting FUSE server...${NC}"
echo "================================"

# Export environment variables
export MOUNT_POINT="$MOUNT_POINT"
export DATA_DIR="$DATA_DIR"
export PORT="$PORT"
export ONE_SECRET="${ONE_SECRET:-test123}"

# Run the Node.js server
node /tmp/run-fuse-server.js 2>&1 | tee "$LOG_FILE"