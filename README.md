# LiveView

Titanium Live App Reloading for simulator and device.

__Install__

Bleeding edge version

``` sh
$ npm install -g git+https://github.com/appcelerator/liveview.git
```


## liveview#help

Outputs usage. Optional command for its usage.

``` sh
$ liveview <command> --help
```

## liveview#install

Manually Install the Titanium CLI hook:
_Note: Cli hook is automatically installed with LiveView_

``` sh
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

``` sh
$ liveview run [Titanium-CLI-Build-Flags]
```

Run liveview via the [Titanium CLI Tools](https://github.com/appcelerator/titanium)

``` sh
$ ti build --liveview [options]
```


## server#status

Outputs Server Active Server(s) Paths(s).

``` sh
$ liveview server status
```

## server#pids

Outputs Server Active Server(s) pid Paths(s).

``` sh
$ liveview server status
```

## server#stop

Stop liveview file/event servers

``` sh
$ liveview server stop
```

## server#start

Start a liveview file/event server for given directory

``` sh
$ liveview server start [-p --project-dir] <project-dir-path> [-d --daemonize]
```

## Development

As LiveView is now distributed in the SDK, the best way to work on it is to link your local git repository into the SDK version used by the app you're using to test.

1. Install the dependencies `npm install`
2. Run `npm link`, this allows you to symlink the module into your SDK easily
3. `cd` to the SDK directory used by your app. So if your app is using `8.3.1.GA` use:
   * Mac - `cd ~/Library/Application\ Support/Titanium/mobilesdk/osx/8.3.1.GA`
   * Windows - `cd %PROGRAMDATA%\Titanium/mobilesdk/win32/8.3.1.GA`
4. Run `npm link liveview` and you're good to go! When you make changes in your local git repository they will be reflected straight away into the SDK

## License

See LICENSE file for information on license.

#### (C) Copyright 20132021, [Appcelerator](http://www.appcelerator.com/) Inc. All Rights Reserved.
