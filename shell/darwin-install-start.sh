#!/bin/bash

# Build
echo "Building.."
npm run build darwin

# Install
echo "Installing.."
rm -rf "/Applications/Pushbullet for Desktop.app"
mv "./build/staging/Pushbullet for Desktop-darwin-x64/Pushbullet for Desktop.app" "/Applications/"

# Start
echo "Starting.."
DEBUG=1 open "/Applications/Pushbullet for Desktop.app"
