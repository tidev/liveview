require('shelljs/global');

exports.cliVersion = '>=3.0.25';

exports.init = function (logger, config, cli) {

	var fs = require('fs'),
		path = require('path'),
		fserver = require('../lib/fserver');

	function doConfig(data, finished) {
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

	cli.addHook('build.ios.copyResource', {
		pre: function (data, finished) {
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
		pre: function (data, finished) {
			if (cli.argv.liveview) {
				data.args[0].liveview = true;
			}
			finished(data);
		}
	});

	cli.addHook('build.ios.compileJsFile', {
		pre: function (data, finished) {
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

	cli.addHook('build.android.setBuilderPyEnv', {
		priority: 2000,
		pre: function (data, finished) {
			if (cli.argv.liveview) {
				data.args[0].LIVEVIEW = '1';
			}
			finished(data);
		}
	});

	cli.addHook('build.pre.compile', {
		priority: 2000,
		post: function (build, finished) {
			if (cli.argv.liveview) {
				var resourceDir = path.join(pwd(), 'Resources'),
					liveviewJS = path.join(resourceDir, 'liveview.js');

				cp('-f', __dirname + '/../build/liveview.js', path.join(resourceDir, 'liveview.js'));

				require('node-appc').net.interfaces(function (interfaces) {
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

	cli.addHook('build.post.compile', function (build, finished) {
		if (cli.argv.liveview) {
			require('child_process').spawn(process.execPath, [
				path.resolve(__dirname + '/../bin/liveview-server'),
				'start',
				'--project-dir', cli.argv['project-dir']
			], {
				detached: true,
				stdio: 'ignore'
			});
		}
		finished();
	});

};
