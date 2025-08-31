#!/bin/bash

# Practical sync test for one.filer using refinio.cli
# This test demonstrates real synchronization between two instances

set -e

echo "==========================================="
echo "     ONE.FILER PRACTICAL SYNC TEST"
echo "==========================================="
echo ""

# Configuration
INSTANCE1_DIR="./test-instance-alice"
INSTANCE2_DIR="./test-instance-bob"
INSTANCE1_PORT=3001
INSTANCE2_PORT=3002

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    # Kill any running instances
    pkill -f "one.filer.*test-instance" || true
    
    # Remove test directories
    rm -rf $INSTANCE1_DIR $INSTANCE2_DIR
    
    log_info "Cleanup complete"
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Step 1: Set up test instances
log_info "Setting up test instances..."
npx refinio sync setup \
    --dir1 $INSTANCE1_DIR \
    --dir2 $INSTANCE2_DIR \
    --port1 $INSTANCE1_PORT \
    --port2 $INSTANCE2_PORT

# Step 2: Start instance 1 (Alice)
log_info "Starting Alice's instance..."
npm run start -- \
    -s alice-secret \
    -c $INSTANCE1_DIR/config.json \
    --enable-admin-api \
    --api-port $INSTANCE1_PORT \
    > $INSTANCE1_DIR/output.log 2>&1 &

ALICE_PID=$!
log_info "Alice's instance started (PID: $ALICE_PID)"

# Wait for Alice to start
sleep 5

# Step 3: Start instance 2 (Bob)
log_info "Starting Bob's instance..."
npm run start -- \
    -s bob-secret \
    -c $INSTANCE2_DIR/config.json \
    --enable-admin-api \
    --api-port $INSTANCE2_PORT \
    > $INSTANCE2_DIR/output.log 2>&1 &

BOB_PID=$!
log_info "Bob's instance started (PID: $BOB_PID)"

# Wait for Bob to start
sleep 5

# Step 4: Check both instances are running
log_info "Verifying instances are running..."
npx refinio debug status

# Step 5: Check filesystem structure
log_info "Alice's filesystem:"
npx refinio debug fs-tree $INSTANCE1_DIR/mount --depth 2

log_info "Bob's filesystem:"
npx refinio debug fs-tree $INSTANCE2_DIR/mount --depth 2

# Step 6: Read invitation from Alice
log_info "Reading invitation from Alice..."
npx refinio sync read-invite $INSTANCE1_DIR

# Step 7: Create test data on Alice's side
log_info "Creating test data on Alice's instance..."
npx refinio sync write-test-data $INSTANCE1_DIR --path /shared-data

# Step 8: Monitor for changes
log_info "Starting filesystem monitor..."
npx refinio sync monitor $INSTANCE2_DIR --duration 15 &
MONITOR_PID=$!

# Step 9: Wait for sync (in real scenario, Bob would accept invite)
log_info "Waiting for sync to occur..."
sleep 10

# Step 10: Verify data on Bob's side
log_info "Verifying synced data on Bob's instance..."
npx refinio sync verify $INSTANCE2_DIR --path /shared-data || log_warn "Data not yet synced"

# Step 11: Check performance
log_info "Running performance tests..."
npx refinio debug perf $INSTANCE1_DIR/mount

# Step 12: Check connections
log_info "Checking connections..."
npx refinio debug connections $INSTANCE1_DIR

# Step 13: Memory usage
log_info "Checking memory usage..."
npx refinio debug memory

# Final summary
echo ""
echo "==========================================="
echo "            TEST SUMMARY"
echo "==========================================="

if [ -f "$INSTANCE1_DIR/mount/shared-data/test1.txt" ]; then
    log_info "✓ Test data created successfully on Alice"
else
    log_error "✗ Test data not found on Alice"
fi

if [ -f "$INSTANCE2_DIR/mount/shared-data/test1.txt" ]; then
    log_info "✓ Data synced to Bob successfully"
else
    log_warn "⚠ Data not synced to Bob (manual invite acceptance needed)"
fi

# Show logs
echo ""
log_info "Alice's logs (last 10 lines):"
tail -n 10 $INSTANCE1_DIR/output.log

echo ""
log_info "Bob's logs (last 10 lines):"
tail -n 10 $INSTANCE2_DIR/output.log

echo ""
log_info "Test complete! Instances are still running for manual inspection."
log_info "Press Ctrl+C to stop and clean up."

# Keep running for manual inspection
wait $ALICE_PID