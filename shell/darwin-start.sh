#!/bin/bash

# Project
PRODUCT_NAME="$(node -p 'require("./package.json").productName')"
INSTALL_PATH="/Applications/${PRODUCT_NAME}.app"

# Quit running
echo "Quitting: ${PRODUCT_NAME}"
killall "${PRODUCT_NAME}"

# Start
echo "Starting: ${INSTALL_PATH}"
DEBUG=1 open "${INSTALL_PATH}"
