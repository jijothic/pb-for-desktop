# PB for Desktop [![Node Package Version](https://img.shields.io/npm/v/pb-for-desktop.svg?style=flat)](https://npmjs.com/package/pb-for-desktop) [![Contributions Welcome](https://img.shields.io/badge/contributions-wanted-red.svg?style=flat)](https://github.com/sidneys/pb-for-desktop/issues) [![Chat](https://badges.gitter.im/sidneys/pb-for-desktop.svg)](https://gitter.im/sidneys/pb-for-desktop) [![macOS + Linux Build Status](http://img.shields.io/travis/sidneys/pb-for-desktop.svg?style=flat)](http://travis-ci.org/sidneys/pb-for-desktop) [![Windows Build Status](https://ci.appveyor.com/api/projects/status/d69sb6iav7tnrldq?svg=true)](https://ci.appveyor.com/project/sidneys/pb-for-desktop)   

**PB for Desktop** is a lightweight cross-platform desktop client for [PushBullet](https://pushbullet.com/).
Receive native push notifications on macOS, Windows and Linux.

*Not affiliated with PushBullet Inc..*

------
![Screenshot: Pushbullet for Desktop (macOS)](https://raw.githubusercontent.com/sidneys/pb-for-desktop/release/screenshot-macos.png)

![Screenshot: Pushbullet for Desktop (Windows)](https://raw.githubusercontent.com/sidneys/pb-for-desktop/release/screenshot-windows.png)

![Screenshot: Pushbullet for Desktop (Linux)](https://raw.githubusercontent.com/sidneys/pb-for-desktop/release/screenshot-linux.png)

------

## Features


>
> **Native Notifications**
>

Uses the macOS [Notification Center](https://en.wikipedia.org/wiki/Notification_Center), the Windows 10 [Action Center](https://en.wikipedia.org/wiki/Action_Center) and [libnotify](https://launchpad.net/ubuntu/+source/libnotify) for Linux.

>
> **Cross-Platform**
>

Tested on macOS (10.11, 10.12), Windows 10 (Anniversary Update) and Debian Linux (Ubuntu 16.04, elementary OS 0.4)

>
> **Unobstrusive**
>

Small resource footprint - runs as a macOS Menu Bar app or a Windows System Tray app.

>
> **Simple Setup**
>

No wrestling with API-Keys or other technical knowledge required.
Login to Pushbullet using Google or Facebook.

>
> **Channel Images**
>

Channel-specific  (e.g. [IFTTT](https://ifttt.com/), [Zapier](https://zapier.com/), [Chat](http://lifehacker.com/huge-pushbullet-update-adds-instant-messaging-chat-hea-1714870644)) icon images for most notifications.

>
> **Image Thumbnails**
>

Preview thumbnails for pushes containing images.

>
> **Custom Sound Effects**
>

Use the default Pushbullet sound or one of your choice.

>
> **Notification Emoji** [![Feature Status: Beta](https://img.shields.io/badge/status-beta-blue.svg?style=flat)]()
>

Use tags to add emoji to notifications, e.g.: add  `{video}` to show a 📺 with every notification.

>
> **Notification Mirroring** [![Feature Status: Beta](https://img.shields.io/badge/status-beta-blue.svg?style=flat)]()
>

Mirror Android notifications via [Pushbullet for Android](https://play.google.com/store/apps/details?id=com.pushbullet.android).

------

## Contents

- [Installation](#installation)
  - [Standard Installation](#standard-installation)
  - [Commandline](#commandline)
- [Developers](#developers)
  + [Sourcecode](#sourcecode)
  + [Dependencies](#dependencies)
  + [Run](#run)
  + [Run (Live Reload)](#run-live-reload)
- [How to Build](#how-to-build)
  + [Build Prerequisites](#build-prerequisites)
  + [Running a Build](#running-a-build)
- [Continuous Integration](#continuous-integration)
- [Roadmap](#roadmap)
- [Discussion](#discussion)
- [Author](#author)
- [License](#license)

## <a name="installation"/></a>Installation

### <a name="standard-installation"/></a>Standard Installation

Download the latest version on the [Releases page](https://github.com/sidneys/pb-for-desktop/releases).

### <a name="commandline"/></a>Commandline Package

To use PB for Desktop from the commandline, install it globally:

```bash
npm install --global pb-for-desktop
```

To run it, launch `pb-for-desktop`:

```bash
pb-for-desktop
```



## <a name="developers"/></a>Developers

### <a name="sourcecode"/></a>Sourcecode

[Clone](github-mac://openRepo/https://github.com/sidneys/pb-for-desktop) or [download](https://github.com/sidneys/pb-for-desktop/archive/master.zip) the sourcecode repository:

```bash
git clone https://github.com/sidneys/pb-for-desktop.git
```

### <a name="dependencies"/></a>Dependencies

To install the required dependencies:

```bash
npm install
```

### <a name="run"/></a>Run

To invoke `electron-prebuilt` on top of the source files:

```bash
npm run start
```

### <a name="run-live-reload"/></a>Run (Live Reload)

To invoke `electron-prebuilt` on top of the source files with live reload support:

```bash
npm run serve
```



## <a name="how-to-build"/></a>How to Build

### <a name="build-prerequisites"/></a>Build Prerequisites

Building for Windows (on macOS & Linux) requires  [`wine`](https://winehq.org) and [`mono`](https://nsis.sourceforge.net/Docs/Chapter3.htm), whereas building for Linux (on macOS & Windows) requires  [`fakeroot`](https://wiki.debian.org/FakeRoot) and [`dpkg`](https://wiki.ubuntuusers.de/dpkg/). All 3 platforms can only be built on macOS. 

To install these requirements on macOS (via [Homebrew](https://brew.sh)):

```bash
brew install wine mono
brew install fakeroot dpkg
```

To install these requirements on Linux (via [APT](https://en.wikipedia.org/wiki/Advanced_Packaging_Tool)):

```bash
sudo apt-get install wine mono
sudo apt-get install fakeroot dpkg
```

The build system automatically creates binaries for all available cpu architectures.

### <a name="running-a-build"/></a>Running a Build

To build all available platforms:

```bash
npm run build		
```

To build platforms selectively, specify their name (`darwin` for macOS,  `win32` for Windows, `linux` for Linux):

```bash
npm run build darwin		# builds macOS
```

```bash
npm run build linux win32	# builds Linux, Windows
```

## <a name="continuous-integration"/></a>Continuous Integration

The build process is fully automated, featuring [continuous integration](https://en.wikipedia.org/wiki/Continuous_integration) support provided by target-platform-specific backends:
- [Travis CI](http://travis-ci.org/sidneys/pb-for-desktop) for macOS and Linux builds
- [AppVeyor](https://ci.appveyor.com/project/sidneys/pushbullet-desktop) for Windows builds

A build and deployment cycle is comprised of several steps:

1. a new tag on the [release](https://github.com/sidneys/pb-for-desktop/commits/release) branch initiates the cycle (e.g. [v.1.0.0](https://github.com/sidneys/pb-for-desktop/releases/tag/v2.0.0))
2. after a successful build, resulting artifacts are deployed back to GitHub (using the existing tag)
3. the resulting tag (combined with all artifacts) constitutes a new [Github Release](https://github.com/sidneys/pb-for-desktop/releases)
4. the GitHub Release can then be manually published by project contributors

## <a name="roadmap"/></a>Roadmap

- [ ] In-App-Updates (via Squirrel / Heroku /  GitHub)
- [ ] SMS for Android
- [ ] Signed binaries for macOS and Windows 10
- [ ] E2E tests via [Spectron](https://github.com/electron/spectron)


## <a name="discussion"/></a>Discussion

- [sidneys/pb-for-desktop](https://gitter.im/sidneys/pb-for-desktop) on Gitter


- [/r/PushBullet](https://www.reddit.com/r/PushBullet/comments/50ewjd/i_just_released_pb_for_desktop_an_opensource/) on Reddit


## <a name="author"/></a>Author

[sidneys](http://sidneys.github.io)

## <a name="license"/></a>License

MIT
