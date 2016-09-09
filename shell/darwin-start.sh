#!/bin/bash

# Project
PRODUCT_NAME=$(node -p "require('./package.json').productName")

# Quit running
echo "Quitting: ${PRODUCT_NAME}"
killall "${PRODUCT_NAME}"

# Start
echo "Starting: ${PRODUCT_NAME}"
DEBUG=1 open "/Applications/${PRODUCT_NAME}.app"
