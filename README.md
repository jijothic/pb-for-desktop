# Pushbullet for Desktop [![Join the chat at https://gitter.im/sidneys/pushbullet-desktop](https://badges.gitter.im/sidneys/pushbullet-desktop.svg)](https://gitter.im/sidneys/pushbullet-desktop?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [![build status](http://img.shields.io/travis/sidneys/pushbullet-desktop.svg?style=flat)](http://travis-ci.org/sidneys/pushbullet-desktop) [![issues](https://img.shields.io/github/issues/sidneys/pushbullet-desktop.svg)](https://github.com/sidneys/pushbullet-desktop/issues)  
**Pushbullet for Desktop** is a lightweight & unobstrusive cross-platform client for [PushBullet](https://pushbullet.com/).

Receive native push notifications on OS X, Windows and Linux.

*Not affiliated with PushBullet Inc..*

## Features

**Native System Notifications**

*No Chrome required.*
Uses the macOS Notification Center and the Windows 10 Action Center.

**Unobstrusive**

Small resource footprint - runs as a macOS Menu Bar app or a Windows System Tray app.

**Simple Setup**

No wrestling with API-Keys or other technical knowledge required.
Login to Pushbullet using Google or Facebook.

**Content & Channel Image Previews**

- Channel-specific notification images ([IFTTT](https://ifttt.com/), [Zapier](https://zapier.com/) or [Pushbullet Chat](http://lifehacker.com/huge-pushbullet-update-adds-instant-messaging-chat-hea-1714870644))
- In-Notification image previews

**Custom Notification Sound**

Use the default Pushbullet notification sound or one of your choice.

**👾 Notification Emoji Tags **

Use custom tags within notifications for easy identification of content types.

Example: Prefix the YouTube-Feed with **{video}** to show a 📺 within Notifications.

## Installation

Download the latest release:

[Pushbullet for Desktop Releases](https://github.com/sidneys/pushbullet-desktop/releases)

## Commandline Usage

Install the global package::

```
npm install --global live-wallpaper-ecorp
```

Run it:

```
pushbullet-desktop
```

## Development

### Prepare Environment

After cloning, install the required packages:

```
npm install
```

Fire up a local Electron instance:

```
./node_modules/.bin/electron ./app/main.js
```

## Building

### Requirements

- Building the Windows app requires [wine](https://winehq.org) and [mono](https://nsis.sourceforge.net/Docs/Chapter3.htm)
- Building the Linux app requires [fakeroot](https://wiki.debian.org/FakeRoot) and [dpkg](https://wiki.ubuntuusers.de/dpkg/)

To install all those it on OSX using [Homebrew](https://brew.sh):

```
brew install --verbose wine mono
brew install --verbose fakeroot dpkg
```

### Running a Build

To build a platform:

```
npm run build <darwin|linux|win32>
```

To build all platforms (OSX only):

```
npm run build <darwin|linux|win32>
```

## Author

[sidneys](http://sidneys.github.io)



