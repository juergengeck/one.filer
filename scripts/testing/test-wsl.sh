#!/bin/bash
# This script runs tests in WSL context

echo "Setting up WSL environment for tests..."

# Ensure we're in the right directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Make test scripts executable
chmod +x test/scripts/run-tests.sh

# Run the tests
bash test/scripts/run-tests.sh