/*
 * liveview FileServer
 */
'use strict';
const http = require('http'),
	net = require('net'),
	url = require('url'),
	path = require('path'),
	join = path.join,
	fs = require('fs'),
	colors = require('coloring'), // eslint-disable-line no-unused-vars
	fsWatcher = require('chokidar'),
	debug = require('debug')('liveview:server'),
	pkgConf = require('../package'),
	util = require('util'),
	Hypar = require('hypar'),
	HOME_DIR = process.env.HOME || process.env.USERPROFILE,
	TMP_DIR = join(HOME_DIR, '/.titanium/'),
	PID = process.pid,
	PID_FILE = join(TMP_DIR, (PID + '-liveview')),
	log = (process.env.SILENT) ? function () {} : console.log,
	logError = (process.env.SILENT) ? function () {} : console.error,
	jsanalyze = require('node-titanium-sdk/lib/jsanalyze'),
	/**
	 * main export
	 */
	FServer = module.exports = {};

var autoStopTimer;
// A mapping of files in an Alloy project that require us to fully recompile the project
// rather than doing selective compilation
const fullRecompileFiles = [
	'app/styles/app.tss',
	'app/config.json'
];

// inject shelljs to the global scope
/* globals ls, cat, rm, exec */
require('shelljs/global');

/**
 * Return an Array of running liveview pid filenames
 * @param {boolean} env whether to log results
 * @return {Array} running liveview server pid filenames
 */
FServer.pids = function (env) {
	let pids = [];
	try {
		pids = ls(join(TMP_DIR, '*-liveview'));
		!!env && log('[LiveView]'.green, 'Current running servers pid files: ' + (pids.join(' ').trim() || 'No Active Servers'.grey) + '\n');
	} catch (e) {
		debug(e);
		// do nothing
	}
	return pids;
};

/**
 * Concatenates the running liveview server pid files (holding the path for each server)
 * @param {boolean} env whether to log results
 * @return {string} [description]
 */
FServer.status = function (env) {
	const paths = cat(join(TMP_DIR, '*-liveview'));
	!!env && log('[LiveView]'.green, 'Current running servers: ' + (paths.trim() || 'No Active Servers'.grey) + '\n');
	return paths;
};

/**
 * Restarts the file server(s)
 */
FServer.restart = function () {
	const paths = FServer.status().split('\n');

	FServer.stop();

	paths.forEach(function (path) {
		if (path.length) {
			FServer.start({
				path: path
			});
		}
	});
};

/**
 * Attempts to kill the process for each running liveview file server
 * @param {boolean} env whether to log results
 */
FServer.stop = function (env) {
	const pids = ls(join(TMP_DIR, '*-liveview'));

	if (!pids.length) {
		!!env && logError('[LiveView]'.red, 'No active servers');
		return;
	}

	pids.forEach(function (pidPath) {
		try {
			let _pid = pidPath.replace(TMP_DIR, '').split('-')[0];
			rm(pidPath);
			log('[LiveView]'.green, 'Closing file/event server process id: ' + _pid);
			process.kill(_pid);
		} catch (e) {
			logError('[LiveView]'.red, 'Error closing server', e);
		}
	});

	debug('Killed PIDS:', pids);
};

/**
 * [decodeEntity description]
 * @param  {string} str [description]
 * @return {string}     [description]
 */
function decodeEntity(str) {
	const names = {
		'nbsp': 160,
		'lt': 60,
		'gt': 62,
		'amp': 38,
		'cent': 162,
		'pound': 163,
		'yen': 164,
		'euro': 8364,
		'copy': 169,
		'reg:': 174
	};

	return ('' + str).replace(/&#?([\w\d]+);?/g, function (s, entity) {
		entity = (isNaN(entity)) ? names[entity] : entity;
		return String.fromCharCode(encodeURI(entity).replace('%'));
	}).replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\b/g, '\b').replace(/\\f/g, '\f').replace(/\\v/g, '\v');
}

/**
 * Starts a new Liveview file server
 * @param  {Object} opts options
 */
FServer.start = function (opts) {
	const options = opts || {},
		HOST = options.host || options.liveviewIp,
		FPORT = options.fport || options.liveviewFport || 8324,
		EPORT = options.eport || options.liveviewEport || 8323,
		PLATFORM = options.platform,
		transpile = options.transpile,
		transpileTarget = options.transpileTarget;

	debug('Liveview File Server Opts', options);
	debug('Running PIDS:', FServer.pids());
	log('[LiveView]'.green, 'version', pkgConf.version);

	let isBuilding = false,
		fileCount = {},
		evtServer;

	let RESOURCE_DIR = path.resolve(options.path || options.projectDir || process.cwd());
	RESOURCE_DIR = (!~RESOURCE_DIR.indexOf('Resources')) ? RESOURCE_DIR + '/Resources' : RESOURCE_DIR;
	const PROJECT_DIR = join(RESOURCE_DIR, '..');

	if (!fs.existsSync(RESOURCE_DIR) || !fs.existsSync(join(PROJECT_DIR, 'tiapp.xml'))) {
		logError('[LiveView]'.red, 'Project directory "' + PROJECT_DIR + '" is not a valid Titanium project.\n');
		process.exit(1);
		return;
	}

	const ALLOY_DIR = join(PROJECT_DIR, 'app');
	const LOCALE_DIR = join(PROJECT_DIR, 'i18n');
	const isAlloy = fs.existsSync(ALLOY_DIR);
	const hasLocale = fs.existsSync(LOCALE_DIR);

	// create new pid file
	fs.existsSync(PID_FILE) && fs.unlinkSync(PID_FILE);
	fs.writeFileSync(PID_FILE, PROJECT_DIR);

	// create static file server
	const fServer = http.createServer(function (request, response) {
		const uri = url.parse(request.url).pathname || '';
		const requestPlatform = request.headers['x-platform'] || PLATFORM;
		const platformFilepath = join(RESOURCE_DIR, requestPlatform, uri);
		const overridePath = join(__dirname, 'overrides', uri);
		const projectNodeModulesPath = join(RESOURCE_DIR, 'node_modules', uri);
		// This is used to handle the polyfill related modules as we dont
		// want to add these into a classic apps Resources dir
		const buildNodeModulesPath = join(RESOURCE_DIR, '..', 'build', 'node_modules', uri);

		debug('[LiveView] File Server host: ', request.headers.host, '\n');
		debug('Request Headers:', '\n', util.inspect(request.headers), '\n');

		if (uri === '/') {
			// TODO Extract to function dedicated to handling root request
			response.writeHead(200, {
				'Content-Type': 'application/json'
			});

			response.write(JSON.stringify({
				pid: process.pid,
				path: PROJECT_DIR,
				uptime: process.uptime(),
				alloy: isAlloy
			}));
			response.end();
			return;
		} else if (uri === '/kill') {
			// TODO Extract to function dedicated to kill request
			response.end('');
			fServer.close();
			evtServer.close();
			rm('-rf', PID_FILE);
			process.exit(0);
		} else if (uri === '/localeStrings.js') {
			// TODO Extract to function dedicated to locale strings request
			response.writeHead(200, {
				'Content-Type': 'text/plain',
				'Project-ID': 'GUID_XXXXXX'
			});

			if (!hasLocale) {
				response.write('module.exports = {};');
				response.end();
				return;
			}

			const langs = fs.readdirSync(LOCALE_DIR).filter(function (name) {
				return fs.statSync(path.resolve(LOCALE_DIR, name)).isDirectory();
			});
			let langData = {};

			/**
			 * [next description]
			 * @param  {number}   i [description]
			 */
			function next(i) { // jshint ignore:line
				if (!langs[i]) {
					response.write('module.exports = ' + JSON.stringify(langData) + ';');
					response.end();
					return;
				}

				const parser = new Hypar();
				let tags = {};
				parser.on('tag', function (e) {
					if (e.name !== 'string') {
						return;
					}
					tags[e.attr.name] = decodeEntity(this._text);
				});

				fs.createReadStream(join(LOCALE_DIR, langs[i], 'strings.xml'))
					.pipe(parser)
					.on('data', function () {
						langData[langs[i]] = tags;
						return next(i + 1);
					});
			}
			next(0);

		} else {

			let filename = join(RESOURCE_DIR, uri);
			if (fs.existsSync(overridePath)) {
				filename = overridePath;
			} else if (fs.existsSync(platformFilepath)) {
				filename = platformFilepath;
			} else if (fs.existsSync(projectNodeModulesPath)) {
				filename = projectNodeModulesPath;
			} else if (fs.existsSync(buildNodeModulesPath)) {
				filename = buildNodeModulesPath;
			}

			fs.exists(filename, function (exists) {
				fileCount[filename] = (fileCount[filename] || 0) + 1;

				// return 404 if file does not exist
				if (!exists) {
					response.writeHead(404, {
						'Content-Type': 'text/plain',
						'Project-ID': 'todo'
					});
					response.write('404 Not Found\n');
					response.end();
					return;
				}

				// responds with file string
				fs.readFile(filename, 'utf8', function (err, file) {
					const out = {};
					if (err) {
						out.code = 500;
						out.data = err;
					} else {
						out.code = 200;
						// We only want to transpile the users code/modules,
						// transpiling the polyfill libs makes things go a bit wonky
						if (filename !== buildNodeModulesPath) {
							const transpiled = jsanalyze.analyzeJs(file, {
								filename: filename,
								minify: false,
								transpile: transpile,
								targets: transpileTarget,
								resourcesDir: join(RESOURCE_DIR, '..', 'build')
							});
							out.data = transpiled.contents;
						} else {
							out.data = file;
						}
					}

					debug('File Server Response',
						'\n'
						+ '  requested: ' + fileCount[filename] + ' time(s)\n'
						+ '  file: ' + uri.replace('/', '') + '\n'
						+ '  response: ' + out.code + '\n'
						+ '  length: ' + out.data.length + '\n'
					);

					response.writeHead(out.code, {
						'Content-Type': 'text/plain',
						'Project-ID': 'GUID_XXXXXX'
					});
					response.write(out.data);
					response.end();
				});
			});
		}
	});

	// start listening for requests
	fServer.listen(parseInt(FPORT, 10), HOST, function () {
		log('[LiveView]'.green, 'File Server Started on', ((HOST ? HOST : '0.0.0.0') + ':' + FPORT).bold);
	});

	// TCP Server for two messaging between running app and server
	evtServer = net.createServer();

	// connect clients
	evtServer.clients = [];

	// listen for new client connections
	evtServer.on('connection', function (client) {
		log('[LiveView]'.green, 'Client connected');
		evtServer.clients.push(client);

		// if the client has reconnected, cancel the server stop
		clearTimeout(autoStopTimer);

		client.on('end', function () {
			log('[LiveView]'.green, 'Client disconnected');
			// evtServer.clients.splice(client);

			// stop the server if no client reconnected in 1 minute
			autoStopTimer = setTimeout(function () {
				FServer.stop();
			}, 60000);
		});

		client.on('data', function (e) {
			log('data:' + e);
		});
	});

	evtServer.on('close', function () {
		evtServer.clients.forEach(function (c) {
			log(c);
			// clients.splice(i);
		});
	});

	evtServer.on('error', function (e) {
		if (e.code === 'EADDRINUSE') {
			log('Address in use, retrying...');
			setTimeout(function () {
				evtServer.close();
				evtServer.listen(parseInt(EPORT));
			}, 1000);
		}
	});

	evtServer.on('change', function (file) {
		const clients = evtServer.clients.slice(0);

		logFsChange(file, 'Changed');

		clients.forEach(function (c) {
			try {
				c.write(JSON.stringify({ type:'event', name:'reload' }));
				evtServer.clients.shift();
			} catch (e) {
				// clients.splice(i);
			}
		});
	});

	// start up event server
	evtServer.listen(parseInt(EPORT, 10), HOST, function () {
		log('[LiveView]'.green, 'Event Server Started on', ((HOST ? HOST : '0.0.0.0') + ':' + EPORT).bold);
	});

	/**
	 * watch Resources dir for file changes
	 */
	if (!isAlloy) {
		const resourceWatcher = evtServer.watcher = fsWatcher.watch(RESOURCE_DIR, { persistent: true, ignoreInitial: true });

		resourceWatcher.on('change', function (file) {
			if (isBuilding) {
				return;
			}
			evtServer.emit('change', file);
		});

		resourceWatcher.on('error', function (path) {
			logError('[LiveView]'.red, 'Error loading watching file', path);
		});
	}

	/**
	 * watch i18n dir for file changes
	 */
	if (hasLocale) {
		const localeWatcher = evtServer.watcher = fsWatcher.watch(LOCALE_DIR, { persistent: true, ignoreInitial: true });

		localeWatcher.on('change', function (file) {
			if (isBuilding) {
				return;
			}
			evtServer.emit('change', file);
		});

		localeWatcher.on('error', function (path) {
			logError('[LiveView]'.red, 'Error loading watching file', path);
		});
	}

	/**
	 * check if alloy project folder should be watched
	 */
	if (isAlloy) {
		const alloyWatcher = fsWatcher.watch(ALLOY_DIR, { persistent: true, ignoreInitial: true });
		log('[LiveView]'.green, 'Alloy project monitor started');

		alloyWatcher.on('change', function (file) {
			if (isBuilding) {
				return log('[LiveView]'.green, 'File changes ignored while Alloy compiling');
			}
			isBuilding = true;
			log('[LiveView]'.green, 'Alloy recompile initiated for', PLATFORM);

			let config = `--config platform=${PLATFORM}`;
			if (file) {
				// Alloy expects the file to be passed in like file=app/controllers/index.js,
				// where the file is relative to the project directory. But we should only do
				// this if the file isn't an  "app wide" file i.e. app.tss, config.json
				const relativePath = path.relative(PROJECT_DIR, file);
				if (!fullRecompileFiles.includes(relativePath)) {
					config = `${config},file=${relativePath}`;
				}
			}
			let alloyCmd = 'alloy';
			if (process.env.ALLOY_PATH) {
				alloyCmd = process.env.ALLOY_PATH;
			}

			const cmd = `${alloyCmd} compile "${ALLOY_DIR}" --no-colors ${config}`;

			debug('alloy compile command %s', cmd);

			exec(cmd, { silent: true }, function (code, error) {
				isBuilding = false;
				if (code) {
					return logError('[LiveView]'.red, error);
				}
				evtServer.emit('change', file);
			});
		});
	}

	process.on('SIGINT', function () {
		fServer.close();
		evtServer.close();
		rm('-rf', PID_FILE);
		process.exit(0);
	});
};

process.on('uncaughtException', function (e) {
	logError('[LiveView]'.red, e);
});

/**
 * [logFsChange description]
 * @param  {string} file  [description]
 * @param  {string} event [description]
 */
function logFsChange(file, event) {
	log('[LiveView]'.green, 'Reload Triggered');
	log('  REASON:'.grey, 'File', event);
	log('  FILE:'.grey, file);
}
