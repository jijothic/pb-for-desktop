#!/bin/bash

# Project
PRODUCT_NAME="$(node -p 'require("./package.json").productName')"
INSTALL_PATH="/Applications/${PRODUCT_NAME}.app"

# Quit running
echo "Quitting: ${PRODUCT_NAME}"
killall "${PRODUCT_NAME}"

# Build
echo "Building: ${PRODUCT_NAME}"
npm --quiet run build darwin 

# Install
if [ -a "${INSTALL_PATH}" ]; then
      echo "Removing: ${INSTALL_PATH}"
      rm -rf "${INSTALL_PATH}"
fi
echo "Installing: ${INSTALL_PATH}"
mv "./build/staging/${PRODUCT_NAME}-darwin-x64/${PRODUCT_NAME}.app" $(dirname "${INSTALL_PATH}")

# Start
echo "Starting: ${INSTALL_PATH}"
DEBUG=1 open "${INSTALL_PATH}"
