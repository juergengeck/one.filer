#!/bin/bash

# ONE.filer Combined Testing Script
# Runs both comprehensive component tests and existing test suites

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "========================================="
echo "ONE.filer Combined Test Execution"
echo "========================================="
echo "Platform: $(uname -s)"
echo "Node Version: $(node --version)"
echo "Current Directory: $(pwd)"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_BUILD=false
VERBOSE=false
TEST_TYPE=""
QUICK_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --type)
            TEST_TYPE="$2"
            shift 2
            ;;
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-build    Skip building the project"
            echo "  --verbose, -v   Show detailed output"
            echo "  --type TYPE     Run specific test type (unit|component|integration|all)"
            echo "  --quick         Run only essential tests"
            echo "  --help, -h      Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Function to run tests and capture results
run_test_suite() {
    local suite_name=$1
    local command=$2
    
    echo -e "${BLUE}Running $suite_name...${NC}"
    
    if eval $command; then
        echo -e "${GREEN}✓ $suite_name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $suite_name failed${NC}"
        return 1
    fi
}

# Track failures
FAILED_SUITES=()
PASSED_SUITES=()
SKIPPED_SUITES=()

# Build project if needed
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}Building project...${NC}"
    if npm run build; then
        echo -e "${GREEN}✓ Build successful${NC}"
    else
        echo -e "${RED}✗ Build failed${NC}"
        exit 1
    fi
fi

# Ensure test dependencies are installed
echo -e "${YELLOW}Checking test dependencies...${NC}"
if [ ! -d "node_modules/mocha" ]; then
    echo "Installing test dependencies..."
    npm install --save-dev mocha chai @types/mocha @types/chai
fi

if [ ! -d "node_modules/chalk" ]; then
    npm install --save-dev chalk
fi

# Compile TypeScript tests
echo -e "${YELLOW}Compiling TypeScript tests...${NC}"
if [ -f "test/tsconfig.json" ]; then
    npx tsc --project test/tsconfig.json || true
fi

echo ""
echo "========================================="
echo "Starting Test Execution"
echo "========================================="
echo ""

# Determine which tests to run based on platform
PLATFORM=$(uname -s)
IS_LINUX=false
IS_WINDOWS=false
IS_WSL=false

if [[ "$PLATFORM" == "Linux" ]]; then
    IS_LINUX=true
    if [ -d "/mnt/c" ]; then
        IS_WSL=true
        echo "Detected: Linux (WSL)"
    else
        echo "Detected: Linux (Native)"
    fi
elif [[ "$PLATFORM" == "MINGW"* ]] || [[ "$PLATFORM" == "MSYS"* ]]; then
    IS_WINDOWS=true
    echo "Detected: Windows"
fi

# Run tests based on type and platform
if [ "$QUICK_MODE" = true ]; then
    echo -e "${YELLOW}Quick mode: Running essential tests only${NC}"
    echo ""
    
    # Unit tests (always run)
    if run_test_suite "Unit Tests" "npm run test:unit 2>/dev/null"; then
        PASSED_SUITES+=("Unit Tests")
    else
        FAILED_SUITES+=("Unit Tests")
    fi
    
    # Platform-specific component test
    if [ "$IS_LINUX" = true ]; then
        if [ -f "test/fuse-linux.test.js" ]; then
            if run_test_suite "Linux FUSE3 Components" "npx mocha test/fuse-linux.test.js --timeout 60000"; then
                PASSED_SUITES+=("Linux FUSE3 Components")
            else
                FAILED_SUITES+=("Linux FUSE3 Components")
            fi
        fi
    elif [ "$IS_WINDOWS" = true ]; then
        if [ -f "test/projfs-windows.test.js" ]; then
            if run_test_suite "Windows ProjFS Components" "npx mocha test/projfs-windows.test.js --timeout 60000"; then
                PASSED_SUITES+=("Windows ProjFS Components")
            else
                FAILED_SUITES+=("Windows ProjFS Components")
            fi
        fi
    fi
    
else
    # Full test suite
    
    # 1. Unit Tests
    if [ -z "$TEST_TYPE" ] || [ "$TEST_TYPE" = "unit" ] || [ "$TEST_TYPE" = "all" ]; then
        echo -e "${BLUE}═══ Unit Tests ═══${NC}"
        
        if [ -f "test/unit/PersistentCache.test.ts" ] || [ -f "test/unit/PersistentCache.test.js" ]; then
            if run_test_suite "Persistent Cache Tests" "npx mocha 'test/unit/PersistentCache*.test.js' --timeout 10000"; then
                PASSED_SUITES+=("Persistent Cache Tests")
            else
                FAILED_SUITES+=("Persistent Cache Tests")
            fi
        else
            SKIPPED_SUITES+=("Persistent Cache Tests")
        fi
        
        if [ -f "test/unit/SmartCacheManager.test.ts" ] || [ -f "test/unit/SmartCacheManager.test.js" ]; then
            if run_test_suite "Smart Cache Manager Tests" "npx mocha 'test/unit/SmartCacheManager*.test.js' --timeout 10000"; then
                PASSED_SUITES+=("Smart Cache Manager Tests")
            else
                FAILED_SUITES+=("Smart Cache Manager Tests")
            fi
        else
            SKIPPED_SUITES+=("Smart Cache Manager Tests")
        fi
        
        echo ""
    fi
    
    # 2. Component Tests
    if [ -z "$TEST_TYPE" ] || [ "$TEST_TYPE" = "component" ] || [ "$TEST_TYPE" = "all" ]; then
        echo -e "${BLUE}═══ Component Tests ═══${NC}"
        
        if [ "$IS_LINUX" = true ]; then
            # Linux FUSE3 Tests
            if [ -f "test/fuse-linux.test.js" ]; then
                if run_test_suite "Linux FUSE3 Component Tests" "npx mocha test/fuse-linux.test.js --timeout 60000"; then
                    PASSED_SUITES+=("Linux FUSE3 Component Tests")
                else
                    FAILED_SUITES+=("Linux FUSE3 Component Tests")
                fi
            else
                echo -e "${YELLOW}Compiling Linux FUSE3 tests...${NC}"
                npx tsc test/fuse-linux.test.ts --module commonjs --target es2022 --esModuleInterop || true
                if [ -f "test/fuse-linux.test.js" ]; then
                    if run_test_suite "Linux FUSE3 Component Tests" "npx mocha test/fuse-linux.test.js --timeout 60000"; then
                        PASSED_SUITES+=("Linux FUSE3 Component Tests")
                    else
                        FAILED_SUITES+=("Linux FUSE3 Component Tests")
                    fi
                else
                    SKIPPED_SUITES+=("Linux FUSE3 Component Tests")
                fi
            fi
            
            # Skip Windows tests on Linux
            SKIPPED_SUITES+=("Windows ProjFS Component Tests")
            
        elif [ "$IS_WINDOWS" = true ] || [ "$IS_WSL" = true ]; then
            # Windows ProjFS Tests
            if [ -f "test/projfs-windows.test.js" ]; then
                if run_test_suite "Windows ProjFS Component Tests" "npx mocha test/projfs-windows.test.js --timeout 60000"; then
                    PASSED_SUITES+=("Windows ProjFS Component Tests")
                else
                    FAILED_SUITES+=("Windows ProjFS Component Tests")
                fi
            else
                echo -e "${YELLOW}Compiling Windows ProjFS tests...${NC}"
                npx tsc test/projfs-windows.test.ts --module commonjs --target es2022 --esModuleInterop || true
                if [ -f "test/projfs-windows.test.js" ]; then
                    if run_test_suite "Windows ProjFS Component Tests" "npx mocha test/projfs-windows.test.js --timeout 60000"; then
                        PASSED_SUITES+=("Windows ProjFS Component Tests")
                    else
                        FAILED_SUITES+=("Windows ProjFS Component Tests")
                    fi
                else
                    SKIPPED_SUITES+=("Windows ProjFS Component Tests")
                fi
            fi
            
            # Can potentially run Linux tests in WSL
            if [ "$IS_WSL" = true ] && [ -f "test/fuse-linux.test.js" ]; then
                if run_test_suite "Linux FUSE3 Component Tests (WSL)" "npx mocha test/fuse-linux.test.js --timeout 60000"; then
                    PASSED_SUITES+=("Linux FUSE3 Component Tests (WSL)")
                else
                    FAILED_SUITES+=("Linux FUSE3 Component Tests (WSL)")
                fi
            else
                SKIPPED_SUITES+=("Linux FUSE3 Component Tests")
            fi
        fi
        
        echo ""
    fi
    
    # 3. Integration Tests
    if [ -z "$TEST_TYPE" ] || [ "$TEST_TYPE" = "integration" ] || [ "$TEST_TYPE" = "all" ]; then
        echo -e "${BLUE}═══ Integration Tests ═══${NC}"
        
        # Cached ProjFS Provider (Windows only)
        if [ "$IS_WINDOWS" = true ] || [ "$IS_WSL" = true ]; then
            if [ -f "test/integration/CachedProjFSProvider.test.js" ]; then
                if run_test_suite "Cached ProjFS Provider Integration" "npx mocha test/integration/CachedProjFSProvider.test.js --timeout 30000"; then
                    PASSED_SUITES+=("Cached ProjFS Provider Integration")
                else
                    FAILED_SUITES+=("Cached ProjFS Provider Integration")
                fi
            else
                SKIPPED_SUITES+=("Cached ProjFS Provider Integration")
            fi
            
            if [ -f "test/integration/FilerWithProjFS.test.js" ]; then
                if run_test_suite "Filer with ProjFS Integration" "npx mocha test/integration/FilerWithProjFS.test.js --timeout 30000"; then
                    PASSED_SUITES+=("Filer with ProjFS Integration")
                else
                    FAILED_SUITES+=("Filer with ProjFS Integration")
                fi
            else
                SKIPPED_SUITES+=("Filer with ProjFS Integration")
            fi
        else
            SKIPPED_SUITES+=("Cached ProjFS Provider Integration")
            SKIPPED_SUITES+=("Filer with ProjFS Integration")
        fi
        
        # Cross-platform integration tests
        if [ -f "test/cross-platform-integration.test.js" ]; then
            if run_test_suite "Cross-Platform Integration" "npx mocha test/cross-platform-integration.test.js --timeout 120000"; then
                PASSED_SUITES+=("Cross-Platform Integration")
            else
                FAILED_SUITES+=("Cross-Platform Integration")
            fi
        else
            echo -e "${YELLOW}Compiling cross-platform integration tests...${NC}"
            npx tsc test/cross-platform-integration.test.ts --module commonjs --target es2022 --esModuleInterop || true
            if [ -f "test/cross-platform-integration.test.js" ]; then
                if run_test_suite "Cross-Platform Integration" "npx mocha test/cross-platform-integration.test.js --timeout 120000"; then
                    PASSED_SUITES+=("Cross-Platform Integration")
                else
                    FAILED_SUITES+=("Cross-Platform Integration")
                fi
            else
                SKIPPED_SUITES+=("Cross-Platform Integration")
            fi
        fi
        
        echo ""
    fi
fi

# Generate summary report
echo ""
echo "========================================="
echo "Test Execution Summary"
echo "========================================="
echo ""

# Display results
if [ ${#PASSED_SUITES[@]} -gt 0 ]; then
    echo -e "${GREEN}Passed (${#PASSED_SUITES[@]}):${NC}"
    for suite in "${PASSED_SUITES[@]}"; do
        echo -e "  ${GREEN}✓${NC} $suite"
    done
    echo ""
fi

if [ ${#FAILED_SUITES[@]} -gt 0 ]; then
    echo -e "${RED}Failed (${#FAILED_SUITES[@]}):${NC}"
    for suite in "${FAILED_SUITES[@]}"; do
        echo -e "  ${RED}✗${NC} $suite"
    done
    echo ""
fi

if [ ${#SKIPPED_SUITES[@]} -gt 0 ]; then
    echo -e "${YELLOW}Skipped (${#SKIPPED_SUITES[@]}):${NC}"
    for suite in "${SKIPPED_SUITES[@]}"; do
        echo -e "  ${YELLOW}⏭${NC} $suite"
    done
    echo ""
fi

# Overall result
TOTAL=$((${#PASSED_SUITES[@]} + ${#FAILED_SUITES[@]} + ${#SKIPPED_SUITES[@]}))
echo "─────────────────────────────────────────"
echo "Total: $TOTAL test suites"
echo -e "Passed: ${GREEN}${#PASSED_SUITES[@]}${NC}"
echo -e "Failed: ${RED}${#FAILED_SUITES[@]}${NC}"
echo -e "Skipped: ${YELLOW}${#SKIPPED_SUITES[@]}${NC}"
echo ""

# Save report to file
REPORT_FILE="combined-test-report.txt"
{
    echo "ONE.filer Combined Test Report"
    echo "Generated: $(date)"
    echo "Platform: $PLATFORM"
    echo ""
    echo "Results:"
    echo "  Passed: ${#PASSED_SUITES[@]}"
    echo "  Failed: ${#FAILED_SUITES[@]}"
    echo "  Skipped: ${#SKIPPED_SUITES[@]}"
    echo ""
    
    if [ ${#FAILED_SUITES[@]} -gt 0 ]; then
        echo "Failed Suites:"
        for suite in "${FAILED_SUITES[@]}"; do
            echo "  - $suite"
        done
    fi
} > "$REPORT_FILE"

echo -e "${BLUE}Report saved to: $REPORT_FILE${NC}"
echo ""

# Exit with appropriate code
if [ ${#FAILED_SUITES[@]} -gt 0 ]; then
    echo -e "${RED}⚠️  TEST FAILURES DETECTED${NC}"
    exit 1
else
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    exit 0
fi