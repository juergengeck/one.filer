#!/bin/bash
cd /mnt/c/Users/juerg/source/one.filer/src/fuse/n-api

echo "Starting FUSE test..."
node test-simple.js &
PID=$!

sleep 2

echo -e "\n=== Testing filesystem operations ==="
echo "Listing directory:"
ls -la /tmp/fuse-test-* 2>&1 | tail -1

echo -e "\nReading file:"
cat /tmp/fuse-test-*/hello.txt 2>&1

echo -e "\nKilling test process..."
kill $PID 2>/dev/null
wait $PID 2>/dev/null

echo "Test complete"