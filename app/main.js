'use strict';


/**
 * Modules: Node
 * @global
 */
const path = require('path'),
    fs = require('fs.extra'),
    util = require('util');

/**
 * @global
 * @constant
 */
const moduleRoot = path.join(__dirname, '..');

/**
 * Modules: Electron
 * @global
 */
const electron = require('electron');
const { app, BrowserWindow, Tray, Menu, MenuItem, shell, dialog, ipcMain } = electron;

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
    defaultAppMenu = require(path.join(moduleRoot, 'lib', 'application-menu')),
    logger = require(path.join(moduleRoot, 'lib', 'logger'));


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
    appTrayIconActive = path.join(moduleRoot, 'icons', platformHelper.type, 'icon-tray-active' + platformHelper.imageExtension(platformHelper.type)),
    appSoundDirectory = path.join(moduleRoot, 'sounds'),
    appLogDirectory = (new AppDirectory(appName)).userLogs(),
    appLauncher = new AutoLaunch({ name: appProductName });



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
    return;
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
 * IPC: New Notification
 * @listens ipcMain#notification-click
 */
ipcMain.on('notification-received', () => {
    appTray.setImage(appTrayIconActive);
});



/**
 * IPC: Notification Clicked
 * @param  {ipcMain#IpcMessageEvent} event
 * @param  {*} options
 * @listens ipcMain#notification-click
 */
ipcMain.on('notification-click', (event, options) => {
    log(['notification-click', 'options', options]);

    let url = options.url;
    if (url) {
        return shell.openExternal(url);
    }
    mainWindow.show();
});



/**
 * IPC: Error
 * @param  {ipcMain#IpcMessageEvent} event
 * @param  {*} message
 * @listens ipcMain#error-show
 */
ipcMain.on('error-show', (event, message) => {
    handleError(message);
});



/**
 * IPC: External Error
 * @listens ipcMain#external-error
 */
ipcMain.on('error-external', () => {
    if (platformHelper.isOSX) {
        app.dock.bounce();
    }
});



/**
 * IPC: Log
 * @listens ipcMain:log
 */
ipcMain.on('log', (event, message) => {
    return log(message); // jshint ignore:line
});



/**
 * Check an objects' type
 */
let getObjectType = function(o) {
    return Object.prototype.toString.call(o).match(/^\[object\s(.*)]$/)[1];
};



/**
 * Dock Visibility
 * @param {Boolean} show - True: show dock icon, false: hide icon
 */
let setWindowVisibility = function(show) {
    // macOS
    if (platformHelper.isOSX) {
        if (show === true) {
            app.dock.show();
        } else {
            app.dock.hide();
        }
    }

    // Windows / Linux
    if (!platformHelper.isOSX) {
        if (show === true) {
            mainWindow.show();
        } else {
            mainWindow.hide();
        }
    }
};



/**
 * Handle App Settings Click
 * @param {Electron.MenuItem} item - Electron Menu item
 * @param {electronSettings#electronSettings} settingsInstance - electron-settings instance
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
 * Automatically add Boolean (checkbox) Settings to Electron Menus
 * @param {Electron.Menu} targetMenu - Electron Menu to add settings to
 * @param {Tray} parentTray - Electron Tray instance hosting the menu
 * @param {electronSettings#electronSettings} settingsInstance - electron-settings instance
 * @param {String=} relativeKeypath - Nested Keypath to registrable settings, e.g. 'options.app'
 * @param {Object=} eventObject - Optionally attach behaviour to options
 */
let addAppSettingsToTray = function(targetMenu, parentTray, settingsInstance, relativeKeypath, eventObject) {
    let settings = keypath(relativeKeypath, settingsInstance.getSync()) || settingsInstance.getSync(),
        settingsCount = Object.keys(settings).length;

    // Create new menu instance using existing items
    let menu = new Menu();

    // Add existing Menu Items
    for (let item of targetMenu.items) {
        menu.append(new MenuItem(item));
    }

    // Loop all Settings
    let iteration = 0;
    for (let option in settings) {

        // Only support Booleans (checkboxes) for now
        if (_.isBoolean(settings[option]) === true) {

            let settingKeypath = relativeKeypath + '.' + option;

            let newItem = new MenuItem({
                type: 'checkbox',
                label: _.startCase(option),
                checked: settingsInstance.getSync(settingKeypath),
                click (item) {
                    return handleAppSettingsClick(item, settingsInstance, settingKeypath, eventObject);
                }
            });

            menu.append(newItem);

            // Check if last iteration
            if (iteration !== settingsCount) {
                // Add separator line
                menu.append(new MenuItem({ type: 'separator' }));
            }

            // Increment iteration
            iteration++;
        }
    }

    if (getObjectType(parentTray) === 'Tray') {
        parentTray.setContextMenu(menu);
    }
};



/** @listens app#before-quit */
app.on('before-quit', () => {
    mainWindow.forceClose = true;
});


/** @listens app#quit */
app.on('quit', () => {
    log(['Settings file', electronSettings.getSettingsFilePath(), electronSettings.getSync()]);
});


/** @listens app#activate */
app.on('activate', () => {
    mainWindow.show();
});


/** @listens app#window-all-closed */
app.on('window-all-closed', () => {
    if (platformHelper.type !== 'darwin') {
        app.quit();
    }
});


/**
 * Settings
 * @property {Boolean} user.showWindow - Show App Window
 * @property {Boolean} user.enableSound - Play Notification Sound
 * @property {Boolean} user.launchOnStartup - Autostart
 * @property {Boolean} user.showRecentPushesOnLaunch - Show recent pushes
 * @property {String} app.currentVersion - Application Version
 * @property {Number} app.lastNotification - Timestamp of last delivered Pushbullet Push
 * @property {Object} app.windowPosition - Application Window position and size
 * @property {String} app.notificationFile - Notification sound
 * @property {String} app.logFile - Log file
 */
const DEFAULT_SETTINGS = {
    user: {
        showWindow: true,
        launchOnStartup: false,
        showRecentPushesOnStartup: true,
        enableSound: true,
        snoozeNotifications: false
    },
    internal: {
        name: appProductName,
        currentVersion: appVersion,
        lastNotification: Math.floor(Date.now() / 1000) - 86400,
        windowPosition: {
            x: 100,
            y: 100,
            width: 400,
            height: 598
        },
        notificationFile: path.join(appSoundDirectory, 'notification-default.wav'),
        logFile: path.join(appLogDirectory, appProductName + '.log')
    }
};


/**
 * Events attached to settings
 */
const DEFAULT_EVENTS = {
    user: {
        showWindow: function(show) {
            setWindowVisibility(show);
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
                    electronSettings.set('internal.notificationFile', file).then(() => {});

                    electronSettings.get('internal.windowPosition')
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

    // Settings Configuration
    electronSettings.configure({
        prettify: true,
        atomicSaving: true
    });

    // Settings Defaults
    electronSettings.defaults(DEFAULT_SETTINGS);
    electronSettings.applyDefaultsSync();

    // Log Directory
    fs.mkdirp(appLogDirectory, (err) => {
        return log(['appLogDirectory', err]);
    });

    // Add globals to Electrons 'global'
    global.electronSettings = electronSettings;

    // Init Tray
    appTray = new Tray(appTrayIconDefault);
    appTray.setImage(appTrayIconDefault);
    appTray.setToolTip(appProductName);
    appTrayMenu = Menu.buildFromTemplate([
        {
            label: 'Show' + ' ' + appProductName,
            click() { mainWindow.show(); }
        },
        {
            type: 'separator'
        },
        {
            type: 'normal',
            enabled: false,
            label: 'General:'
        },
        {
            label: 'Display App Window',
            type: 'checkbox',
            checked: electronSettings.getSync('user.showWindow'),
            click (item) {
                return handleAppSettingsClick(item, electronSettings, 'user.showWindow', DEFAULT_EVENTS);
            }
        },
        {
            label: 'Snooze Notifications',
            type: 'checkbox',
            checked: electronSettings.getSync('user.snoozeNotifications'),
            click (item) {
                return handleAppSettingsClick(item, electronSettings, 'user.snoozeNotifications', DEFAULT_EVENTS);
            }
        },
        {
            type: 'separator'
        },
        {
            type: 'normal',
            enabled: false,
            label: 'Startup:'
        },
        {
            label: 'Launch on System Startup',
            type: 'checkbox',
            checked: electronSettings.getSync('user.launchOnStartup'),
            click (item) {
                return handleAppSettingsClick(item, electronSettings, 'user.launchOnStartup', DEFAULT_EVENTS);
            }
        }, {
            label: 'Show Recent Pushes On Launch',
            type: 'checkbox',
            checked: electronSettings.getSync('user.showRecentPushesOnLaunch'),
            click (item) {
                return handleAppSettingsClick(item, electronSettings, 'user.showRecentPushesOnStartup', DEFAULT_EVENTS);
            }
        },
        {
            type: 'separator'
        },
        {
            type: 'normal',
            enabled: false,
            label: 'Audio:'
        },
        {
            label: 'Enable Sound effects',
            type: 'checkbox',
            checked: electronSettings.getSync('user.enableSound'),
            click (item) {
                return handleAppSettingsClick(item, electronSettings, 'user.enableSound', DEFAULT_EVENTS);
            }
        },
        {
            type: 'normal',
            id: 'notificationFile',
            label: 'Change Notification Sound...',
            click() {
                dialog.showOpenDialog({
                    title: 'Pick Soundfile (aiff, m4a, mp3, mp4, m4a)', properties: ['openFile', 'showHiddenFiles'],
                    defaultPath: appSoundDirectory,
                    filters: [{ name: 'Sound', extensions: ['aiff', 'm4a', 'mp3', 'mp4', 'wav'] }]
                }, DEFAULT_EVENTS.internal.notificationFile);
            }
        },
        {
            type: 'separator'
        },
        {
            type: 'normal',
            enabled: false,
            label: 'Version' + ' ' + appVersion
        },
        {
            label: 'Quit' + ' ' + appProductName,
            click() { app.quit(); }
        },
    ]);

    appTray.setContextMenu(appTrayMenu);

    //addAppSettingsToTray(appTrayMenu, appTray, electronSettings, 'user', DEFAULT_EVENTS);

    // Create the browser window.
    mainWindow = new BrowserWindow({
        backgroundColor: '#4AB367',
        minHeight: 400,
        minWidth: 400,
        frame: false,
        icon: appIcon,
        title: appProductName,
        show: false,
        titleBarStyle: 'hidden',
        alwaysOnTop: true,
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: true,
            allowDisplayingInsecureContent: true,
            experimentalFeatures: true,
            allowRunningInsecureContent: true,
            webSecurity: false,
            webaudio: true,
            scrollBounce: true
        }
    });

    // and load the index.html of the app.
    mainWindow.loadURL(appUrl);

    // Web Contents
    mainPage = mainWindow.webContents;

    /** @listens mainWindow#closed */
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    /** @listens mainWindow:focus */
    mainWindow.on('focus', () => {
        appTray.setImage(appTrayIconDefault);
    });

    /** @listens mainWindow:show */
    mainWindow.on('show', () => {
        if (mainWindow.forceClose) {
            return;
        }

        electronSettings.get('internal.windowPosition')
            .then(value => {
                mainWindow.setBounds(value);
            });
    });

    /** @listens mainWindow:close */
    mainWindow.on('close', ev => {
        electronSettings.set('internal.windowPosition', mainWindow.getBounds())
            .then(() => {});

        if (mainWindow.forceClose) {
            return;
        }
        ev.preventDefault();
        mainWindow.hide();
    });

    /** @listens mainWindow:will-navigate */
    mainPage.on('will-navigate', (event, url) => {
        event.preventDefault();
        shell.openExternal(url);
    });

    /** @listens mainWindow:dom-ready */
    mainPage.on('dom-ready', () => {
        mainWindow.show();
        //mainPage.openDevTools();

        if (process.env['DEBUG']) {
            mainPage.openDevTools();
        }
    });

    // Create the Application's main menu
    appMenu = Menu.buildFromTemplate(defaultAppMenu());

    Menu.setApplicationMenu(appMenu);

    // Update Settings
    electronSettings.set('internal.currentVersion', appVersion)
        .then(() => {
            log(['internal.currentVersion', appVersion]);
        }).then(function(err) {
        log(['electronSettings', 'internal.currentVersion', err]);
    });

    // Apply Settings
    electronSettings.get('user.showWindow')
        .then(showWindow => {
            setWindowVisibility(showWindow);
        }).then(function(err) {
        log(['electronSettings', 'user.showWindow', err]);
    });
    electronSettings.get('user.launchOnStartup')
        .then(value => {
            if (value) {
                appLauncher.enable();
            } else {
                appLauncher.disable();
            }
        }).then(function(err) {
        log(['electronSettings', 'user.launchOnStartup', err]);
    });
});
