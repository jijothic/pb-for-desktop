#!/usr/bin/env node


/**
 * Modules: Node
 * @global
 */
const path = require('path'),
    childProcess = require('child_process');

/**
 * Modules: External
 * @global
 */
const electronPath = require('electron-prebuilt');

/**
 * Modules: Internal
 * @global
 */
const moduleRoot = path.join(__dirname, '..'),
    packageJson = require(path.join(moduleRoot, 'package.json'));

/**
 * Path to Electron application
 * @global
 */
const appMain = path.join(moduleRoot, packageJson.main);


// Run
childProcess.spawn(electronPath, [ appMain ], {
    stdio: 'inherit'
});
