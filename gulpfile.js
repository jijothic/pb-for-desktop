'use strict';



/**
 * Modules: Node
 * @global
 */
const path = require('path');


/**
 * Modules: Internal
 * @global
 */
const moduleRoot = path.join(__dirname),
    packageJson = require(path.join(moduleRoot, 'package.json'));


/**
 * Modules: Third Party
 * @global
 */
const gulp = require('gulp'),
    livereloadServer = require('electron-connect').server;


/**
 * @global
 * @default
 */
const livereloadSettings = {
        useGlobalElectron: true,
        verbose: false
    };


/**
 * Files
 * @global
 * @constant
 */
const mainProcessFiles = [
        path.join(moduleRoot, 'app', 'main.js'),
        path.join(moduleRoot, 'app', 'scripts', 'application-menu.js'),
        path.join(moduleRoot, 'icons', '**', '*.*')
    ],
    rendererProcessFiles = [
        path.join(moduleRoot, 'app', 'index.html'),
        path.join(moduleRoot, 'app', 'scripts', 'browser.js'),
        path.join(moduleRoot, 'app', 'scripts', 'webview.js'),
        path.join(moduleRoot, 'app', 'styles', '*.css'),
        path.join(moduleRoot, 'app', 'images', '*.*'),
        path.join(moduleRoot, 'app', 'fonts', '*.*')
    ];


gulp.task('serve', function() {

    // Create server
    livereloadServer.create(livereloadSettings).start();

    // Restart main process
    gulp.watch(mainProcessFiles, livereloadServer.restart);

    // Reload renderer process
    gulp.watch(rendererProcessFiles, livereloadServer.reload);
});

gulp.task('reload:main', function() {
    livereloadServer.restart();
});

gulp.task('reload:renderer', function() {
    livereloadServer.reload();
});

gulp.task('default', ['serve']);

