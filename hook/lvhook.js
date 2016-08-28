require('shelljs/global');

var debug = require('debug')('liveview:clihook'),
	path = require('path'),
	http = require('http'),
	join = path.join,
	fs = require('fs'),
	spawn = require('child_process').spawn,
	util = require('util');

// export min cli version

exports.cliVersion = '>=3.0.25';


/**
 * initialize cli hook
 */

exports.init = function(logger, config, cli) {

	function doConfig(data, finished) {
		debug('Runningbuild.[PLATFORM].config hook');
		var sdkVersion = (cli.sdk && cli.sdk.name) || (cli.manifest && cli.manifest.version);
		var r = ((simpVer(cli.version) < 321) ? data.result : (sdkVersion && simpVer(sdkVersion) < 321) ? data.result[0] : data.result[1]) || {};
		r.flags || (r.flags = {});
		r.flags.liveview = {
			default: false,
			desc: 'enables LiveView'
		};
		finished(null, data);
	}

	cli.addHook('build.android.config', doConfig);
	cli.addHook('build.ios.config', doConfig);
	cli.addHook('build.windows.config', doConfig);

	/**
	 * [escape description]
	 * @param  {[type]} str [description]
	 * @return {[type]}     [description]
	 */

	function escape() {
		var args = join.apply(this, [].slice.call(arguments));
		return '"' + args + '"';
	}

	/**
	 * Replace and rename original app.js  file to execute liveview.js first
	 */

 function copyResource(data, finished) {
		debug('Running pre:build.'+cli.argv.platform+'.copyResource hook');
		if (cli.argv.liveview) {
			var RESOURCES_DIR = join(this.projectDir, 'Resources');

			var srcFile = data.args[0];
			var destFile = data.args[1];
			if (join(RESOURCES_DIR, 'app.js') === srcFile ||
					(new RegExp('^' + RESOURCES_DIR.replace(/\\/g, '/') + '(\/(android|ipad|ios|iphone|windows))?\/app.js$').test(srcFile.replace(/\\/g, '/')))) {
				data.args[0] = join(tempdir(), 'liveview.js');
			}
		}

		// backwards compatibility

		if (simpVer(cli.version) < 321) { return finished(data); }

		finished(null, data);
	}

	function writeBuildManifest(data, finished) {
		debug('Running pre:build.'+cli.argv.platform+'.writeBuildManifest hook');
		if (cli.argv.liveview) {
			data.args[0].liveview = true;
		}

		// backwards compatibility

		if (simpVer(cli.version) < 321) { return finished(data); }

		finished(null, data);
	}

	cli.addHook('build.ios.copyResource', { pre: copyResource });
	cli.addHook('build.ios.writeBuildManifest', { pre: writeBuildManifest });

	cli.addHook('build.android.copyResource', { pre: copyResource });
	cli.addHook('build.android.writeBuildManifest', { pre: writeBuildManifest });

	cli.addHook('build.windows.copyResource', { pre: copyResource });
	cli.addHook('build.windows.writeBuildManifest', { pre: writeBuildManifest });

	/**
	 * Copy LiveView.js to Resources folder and Inject Server Address
	 */

	cli.addHook('build.pre.compile', {
		priority: 3000,
		post: function(build, finished) {
			if (cli.argv.liveview) {
				debug('Running post:build.pre.compile hook');
				var resourceDir = path.resolve(cli.argv['project-dir'], 'Resources');
				var liveviewJS = join(tempdir(), 'liveview.js');
				cp('-f', join(__dirname, '../build/liveview.js'), liveviewJS);

				var ipAddr = getNetworkIp();

				if (ipAddr) {
					fs.writeFileSync(liveviewJS,
						fs.readFileSync(liveviewJS)
						.toString()
						.replace(/FSERVER_HOST/g, ipAddr)
						.replace(/TCP_HOST/g, ipAddr)
					);
				} else {
					logger.error('Unable to detect IP address');
				}
				finished();
			} else {
				finished();
			}
		}
	});

	/**
	 * Start event/file server
	 */
	cli.addHook('build.post.compile', function(build, finished) {
		// kill running server via fserver http api
		debug('invoke kill');

		var domain = require('domain').create();

		domain.on('error', function(err) {
			debug(err);
		});

		domain.run(function() {
			http
				.get('http://localhost:8324/kill', function(res){})
				.on('error', function(e){
				})
				.on('data', function(e){})
				.on('close', function(e){
					startServer(finished);
				});
		});
	});

	function startServer(finished) {
		if (cli.argv.liveview) {
			debug('Running post:build.post.compile hook');
			var binDIR = join(__dirname, '../bin/liveview-server');
			var cmdOpts = [
				binDIR,
				'start',
				'--project-dir', cli.argv['project-dir'],
				'--platform', cli.argv['platform']
			];

			if (!cli.argv.colors) {
				cmdOpts.push('--no-colors');
			}

			debug('Spawning detached process with command:', cmdOpts);
			var child = spawn(process.execPath, cmdOpts, {
				detached: true
			});

			child.on('error', function(err) {
				console.error('\n %s\n', err);
			});

			child.stdout.pipe(process.stdout);
		}
		finished();
	}
};

/**
 * getNetworkIp
 * get users local network ip address
 *
 * @return Number
 */
function getNetworkIp() {
	var n = require('os').networkInterfaces();
	var ip = []
	for (var k in n) {
		var inter = n[k]
		for (var j in inter)
			if (inter[j].family === 'IPv4' && !inter[j].internal &&
				// skip Windows virtual adapter for Windows Phone Emulator
				!(inter[j].mac.startsWith('00:15:5d') && k.indexOf('Windows Phone Emulator') > 0)) {
				return inter[j].address
			}
	}
}

/**
 * output version as integer
 * @param  {String} version
 * @return {Number}
 */

function simpVer (version) {
	return parseInt(version.split('-')[0].replace(/\./g, ''));
}
