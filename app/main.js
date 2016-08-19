'use strict';


/**
 * Modules: Node
 * @global
 */
const path = require('path'),
    fs = require('fs'),
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
    mkdirp = require('mkdirp'),
    AppDirectory = require('appdirectory');

/**
 * Modules: Internal
 * @global
 */
const packageJson = require(path.join(moduleRoot, 'package.json')),
    platform = require(path.join(moduleRoot, 'lib', 'platform')),
    logger = require(path.join(moduleRoot, 'lib', 'logger')),
    defaultAppMenu = require(path.join(moduleRoot, 'lib', 'application-menu'));


/** App Properties
 * @global
 * @constant
 */
const appUrl = 'file://' + moduleRoot + '/app/index.html',
    appName = packageJson.productName || packageJson.name,
    appVersion = packageJson.version,
    appIcon = path.join(moduleRoot, 'icons', platform.type, 'app-icon' + platform.icon(platform.type)),
    appTrayIconDefault = path.join(moduleRoot, 'icons', platform.type, 'icon-tray' + platform.image(platform.type)),
    appTrayIconActive = path.join(moduleRoot, 'icons', platform.type, 'icon-tray-active' + platform.image(platform.type)),
    appSoundDirectory = path.join(moduleRoot, 'sounds'),
    appLogDirectory = (new AppDirectory(appName)).userLogs();


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
    logger.log('Handling Squirrel call', squirrel);
    return; // jscs:ignore maximumLineLength
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
    var filePath = path.normalize(file.toString()),
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
    logger.log('notification-click', 'options', options);

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
    if (platform.isOSX) {
        app.dock.bounce();
    }
});


/**
 * Log
 */
ipcMain.on('log', (event, message) => {
    let jsonDate = (new Date()).toJSON(),
        logEntry = '[' + jsonDate + ']' + ' ' + util.format.apply(null, message) + '\n';

    electronSettings.get('app.logFile')
        .then(value => {
            fs.appendFile(value, logEntry, (err) => {
                if (err) { return logger.log('error', err); }
            });
        });
});


/**
 * Dock Visibility
 * @param {Boolean} enable - True: show dock icon, false: hide icon
 */
let updateDock = function(enable) {
    if (platform.isOSX) {
        if (enable === true) {
            return app.dock.show();
        }
        app.dock.hide();
    }

    if (!platform.isOSX) {
        if (enable === true) {
            return mainWindow.show();
        }
        mainWindow.hide();
    }
};


/**
 * Register Configuration
 * @param {Electron.Menu} currentMenu - Electron Menu to add settings to
 * @param {electronSettings} electronSettingsInstance - 'electron-settings' instance
 * @param {String..} relativeKeypath - Nested Keypath to registrable settings, e.g. 'options.app'
 * @param {Object..} eventObject - Optionally attach behaviour to options
 */
let registerOptionsWithMenu = function(currentMenu, electronSettingsInstance, relativeKeypath, eventObject) {
    let settings = keypath(relativeKeypath, electronSettingsInstance.getSync()) || electronSettingsInstance.getSync();

    let menu = new Menu();

    // Add existing Menu Items
    for (let item of currentMenu.items) {
        menu.append(new MenuItem(item));
    }

    // Add Seperator
    menu.append(new MenuItem({ type: 'separator' }));

    // Add on/off to Menu
    for (let option in settings) {
        let absoluteKeypath = relativeKeypath + '.' + option;

        let newItem = new MenuItem({
            type: 'checkbox',
            id: option,
            label: _.startCase(option),
            checked: electronSettingsInstance.getSync(absoluteKeypath),
            click(item) {
                electronSettingsInstance.setSync(absoluteKeypath, item.checked);

                let handler = keypath(absoluteKeypath, eventObject);

                if (_.isFunction(handler)) { handler(item.checked); }
            }
        });

        menu.append(newItem);
    }

    appTray.setContextMenu(menu);
};


/** @listens app#before-quit */
app.on('before-quit', () => {
    mainWindow.forceClose = true;
});


/** @listens app#quit */
app.on('quit', () => {
    logger.log('Updated settings', electronSettings.getSettingsFilePath(), electronSettings.getSync());
});


/** @listens app#activate */
app.on('activate', () => {
    mainWindow.show();
});


/** @listens app#window-all-closed */
app.on('window-all-closed', () => {
    if (platform.type !== 'darwin') {
        app.quit();
    }
});


/**
 * Settings
 * @property {Boolean} user.showApp - Show App
 * @property {Boolean} user.enableSound - Play Notification Sound
 * @property {String} app.currentVersion - Application Version
 * @property {Number} app.lastNotification - Timestamp of last delivered Pushbullet Push
 * @property {Object} app.windowPosition - Application Window position and size
 * @property {String} app.notificationFile - Notification sound
 * @property {String} app.logFile - Log file
 */
const DEFAULT_SETTINGS = {
    user: {
        showApp: true,
        enableSound: true
    },
    app: {
        name: appName,
        currentVersion: appVersion,
        lastNotification: Math.floor(Date.now() / 1000) - 86400,
        windowPosition: {
            x: 100,
            y: 100,
            width: 400,
            height: 598
        },
        notificationFile: path.join(appSoundDirectory, 'notification-default.wav'),
        logFile: path.join(appLogDirectory, appName + '.log')
    }
};


/**
 * Events attached to settings
 */
const DEFAULT_EVENTS = {
    user: {
        showApp: function(show) {
            return updateDock(show);
        }
    },
    app: {
        notificationFile: function(items) {
            if (items) {
                validateFileType(items, 'audio', function(err, file) {
                    if (err) { return logger.error(err); }
                    electronSettings.set('app.notificationFile', file).then(() => {});

                    electronSettings.get('app.windowPosition')
                        .then(value => {
                            mainWindow.setBounds(value);
                        });

                    logger.log('Updated Setting', 'notificationFile', file);
                });
            }
        }
    }
};


/**
 *  Main
 */
app.on('ready', () => {
    // Load Settings
    electronSettings.defaults(DEFAULT_SETTINGS);
    electronSettings.configure({
        prettify: true,
        atomicSaving: true
    });

    // Init Log Directory
    mkdirp(appLogDirectory, (err) => {
        if (err) { return logger.error('appLogDirectory', err); }
    });

    // Add globals to Electrons 'global'
    global.electronSettings = electronSettings;

    // Init Tray
    appTray = new Tray(appTrayIconDefault);
    appTray.setImage(appTrayIconDefault);
    appTray.setToolTip(appName);
    appTrayMenu = Menu.buildFromTemplate([
        {
            label: 'Show',
            click() { mainWindow.show(); }
        },
        {
            label: 'Quit',
            click() { app.quit(); }
        }
    ]);

    appTray.setContextMenu(appTrayMenu);

    // Create the browser window.
    mainWindow = new BrowserWindow({
        backgroundColor: '#ecf0f0',
        minWidth: 400,
        icon: appIcon,
        title: appName,
        show: false,
        titleBarStyle: 'default',
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

        electronSettings.get('app.windowPosition')
            .then(value => {
                mainWindow.setBounds(value);
            });
    });

    /** @listens mainWindow:close */
    mainWindow.on('close', ev => {
        electronSettings.set('app.windowPosition', mainWindow.getBounds())
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

        registerOptionsWithMenu(appTrayMenu, electronSettings, 'user', DEFAULT_EVENTS);
    });

    // Create the Application's main menu
    appMenu = Menu.buildFromTemplate(defaultAppMenu());

    appMenu.items[0].submenu.insert(1, new MenuItem({ type: 'separator' }));
    appMenu.items[0].submenu.insert(2, new MenuItem({
        type: 'normal',
        id: 'notificationFile',
        label: 'Change Notification Sound...',
        click() {
            dialog.showOpenDialog({
                title: 'Pick Soundfile (aiff, m4a, mp3, mp4, m4a)', properties: ['openFile', 'showHiddenFiles'],
                defaultPath: appSoundDirectory,
                filters: [{ name: 'Sound', extensions: ['aiff', 'm4a', 'mp3', 'mp4', 'wav'] }]
            }, DEFAULT_EVENTS.app.notificationFile);
        }
    }));

    Menu.setApplicationMenu(appMenu);

    // Apply loaded settings
    electronSettings.set('app.currentVersion', appVersion)
        .then(() => {
            logger.log('app.currentVersion', appVersion);
        });

    electronSettings.get('user.showApp')
        .then(value => {
            updateDock(value);
        });
});
