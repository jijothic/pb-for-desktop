'use strict';



/**
 * Modules: Node
 * @global
 */
const path = require('path'),
    util = require('util'),
    url = require('url');


/**
 * @global
 * @constant
 */
const moduleRoot = path.join(__dirname, '..');


/**
 * Debug
 * @constant
 * @global
 */
const debugMode = process.env['DEBUG'];


/**
 * Modules: Internal
 * @global
 */
const packageJson = require(path.join(moduleRoot, 'package.json')),
    platformHelper = require(path.join(moduleRoot, 'lib', 'platform-helper'));


//noinspection NpmUsedModulesInstalled
/**
 * Modules: Electron
 * @global
 */
const electron = require('electron');
const { ipcRenderer, remote } = electron;


/**
 * Modules: Third Party
 * @global
 */
const livereloadClient = require('electron-connect').client;



/**
 * DOM Components
 */
let webview = document.getElementById('webview'),
    spinner = document.getElementById('spinner'),
    controls = document.getElementById('controls'),
    buttons = {
        home: {
            target: document.querySelector('.controls__button.home'),
            event() { webview.goBack(); }
        }
    };


/**
 * DOM Controls
 */
let registerButtons = function() {
        for (let i in buttons) {
            buttons[i].target.addEventListener('click', buttons[i].event);
        }
    };


/**
 * Logger
 */
let logDefault = console.log;
console.debug = function() {
    if (!debugMode) {
        return;
    }

    let self = this,
        packageName = packageJson.name.toUpperCase(),
        messageList = Array.from(arguments),
        messageLabel = messageList.shift(),
        messageListFormatted = util.format.apply(null, messageList);

    // Add brackets
    packageName = '[' + packageName + ']';
    messageLabel = '[' + messageLabel + ']';

    // Show in console
    logDefault.apply(self, [
        '%c%s%c%s%c %c%s', 'font-weight: bold; background: #4AB367; color: white;',
        packageName,
        'background: #4AB367; color: white; padding: 0 2px 0 0',
        messageLabel,
        '',
        'font-weight: bold',
        messageListFormatted
    ]);

    // Send to main process
    ipcRenderer.send('log', [
        messageLabel,
        messageListFormatted
    ]);
};


/**
 * @listens webview:did-finish-load
 */
webview.addEventListener('did-finish-load', () => {

    // Init Controls
    registerButtons();

    // Hide Spinner
    spinner.classList.add('hide');

    // macOS Title Bar
    if (platformHelper.isMacOS) {
        webview.classList.add('padding-titlebar');
    }

    // DEBUG
    if (debugMode) {
        livereloadClient.create();
        webview.openDevTools();
    }
});



/**
 * @listens webview:new-window
 */
webview.addEventListener('new-window', (ev) => {
    let protocol = url.parse(ev.url).protocol;

    if (protocol === 'http:' || protocol === 'https:') {
        remote.shell.openExternal(ev.url);
    }

    // DEBUG
    console.debug('Event', 'new-window', ev.url);
});



/**
 * @listens webview:will-navigate
 */
webview.addEventListener('load-commit', (ev) => {
    let hostname = url.parse(ev.url).hostname;

    switch (hostname) {
        case 'accounts.google.com':
        case 'accounts.youtube.com':
        case 'www.facebook.com':
            controls.classList.add('show');
            break;
        default:
            controls.classList.remove('show');
    }

    // DEBUG
    // console.debug('Event', 'will-navigate', hostname);
});
