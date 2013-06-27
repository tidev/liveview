require('shelljs/global');

var debug = require('debug')('liveview:clihook')
	, path = require('path')
	, join = path.join
	, fs = require('fs')
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

	cli.addHook('build.ios.copyResource', {
		pre: function(data, finished) {
			debug('Running pre:build.ios.copyResource hook');
			if (cli.argv.liveview) {
				var srcFile = data.args[0],
					destFile = data.args[1];

				if (srcFile == join(this.projectDir, 'Resources', 'app.js')) {
					data.args[0] = join(tempdir(),'liveview.js');
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
		priority: 3000,
		post: function(build, finished) {
			if (cli.argv.liveview) {
				debug('Running post:build.pre.compile hook');
				var resourceDir = path.resolve(cli.argv['project-dir'], 'Resources');
				var liveviewJS = join(tempdir(), 'liveview.js');

				cp('-f', join(__dirname, '../build/liveview.js'), liveviewJS);

				iface(function(interfaces) {
					var names = Object.keys(interfaces).sort(),
						ipAddr;
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
		exec(escape(__dirname, '../bin/liveview-server') + ' stop --no-colors');
		if (cli.argv.liveview) {
			debug('Running post:build.post.compile hook');
			var binDIR = join(__dirname, '../bin/liveview-server');
			var cmdOpts = [
				binDIR,
				'start',
				'--project-dir',
				cli.argv['project-dir']
			];

			if (!cli.argv.colors) { cmdOpts.push('--no-colors'); }
			debug('Spawning detached process with command:', cmdOpts);
			require('child_process').spawn(process.execPath, cmdOpts, {
				detached: true,
				stdio: 'inherit'
			});
		}
		finished();
	});
};