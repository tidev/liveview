require('shelljs/global');

var debug = require('debug')('liveview:clihook'),
	path = require('path'),
	join = path.join,
	fs = require('fs'),
	util = require('util');

// export min cli version

exports.cliVersion = '>=3.0.25';


/**
 * initialize cli hook
 */

exports.init = function(logger, config, cli) {

	function doConfig(data, finished) {
		debug('Runningbuild.[PLATFORM].config hook');
		var r = data.result || {};
		r.flags || (r.flags = {});
		r.flags.liveview = {
			default: false,
			desc: 'enables LiveView'
		};
		finished(null, data);
	}

	cli.addHook('build.android.config', doConfig);
	cli.addHook('build.ios.config', doConfig);

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

			if (join(RESOURCES_DIR, 'app.js') === srcFile || (new RegExp('^' + RESOURCES_DIR + '(\/(android|ipad|ios|iphone))?\/app.js$').test(srcFile))) {
				data.args[0] = join(tempdir(), 'liveview.js');
			}
		}
		finished(data);
	}

	function writeBuildManifest(data, finished) {
		debug('Running pre:build.'+cli.argv.platform+'.writeBuildManifest hook');
		if (cli.argv.liveview) {
			data.args[0].liveview = true;
		}
		finished(data);
	}

	cli.addHook('build.ios.copyResource', { pre: copyResource });
	cli.addHook('build.ios.writeBuildManifest', { pre: writeBuildManifest });

	cli.addHook('build.android.copyResource', { pre: copyResource });
	cli.addHook('build.android.writeBuildManifest', { pre: writeBuildManifest });

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
	 * Start event/file Server
	 */

	cli.addHook('build.post.compile', function(build, finished) {
		exec(escape(__dirname, '../bin/liveview-server') + ' stop --no-colors');
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
			require('child_process').spawn(process.execPath, cmdOpts, {
				detached: true,
				stdio: 'inherit'
			});
		}
		finished();
	});
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
			if (inter[j].family === 'IPv4' && !inter[j].internal) {
				return inter[j].address
			}
	}
}
