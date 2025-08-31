#!/bin/bash

# Simple test script for syncing two ONE.filer instances
# Run this script to test data sync between two instances

set -e

echo "========================================"
echo "ONE.filer Instance Sync Test (Simple)"
echo "========================================"

# Configuration
LINUX_DATA="./data-sync-linux"
WINDOWS_DATA="./data-sync-windows"
LINUX_MOUNT="/tmp/one-sync-linux"
WINDOWS_MOUNT="/tmp/one-sync-windows"

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up..."
    fusermount -u $LINUX_MOUNT 2>/dev/null || true
    fusermount -u $WINDOWS_MOUNT 2>/dev/null || true
    pkill -f "one-sync-linux" 2>/dev/null || true
    pkill -f "one-sync-windows" 2>/dev/null || true
    echo "Cleanup complete"
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Step 1: Clean previous data
echo ""
echo "Step 1: Cleaning previous test data..."
rm -rf $LINUX_DATA $WINDOWS_DATA
fusermount -u $LINUX_MOUNT 2>/dev/null || true
fusermount -u $WINDOWS_MOUNT 2>/dev/null || true

# Step 2: Create configurations
echo ""
echo "Step 2: Creating configurations..."

cat > config-sync-linux.json << EOF
{
    "directory": "$LINUX_DATA",
    "commServerUrl": "wss://comm10.dev.refinio.one",
    "createEveryoneGroup": true,
    "useFiler": true,
    "filerConfig": {
        "mountPoint": "$LINUX_MOUNT",
        "pairingUrl": "https://edda.dev.refinio.one/invites/invitePartner/?invited=true/",
        "iomMode": "full",
        "logCalls": false
    },
    "connectionsConfig": {
        "commServerUrl": "wss://comm10.dev.refinio.one",
        "acceptIncomingConnections": true,
        "acceptUnknownInstances": true,
        "acceptUnknownPersons": true,
        "allowPairing": true,
        "pairingTokenExpirationDuration": 3600000,
        "establishOutgoingConnections": true
    }
}
EOF

cat > config-sync-windows.json << EOF
{
    "directory": "$WINDOWS_DATA",
    "commServerUrl": "wss://comm10.dev.refinio.one",
    "createEveryoneGroup": true,
    "useFiler": true,
    "filerConfig": {
        "mountPoint": "$WINDOWS_MOUNT",
        "pairingUrl": "https://edda.dev.refinio.one/invites/invitePartner/?invited=true/",
        "iomMode": "full",
        "logCalls": false
    },
    "connectionsConfig": {
        "commServerUrl": "wss://comm10.dev.refinio.one",
        "acceptIncomingConnections": true,
        "acceptUnknownInstances": true,
        "acceptUnknownPersons": true,
        "allowPairing": true,
        "pairingTokenExpirationDuration": 3600000,
        "establishOutgoingConnections": true
    }
}
EOF

echo "Configurations created"

# Step 3: Start Linux instance
echo ""
echo "Step 3: Starting Linux instance..."
npm start -- start -s linux-sync-123 -c config-sync-linux.json > linux-instance.log 2>&1 &
LINUX_PID=$!
echo "Linux instance started (PID: $LINUX_PID)"

# Wait for mount
echo "Waiting for Linux mount..."
for i in {1..30}; do
    if [ -d "$LINUX_MOUNT/invites" ]; then
        echo "Linux instance ready!"
        break
    fi
    sleep 1
done

# Step 4: Start Windows instance
echo ""
echo "Step 4: Starting Windows instance..."
npm start -- start -s windows-sync-456 -c config-sync-windows.json > windows-instance.log 2>&1 &
WINDOWS_PID=$!
echo "Windows instance started (PID: $WINDOWS_PID)"

# Wait for mount
echo "Waiting for Windows mount..."
for i in {1..30}; do
    if [ -d "$WINDOWS_MOUNT/invites" ]; then
        echo "Windows instance ready!"
        break
    fi
    sleep 1
done

# Step 5: Check both instances are running
echo ""
echo "Step 5: Verifying instances..."
if [ -d "$LINUX_MOUNT/invites" ] && [ -d "$WINDOWS_MOUNT/invites" ]; then
    echo "✓ Both instances are running"
else
    echo "✗ One or both instances failed to start"
    echo "Check linux-instance.log and windows-instance.log for details"
    exit 1
fi

# Step 6: Get invitation from Linux
echo ""
echo "Step 6: Getting invitation from Linux instance..."
INVITE_FILE="$LINUX_MOUNT/invites/iom_invite.txt"

# Wait for invitation file
for i in {1..10}; do
    if [ -f "$INVITE_FILE" ]; then
        INVITATION=$(cat "$INVITE_FILE")
        echo "✓ Got invitation: ${INVITATION:0:50}..."
        break
    fi
    echo "Waiting for invitation file..."
    sleep 2
done

if [ -z "$INVITATION" ]; then
    echo "✗ Failed to get invitation"
    exit 1
fi

# Step 7: Accept invitation in Windows instance
echo ""
echo "Step 7: Accepting invitation in Windows instance..."
mkdir -p "$WINDOWS_MOUNT/invites/accept"
echo "$INVITATION" > "$WINDOWS_MOUNT/invites/accept/invitation.txt"
echo "✓ Invitation written to Windows instance"

# Wait for pairing
echo "Waiting for pairing to complete..."
sleep 10

# Step 8: Check connections
echo ""
echo "Step 8: Checking connections..."
if [ -f "$LINUX_MOUNT/invites/connections.txt" ]; then
    echo "Linux connections:"
    cat "$LINUX_MOUNT/invites/connections.txt"
fi

if [ -f "$WINDOWS_MOUNT/invites/connections.txt" ]; then
    echo "Windows connections:"
    cat "$WINDOWS_MOUNT/invites/connections.txt"
fi

# Step 9: Test data sync
echo ""
echo "Step 9: Testing data synchronization..."
echo ""
echo "Test 1: Creating file in Linux instance..."
mkdir -p "$LINUX_MOUNT/chats"
echo "Test from Linux at $(date)" > "$LINUX_MOUNT/chats/test-linux.txt"
echo "✓ File created in Linux"

echo "Waiting for sync..."
sleep 5

echo "Checking if file appears in Windows instance..."
if [ -f "$WINDOWS_MOUNT/chats/test-linux.txt" ]; then
    CONTENT=$(cat "$WINDOWS_MOUNT/chats/test-linux.txt")
    echo "✓ File synced to Windows: $CONTENT"
else
    echo "✗ File not found in Windows instance"
fi

echo ""
echo "Test 2: Creating file in Windows instance..."
mkdir -p "$WINDOWS_MOUNT/chats"
echo "Test from Windows at $(date)" > "$WINDOWS_MOUNT/chats/test-windows.txt"
echo "✓ File created in Windows"

echo "Waiting for sync..."
sleep 5

echo "Checking if file appears in Linux instance..."
if [ -f "$LINUX_MOUNT/chats/test-windows.txt" ]; then
    CONTENT=$(cat "$LINUX_MOUNT/chats/test-windows.txt")
    echo "✓ File synced to Linux: $CONTENT"
else
    echo "✗ File not found in Linux instance"
fi

# Step 10: Summary
echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "Linux instance: $LINUX_MOUNT"
echo "Windows instance: $WINDOWS_MOUNT"
echo ""
echo "To manually test:"
echo "1. Create/modify files in $LINUX_MOUNT"
echo "2. Check if they appear in $WINDOWS_MOUNT"
echo "3. And vice versa"
echo ""
echo "Instances will continue running. Press Ctrl+C to stop."
echo ""

# Keep running
wait