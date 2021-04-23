# LiveView

Titanium Live App Reloading for simulator and device powered by [Vite](https://vitejs.dev/).

## Install

This version of LiveView is still experimental and only works with Titanium SDK 10+. To install, use the `next` tag from NPM:

``` sh
$ npm install -g liveview@next
```

This will install a preview release of LiveView alongside the bundled one from the SDK. If you build with SDK 10+ and enable LiveView, this new version will be used. All versions below SDK 10 will keep using the default LiveView shipped with the SDK.

## Usage

The prefered way to use LiveView is with the new `serve` command that is added to the `ti` CLI. Alternatively, you can also use the `--liveview` flag of the `build` command.

### Serve Command

```sh
ti serve <android|ios>
```

The `serve` command will only build your app once and then serve your app's JavaScript through the Vite dev server. This makes it extremely fast on consecutive builds as it only needs to start the dev server and launch your app.

To prevent unnecessary re-builds of your app, the `serve` command will perform a few checks on the passed build options and your `tiapp.xml`. Your app will only be build again if:

- Anything in `tiapp.xml` was changed.
- The `--target` option changed.
- The `--force` flag is set.
- No metadata from the previous build is available.

Internally the `serve` command wraps the `build` command, so all options from the build command are supported.

> ⚠️ **NOTE:** The `serve` command currently cannot detect when you change any assets in your app, like images or fonts. To bring your LiveView enabled app up-to-date, simply use the `--force` flag to run a full build.
>
> If you are in an early stage of your app development and frequently change assets, see the `--liveview` build command flag below, which always goes through a normal build.

### Build Command Flag

```sh
ti build -p <android|ios> --liveview
```

Using the `--liveview` flag goes through the normal Titanium build process, which makes sure all your app's assets and native dependencies are always up-to-date.

### Disable the Preview Release

This package contains a `postinstall` script which will automatically configure the `ti` CLI so it knows where to find the new LiveView. On builds with SDK 10+, this Preview Release will be used instead of the default LiveView that comes shipped with the SDK. You can disable this by removing the lookup paths from the `ti config` settings.

First run `ti config` to get a list of paths that the CLI will scan for additional hooks and commands:

```sh
ti config
```

Look for the `paths.commands` and `paths.hooks` options. After you have identified the paths that point to folders inside LiveView you can remove them by running the following commands:

```sh
ti config -r paths.commands /path/to/liveview/node/commands
ti config -r paths.hooks /path/to/liveview/node/hooks
```

To re-enable the preview release of LiveView, simply add the paths again:

```sh
ti config -a paths.commands /path/to/liveview/node/commands
ti config -a paths.hooks /path/to/liveview/node/hooks
```

If you feel lazy (or forgot the paths) you can also just install LiveView again to re-run the `postinstall` script which will practically do the same.

## Development

If you already have installed LiveView globally make sure to [disable the preview release](#disable-the-preview-release) first.

Now, run `yarn` and then `yarn dev` to start watching all files for changes.
