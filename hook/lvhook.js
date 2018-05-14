'use strict';
const debug = require('debug')('liveview:clihook'),
	path = require('path'),
	http = require('http'),
	join = path.join,
	fs = require('fs-extra'),
	os = require('os'),
	server = require('../lib/fserver');

// export min cli version
exports.cliVersion = '>=3.0.25';

/**
 * initialize cli hook
 * @param  {Object} logger The Titanium CLI logger
 * @param  {Object} config Titanium CLI build config
 * @param  {Object} cli    Titanium CLI builder
 * @return {undefined}        [description]
 */
exports.init = function (logger, config, cli) {

	/**
	 * [doConfig description]
	 * @param  {Object} data     [description]
	 * @param  {Function} finished [description]
	 */
	function doConfig(data, finished) {
		debug('Running build.[PLATFORM].config hook');
		const sdkVersion = (cli.sdk && cli.sdk.name) || (cli.manifest && cli.manifest.version);
		const r = ((simpVer(cli.version) < 321) ? data.result : (sdkVersion && simpVer(sdkVersion) < 321) ? data.result[0] : data.result[1]) || {};
		r.flags || (r.flags = {});
		r.flags.liveview = {
			default: false,
			desc: 'enables LiveView'
		};

		r.options || (r.options = {});
		r.options['liveview-ip'] = {
			default: null,
			desc: 'LiveView Server IP address'
		};

		r.options['liveview-fport'] = {
			default: null,
			desc: 'LiveView file server port'
		};

		r.options['liveview-eport'] = {
			default: null,
			desc: 'LiveView event server port'
		};

		finished(null, data);
	}

	cli.addHook('build.android.config', doConfig);
	cli.addHook('build.ios.config', doConfig);
	cli.addHook('build.windows.config', doConfig);

	/**
	 * Replace and rename original app.js file to execute liveview.js first
	 * @param  {Object} data     [description]
	 * @param  {Function} finished Callback function
	 * @returns {undefined}
	 */
	function copyResource(data, finished) {
		debug('Running pre:build.' + cli.argv.platform + '.copyResource hook');

		if (cli.argv.liveview) {
			const RESOURCES_DIR = join(this.projectDir, 'Resources');

			const srcFile = data.args[0];
			if (join(RESOURCES_DIR, 'app.js') === srcFile
				|| (new RegExp('^' + RESOURCES_DIR.replace(/\\/g, '/') + '(/(android|ipad|ios|iphone|windows|blackberry|tizen))?/app.js$').test(srcFile.replace(/\\/g, '/')))) {
				data.args[0] = join(os.tmpdir(), 'liveview.js');
			}
		}

		// backwards compatibility
		if (simpVer(cli.version) < 321) {
			return finished(data);
		}

		finished(null, data);
	}

	/**
	 * [writeBuildManifest description]
	 * @param  {Object} data     [description]
	 * @param  {Function} finished Callback function
	 * @returns {undefined}
	 */
	function writeBuildManifest(data, finished) {
		debug('Running pre:build.' + cli.argv.platform + '.writeBuildManifest hook');

		if (cli.argv.liveview) {
			data.args[0].liveview = true;

			const tempAppJS = path.resolve(cli.argv['project-dir'], 'Resources', '.liveviewapp.js');
			fs.existsSync(tempAppJS) && fs.unlinkSync(tempAppJS);
		}

		// backwards compatibility
		if (simpVer(cli.version) < 321) {
			return finished(data);
		}

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
		/**
		 * [description]
		 * @param  {Object} build    [description]
		 * @param  {Function} finished [description]
		 */
		post: function (build, finished) {
			if (cli.argv.liveview) {
				debug('Running post:build.pre.compile hook');
				const resourceDir = path.resolve(cli.argv['project-dir'], 'Resources');
				const liveviewJS = join(os.tmpdir(), 'liveview.js');
				fs.copySync(join(__dirname, '../build/liveview.js'), liveviewJS, { clobber: true });
				fs.copySync(join(resourceDir, 'app.js'), join(resourceDir, '.liveviewapp.js'), { clobber: true });

				const ipAddr = cli.argv['liveview-ip'] || getNetworkIp();
				const fileServerPort = cli.argv['liveview-fport'] || 8324;
				const eventServerPort = cli.argv['liveview-eport'] || 8323;

				if (ipAddr) {
					fs.writeFileSync(liveviewJS,
						fs.readFileSync(liveviewJS)
							.toString()
							.replace(/FSERVER_HOST/g, ipAddr)
							.replace(/FSERVER_PORT/g, fileServerPort)
							.replace(/ESERVER_PORT/g, eventServerPort)
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
	cli.addHook('build.post.compile', function (build, finished) {
		// kill running server via fserver http api
		debug('invoke kill');

		const domain = require('domain').create();
		domain.on('error', function (err) {
			debug(err);
		});

		domain.run(function () {
			http
				.get('http://localhost:8324/kill', function () {})
				.on('error', function () {})
				.on('data', function () {})
				.on('close', function () {
					startServer(build, finished);
				});
		});
	});

	/**
	 * [startServer description]
	 * @param  {Function} finished [description]
	 */
	function startServer(build, finished) {
		if (cli.argv.liveview) {
			const ipAddr = cli.argv['liveview-ip'];
			const fileServerPort = cli.argv['liveview-fport'];
			const eventServerPort = cli.argv['liveview-eport'];
			const platform = cli.argv.platform;
			const transpileTarget = {};

			if (platform === 'ios') {
				if (build.useJSCore) {
					transpileTarget.ios = build.minSupportedIosSdk;
				}
			} else if (platform === 'android') {
				transpileTarget.chrome = build.chromeVersion;
			} else if (platform === 'windows') {
				transpileTarget.safari = '10';
			}

			const opts = {
				host: ipAddr,
				fport: fileServerPort,
				eport: eventServerPort,
				platform,
				projectDir: cli.argv['project-dir'],
				transpile: cli.tiapp.transpile,
				transpileTarget
			};

			debug('opts are %o', opts);
			debug('Running post:build.post.compile hook');
			server.start(opts);
		}
		finished();
	}
};

/**
 * getNetworkIp
 * get users local network ip address
 *
 * @return {string}
 */
function getNetworkIp() {
	const n = require('os').networkInterfaces();

	for (const k in n) {
		const inter = n[k];
		for (const j in inter) {
			if (inter[j].family === 'IPv4' && !inter[j].internal) {
				return inter[j].address;
			}
		}
	}
}

/**
 * output version as integer. Takes all input up to first '-', removes periods, tries to parse as integer
 * @param  {string} version version string with - separators
 * @return {number} First segment of version (split by '-'), with '.'s removed, parsed as an integer
 */
function simpVer(version) {
	return parseInt(version.split('-')[0].replace(/\./g, ''));
}
