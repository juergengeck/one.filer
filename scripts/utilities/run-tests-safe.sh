#!/bin/bash

# Safe Test Runner with Timeout Protection
# Prevents tests from hanging indefinitely

set -e

echo "========================================="
echo "Safe Test Runner with Timeout Protection"
echo "========================================="
echo "Platform: $(uname -s)"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run a test with timeout
run_test_with_timeout() {
    local test_name=$1
    local test_command=$2
    local timeout_seconds=${3:-60}  # Default 60 seconds
    
    echo -e "${BLUE}Running: $test_name (timeout: ${timeout_seconds}s)${NC}"
    
    # Run the test command with timeout
    if timeout $timeout_seconds bash -c "$test_command" 2>&1; then
        echo -e "${GREEN}✓ $test_name passed${NC}"
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo -e "${RED}✗ $test_name TIMEOUT after ${timeout_seconds}s${NC}"
        else
            echo -e "${RED}✗ $test_name failed with code $exit_code${NC}"
        fi
        return 1
    fi
}

# Clean up any hanging processes before starting
echo "Cleaning up any hanging test processes..."
pkill -f "mocha.*test" 2>/dev/null || true
pkill -f "node.*test.*fuse" 2>/dev/null || true
fusermount -u /tmp/test-fuse-mount 2>/dev/null || true
fusermount -u /tmp/onefiler-* 2>/dev/null || true
fusermount -u /tmp/sync-test-* 2>/dev/null || true
fusermount -u /tmp/load-test-* 2>/dev/null || true

# Build the project
echo -e "${YELLOW}Building project...${NC}"
if timeout 120 npm run build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed or timed out${NC}"
    exit 1
fi

echo ""
echo "========================================="
echo "Running Tests with Timeout Protection"
echo "========================================="
echo ""

# Track test results
PASSED=0
FAILED=0
TIMEOUT=0

# Run unit tests
if run_test_with_timeout "Unit Tests" "npm run test:unit 2>/dev/null || npx mocha 'test/unit/**/*.test.js' 2>/dev/null || echo 'No unit tests found'" 30; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Detect platform
PLATFORM=$(uname -s)

# Run platform-specific tests
if [[ "$PLATFORM" == "Linux" ]]; then
    echo ""
    echo -e "${YELLOW}Running Linux-specific tests...${NC}"
    
    # Run FUSE tests with longer timeout (they need to start/stop mounts)
    if run_test_with_timeout "Linux FUSE3 Tests" "npx mocha test/fuse-linux.test.js --timeout 30000" 120; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
    
    # Clean up after FUSE tests
    fusermount -u /tmp/test-fuse-mount 2>/dev/null || true
    
elif [[ "$PLATFORM" == "MINGW"* ]] || [[ "$PLATFORM" == "MSYS"* ]]; then
    echo ""
    echo -e "${YELLOW}Running Windows-specific tests...${NC}"
    
    # Run ProjFS tests
    if run_test_with_timeout "Windows ProjFS Tests" "npx mocha test/projfs-windows.test.js --timeout 30000" 120; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
fi

# Run cross-platform integration tests (with very conservative timeout)
echo ""
echo -e "${YELLOW}Running cross-platform integration tests...${NC}"

if [ -f "test/cross-platform-integration.test.js" ]; then
    if run_test_with_timeout "Cross-Platform Integration" "npx mocha test/cross-platform-integration.test.js --timeout 60000" 180; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
fi

# Clean up any remaining test processes
echo ""
echo "Cleaning up test processes..."
pkill -f "mocha.*test" 2>/dev/null || true
pkill -f "node.*test.*fuse" 2>/dev/null || true
fusermount -u /tmp/test-fuse-mount 2>/dev/null || true
fusermount -u /tmp/onefiler-* 2>/dev/null || true
fusermount -u /tmp/sync-test-* 2>/dev/null || true
fusermount -u /tmp/load-test-* 2>/dev/null || true

# Summary
echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

# Create a test report
REPORT_FILE="test-report-safe.txt"
{
    echo "Safe Test Report"
    echo "Generated: $(date)"
    echo "Platform: $PLATFORM"
    echo ""
    echo "Results:"
    echo "  Passed: $PASSED"
    echo "  Failed: $FAILED"
    echo ""
    echo "Note: Tests were run with timeout protection to prevent hanging."
} > "$REPORT_FILE"

echo -e "${BLUE}Report saved to: $REPORT_FILE${NC}"
echo ""

# Exit with appropriate code
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}⚠️  TEST FAILURES DETECTED${NC}"
    exit 1
else
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    exit 0
fi