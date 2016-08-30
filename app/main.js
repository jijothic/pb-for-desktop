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
 * Log to console and file
 * @param {*} messageList - Log Message
 */
let log = function(messageList) {
    let localDate = (new Date()),
        localDateString = localDate.toISOString().replace(/Z|T|\..+/gi, ' ').trim().split(' ').reverse().join(' ');

    for (let message in messageList) {
        if (messageList[message] !== null && typeof messageList[message] === 'object') {
            messageList[message] = '\r\n' + util.inspect(messageList[message], {
                    colors: true, showProxy: true, showHidden: true, depth: null
                });
        }
    }

    let logEntry = '[' + localDateString + ']' + ' ' + messageList.join(' ');

    electronSettings.get('internal.logFile')
        .then(value => {
            fs.appendFile(value, (logEntry + '\r\n'), function(err) {
                if (err) {
                    return console.error('error', err);
                }
            });
        });

    console.log(logEntry);
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
    if (platform.isOSX) {
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
 * @param {electronSettings:electronSettings} electronSettingsInstance - 'electron-settings' instance
 * @param {String..} relativeKeypath - Nested Keypath to registrable settings, e.g. 'options.app'
 * @param {Object..} eventObject - Optionally attach behaviour to options
 */
let registerOptionsWithMenu = function(currentMenu, electronSettingsInstance, relativeKeypath, eventObject) {
    let settings = keypath(relativeKeypath, electronSettingsInstance.getSync()) || electronSettingsInstance.getSync(),
        settingsCount = Object.keys(settings).length;

    let menu = new Menu();

    // Add existing Menu Items
    for (let item of currentMenu.items) {
        menu.append(new MenuItem(item));
    }

    // Add separator line
    menu.append(new MenuItem({ type: 'separator' }));

    // Option Click Handler
    let settingClickHandler = function(menuItem) {
        let absoluteKeypath = menuItem.sublabel,
            isChecked = menuItem.checked;

        electronSettingsInstance.setSync(absoluteKeypath, isChecked);

        let handler = keypath(absoluteKeypath, eventObject);

        if (_.isFunction(handler)) {
            handler(isChecked);
        }
    };

    // Loop all Settings
    let iteration = 0;
    for (let option in settings) {

        // Only support Booleans (checkboxes) for now
        if (_.isBoolean(settings[option]) === true) {

            let absoluteKeypath = relativeKeypath + '.' + option;

            let newItem = new MenuItem({
                type: 'checkbox',
                id: option,
                sublabel: absoluteKeypath,
                label: _.startCase(option),
                checked: electronSettingsInstance.getSync(absoluteKeypath),
                click: settingClickHandler
            });

            menu.append(newItem);

            // Check if last iteration
            if (iteration !== settingsCount) {
                // Add separator line
                menu.append(new MenuItem({ type: 'separator' }));
            }

            // Increment iteration
            iteration++;

            // DEBUG
            log(['registerOptionsWithMenu', 'option', option]);
            log(['registerOptionsWithMenu', '_.isBoolean(settings[option]', _.isBoolean(settings[option])]);
        }
    }

    appTray.setContextMenu(menu);
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
    if (platform.type !== 'darwin') {
        app.quit();
    }
});


/**
 * Settings
 * @property {Boolean} user.showWindow - Show App Window
 * @property {Boolean} user.enableSound - Play Notification Sound
 * @property {String} app.currentVersion - Application Version
 * @property {Number} app.lastNotification - Timestamp of last delivered Pushbullet Push
 * @property {Object} app.windowPosition - Application Window position and size
 * @property {String} app.notificationFile - Notification sound
 * @property {String} app.logFile - Log file
 */
const DEFAULT_SETTINGS = {
    user: {
        showWindow: true,
        enableSound: true,
        showRecentPushesOnStartup: true
    },
    internal: {
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
        showWindow: function(show) {
            return updateDock(show);
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
    // Load Settings
    electronSettings.defaults(DEFAULT_SETTINGS);
    electronSettings.configure({
        prettify: true,
        atomicSaving: true
    });

    // Init Log Directory
    mkdirp(appLogDirectory, (err) => {
        return log(['appLogDirectory', err]);
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
            }, DEFAULT_EVENTS.internal.notificationFile);
        }
    }));

    Menu.setApplicationMenu(appMenu);

    // Commit Settings
    electronSettings.set('internal.currentVersion', appVersion)
        .then(() => {
            log(['internal.currentVersion', appVersion]);
        });

    // Load Settings
    electronSettings.get('user.showWindow')
        .then(value => {
            updateDock(value);
        });
});
