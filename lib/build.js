'use strict';


/**
 * Modules: Node
 * @global
 */
const path = require('path');


/**
 * Modules: Third Party
 * @global
 */
const _ = require('lodash'),
    fs = require('fs-extra'),
    rimraf = require('rimraf'),
    glob = require('glob'),
    electronPackager = require('electron-packager'),
    nodePlatforms = require('node-platforms'),
    nodeArchs = require('node-archs'),
    tryRequire = require('try-require'),
    darwinInstaller = tryRequire('appdmg'),
    windowsInstaller = tryRequire('electron-winstaller'),
    linuxInstaller = tryRequire('electron-installer-debian');


/**
 * Modules: Internal
 * @global
 */
const moduleRoot = path.join(__dirname, '..'),
    packageJson = require(path.join(moduleRoot, 'package.json')),
    platformHelper = require(path.join(moduleRoot, 'lib', 'platform-helper')),
    logger = require(path.join(moduleRoot, 'lib', 'logger'));


/**
 * Debug
 * @constant
 * @global
 */
const debugMode = process.env['DEBUG'];


/**
 * Directories
 * @constant
 * @global
 */
const directoryBuild = path.join(moduleRoot, packageJson.build.directoryBuild),
    directoryCache = path.join(directoryBuild, 'cache'),
    directoryRelease = path.join(directoryBuild, 'release'),
    directoryStaging = path.join(directoryBuild, 'staging'),
    directoryAssets = path.join(moduleRoot, packageJson.build.directoryIcons);


/**
 * Ignored files
 * @constant
 * @global
 */
const fileIgnoreList = [
    'appveyor.yml',
    '.editorconfig',
    '.DS_Store',
    '.gitignore',
    '.idea',
    '.jscsrc',
    '.jshintrc',
    '.npmignore',
    '.travis.yml',
    path.relative(moduleRoot, directoryCache),
    path.relative(moduleRoot, directoryStaging),
    path.relative(moduleRoot, directoryRelease)
];


/**
 * Resolve Installer creation modules
 * @param {String} platform - Target platform
 * @param {String} target - Installer target file
 * @return {Object|void}
 */
let resolvePlatformInstaller = function(platform, target) {

    let extension = path.extname(target).split('.')[1],
        map;

    // Hashmap
    map = {
        darwin: {
            dmg: darwinInstaller
        },
        win32: {
            exe: windowsInstaller.createWindowsInstaller
        },
        linux: {
            deb: linuxInstaller
        }
    };

    return map[platform][extension];
};


/**
 * Create electron-packager Configuration
 */
let createBuildConfiguration = function(platform) {

    let pkg = _.clone(packageJson),
        options = pkg.build;

    let buildVersion = _(new Date().toJSON()).replace(/T|Z|-|:|\./g, ''),
        icon = path.join(directoryAssets, platform, 'icon-app' + platformHelper.iconExtension(platform));

    // Installation icon
    let setupIcon = path.join(directoryAssets, platform, 'icon-setup' + platformHelper.iconExtension(platform));

    // Setup icon
    let setupBackground = path.join(directoryAssets, platform, 'background-setup' + '.gif');

    // Ignore assets for other platforms
    let ignore = fileIgnoreList;
    for (let p of nodePlatforms) {
        if (platform !== p) {
            ignore.push(path.relative(moduleRoot, path.join(directoryAssets, p)));
        }
    }
    for (let i in ignore) {
        // Regexify ignore list entries
        ignore[i] = '/' + ignore[i] + '($|/)';
        ignore[i] = ignore[i].replace(/\\/g, '\/');
        ignore[i] = ignore[i].replace(/\./g, '\\.');
    }

    // name of binary
    let name;
    if (platformHelper.isDarwin) {
        // "Product Name.app"
        name = options.productName;
    } else {
        // "product-name.exe"
        name = pkg.name;
    }

    // productName
    let productName = options.productName;
    if (platformHelper.isWindows) {
        productName = name;
    }

    return {
        'app-bundle-id': options.id,
        'app-category-type': options.category,
        'app-company': options.company,
        'app-copyright': 'Copyright © ' + new Date().getFullYear(),
        'app-version': pkg.version,
        'arch': 'all',
        'asar': false,
        'build-version': buildVersion,
        'description': options.productDescription,
        'dir': moduleRoot,
        'helper-bundle-id': options.id + '.helper',
        'icon': icon,
        'iconUrl': options.iconUrl,
        'ignore': ignore,
        'name': name,
        'out': directoryStaging,
        'overwrite': true,
        'platform': platform,
        'productDescription': options.productDescription,
        'productName': productName,
        'prune': true,
        'setupIcon': setupIcon,
        'setupBackground': setupBackground,
        'version': options.electronVersion,
        'win32metadata': {
            CompanyName: options.company,
            FileDescription: options.productDescription,
            OriginalFilename: name,
            FileVersion: pkg.version,
            ProductVersion: pkg.version,
            ProductName: options.productName,
            InternalName: options.productName
        },
        'download': {
            'cache': directoryCache,
            'strictSSL': false
        }
    };
};


/**
 * Commandline platform override (default: build all platforms)
 * @example > npm run build darwin
 * @example > npm run build win32
 */
let createPlatformListCli = function() {
    let list = process.argv.slice(3) || [];

    // Convenience replacer for operating system names
    for (let p in list) {
        list[p] = list[p].replace(/\b(apple|mac|macos|macosx|macintosh|osx)\b/i, 'darwin');
        list[p] = list[p].replace(/\b(win|win10|windows|windows10)\b/i, 'win32');
        list[p] = list[p].replace(/\b(debian|gnu|ubuntu)\b/i, 'linux');
    }

    return _.uniq(list);
};


/**
 * Test if string contains a CPU architecture
 * @return {String} Found architecture
 */
let parseArchitecture = function(search) {
    let match = search.match(new RegExp(nodeArchs.join('|')))[0];
    
    // DEBUG
    logger.debug('parseArchitecture', 'search', search, 'match', match);

    return match;
};


/**
 *
 * @example > npm run build darwin
 * @example > npm run build win32
 */

/**
 * Strip wildcards from package names, convert to lowercase add version info
 * @param {String} filePath - Path to package
 * @param {String=} platform - Platform
 * @param {String=} version - File version
 * @param {String=} architecture - Target architecture
 * @param {Boolean=} retainDirectory - Retain full path to file
 * @param {Boolean=} removeExtension - Remove extension
 * @return {String}
 */
let getSafePackageFileName = function(filePath, platform, version, architecture, retainDirectory, removeExtension) {
    let fileName = _.toLower(path.basename(filePath)),
        extension = path.extname(filePath);

    if (fileName) {
        // Remove extension
        fileName = fileName.replace(/\.[^/.]+$/, '');
        // Whitespace to underscore
        fileName = fileName.replace(/\s+/g, '-');
    }

    // Add platform
    if (platform) {
        fileName = fileName + '_' + platform;
    }

    // Add version
    if (version) {
        fileName = fileName + '_' + 'v' + version;
    }

    // Add architecture
    if (architecture) {
        fileName = fileName + '_' + architecture;
    }

    // Add extension
    if (!removeExtension) {
        fileName = fileName + extension;
    }

    // Add Path
    if (path.dirname(filePath) && retainDirectory) {
        fileName = path.join(path.dirname(filePath), fileName);
    }

    // DEBUG
    logger.debug('getSafePackageFileName', 'fileName', fileName);

    return fileName;
};


/**
 * Create folders
 * @param {...*} arguments - Filesystem paths
 */
let createDirectorySync = function() {
    let args = Array.from(arguments);
    for (let directoryPath of args) {
        let target = path.resolve(directoryPath);

        fs.mkdirpSync(target);

        // DEBUG
        logger.debug('createDirectorySync', target);
    }
};


/**
 * Delete directory
 * @param {String} directoryPath - Path
 * @param {Boolean=} contentsOnly - Keep directory intact
 * @param {Function=} callback - Completion callback
 */
let deleteDirectory = function(directoryPath, contentsOnly, callback) {

    let cb = callback || function() {};

    let target = path.normalize(path.resolve(directoryPath));

    if (contentsOnly) {
        target = path.join(target, '**', '*');
    }

    rimraf(target, {}, function(err) {
        if (err) {
            logger.error('deleteDirectory', target, err);
            return cb(err);
        }

        cb(null);

        // DEBUG
        logger.debug('deleteDirectory', target);
    });
};



/**
 * Delete directory synchronously
 * @param {String} directoryPath - Path
 * @param {Boolean=} contentsOnly - Keep directory intact
 */
let deleteDirectorySync = function(directoryPath, contentsOnly) {

    let target = path.normalize(path.resolve(directoryPath));

    if (contentsOnly) {
        target = path.join(target, '**', '*');
    }

    rimraf.sync(target);

    // DEBUG
    logger.debug('deleteDirectorySync', target);
};


/**
 * Define build target platforms
 * @returns {Array} - List of platforms to build for
 */
let createPlatformList = function() {

    let platformList = [];

    // If specified, use platform from commandline
    if (createPlatformListCli().length > 0) {
        platformList = createPlatformListCli();
    }

    // Default platforms
    if (platformList.length === 0) {
        // macOS
        if (platformHelper.isDarwin) {
            platformList = ['darwin', 'linux'];
        }
        // Windows
        if (platformHelper.isWindows) {
            platformList = ['win32'];
        }
        // Linux
        if (platformHelper.isLinux) {
            platformList = ['linux'];
        }
    }

    // DEBUG
    logger.debug('createPlatformList', platformList);

    return platformList;
};


/**
 * Package all Platforms
 * @param {String} platformName - darwin, win32, linux
 * @param {String} sourceArtifact - Application to package
 * @param {String} targetDirectory - Deployment target folder
 * @param {Object} buildOptions - electron-packager options object
 * @param {Function=} callback - Completion callback
 */
let packageArtifact = function(platformName, sourceArtifact, targetDirectory, buildOptions, callback) {

    let cb = callback || function() {};

    let platformPackager = {};

    // macOS
    platformPackager.darwin = function() {
        let architectureName = parseArchitecture(sourceArtifact),
            targetFileName = getSafePackageFileName(buildOptions['name'], false, buildOptions['app-version'], false, null, true),
            targetSubdirectory = path.join(targetDirectory, targetFileName),
            targetExtension = '.dmg',
            sourcesFilePath = path.join(sourceArtifact, buildOptions['name'] + '.app'),
            targetFilePath = path.join(targetDirectory, path.basename(targetSubdirectory) + targetExtension);

        // Options
        let installerOptions = {
            basepath: '/',
            target: targetFilePath,
            arch: architectureName,
            specification: {
                title: buildOptions['productName'],
                icon: buildOptions['setupIcon'],
                background: buildOptions['setupBackground'],
                window: {
                    size: {
                        width: 640,
                        height: 360
                    }
                },
                contents: [
                    { x: 162, y: 220, type: 'file', path: sourcesFilePath },
                    { x: 478, y: 216, type: 'link', path: '/Applications' },
                    { x: 10000, y: 10000, type: 'position', path: '.background' },
                    { x: 10000, y: 10000, type: 'position', path: '.DS_Store' },
                    { x: 10000, y: 10000, type: 'position', path: '.Trashes' },
                    { x: 10000, y: 10000, type: 'position', path: '.VolumeIcon.icns' }
                ]
            }
        };

        // DEBUG
        logger.debug('packagePlatform', platformName, 'installerOptions', installerOptions);

        // Prepare working directories
        deleteDirectorySync(targetFilePath);

        // Create Installer
        let installer = resolvePlatformInstaller(platformName, targetFilePath)(installerOptions);

        installer.on('finish', function() {
            // DEBUG
            logger.debug('platformPackager', platformName, 'targetFilePath', targetFilePath);

            cb(null, targetFilePath);
        });
        installer.on('error', function(err) {
            if (err) {
                logger.error('platformPackager', platformName, 'deployHelper', err);
                return cb(err);
            }
        });
    };


    // Windows
    platformPackager.win32 = function() {
        let architectureName = parseArchitecture(sourceArtifact),
            targetFileName = getSafePackageFileName(buildOptions['productName'], null, buildOptions['app-version'], architectureName),
            targetSubdirectory = path.join(targetDirectory, targetFileName),
            targetExtension = '.exe',
            sourcesFilePath = path.join(targetSubdirectory, buildOptions['productName'] + 'Setup' + targetExtension),
            targetFilePath = path.join(targetDirectory, targetFileName + targetExtension);

        // Options
        let installerOptions = {
            arch: architectureName,
            appDirectory: sourceArtifact,
            outputDirectory: targetSubdirectory,
            loadingGif: buildOptions['setupBackground'],
            noMsi: true,
            exe: buildOptions['productName'] + '.exe',
            version: buildOptions['app-version'],
            authors: buildOptions['app-company'],
            title: buildOptions['productName'],
            productName: buildOptions['productName'],
            description: buildOptions['productDescription'],
            name: buildOptions['name'],
            iconUrl: buildOptions['iconUrl'],
            setupIcon: buildOptions['setupIcon']
        };

        // DEBUG
        logger.debug('packagePlatform', platformName, 'installerOptions', installerOptions);

        // Prepare working directories
        deleteDirectorySync(targetSubdirectory, true);
        deleteDirectorySync(targetFilePath);

        // Package
        if (debugMode) {
            process.env['DEBUG'] = 'electron-windows-installer:main';
        }

        // Package
        let installer = resolvePlatformInstaller(platformName, targetFilePath)(installerOptions);

        installer
            .then(function() {
                // Rename
                fs.rename(sourcesFilePath, targetFilePath, function(err) {

                    if (err) {
                        logger.error('deployHelper', platformName, 'fs.rename', err);
                        return cb(err);
                    }

                    // Remove working directories
                    deleteDirectory(targetSubdirectory, false, function(err) {
                        if (err) {
                            logger.error('deployHelper', platformName, 'deleteDirectory', err);
                            return cb(err);
                        }

                        cb(null, targetFilePath);
                    });
                });
            }, function(err) {
                if (err) {
                    logger.error('deployHelper', platformName, err);
                    return cb(err);
                }
            });
    };


    // Linux
    platformPackager.linux = function() {
        let architectureName = parseArchitecture(sourceArtifact),
            targetFileName = getSafePackageFileName(buildOptions['productName'], null, buildOptions['app-version'], architectureName),
            targetExtension = '.deb',
            targetFilePath = path.join(targetDirectory, targetFileName + targetExtension);

            if (architectureName.includes('64')) {
                architectureName = 'amd64';
            }

            if (architectureName.includes('32')) {
                architectureName = 'i386';
            }
            
        let installerOptions = {
            arch: architectureName,
            logger: logger.debug,
            depends: ['libappindicator1', 'libnotify-bin'],
            src: sourceArtifact,
            dest: targetDirectory,
            rename(dest) {
                let filename = getSafePackageFileName(buildOptions['name'] + targetExtension, null, buildOptions['app-version'], architectureName);

                // DEBUG
                logger.debug('platformPackager', platformName, 'rename', filename);

                return path.join(dest, filename);
            },
            bin: buildOptions['name'],
            icon: buildOptions['setupIcon']
        };

        // DEBUG
        logger.debug('packagePlatform', platformName, 'installerOptions', installerOptions);

        // Create Installer
        let installer = resolvePlatformInstaller(platformName, targetFilePath);

        installer(installerOptions, function(err) {
            if (err) {
                logger.error('linuxInstaller', err);
                return cb(err);
            }

            // DEBUG
            logger.debug('platformPackager', platformName);

            cb(null);
        });
    };

    platformPackager[platformName]();
};


/**
 * Build, Package all Platforms
 * @param {Function..} callback - Completion callback
 */
let buildAndPackage = function(callback) {

    let cb = callback || function() {};

    let platformList = createPlatformList();

    logger.log('Project', packageJson.name, packageJson.version);
    logger.log('Platforms', platformList.join(', '));

    // Prepare working directories
    createDirectorySync(directoryStaging, directoryRelease);

    /**
     * Recurse Platforms with nested callbacks
     */
    let createBinaryForPlatformRecursive = function(platformIndex) {

        let platformName = platformList[platformIndex];

        if (platformName) {
            let buildOptions = createBuildConfiguration(platformName);

            // DEBUG
            logger.debug('createBinaryForPlatformRecursive', 'buildOptions', buildOptions);

            electronPackager(buildOptions, function(err, archBinaryList) {
                if (err) { return cb(err); }

                /**
                 * Recurse Architecture-specific builds
                 */
                // DEBUG
                logger.debug('electronPackager', (_(archBinaryList).map(function(n) { return path.relative(moduleRoot, n); })).join(' '), 'ok');
                let createDeploymentForArchitectureRecursive = function(archIndex) {
                    let sourceArtifact = archBinaryList[archIndex],
                        targetDirectory = directoryRelease;

                    // DEBUG
                    logger.debug('createDeploymentForArchitectureRecursive', 'sourceArtifact', sourceArtifact);
                    logger.debug('createDeploymentForArchitectureRecursive', 'targetDirectory', targetDirectory);

                    return packageArtifact(platformName, sourceArtifact, targetDirectory, buildOptions, function(err) {
                        if (err) { return cb(err); }

                        if ((archIndex + 1) !== archBinaryList.length) {
                            return createDeploymentForArchitectureRecursive(archIndex + 1);
                        }

                        if ((platformIndex + 1) !== platformList.length) {
                            return createBinaryForPlatformRecursive(platformIndex + 1);
                        }

                        cb(null, targetDirectory);
                    });
                };

                // Init arch recursion
                createDeploymentForArchitectureRecursive(0);
            });
        }
    };

    // Init platform recursion
    createBinaryForPlatformRecursive(0);
};


/**
 * Initialize main process if called from CLI
 */
if (require.main === module) {

    buildAndPackage(function(err, result) {
        if (err) {
            logger.error('buildAndPackage', err);
            return process.exit(1);
        }

        glob(path.join(result, '*.*'), { cwd: moduleRoot }, function(err, files) {
            for (let file of files) {
                logger.log('Artifact ready', file);
            }
            process.exit(0);
        });
    });
}


/**
 * exports
 */
module.exports = {
    build: buildAndPackage
};
