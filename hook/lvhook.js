require('shelljs/global');
var debug = require('debug')('liveview:clihook')
	, util = require('util');

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

	var fs = require('fs'),
		path = require('path');

	function iface(callback) {

		var ifaces = require('os').networkInterfaces(),
			exec = require('child_process').exec,
			cmds = ['ifconfig', 'ipconfig /all'];

		// need to re-map the interface structure to make room for the mac address
		Object.keys(ifaces).forEach(function(dev) {
			ifaces[dev] = {
				ipAddresses: ifaces[dev]
			};
		});

		callback = callback || function() {};

		(function go() {
			var cmd = cmds.shift();
			if (cmd) {
				exec(cmd, function(err, stdout, stderr) {
					if (err) {
						go();
						return;
					}

					var macs = {};

					// parse the mac addresses
					stdout.replace(/\r\n|\r/g, '\n') // remove all \r
					.replace(/\n\n/g, '\n') // remove double lines
					.replace(/[\n][\t ]/g, ' ') // if the next line indents, bring it up a line
					.replace(/   /g, '~') // if indented with spaces, mark with ~ so we can match
					.replace(/ethernet adapter ([^:]*:)\n/ig, '$1') // on Windows, remove Ethernet adapter
					.split('\n').forEach(function(line) {
						if (line = line.trim()) {
							var m = line.match(/([^:~]*).*?((?:[0-9A-F][0-9A-F][:-]){5}[0-9A-F][0-9A-F])/i);
							m && m.length > 1 && m[2] && (macs[m[1]] = m[2])
						}
					});

					// set the mac address, if it exists
					Object.keys(ifaces).forEach(function(dev) {
						macs[dev] && (ifaces[dev].macAddress = macs[dev]);
					});

					callback(interfaces = ifaces);
				});
			} else {
				callback(interfaces = ifaces);
			}
		}());
	};

	/**
	 * Replace and rename original app.js  file to execute liveview.js first
	 */

	cli.addHook('build.ios.copyResource', {
		pre: function(data, finished) {
			debug('Running pre:build.ios.copyResource hook');
			if (cli.argv.liveview) {
				var srcFile = data.args[0],
					destFile = data.args[1];

				if (srcFile == path.join(this.projectDir, 'Resources', 'app.js')) {
					data.args[1] = path.join(path.dirname(destFile), '_app.js');
				} else if (srcFile == path.join(this.projectDir, 'Resources', 'liveview.js')) {
					data.args[1] = path.join(path.dirname(destFile), 'app.js');
				}
			}
			finished(data);
		}
	});

	cli.addHook('build.ios.writeBuildManifest', {
		pre: function(data, finished) {
			debug('Running pre:build.ios.writeBuildManifest hook');
			if (cli.argv.liveview) {
				data.args[0].liveview = true;
			}
			finished(data);
		}
	});

	/**
	 * Replace and rename original app.js  file to execute liveview.js first
	 */

	cli.addHook('build.ios.compileJsFile', {
		pre: function(data, finished) {
			debug('Running pre:build.ios.compileJsFile hook');
			if (cli.argv.liveview) {
				var target = data.args[0];
				if (target.from == path.join(this.projectDir, 'Resources', 'app.js')) {
					target.path = '_app.js';
					target.to = target.to.substring(0, target.to.length - 13) + 'liveview.js';
				} else if (target.from == path.join(this.projectDir, 'Resources', 'liveview.js')) {
					target.path = 'app.js';
					target.to = target.to.substring(0, target.to.length - 13) + 'app.js';
				}
			}
			finished(data);
		}
	});

	/**
	 * Set LiveView flag for legacy android builder.py
	 */

	cli.addHook('build.android.setBuilderPyEnv', {
		priority: 2000,
		pre: function(data, finished) {
			debug('Running pre:build.ios.compileJsFile hook');
			if (cli.argv.liveview) {
				data.args[0].LIVEVIEW = '1';
			}
			finished(data);
		}
	});

	/**
	 * Copy LiveView.js to Resources folder and Inject Server Address
	 */

	cli.addHook('build.pre.compile', {
		priority: 2000,
		post: function(build, finished) {
			debug('Running post:build.pre.compile hook');
			if (cli.argv.liveview) {

				var resourceDir = path.resolve(cli.argv['project-dir'], 'Resources');
				var liveviewJS = path.join(resourceDir, 'liveview.js');

				cp('-f', __dirname + '/../build/liveview.js', path.join(resourceDir, 'liveview.js'));

				iface(function(interfaces) {
					var names = Object.keys(interfaces).sort(),
						ipAddr;

					if (cli.argv.platform == 'android' && cli.argv.target == 'emulator') {
						// android emulator is special
						ipAddr = '10.0.2.2';
					} else {
						// note: this finds the first physical interface which may not necessarily be the default gateway interface
						for (var i = 0; i < names.length; i++) {
							if (interfaces[names[i]].macAddress) {
								var ips = interfaces[names[i]].ipAddresses;
								for (var j = 0; j < ips.length; j++) {
									ipAddr = ips[j].address;
									if (ips[j].family.toLowerCase() == 'ipv4') {
										break;
									}
								}
								break;
							}
						}
					}

					if (ipAddr) {
						fs.writeFileSync(liveviewJS, fs.readFileSync(liveviewJS).toString().replace(/FSERVER_HOST/g, ipAddr).replace(/TCP_HOST/g, ipAddr));
					} else {
						logger.error('Unable to detect IP address');
					}
					finished();
				});
			} else {
				finished();
			}
		}
	});

	/**
	 * Start event/file Server
	 */

	cli.addHook('build.post.compile', function(build, finished) {
		var fserverBin = path.normalize(__dirname + '/../bin/liveview-server');
		debug('Running post:build.post.compile hook');
		if (cli.argv.liveview) {
			var useColors = (cli.argv.colors) ? '' : '--no-colors';
			exec(fserverBin + ' start --project-dir ' + cli.argv['project-dir'] + ' --daemonize ' + useColors, {async: true});
		} else {
			exec(fserverBin + ' stop', {silent: true, async: true });
		}
		finished();
	});
};