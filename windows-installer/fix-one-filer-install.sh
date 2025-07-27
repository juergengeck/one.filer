#!/bin/bash
set -e

echo "🔧 Fixing ONE Filer installation..."

# Backup current directory if it exists
if [ -d ~/one.filer ]; then
    echo "📦 Backing up existing installation..."
    mv ~/one.filer ~/one.filer.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy the correct packaged version
echo "📁 Installing correct ONE Filer package..."
cp -r /mnt/c/Users/juerg/source/one.filer/windows-package/wsl-files/one.filer ~/

# Run the setup script
echo "🔧 Running setup..."
cd ~
if [ -f /mnt/c/Users/juerg/source/one.filer/windows-package/wsl-files/setup-one-filer.sh ]; then
    cp /mnt/c/Users/juerg/source/one.filer/windows-package/wsl-files/setup-one-filer.sh ~/
    chmod +x ~/setup-one-filer.sh
    ./setup-one-filer.sh
fi

# Create the start script
echo "📝 Creating start script..."
cat > ~/one.filer/start.sh << 'EOF'
#!/bin/bash
cd ~/one.filer

# Set default mount point
MOUNT_POINT="${1:-/mnt/c/Users/$USER/OneFiler}"

# Create mount point if needed
sudo mkdir -p "$MOUNT_POINT"

# Start ONE Filer
echo "Starting ONE Filer at $MOUNT_POINT"
npm start -- --mount "$MOUNT_POINT"
EOF

chmod +x ~/one.filer/start.sh

echo "✅ ONE Filer installation fixed!"
echo ""
echo "To start ONE Filer, run:"
echo "  cd ~/one.filer && ./start.sh"
echo ""
echo "Or with a custom mount point:"
echo "  cd ~/one.filer && ./start.sh /path/to/mount"