#\!/bin/bash
set -e
echo "🚀 Setting up ONE Filer in Ubuntu WSL2..."
cd /home/$USER/one.filer
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y nodejs npm build-essential python3 git libfuse3-dev fuse3
echo "📦 Installing Node.js dependencies..."
npm install
echo "🔧 Setting up FUSE permissions..."
sudo chmod 666 /dev/fuse
echo "✅ ONE Filer setup complete\!"
