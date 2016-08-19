'use strict';


/**
 * Modules: Node
 * @global
 */
const path = require('path'),
    util = require('util');

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
const moduleRoot = path.join(__dirname, '..', '..'),
    _ = require('lodash'),
    editorContextMenu = remote.require('electron-editor-context-menu'),
    fileUrl = require('file-url'),
    stringFormat = require('string-format-obj');

/**
 * Modules: Internal
 * @global
 */
const packageJson = require(path.join(moduleRoot, 'package.json'));

/**
 * Settings
 * @global
 */
let electronSettings = remote.getGlobal('electronSettings');

/**
 * Play Audio
 */
let playSoundFile = function(filePath, cb) {
    let soundFile = fileUrl(filePath);

    let audio = new Audio(soundFile);

    audio.volume = 0.5;

    audio.addEventListener('error', function(err) {
        return cb(err, soundFile);
    });

    audio.addEventListener('ended', function() {
        return cb(null, soundFile);
    });

    audio.play();
};


/**
 * Notification
 * @constant
 * @default
 */
let maxNotificationsPerSecond = 0.5,
    maxRecentNotifications = 10;


/**
 * Notification Defaults
 * @constant
 * @default
 */
const NotificationDefaults = {
    push: {},
    type: 'note',
    title: null,
    body: null,
    url: null,
    icon: null
};


/**
 * Notification Tags
 * @global
 */
const notificationTags = {
    article: '📰',
    social: '🍻',
    video: '📺',
    comment: '🗣',
    package: '💽',
    developer: '🖥',
    audio: '📻'
};


/**
 * Parse Notification Tags
 * @param {String} content - Notification Content
 * @param {Object} dictionary - Tag Dictionary
 * @return {String} - Formatted String
 * @global
 * @example {social} New entry at reddit.com/subreddits/pushbullet'
 */
let parseNotificationTags = function(content, dictionary) {
    return stringFormat(content, dictionary);
};


/**
 * Remove Notification Tags
 * @param {String} content - Notification Content
 * @param {Object} dictionary - Tag Dictionary
 * @return {String} - Formatted String
 * @global
 * @example {social} New entry at reddit.com/subreddits/pushbullet'
 */
let removeNotificationTags = function(content, dictionary) {
    let newDictionary = _.clone(dictionary);
    for (let tagName in newDictionary) {
        if (newDictionary.hasOwnProperty(tagName)) {
            newDictionary[tagName] = '';
        }
    }
    return parseNotificationTags(content, newDictionary);
};


/**
 * Log
 */
let logDefault = console.log;
console.debug = function() {
    let args = Array.from(arguments),
        label = args.shift();

    ipcRenderer.send('log', arguments);
    logDefault.apply(this, ['%c%s%c%s%c %c%s', 'font-weight: bold; background: #4AB367; color: white;', '[' + packageJson.name.toUpperCase() + ']', 'background: #4AB367; color: white; padding: 0 2px 0 0', '[' + label + ']', '', 'font-weight: bold', util.format.apply(null, args)]);
};


/**
 * Format Unix timestamps
 */
let getFormattedDate = function(unixTime) {
    let localDate = new Date(unixTime * 1000);

    return localDate.toISOString().replace(/Z|T|\..+/gi, ' ').trim().split(' ').reverse().join(' ');
};


/**
 * Notification constructor reference
 */
let NotificationDefault = Notification;


/**
 * Find images for push properties
 * @param {Object} push - Pushbullet push (https://docs.pushbullet.com/#push)
 * @returns {String} Image URI
 */
let getIconForPushbulletPush = function(push) {

    let imageUrl;

    // Accounts (Google, Facebook ..)
    let accountImage,
        accountIdShort = push['receiver_iden'],
        accountList = window.pb.api.accounts.all;

    for (let account of accountList) {
        if (account['iden'].startsWith(accountIdShort)) {
            accountImage = account['image_url'];
        }
    }

    // Channels (IFTTT, Zapier ..)
    let channelImage,
        channelId = push['client_iden'],
        channelList = window.pb.api.grants.all;

    for (let channel of channelList) {
        if (channel['client']['iden'] === channelId) {
            channelImage = channel['client']['image_url'];
        }
    }

    // Devices (Phone, Tablet ..)
    let deviceImage,
        deviceId = push['source_device_iden'],
        deviceList = window.pb.api.devices.all;

    for (let device of deviceList) {
        if (device['iden'] === deviceId) {
            deviceImage = 'http://www.pushbullet.com/img/deviceicons/' + device['icon'] + '.png';
        }
    }

    // Fallback
    imageUrl = channelImage || deviceImage || accountImage;

    return imageUrl;
};


/**
 * Notification Decorator
 */
Notification = function(pushTitle, pushObject) {

    /** Pre-populate Push Attributes
     */
    let push = pushObject || NotificationDefaults.push,
        type = push['type'] || NotificationDefaults.type,
        title = push['title'] || pushTitle || push['body'] || NotificationDefaults.title,
        body = push['body'] || push['title'] || NotificationDefaults.body,
        url = NotificationDefaults.url,
        icon = getIconForPushbulletPush(push) || NotificationDefaults.ICON,
        iden = push['iden'];

    /** Determine Push Type
     * @see {@link https://docs.pushbullet.com/#push|Pushbullet API}
     */
    switch (type) {
        case 'link':
            title = title || push['url'];
            body = body || push['url'];
            url = push['url'];
            break;
        case 'note':
            body = push['body'] || push['title'];
            break;
        case 'file':
            title = title || push['file_name'];
            body = body || push['file_type'];
            url = push['file_url'];
            icon = push['image_url'] || icon;
            break;
    }

    // Tags Handling
    title = _.trim(parseNotificationTags(title, notificationTags));
    body = _.trim(removeNotificationTags(body, notificationTags));

    // Options for native notification
    let options = {
        title: title,
        body: body,
        icon: icon,
        url: url,
        tag: iden,
        silent: true
    };

    // Trigger native notification
    let notification = new NotificationDefault(options.title, options);

    electronSettings.get('user.enableSound')
        .then(enableSound => {
            if (enableSound === true) {
                electronSettings.get('app.notificationFile')
                    .then(notificationFile => {
                        playSoundFile(notificationFile, function(err, file) {
                            if (err) {
                                return console.debug('playSoundFile Error', file);
                            }
                            // DEBUG
                            // return console.debug('playSoundFile]');
                        });
                    });
            }
        });



    // Register event handlers for main renderer
    ipcRenderer.send('notification-received');

    notification.addEventListener('click', () => {
        ipcRenderer.send('notification-click', options);
    });

    // Debug
    console.debug('Notification', '"' + notification.title + '"');
    console.debug('Notification', 'Created:', getFormattedDate(pushObject.created), '(Modified: ' + getFormattedDate(pushObject.modified) + ')');

    return notification;
};


Notification.prototype = NotificationDefault.prototype;
Notification.permission = NotificationDefault.permission;
Notification.requestPermission = NotificationDefault.requestPermission.bind(Notification);


/**
 * Show Notification
 */
window.showNotification = function(push) {
    if (push.active && push.active === true) {
        return new Notification(null, push);
    }
};


/**
 * Enqueue multiple pushes (throttled)
 */
window.enqueuePushesForNotification = function(pushes, after, callback) {

    let cb = callback || function() {};

    let self = this;

    if (pushes.length === 0) {
        return;
    }

    let pushesList = pushes,
        notifyAfter = after || 0;

    // Remove pushes older than 'app.lastNotification' from array
    let recentPushes = pushesList.filter(function(element) {
        return (element.modified || element.created) > notifyAfter;
    });

    recentPushes.forEach(function(push, index) {
        let notificationTimeout = setTimeout(function() {

            // Show local notification
            window.showNotification(push, notifyAfter);

            // Update 'app.lastNotification' with timestamp from most recent push
            if (push.modified > notifyAfter) {
                // Sync Settings
                electronSettings.set('app.lastNotification', push.modified)
                    .then(() => {});
                // DEBUG
                //log('[appSettings', '[app.lastNotification', push.modified);
            }

            // Debug
            //log('[title', push.title || push.body);
            //log('[modified', push.modified, '[notifyAfter', notifyAfter);
            //log('[modified <= notifyAfter', (push.modified <= notifyAfter));

            // Callback
            if (recentPushes.length === (index + 1)) {
                clearTimeout(notificationTimeout);
                return cb(recentPushes.length);
            }
        }, parseInt((1000 / maxNotificationsPerSecond)) * index, self);
    }, self);

    return cb(recentPushes.length);
};


/**
 * Get all new pushes and show them (if any)
 */
window.enqueueNewPushes = function(callback) {

    let cb = callback || function() {};

    let pushesList = window.getPushes(maxRecentNotifications);

    electronSettings.get('app.lastNotification')
        .then(lastNotification => {
            window.enqueuePushesForNotification(pushesList, lastNotification, function(length) {
                return cb(length);
            });
        });
};


/**
 * Main
 */
window.onload = function() {

    let injectionInterval = setInterval(function() {
        if (window.pb && window.pb.ws.connected) {

            if (process.env['DEBUG']) {
                window.enableDebug(true);
            }

            window.optimizeMenu();
            window.createWebsocketProxy();
            window.createErrorProxy();
            window.createPushProxy();

            // Show recent pushes manually on load
            window.enqueueNewPushes(function(result) {
                console.debug('Callback fired', 'window.enqueueNewPushes', 'result', result);
            });

            return clearInterval(injectionInterval);
        }
    }, 500, this);
};


/**
 * Add margin for Title bar
 */
window.addTitlebarMargin = function() {
    window.document.getElementById('sink').style['background-color'] = '#4AB367';
    window.document.getElementById('mobile-header').style['margin-top'] = '12px';
    window.document.getElementById('mobile-header').style['box-shadow'] = 'none';
};


/**
 * Remove setup menu item
 */
window.optimizeMenu = function() {
    window.pb.api.account.preferences.setup_done = true;
    window.pb.sidebar.update();
    window.onecup.goto('/#people');

    console.debug('window.optimizeMenu');
};


/**
 * Add margin for Title bar
 */
window.enableDebug = function(enable) {
    window.pb.DEBUG = Boolean(enable);

    console.debug('enableDebug', window.pb.DEBUG);
};


/**
 * Proxy pb.ws
 */
window.createWebsocketProxy = function() {
    window.pb.ws = new Proxy(window.pb.ws, {
        set: function(target, name, value) {
            target[name] = value;
            if (name === 'connected') {
                if (value === false) {
                    console.debug('Proxy', 'window.pb.ws', 'disconnected');
                }
            }
        }
    });

    console.debug('Proxy created', 'window.pb.ws');
};


/**
 * Proxy pb.ws
 */
window.createErrorProxy = function() {
    window.pb.error = new Proxy(window.pb.error, {
        set: function(target, name, value) {
            target[name] = value;
            ipcRenderer.send('error-external');
        }
    });

    console.debug('Proxy created', 'window.pb.error');
};


/**
 * Proxy pb.api.pushes.objs
 */
window.createPushProxy = function() {
    window.pb.api.pushes.objs = new Proxy(window.pb.api.pushes.objs, {
        set: function(target, name, value) {
            let isNew = !Boolean(target[name]);

            target[name] = value;

            if (isNew) {
                // DEBUG
                // console.debug('window.pb.api.pushes.objs', 'isNew', isNew);
                window.enqueueNewPushes(function(result) {
                    // DEBUG
                    // console.debug('window.pb.api.pushes.objs', 'enqueueNewPushes', result);
                });
            }

            // DEBUG
            // console.debug('window.pb.api.pushes.objs set', 'name', '"' + name + '"', 'value', value.constructor.name);
        }
    });

    //console.debug('Proxy created', 'window.pb.api.pushes.objs');
};


/**
 * Get all Pushbullet Pushes sorted by recency (ascending)
 * @param {Number..} limit - Limit result to fixed number
 * @returns {Array} List of Pushes
 */
window.getPushes = function(limit) {

    if (!window.pb.api.pushes) {
        return;
    }

    let queueLimit = limit || 0;

    // Get hashmap of all pushes
    let pushesReference = window.pb.api.pushes.objs,
        pushesList = [];

    // Build list of active pushes
    for (let iden in pushesReference) {
        let pushObject = pushesReference[iden];
        if (pushObject.active) {
            pushesList.push(pushObject);
        }
    }

    // Sort list pushes by creation date
    pushesList.sort(function(pushA, pushB) {
        let dateA = pushA.created;
        let dateB = pushB.created;

        if (dateA < dateB) {
            return -1;
        } else if (dateA > dateB) {
            return 1;
        }
        return 0;
    });

    // Apply size limit
    pushesList = pushesList.slice(pushesList.length - queueLimit, pushesList.length);

    return pushesList;
};


/**
 * Add native context menus
 */
window.addEventListener('contextmenu', ev => {
    console.debug('Event', 'window', 'contextmenu');

    if (!ev.target.closest('textarea, input, [contenteditable="true"]')) {
        return;
    }

    let menu = editorContextMenu();

    let menuTimeout = setTimeout(function() {
        menu.popup(remote.getCurrentWindow());
        return clearTimeout(menuTimeout);
    }, 60);
});
