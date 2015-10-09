require('shelljs/global');

var debug = require('debug')('liveview:clihook'),
	path = require('path'),
	http = require('http'),
	join = path.join,
	fs = require('fs'),
	async = require('async'),
	exec = require('child_process').exec,
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
					(new RegExp('^' + RESOURCES_DIR.replace(/\\/g, '/') + '(\/(android|ipad|ios|iphone))?\/app.js$').test(srcFile.replace(/\\/g, '/')))) {
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

				var ipAddr;
				async.series([
					function (cb) {
						getNetworkIp(function(err, result) {
							ipAddr = result;
							debug('network ip ' + ipAddr);
							cb();
						});
					},

					function (cb) {
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
						cb();
					}
				], function (err){
					finished();
				});
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
 * getScopeId
 * get IPv6 local-link scope id
 *
 * @return Number
 */
function getScopeId(inter, callback) {
	var regrex = /^[\w\W]*scopeid\s+(0x\d+)[\w\W]*?/;
    debug('executing ifconfig ' + inter.interName);
    exec('ifconfig ' + inter.interName, function(err, stdout, stderr) {
        if (err) {
            return callback(err);
        }

        var regex = /^[\w\W]*scopeid\s+(0x\d+)[\w\W]*?/;
        var match = stdout.match(regex);
        var scopeid;
        if (match) {
            scopeid = parseInt(match[1], 16);
        }

        callback(null, scopeid);
    });
}


/**
 * getNetworkIp
 * get users local network ip address
 *
 * @return Number
 */
function getNetworkIp(callback) {
	var n = require('os').networkInterfaces();
	var isWin = /^win/.test(process.platform);
	var interObj = {};
	var host;
	var selected;

	for (var k in n) {
		var inter = n[k];
		for (var j in inter) {
			if (!inter[j].internal & !interObj[inter[j].family]) {
				interObj[inter[j].family] = {
					address: inter[j].address,
					scopeid: inter[j].scopeid,
					interName: k,
				};
			}
		}
	}

	if (isWin || !interObj['IPv6']) {
		selected = interObj['IPv4'];
		host = selected && selected.address;
		callback(null, host);
	} else {
		selected = interObj['IPv6'];
		if (selected.scopeid) {
			host = selected.address.replace('::', ':' + selected.scopeid + '::');
			callback(null, host);
		} else {
			getScopeId(selected, function (err, id) {
				if (err) {
					// fallback to IPv4
					host = interObj['IPv4'] && interObj['IPv4'].address;
				} else {
					host = selected.address.replace('::', ':' + id + '::');
				}
				callback(null, host);
			});
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
