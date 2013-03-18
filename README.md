# LiveView
## Titanium live preview of Titanium applications on device.

## Install

Bleeding edge version

```
$ npm install -g git+https://github.com/appcelerator/liveview.git
```

Install the Titanium CLI hook:

```
$ titanium config paths.hooks -a "/path/to/liveview/hook"
```

## API

### help

Outputs usage. Optional command for its usage.

```
$ liveview [command] --help
```

### run

Run liveview with the requested Titanium CLI Build Flags.
(_prompts for build flags if none provided_)

```
$ liveview run [Titanium-CLI-Build-Flags]
```

## License

See LICENSE file for information on license.

#### (C) Copyright 2013, [Appcelerator](http://www.appcelerator.com/) Inc. All Rights Reserved.
