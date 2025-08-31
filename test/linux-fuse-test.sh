#!/bin/bash

# Linux FUSE3 Test Script
# Tests the Linux version of ONE.filer with FUSE3 support

set -e

echo "🐧 Linux FUSE3 Integration Test"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
MOUNT_POINT="/tmp/one-filer-test-mount"
TEST_DIR="/tmp/one-filer-test-data"
TEST_INSTANCE="test-instance-linux"
SECRET="test123"
FUSE_LOG="/tmp/one-filer-fuse.log"

# Function to cleanup
cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    
    # Unmount if mounted
    if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
        fusermount -u "$MOUNT_POINT" 2>/dev/null || true
    fi
    
    # Kill any remaining processes
    pkill -f "one-filer" 2>/dev/null || true
    
    # Remove test directories
    rm -rf "$MOUNT_POINT" "$TEST_DIR" "$FUSE_LOG"
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Function to run test
run_test() {
    local test_name="$1"
    local test_cmd="$2"
    
    echo -n "  Testing $test_name... "
    
    if eval "$test_cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Start of tests
echo "Setting up test environment..."

# Clean any previous test data
cleanup

# Create test directories
mkdir -p "$MOUNT_POINT"
mkdir -p "$TEST_DIR"

# Check if we're in WSL
if [ -n "$WSL_DISTRO_NAME" ]; then
    echo "Running in WSL2: $WSL_DISTRO_NAME"
    
    # Check if FUSE is available in WSL
    if ! command -v fusermount &> /dev/null; then
        echo -e "${RED}Error: FUSE not available in WSL${NC}"
        exit 1
    fi
fi

# Check FUSE3 installation
echo "Checking FUSE3 installation..."
if ! pkg-config --exists fuse3; then
    echo -e "${RED}Error: FUSE3 not installed${NC}"
    echo "Install with: sudo apt-get install libfuse3-dev fuse3"
    exit 1
fi

FUSE_VERSION=$(pkg-config --modversion fuse3)
echo "FUSE3 version: $FUSE_VERSION"

# Build the native module if needed
echo "Building native FUSE3 module..."
cd "$(dirname "$0")/.."

# Check if we need to compile the native module
if [ ! -f "lib/fuse/native-fuse3.node" ]; then
    echo "Compiling native FUSE3 binding..."
    
    # Create a simple binding.gyp for FUSE3
    cat > binding.gyp << 'EOF'
{
  "targets": [
    {
      "target_name": "native-fuse3",
      "sources": [ "src/fuse/fuse3_binding.cpp" ],
      "include_dirs": [
        "<!@(pkg-config fuse3 --cflags-only-I | sed s/-I//g)"
      ],
      "libraries": [
        "<!@(pkg-config fuse3 --libs)"
      ],
      "defines": [
        "FUSE_USE_VERSION=30"
      ],
      "cflags": [
        "-Wall",
        "-Wno-deprecated-declarations"
      ]
    }
  ]
}
EOF

    # Create a minimal FUSE3 binding source
    mkdir -p src/fuse
    cat > src/fuse/fuse3_binding.cpp << 'EOF'
#include <node.h>
#include <node_buffer.h>
#include <v8.h>

#define FUSE_USE_VERSION 30
#include <fuse3/fuse.h>
#include <string>
#include <cstring>

using namespace v8;

// Minimal FUSE3 operations for testing
static int test_getattr(const char *path, struct stat *stbuf, struct fuse_file_info *fi) {
    memset(stbuf, 0, sizeof(struct stat));
    
    if (strcmp(path, "/") == 0) {
        stbuf->st_mode = S_IFDIR | 0755;
        stbuf->st_nlink = 2;
    } else if (strcmp(path, "/test.txt") == 0) {
        stbuf->st_mode = S_IFREG | 0644;
        stbuf->st_nlink = 1;
        stbuf->st_size = 13;
    } else {
        return -ENOENT;
    }
    
    return 0;
}

static int test_readdir(const char *path, void *buf, fuse_fill_dir_t filler,
                        off_t offset, struct fuse_file_info *fi, enum fuse_readdir_flags flags) {
    if (strcmp(path, "/") != 0)
        return -ENOENT;
    
    filler(buf, ".", NULL, 0, FUSE_FILL_DIR_PLUS);
    filler(buf, "..", NULL, 0, FUSE_FILL_DIR_PLUS);
    filler(buf, "test.txt", NULL, 0, FUSE_FILL_DIR_PLUS);
    
    return 0;
}

static int test_read(const char *path, char *buf, size_t size, off_t offset,
                    struct fuse_file_info *fi) {
    const char *content = "Hello, FUSE3!\n";
    size_t len = strlen(content);
    
    if (strcmp(path, "/test.txt") != 0)
        return -ENOENT;
    
    if (offset < len) {
        if (offset + size > len)
            size = len - offset;
        memcpy(buf, content + offset, size);
    } else {
        size = 0;
    }
    
    return size;
}

void Initialize(Local<Object> exports) {
    // Export basic info for testing
    Isolate* isolate = exports->GetIsolate();
    exports->Set(isolate->GetCurrentContext(),
                 String::NewFromUtf8(isolate, "fuseVersion").ToLocalChecked(),
                 Number::New(isolate, FUSE_VERSION)).Check();
}

NODE_MODULE(native_fuse3, Initialize)
EOF

    # Build with node-gyp
    npm install -g node-gyp 2>/dev/null || true
    node-gyp configure
    node-gyp build
    
    # Copy the built module
    cp build/Release/native-fuse3.node lib/fuse/
fi

# Test 1: Basic FUSE mount
echo ""
echo "Running FUSE3 tests..."
echo "----------------------"

# Start the ONE.filer in background
echo "Starting ONE.filer with FUSE3..."
NODE_ENV=test npm start -- start \
    --secret "$SECRET" \
    --instance "$TEST_INSTANCE" \
    --mountpoint "$MOUNT_POINT" \
    --datadir "$TEST_DIR" \
    > "$FUSE_LOG" 2>&1 &

FUSE_PID=$!

# Wait for mount
echo -n "Waiting for FUSE mount... "
for i in {1..30}; do
    if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
        echo -e "${GREEN}mounted${NC}"
        break
    fi
    sleep 1
done

if ! mountpoint -q "$MOUNT_POINT"; then
    echo -e "${RED}failed${NC}"
    echo "FUSE log:"
    cat "$FUSE_LOG"
    exit 1
fi

# Run tests
TESTS_PASSED=0
TESTS_FAILED=0

# Test 2: Check mount point
if run_test "mount point exists" "[ -d '$MOUNT_POINT' ]"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Test 3: List root directory
if run_test "list root directory" "ls '$MOUNT_POINT' > /dev/null"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Test 4: Check expected directories
for dir in chats objects types debug invites; do
    if run_test "directory /$dir exists" "[ -d '$MOUNT_POINT/$dir' ]"; then
        ((TESTS_PASSED++))
    else
        ((TESTS_FAILED++))
    fi
done

# Test 5: Create a file
TEST_FILE="$MOUNT_POINT/debug/test-file.txt"
if run_test "create file" "echo 'FUSE3 test' > '$TEST_FILE'"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Test 6: Read the file
if run_test "read file" "grep 'FUSE3 test' '$TEST_FILE'"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Test 7: Create directory
TEST_SUBDIR="$MOUNT_POINT/debug/test-subdir"
if run_test "create directory" "mkdir -p '$TEST_SUBDIR'"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Test 8: File in subdirectory
if run_test "file in subdirectory" "echo 'nested' > '$TEST_SUBDIR/nested.txt'"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Test 9: Delete file
if run_test "delete file" "rm -f '$TEST_FILE'"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Test 10: Check file is deleted
if run_test "verify deletion" "[ ! -f '$TEST_FILE' ]"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Test 11: Performance test
echo -n "  Testing write performance... "
START_TIME=$(date +%s%N)
for i in {1..100}; do
    echo "Performance test $i" > "$MOUNT_POINT/debug/perf-$i.txt"
done
END_TIME=$(date +%s%N)
DURATION=$((($END_TIME - $START_TIME) / 1000000))
echo -e "${GREEN}${DURATION}ms for 100 writes${NC}"
((TESTS_PASSED++))

# Test 12: WSL integration (if in WSL)
if [ -n "$WSL_DISTRO_NAME" ]; then
    echo ""
    echo "WSL2 Integration Tests:"
    echo "----------------------"
    
    # Check if Windows can see the mount
    WIN_PATH="\\\\wsl$\\$WSL_DISTRO_NAME${MOUNT_POINT//\//\\}"
    echo "  Windows path: $WIN_PATH"
    
    # Test from Windows side
    if command -v cmd.exe &> /dev/null; then
        if run_test "Windows accessibility" "cmd.exe /c dir '$WIN_PATH' > /dev/null 2>&1"; then
            ((TESTS_PASSED++))
        else
            ((TESTS_FAILED++))
            echo "    Note: WSL FUSE mounts may not be accessible from Windows"
        fi
    fi
fi

# Stop the FUSE process
echo ""
echo "Stopping FUSE mount..."
kill $FUSE_PID 2>/dev/null || true
sleep 2

# Force unmount if still mounted
if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
    fusermount -u "$MOUNT_POINT"
fi

# Results
echo ""
echo "================================"
echo "Test Results:"
echo "================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All Linux FUSE3 tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi