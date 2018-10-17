# LiveView

[![Build Status](https://travis-ci.com/appcelerator/liveview.svg?token=ph6xdReX6PW2XENunBEH&branch=master)](https://travis-ci.com/appcelerator/liveview) [![Greenkeeper badge](https://badges.greenkeeper.io/appcelerator/liveview.svg?token=a4158989980182cc11ba9561daa7996bb5788c24106a6936194e71cc7ad22115&ts=1539797586155)](https://greenkeeper.io/)

Titanium Live App Reloading for simulator and device.

__Install__

Bleeding edge version

```
$ npm install -g git+https://github.com/appcelerator/liveview.git
```


## liveview#help

Outputs usage. Optional command for its usage.

```
$ liveview <command> --help
```

## liveview#install

Manually Install the Titanium CLI hook:
_Note: Cli hook is automatically installed with LiveView_

```
$ liveview install clihook
```

## liveview#rm

Manually Remove the Titanium CLI hook:
_Note: Cli hook is automatically removed with LiveView_

```
$ liveview rm clihook
```

## liveview#run

Run liveview with the requested Titanium CLI Build Flags.
( _prompts for build flags if none provided_ )

```
$ liveview run [Titanium-CLI-Build-Flags]
```

Run liveview via the [Titanium CLI Tools](https://github.com/appcelerator/titanium)

```
$ ti build --liveview [options]
```


## server#status

Outputs Server Active Server(s) Paths(s).

```
$ liveview server status
```

## server#pids

Outputs Server Active Server(s) pid Paths(s).

```
$ liveview server status
```

## server#stop

Stop liveview file/event servers

```
$ liveview server stop
```

## server#start

Start a liveview file/event server for given directory

```
$ liveview server start [-p --project-dir] <project-dir-path> [-d --daemonize]
```

## License

See LICENSE file for information on license.

#### (C) Copyright 2013, [Appcelerator](http://www.appcelerator.com/) Inc. All Rights Reserved.
