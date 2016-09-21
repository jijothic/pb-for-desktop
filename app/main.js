'use strict';



/**
 * Modules: Node
 * @global
 */
const path = require('path'),
    fs = require('fs-extra'),
    util = require('util');



/**
 * @global
 * @constant
 */
const moduleRoot = path.join(__dirname, '..');



//noinspection NpmUsedModulesInstalled
/**
 * Modules: Electron
 * @global
 */
const electron = require('electron');
const { app, BrowserWindow, Tray, Menu, shell, dialog, ipcMain } = electron;



/**
 * Modules: Third Party
 * @global
 */
const _ = require('lodash'),
    electronSettings = require('electron-settings'),
    squirrel = require('electron-squirrel-startup'),
    keypath = require('keypath'),
    mime = require('mime'),
    AppDirectory = require('appdirectory'),
    AutoLaunch = require('auto-launch');



/**
 * Modules: Internal
 * @global
 */
const packageJson = require(path.join(moduleRoot, 'package.json')),
    platformHelper = require(path.join(moduleRoot, 'lib', 'platform-helper')),
    applicationMenu = require(path.join(moduleRoot, 'app', 'scripts', 'application-menu')),
    logger = require(path.join(moduleRoot, 'lib', 'logger'));



/**
 * Debug
 * @constant
 * @global
 */
const debugMode = process.env['DEBUG'];



/** App Properties
 * @global
 * @constant
 */
const appUrl = 'file://' + moduleRoot + '/app/index.html',
    appName = packageJson.name,
    appProductName = packageJson.productName || packageJson.name,
    appVersion = packageJson.version,
    appIcon = path.join(moduleRoot, 'icons', platformHelper.type, 'app-icon' + platformHelper.iconExtension(platformHelper.type)),
    appTrayIconDefault = path.join(moduleRoot, 'icons', platformHelper.type, 'icon-tray' + platformHelper.imageExtension(platformHelper.type)),
    appSoundDirectory = path.join(moduleRoot, 'sounds'),
    appLogDirectory = (new AppDirectory(appName)).userLogs(),
    appLauncher =  debugMode ? new AutoLaunch({ name: appName }) : void 0;


/**
 * @global
 */
let mainWindow,
    mainPage,
    appMenu,
    appTray,
    appTrayMenu;



/**
 * Squirrel Handler
 */
if (squirrel) {
    (function() {
        return;
    })();
}



/**
 * Error Handler
 * @param {String} message - Error Message
 */
let handleError = function(message) {
    dialog.showMessageBox({
        type: 'warning',
        icon: appIcon,
        buttons: ['Dismiss'],
        defaultId: 0,
        title: 'Error',
        message: 'Error',
        detail: message || 'Error'
    });
};



/**
 * Validate Files by Mimetype
 */
let validateFileType = function(file, targetType, cb) {
    let filePath = path.normalize(file.toString()),
        foundType;

    fs.stat(filePath, function(err) {
        if (err) { return cb(err); }

        foundType = mime.lookup(filePath);

        if (!_(foundType).startsWith(targetType)) {
            return cb(foundType);
        }

        cb(null, filePath);
    });
};


/**
 * Log to console and file
 * @param {*} messageList - Log Message
 */
let log = function(messageList) {
    let date = (new Date()),
        dateString = date.toISOString().replace(/Z|T|\..+/gi, ' ').trim().split(' ').reverse().join(' '),
        logString = messageList.join(' '),
        logEntry = '[' + dateString + '] ' + logString;

    for (let message in messageList) {
        if (messageList[message] !== null && typeof messageList[message] === 'object') {
            messageList[message] = '\r\n' + util.inspect(messageList[message], {
                    colors: true, showProxy: true, showHidden: true, depth: null
                });
        }
    }

    electronSettings.get('internal.logFile')
        .then(logFile => {
            // Create Directory
            fs.mkdirp(path.dirname(logFile), (err) => {
                if (err) {
                    return console.error('log', 'fs.mkdirp', err);
                }
                // Append Log
                fs.appendFile(logFile, (logEntry + '\r\n'), function(err) {
                    if (err) {
                        return console.error('log', 'fs.appendFile', err);
                    }
                });
            });
        });

    logger.log(dateString, logString);
};


/**
 * ipcMain
 */
/** @listens ipcMain:notification-click */
ipcMain.on('notification-click', (event, options) => {
    let url = options.url;
    if (url) {
        return shell.openExternal(url);
    }
    mainWindow.show();
});

/** @listens ipcMain:error-show */
ipcMain.on('error-show', (event, message) => {
    handleError(message);
});

/** @listens ipcMain:error-external */
ipcMain.on('error-external', () => {
    if (platformHelper.isMacOS) {
        app.dock.bounce();
    }
});

/** @listens ipcMain:window-minimize */
ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
});

/** @listens ipcMain:window-maximize */
ipcMain.on('window-unmaximize', () => {
    mainWindow.unmaximize();
});

/** @listens ipcMain:window-fullscreen */
ipcMain.on('window-maximize', () => {
    mainWindow.maximize();
});

/** @listens ipcMain:window-close */
ipcMain.on('window-close', () => {
    mainWindow.close();
});

/** @listens ipcMain:app-quit */
ipcMain.on('app-quit', () => {
    app.quit();
});

/** @listens ipcMain:log */
ipcMain.on('log', (event, message) => {
    return log(message); // jshint ignore:line
});


/**
 * Show App in Dock / Taskbar
 * @param {Boolean} show - True: show dock icon, false: hide icon
 */
let setDisplayInTaskbar = function(show) {
    if (show) {
        if (platformHelper.isMacOS) {
            app.dock.show();
        } else {
            mainWindow.setSkipTaskbar(false);
        }
    } else {
        if (platformHelper.isMacOS) {
            app.dock.hide();
        } else {
            mainWindow.setSkipTaskbar(true);
        }
    }
};


/**
 * Handle App Settings Click
 * @param {Electron.MenuItem} item - Electron Menu item
 * @param {Object} settingsInstance - electron-settings instance
 * @param {String=} settingKeypath - Nested Keypath to registrable settings, e.g. 'options.app'
 * @param {Object=} eventObject - Optionally attach behaviour to options
 */
let handleAppSettingsClick = function(item, settingsInstance, settingKeypath, eventObject) {
    let itemKeypath = settingKeypath,
        itemChecked = item.checked;

    settingsInstance.setSync(itemKeypath, itemChecked);

    let handler = keypath(itemKeypath, eventObject);

    if (_.isFunction(handler)) {
        handler(itemChecked);
    }
};


/**
 * app
 */
/** @listens app#before-quit */
app.on('before-quit', () => {
    electronSettings.setSync('internal.windowBounds', mainWindow.getBounds());
    app.isQuitting = true;
});

/** @listens app#quit */
app.on('quit', () => {
    log(['Settings file', electronSettings.getSettingsFilePath()]);
    logger.debug('electronSettings', electronSettings.getSync());
});

/** @listens app#activate */
app.on('activate', () => {
    mainWindow.show();
});



/**
 * Settings
 * @property {Boolean} user.displayInTaskbar - Show Main Window
 * @property {Boolean} user.enableSound - Play Notification Sound
 * @property {Boolean} user.launchOnStartup - Autostart
 * @property {Boolean} user.showRecentPushesOnLaunch - Show recent pushes
 * @property {String} app.currentVersion - Application Version
 * @property {Number} app.lastNotification - Timestamp of last delivered Pushbullet Push
 * @property {Object} app.windowBounds - Application Window position and size
 * @property {String} app.notificationFile - Notification sound
 * @property {String} app.logFile - Log file
 */
const defaultSettings = {
    user: {
        displayInTaskbar: true,
        launchOnStartup: false,
        showRecentPushesOnStartup: true,
        enableSound: true,
        snoozeNotifications: false
    },
    internal: {
        name: appProductName,
        currentVersion: appVersion,
        lastNotification: Math.floor(Date.now() / 1000) - 86400,
        windowBounds: {
            x: 100,
            y: 100,
            width: 400,
            height: 550
        },
        notificationFile: path.join(appSoundDirectory, 'notification-default.wav'),
        logFile: path.join(appLogDirectory, appProductName + '.log')
    }
};


/**
 * Events attached to settings
 */
const settingsEvents = {
    user: {
        displayInTaskbar: function(display) {
            setDisplayInTaskbar(display);
        },
        launchOnStartup: function(launch) {
            if (launch) {
                appLauncher.enable();
            } else {
                appLauncher.disable();
            }
        }
    },
    internal: {
        notificationFile: function(items) {
            if (items) {
                validateFileType(items, 'audio', function(err, file) {
                    if (err) { return log([err]); }
                    electronSettings.set('internal.notificationFile', file).then(() => { });

                    electronSettings.get('internal.windowBounds')
                        .then(value => {
                            mainWindow.setBounds(value);
                        });

                    log(['Updated Setting', 'notificationFile', file]);
                });
            }
        }
    }
};


/**
 *  Main
 */
app.on('ready', () => {

    // Add Settings to globals
    global.electronSettings = electronSettings;

    // Settings Configuration
    electronSettings.configure({
        prettify: true,
        atomicSaving: true
    });

    // Settings Defaults
    electronSettings.defaults(defaultSettings);
    electronSettings.applyDefaultsSync();

    // Log Directory
    fs.mkdirp(appLogDirectory, (err) => {
        return log(['appLogDirectory', err]);
    });

    // Init Tray
    appTray = new Tray(appTrayIconDefault);
    appTray.setImage(appTrayIconDefault);
    appTray.setToolTip(appProductName);
    appTrayMenu = Menu.buildFromTemplate([
        {
            type: 'normal',
            enabled: false,
            label: appProductName + ' v' + appVersion
        },
        {
            label: 'Show',
            click() { mainWindow.show(); }
        },
        {
            label: 'Quit',
            click() { app.quit(); }
        },
        {
            type: 'separator'
        },
        {
            type: 'normal',
            enabled: false,
            label: 'General'
        },
        {
            label: 'Display App Window',
            type: 'checkbox',
            checked: electronSettings.getSync('user.displayInTaskbar'),
            click(item) {
                return handleAppSettingsClick(item, electronSettings, 'user.displayInTaskbar', settingsEvents);
            }
        },
        {
            label: 'Snooze Notifications',
            type: 'checkbox',
            checked: electronSettings.getSync('user.snoozeNotifications'),
            click(item) {
                return handleAppSettingsClick(item, electronSettings, 'user.snoozeNotifications', settingsEvents);
            }
        },
        {
            type: 'separator'
        },
        {
            type: 'normal',
            enabled: false,
            label: 'Startup'
        },
        {
            label: 'Launch on System Startup',
            type: 'checkbox',
            checked: electronSettings.getSync('user.launchOnStartup'),
            click(item) {
                return handleAppSettingsClick(item, electronSettings, 'user.launchOnStartup', settingsEvents);
            }
        }, {
            label: 'Show Recent Pushes On Launch',
            type: 'checkbox',
            checked: electronSettings.getSync('user.showRecentPushesOnLaunch'),
            click(item) {
                return handleAppSettingsClick(item, electronSettings, 'user.showRecentPushesOnStartup', settingsEvents);
            }
        },
        {
            type: 'separator'
        },
        {
            type: 'normal',
            enabled: false,
            label: 'Audio'
        },
        {
            label: 'Enable Sound effects',
            type: 'checkbox',
            checked: electronSettings.getSync('user.enableSound'),
            click(item) {
                return handleAppSettingsClick(item, electronSettings, 'user.enableSound', settingsEvents);
            }
        },
        {
            type: 'normal',
            id: 'notificationFile',
            label: 'Change Notification Sound...',
            click() {
                dialog.showOpenDialog({
                    title: 'Change Notification Sound', properties: ['openFile', 'showHiddenFiles'],
                    defaultPath: appSoundDirectory,
                    filters: [{ name: 'Sound', extensions: ['aiff', 'm4a', 'mp3', 'mp4', 'wav'] }]
                }, settingsEvents.internal.notificationFile);
            }
        }
    ]);

    appTray.setContextMenu(appTrayMenu);

    //addAppSettingsToTray(appTrayMenu, appTray, electronSettings, 'user', DEFAULT_EVENTS);

    // Create the browser window.
    mainWindow = new BrowserWindow({
        backgroundColor: '#4AB367',
        minWidth: 256,
        minHeight: 512,
        frame: ( platformHelper.isMacOS ) ? false : true,
        icon: appIcon,
        title: appProductName,
        show: false,
        titleBarStyle: platformHelper.isMacOS ? 'hidden-inset' : 'default',
        autoHideMenuBar: true,
        thickFrame: true,
        fullscreenable: true,
        webPreferences: {
            nodeIntegration: true,
            allowDisplayingInsecureContent: true,
            experimentalFeatures: true,
            allowRunningInsecureContent: true,
            webSecurity: false,
            webaudio: true
        }
    });

    // and load the index.html of the app.
    mainWindow.loadURL(appUrl);

    // Web Contents
    mainPage = mainWindow.webContents;


    /**
     * mainWindow
     */
    /** @listens mainWindow:close */
    mainWindow.on('close', ev => {
        if (!app.isQuitting) {
            ev.preventDefault();
            mainWindow.hide();
        }
    });

    /**
     * mainPage
     */
    /** @listens mainPage:will-navigate */
    mainPage.on('will-navigate', (event, url) => {
        event.preventDefault();
        if (url) {
            shell.openExternal(url);
        }
    });
    /** @listens mainPage:dom-ready */
    mainPage.on('dom-ready', () => {
        mainWindow.show();

        if (debugMode) {
            mainPage.openDevTools();
        }
    });


    // Create the Application's main menu
    appMenu = Menu.buildFromTemplate(applicationMenu());

    Menu.setApplicationMenu(appMenu);

    // Update Settings
    electronSettings.set('internal.currentVersion', appVersion)
        .then(() => {});

    // Apply Settings
    electronSettings.get('internal.windowBounds')
        .then(windowBounds => {
            mainWindow.setBounds(windowBounds);
        });
    electronSettings.get('user.displayInTaskbar')
        .then(displayInTaskbar => {
            setDisplayInTaskbar(displayInTaskbar);
        });
    electronSettings.get('user.launchOnStartup')
        .then(launchOnStartup => {
            if (launchOnStartup) {
                appLauncher.enable();
            } else {
                appLauncher.disable();
            }
        });
});
