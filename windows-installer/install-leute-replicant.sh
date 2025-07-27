#!/bin/bash
# Install one.leute.replicant in WSL

set -e

echo "Installing one.leute.replicant..."

# Install dependencies
sudo apt-get update
sudo apt-get install -y nodejs npm fuse3 libfuse3-dev build-essential

# Install one.leute.replicant globally
echo "Installing one.leute.replicant package..."
sudo npm install -g /mnt/c/Users/juerg/source/one.filer/vendor/refinio-one.leute.replicant-latest.tgz

# Set up fuse permissions
sudo usermod -a -G fuse $USER

# Create mount directory
mkdir -p ~/one-files

echo "Installation complete!"
echo "Run 'one-leute-replicant --help' to see available commands"