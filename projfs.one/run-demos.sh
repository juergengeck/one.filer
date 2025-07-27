#!/bin/bash

echo "🚀 ProjFS.ONE Demos"
echo "=================="
echo ""

echo "Choose a demo to run:"
echo "1. Development Demo (Core functionality test)"
echo "2. Integration Demo (Full stack architecture)"
echo "3. Basic Mount (Simple filesystem example)"
echo "4. Exit"
echo ""

read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "Running Development Demo..."
        echo ""
        node dist/examples/dev-demo.js
        ;;
    2)
        echo ""
        echo "Running Integration Demo..."
        echo ""
        node dist/examples/integration-demo.js
        ;;
    3)
        echo ""
        echo "Running Basic Mount Example..."
        echo ""
        node dist/examples/basic-mount.js
        ;;
    4)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice. Please run again."
        ;;
esac