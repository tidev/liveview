/*
 * liveview FileServer
 */
'use strict';
const http = require('http'),
	net = require('net'),
	url = require('url'),
	path = require('path'),
	join = path.join,
	fs = require('fs-extra'),
	colors = require('coloring'), // eslint-disable-line no-unused-vars
	fsWatcher = require('chokidar'),
	debug = require('debug')('liveview:server'),
	pkgConf = require('../package'),
	util = require('util'),
	crypto = require('crypto'),
	Hypar = require('hypar'),
	HOME_DIR = process.env.HOME || process.env.USERPROFILE,
	TMP_DIR = join(HOME_DIR, '/.titanium/'),
	PID = process.pid,
	PID_FILE = join(TMP_DIR, (PID + '-liveview')),
	log = (process.env.SILENT) ? function () {} : console.log,
	logError = (process.env.SILENT) ? function () {} : console.error,
	/**
	 * main export
	 */
	FServer = module.exports = {};

// jsanalyze is lazy loaded when it's actually used because it pulls in Babel and slow
let jsanalyze = null;

var autoStopTimer;
// A mapping of files in an Alloy project that require us to fully recompile the project
// rather than doing selective compilation
const fullRecompileFiles = [
	'app/styles/app.tss',
	'app/config.json'
];

// Resource sub folders that hold files for one platform only
const PLATFORM_DIRS = [ 'android', 'iphone', 'ipad', 'ios', 'windows', 'mobileweb', 'blackberry', 'tizen' ];

// Request path of the prefetch manifest that the client asks for before a reload
const MANIFEST_URI = '/__liveview/manifest';

// Changes that arrive within this window are sent to the clients as one reload
const RELOAD_DEBOUNCE_MS = 500;

// inject shelljs to the global scope
/* globals ls, cat, rm, exec */
require('shelljs/global');

/**
 * md5 of a file, memoized by path, size and modification time
 */
const hashCache = new Map();
function hashFile(filename) {
	const stat = fs.statSync(filename);
	const cached = hashCache.get(filename);
	if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
		return cached.hash;
	}
	const hash = crypto.createHash('md5').update(fs.readFileSync(filename)).digest('hex');
	hashCache.set(filename, { size: stat.size, mtimeMs: stat.mtimeMs, hash });
	return hash;
}

/**
 * Lists the .js files below `dir` as paths relative to `dir` with forward slashes.
 * Hidden entries are skipped. `skipTopLevel` names top level folders to leave out.
 * @param  {string} dir directory to walk
 * @param  {Array<string>} skipTopLevel top level folder names to skip
 * @return {Array<string>} relative file paths
 */
function listJsFiles(dir, skipTopLevel) {
	const out = [];
	if (!fs.existsSync(dir)) {
		return out;
	}
	(function walk(current, rel) {
		let entries;
		try {
			entries = fs.readdirSync(current, { withFileTypes: true });
		} catch (e) {
			return;
		}
		entries.forEach(function (entry) {
			if (entry.name[0] === '.') {
				return;
			}
			if (!rel && skipTopLevel && skipTopLevel.includes(entry.name)) {
				return;
			}
			const relPath = rel ? rel + '/' + entry.name : entry.name;
			if (entry.isDirectory()) {
				walk(join(current, entry.name), relPath);
			} else if (entry.isFile() && entry.name.endsWith('.js')) {
				out.push(relPath);
			}
		});
	}(dir, ''));
	return out;
}

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
			log('[LiveView]'.green, 'Attempting to close file/event server process id: ' + _pid);
			process.kill(_pid);
		} catch (e) {
			// Only log the error if it's not an ESRCH (no such process) as
			// sometimes liveview does not clean up the pidfile when stopping
			if (e.code !== 'ESRCH') {
				logError('[LiveView]'.red, 'Error closing server', e);
			}
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
		nbsp: 160,
		lt: 60,
		gt: 62,
		amp: 38,
		cent: 162,
		pound: 163,
		yen: 164,
		euro: 8364,
		copy: 169,
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
	}

	const ALLOY_DIR = join(PROJECT_DIR, 'app');
	const LOCALE_DIR = join(PROJECT_DIR, 'i18n');
	const isAlloy = fs.existsSync(ALLOY_DIR) && !process.env.TI_USE_WEBPACK;
	const hasLocale = fs.existsSync(LOCALE_DIR);

	const pidObj = {
		projectPath: PROJECT_DIR,
		ip: HOST,
		eport: EPORT,
		fport: FPORT,
		alloy: isAlloy,
		platform: PLATFORM
	};

	// create new pid file
	fs.ensureDirSync(TMP_DIR);
	fs.existsSync(PID_FILE) && fs.unlinkSync(PID_FILE);
	fs.writeJsonSync(PID_FILE, pidObj, { spaces: '\t' });

	const OVERRIDES_DIR = join(__dirname, 'overrides');
	const PROJECT_NODE_MODULES_DIR = join(RESOURCE_DIR, 'node_modules');
	// This is used to handle the polyfill related modules as we dont
	// want to add these into a classic apps Resources dir
	const BUILD_NODE_MODULES_DIR = join(RESOURCE_DIR, '..', 'build', 'node_modules');

	// Identifies the server configuration. A client drops its prefetch cache when this changes.
	const serverSignature = crypto.createHash('md5').update(JSON.stringify({
		version: pkgConf.version,
		platform: PLATFORM,
		transpile: transpile,
		transpileTarget: transpileTarget
	})).digest('hex');

	/**
	 * Resolves a request path to the file that the server sends for it.
	 * The order is: override, platform folder, project node_modules, build node_modules, Resources.
	 * @param  {string} uri request path, for example /alloy/controllers/index.js
	 * @param  {string} requestPlatform platform of the client
	 * @return {Object} filename and whether the file is a build node module
	 */
	function resolveFile(uri, requestPlatform) {
		const platformFilepath = join(RESOURCE_DIR, requestPlatform, uri);
		const overridePath = join(OVERRIDES_DIR, uri);
		const projectNodeModulesPath = join(PROJECT_NODE_MODULES_DIR, uri);
		const buildNodeModulesPath = join(BUILD_NODE_MODULES_DIR, uri);

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
		return { filename, isBuildNodeModule: filename === buildNodeModulesPath };
	}

	/**
	 * Hash of the i18n strings, so that the client can tell when localeStrings changed.
	 * @return {string}
	 */
	function localeHash() {
		if (!hasLocale) {
			return 'none';
		}
		const hash = crypto.createHash('md5');
		fs.readdirSync(LOCALE_DIR).sort().forEach(function (name) {
			const stringsPath = join(LOCALE_DIR, name, 'strings.xml');
			if (fs.existsSync(stringsPath)) {
				hash.update(name).update(hashFile(stringsPath));
			}
		});
		return hash.digest('hex');
	}

	/**
	 * Builds the prefetch manifest: every module id the server can serve with a hash of its source.
	 * Ids have no leading slash and no .js extension.
	 * @param  {string} requestPlatform platform of the client
	 * @return {Object} manifest
	 */
	function buildManifest(requestPlatform) {
		const otherPlatformDirs = PLATFORM_DIRS.filter(name => name !== requestPlatform);
		const ids = new Set();

		listJsFiles(RESOURCE_DIR, otherPlatformDirs).forEach(function (rel) {
			const prefix = requestPlatform + '/';
			ids.add(rel.startsWith(prefix) ? rel.slice(prefix.length, -3) : rel.slice(0, -3));
		});
		listJsFiles(OVERRIDES_DIR).forEach(rel => ids.add(rel.slice(0, -3)));
		listJsFiles(PROJECT_NODE_MODULES_DIR).forEach(rel => ids.add(rel.slice(0, -3)));
		listJsFiles(BUILD_NODE_MODULES_DIR).forEach(rel => ids.add(rel.slice(0, -3)));

		const files = {};
		ids.forEach(function (id) {
			const resolved = resolveFile('/' + id + '.js', requestPlatform);
			try {
				files[id] = hashFile(resolved.filename);
			} catch (e) {
				debug('manifest: cannot hash %s: %s', resolved.filename, e.message);
			}
		});
		files.localeStrings = localeHash();

		return { signature: serverSignature, files };
	}

	// create static file server
	const fServer = http.createServer(function (request, response) {
		const uri = url.parse(request.url).pathname || '';
		const requestPlatform = request.headers['x-platform'] || PLATFORM;

		debug('[LiveView] File Server host: ', request.headers.host, '\n');
		debug('Request Headers:', '\n', util.inspect(request.headers), '\n');

		if (uri === MANIFEST_URI) {
			const started = Date.now();
			let body;
			try {
				body = JSON.stringify(buildManifest(requestPlatform));
			} catch (e) {
				logError('[LiveView]'.red, 'Cannot build manifest', e);
				response.writeHead(500, { 'Content-Type': 'text/plain' });
				response.end('500 ' + e.message);
				return;
			}
			debug('manifest for %s built in %d ms', requestPlatform, Date.now() - started);
			response.writeHead(200, { 'Content-Type': 'application/json' });
			response.end(body);
			return;
		} else if (uri === '/') {
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
				const stringsPath = join(LOCALE_DIR, langs[i], 'strings.xml');
				if (!fs.existsSync(stringsPath)) {
					return next(i + 1);
				}
				fs.createReadStream(stringsPath)
					.pipe(parser)
					.on('data', function () {
						langData[langs[i]] = tags;
						return next(i + 1);
					});
			}
			next(0);

		} else {

			const resolved = resolveFile(uri, requestPlatform);
			const filename = resolved.filename;

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
						if (!resolved.isBuildNodeModule && !process.env.TI_USE_WEBPACK) {
							if (!jsanalyze) {
								// lazy load :)
								jsanalyze = require('node-titanium-sdk/lib/jsanalyze');
							}

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
		log('[LiveView]'.green, 'File Server Started on', ((HOST ? HOST : '127.0.0.1') + ':' + FPORT).bold);
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
			// remove the client from the clients array
			evtServer.clients = evtServer.clients.filter(cl => cl !== client);

			// stop the server if no client reconnected in 15 minutes
			autoStopTimer = setTimeout(function () {
				if (evtServer.clients.length <= 1) {
					FServer.stop();
				}
			}, 1000 * 60 * 15);
		});

		client.on('data', function (e) {
			log('data:' + e);
		});
	});

	evtServer.on('close', function () {
		evtServer.clients = [];
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

	// Several files change in a burst (an editor save, an Alloy compile). The timer restarts on
	// every change and the clients get one reload event after the burst ends.
	let reloadTimer = null;
	let reloadFile = null;

	evtServer.on('change', function (file) {
		reloadFile = file;
		clearTimeout(reloadTimer);
		reloadTimer = setTimeout(sendReload, RELOAD_DEBOUNCE_MS);
	});

	function sendReload() {
		reloadTimer = null;
		logFsChange(reloadFile, 'Changed');

		const message = JSON.stringify({ type: 'event', name: 'reload' });
		evtServer.clients = evtServer.clients.filter(function (c) {
			if (c.destroyed) {
				return false;
			}
			try {
				c.write(message);
				return true;
			} catch (e) {
				debug('dropping client after write error: %s', e.message);
				return false;
			}
		});
	}

	// start up event server
	evtServer.listen(parseInt(EPORT, 10), HOST, function () {
		log('[LiveView]'.green, 'Event Server Started on', ((HOST ? HOST : '127.0.0.1') + ':' + EPORT).bold);
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
		const alloyWatcher = fsWatcher.watch(ALLOY_DIR, {
			persistent: true,
			ignoreInitial: true,
			ignored: [ /semantic\.colors\.json/ ]
		});
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
				if (!relativePath.startsWith('app/themes/') && !fullRecompileFiles.includes(relativePath)) {
					config = `${config},file=${relativePath}`;
				}
			}

			let alloyCmd = process.platform === 'win32' ? 'alloy.cmd' : 'alloy';
			if (process.env.ALLOY_PATH) {
				alloyCmd = `"${process.execPath}" ${process.env.ALLOY_PATH}`;
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
