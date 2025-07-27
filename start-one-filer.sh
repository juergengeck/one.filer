#!/bin/bash
# ONE Filer Start Script

echo "Starting ONE Filer..."
echo "===================="
echo ""

# Navigate to the project directory
cd "$(dirname "$0")"

# Create mount directory
MOUNT_DIR="$HOME/OneFiler"
mkdir -p "$MOUNT_DIR"

echo "Mount directory: $MOUNT_DIR"
echo ""

# Start ONE Filer
echo "Launching ONE Filer..."
npm start -- start --secret testpassword123 --mount "$MOUNT_DIR"