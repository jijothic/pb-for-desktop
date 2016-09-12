#!/bin/bash

# Project
PRODUCT_NAME="$(node -p 'require("./package.json").productName')"

# Quit running
echo "Quitting: ${PRODUCT_NAME}"
killall "${PRODUCT_NAME}"

# Build
echo "Building: ${PRODUCT_NAME}"
npm run build darwin

# Install
echo "Installing: ${PRODUCT_NAME}"
rm -rf "/Applications/${PRODUCT_NAME}.app"
mv "./build/staging/${PRODUCT_NAME}-darwin-x64/${PRODUCT_NAME}.app" "/Applications/${PRODUCT_NAME}.app"

# Start
echo "Starting: ${PRODUCT_NAME}"
DEBUG=1 open "/Applications/${PRODUCT_NAME}.app"
