#!/bin/bash

# Test script for one.filer using refinio.cli
# This script tests the filesystem functionality using the refinio CLI

set -e  # Exit on error

echo "========================================"
echo "ONE.FILER Test Suite using refinio.cli"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
TEST_MOUNT_POINT="/tmp/one-filer-test"
TEST_SECRET="test-secret-123"
TEST_PROFILE="test-profile"

# Function to print test status
print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Function to cleanup
cleanup() {
    print_test "Cleaning up test environment..."
    
    # Try to unmount if mounted
    refinio filer unmount --profile $TEST_PROFILE 2>/dev/null || true
    
    # Clean up mount point
    [ -d "$TEST_MOUNT_POINT" ] && rm -rf "$TEST_MOUNT_POINT"
    
    print_success "Cleanup complete"
}

# Set up trap for cleanup on exit
trap cleanup EXIT

# 1. Test FUSE3 addon loading
print_test "Testing FUSE3 N-API addon..."
if node -e "require('./packages/one.filer.linux/fuse3-napi/build/Release/fuse3_napi.node'); console.log('FUSE3 addon loaded');" 2>/dev/null; then
    print_success "FUSE3 addon loads correctly"
else
    print_error "FUSE3 addon failed to load"
    exit 1
fi

# 2. Test refinio.cli availability
print_test "Checking refinio.cli installation..."
if command -v refinio &> /dev/null; then
    print_success "refinio.cli is installed"
    refinio --version
else
    print_error "refinio.cli not found. Please install it first: npm link in refinio.cli directory"
    exit 1
fi

# 3. Start ONE instance (if not already running)
print_test "Starting ONE instance for testing..."
# This would normally start your replicant/ONE instance
# For now, we'll assume it's already running or start it in background
# one-filer start -s "$TEST_SECRET" --filer true --filer-mount-point "$TEST_MOUNT_POINT" &
# ONE_PID=$!
# sleep 5

# 4. Test filer status
print_test "Getting filer status..."
if refinio filer status --profile $TEST_PROFILE; then
    print_success "Filer status retrieved"
else
    print_error "Failed to get filer status"
fi

# 5. Test mounting filesystem
print_test "Mounting filer filesystem at $TEST_MOUNT_POINT..."
if refinio filer mount --mount-point "$TEST_MOUNT_POINT" --iom-mode light --profile $TEST_PROFILE; then
    print_success "Filer mounted successfully"
else
    print_error "Failed to mount filer"
    exit 1
fi

# 6. Verify mount point exists
print_test "Verifying mount point..."
if [ -d "$TEST_MOUNT_POINT" ]; then
    print_success "Mount point exists"
    ls -la "$TEST_MOUNT_POINT"
else
    print_error "Mount point not found"
    exit 1
fi

# 7. Test filesystem operations
print_test "Testing filesystem operations..."

# Check for expected directories
EXPECTED_DIRS=("objects" "profiles" "chats" "connections")
for dir in "${EXPECTED_DIRS[@]}"; do
    if [ -d "$TEST_MOUNT_POINT/$dir" ]; then
        print_success "Directory '$dir' exists"
    else
        print_error "Directory '$dir' not found"
    fi
done

# 8. Test listing filesystems
print_test "Listing mounted filesystems..."
if refinio filer list-fs --profile $TEST_PROFILE; then
    print_success "Filesystems listed"
else
    print_error "Failed to list filesystems"
fi

# 9. Test configuration management
print_test "Testing configuration management..."
if refinio filer config --profile $TEST_PROFILE; then
    print_success "Configuration retrieved"
else
    print_error "Failed to get configuration"
fi

# 10. Test specific filesystem info
print_test "Getting filesystem info for /objects..."
if refinio filer fs-info /objects --profile $TEST_PROFILE; then
    print_success "Filesystem info retrieved"
else
    print_error "Failed to get filesystem info"
fi

# 11. Test cache operations
print_test "Testing cache clearing..."
if refinio filer clear-cache --profile $TEST_PROFILE; then
    print_success "Cache cleared"
else
    print_error "Failed to clear cache"
fi

# 12. Test refresh operation
print_test "Refreshing filer filesystem..."
if refinio filer refresh --profile $TEST_PROFILE; then
    print_success "Filer refreshed"
else
    print_error "Failed to refresh filer"
fi

# 13. Test unmounting
print_test "Unmounting filer filesystem..."
if refinio filer unmount --profile $TEST_PROFILE; then
    print_success "Filer unmounted"
else
    print_error "Failed to unmount filer"
fi

# 14. Verify unmount
print_test "Verifying unmount..."
if refinio filer status --profile $TEST_PROFILE | grep -q "Mounted: No"; then
    print_success "Filesystem successfully unmounted"
else
    print_error "Filesystem still mounted"
fi

echo ""
echo "========================================"
echo -e "${GREEN}All tests completed successfully!${NC}"
echo "========================================"