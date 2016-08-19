'use strict';


/**
 * Modules
 * Node
 */
const path = require('path'),
    os = require('os');


/**
 * Modules
 * External
 */
const _ = require('lodash'),
    chalk = require('chalk');


/**
 * Styles
 */
let styleDefault = chalk.cyan.bold,
    styleError = chalk.red.bold,
    styleDebug = chalk.red.yellow;


/**
 * Format log messages
 * @param {...*} arguments - Messages or entities to print.
 * @returns {Object}
 */
let format = function() {
    let args = Array.from(arguments);

    let prefix = '[' + path.basename(module.parent.filename) + ']',
        label = args.shift(),
        message = [];

    for (let e of args) {
        if (!_(e).isString()) {
            e = JSON.stringify(e, null, 4);
        }

        message.push(e);
    }

    message = message.join(' ');

    return {
        prefix: prefix,
        label: label,
        message: message
    };
};

/**
 * Message
 * @param {...*} arguments - Messages or entities to print.
 */
let log = function() {
    if (arguments.length === 0) { return; }

    let parameters = [
        styleDefault.inverse(format.apply(this, arguments).prefix),
        styleDefault.inverse(_(format.apply(this, arguments).label).upperCase()),
        styleDefault(format.apply(this, arguments).message)
    ];

    console.log(parameters.join(' '));
};


/**
 * Error Message
 * @param {...*} arguments - Error Messages or entities to print.
 */
let error = function() {
    if (arguments.length === 0) { return; }

    let parameters = [
        styleError.inverse(format.apply(this, arguments).prefix),
        styleError.inverse(format.apply(this, arguments).label),
        styleError(format.apply(this, arguments).message)
    ];

    console.log(parameters.join(' '));
};


/**
 * Debug Message
 * @param {...*} arguments - Error Messages or entities to print.
 */
let debug = function() {
    if (arguments.length === 0) { return; }

    // Debug environment only
    if (!process.env['DEBUG']) { return; }

    let parameters = [
        format.apply(this, arguments).prefix,
        format.apply(this, arguments).label
    ].join(' ');

    // Print messages containing line breaks on separate lines
    (format.apply(this, arguments).message).split(os.EOL).forEach(function(e) {
        console.log(styleDebug.inverse(parameters + ' ' + e));
    });
};


/**
 * exports
 */
module.exports = {
    log: log,
    error: error,
    debug: debug
};
