/* !
 * liveview FileServer
 */
var http = require('http'),
	net = require('net'),
	url = require('url'),
	path = require('path'),
	join = path.join,
	fs = require('fs'),
	fsWatcher = require('chokidar'),
	debug = require('debug')('liveview:server'),
	pkgConf = require('../package'),
	util = require('util'),
	detect = require('jsparse-tools2').lexscope,
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

// inject shelljs to the global scope
/* globals ls, cat, rm, exec */
require('shelljs/global');

/**
 * Return an Array of running liveview pid filenames
 * @param {boolean} env whether to log results
 * @return {Array} running liveview server pid filenames
 */
FServer.pids = function (env) {
	var pids = [];
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
	var paths = cat(join(TMP_DIR, '*-liveview'));
	!!env && log('[LiveView]'.green, 'Current running servers: ' + (paths.trim() || 'No Active Servers'.grey) + '\n');
	return paths;
};

/**
 * Restarts the file server(s)
 */
FServer.restart = function () {
	var paths = FServer.status().split('\n');

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
	var pids = ls(join(TMP_DIR, '*-liveview'));

	if (!pids.length) {
		!!env && logError('[LiveView]'.red, 'No active servers');
		return;
	}

	pids.forEach(function (pidPath) {
		var _pid;
		try {
			_pid = pidPath.replace(TMP_DIR, '').split('-')[0];
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
	var names = {
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
	});
}

/**
 * Starts a new Liveview file server
 * @param  {Object} opts options
 */
FServer.start = function (opts) {
	var options = opts || {},
		RESOURCE_DIR = path.resolve(options.path || options.projectDir || process.cwd()),
		PROJECT_DIR,
		ALLOY_DIR,
		LOCALE_DIR,
		HOST = options.host || options.liveviewIp,
		FPORT = options.fport || options.liveviewFport || 8324,
		EPORT = options.eport || options.liveviewEport || 8323,
		isAlloy,
		hasLocale,
		isBuilding = false,
		fileCount = {},
		PLATFORM = options.platform,
		fServer,
		evtServer,
		resourceWatcher,
		localeWatcher,
		alloyWatcher;

	debug('Liveview File Server Opts', options);

	debug('Running PIDS:', FServer.pids());
	log('[LiveView]'.green, 'version', pkgConf.version);

	RESOURCE_DIR = (!~RESOURCE_DIR.indexOf('Resources')) ? RESOURCE_DIR + '/Resources' : RESOURCE_DIR;
	PROJECT_DIR = join(RESOURCE_DIR, '../');
	ALLOY_DIR = join(PROJECT_DIR, 'app');
	LOCALE_DIR = join(PROJECT_DIR, 'i18n');

	isAlloy = fs.existsSync(ALLOY_DIR);
	hasLocale = fs.existsSync(LOCALE_DIR);

	if (!fs.existsSync(RESOURCE_DIR) || !fs.existsSync(join(PROJECT_DIR, 'tiapp.xml'))) {
		logError('[LiveView]'.red, 'Project directory "' + PROJECT_DIR + '" is not a valid Titanium project.\n');
		process.exit(1);
		return;
	}

	// create new pid file
	fs.existsSync(PID_FILE) && fs.unlinkSync(PID_FILE);
	fs.writeFileSync(PID_FILE, PROJECT_DIR);

	// create static file server
	fServer = http.createServer(function (request, response) {
		var uri = url.parse(request.url).pathname || '',
			requestPlatform = request.headers['x-platform'] || PLATFORM,
			platformFilepath = join(RESOURCE_DIR, requestPlatform, uri),
			filename = join(RESOURCE_DIR, uri),
			overridePath = join(__dirname, 'overrides', uri),
			langs, // used by /localeStrings.js handling
			langData = {}; // used by /localeStrings.js handling

		debug('[LiveView] File Server host: ', request.headers.host, '\n');

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
		}

		if (uri === '/kill') {
			// TODO Extract to function dedicated to kill request
			response.end('');
			fServer.close();
			evtServer.close();
			rm('-rf', PID_FILE);
			process.exit(0);
		}

		debug('Request Headers:', '\n', util.inspect(request.headers), '\n');

		if (fs.existsSync(overridePath)) {
			filename = overridePath;
		} else if (fs.existsSync(platformFilepath)) {
			filename = platformFilepath;
		}

		if (uri === '/localeStrings.js') {
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

			langs = fs.readdirSync(LOCALE_DIR).filter(function (name) {
				return fs.statSync(path.resolve(LOCALE_DIR, name)).isDirectory();
			});
			langData = {};

			/**
			 * [next description]
			 * @param  {number}   i [description]
			 */
			function next(i) { // jshint ignore:line
				var tags = {},
					parser;
				if (!langs[i]) {
					response.write('module.exports = ' + JSON.stringify(langData) + ';');
					response.end();
					return;
				}

				parser = new Hypar();
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
				fs.readFile(filename, function (err, file) {
					var out = (err) ? { code: 500, data: err } : { code: 200, data: file },
						scope,
						v,
						shiftCount = 0;

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

					if (uri === '/app.js') {

						scope = detect(out.data);

						// TODO probably a better way to do this, but this fix will work for now.

						out.data = String(out.data).replace(/^#![^\n]*\n/, '').split('');

						v = Object.keys(scope.lexvars['']);
						v.forEach(function (vr) {
							var line = scope.lexvars[''][vr],
								start;
							if (line.type === 'VariableDeclarator') {
								start = line.parent.start + shiftCount;
								out.data[start] = ' ';
								out.data[start + 1] = ' ';
								out.data[start + 2] = ' ';

								if (line.parent && line.parent.kind === 'const') {
									out.data[start + 3] = ' ';
									out.data[start + 4] = ' ';
								}

								if (line.init === null) {
									out.data.splice(line.end + shiftCount, 0, ' = null');
									shiftCount++;
								}
							}
						});
						out.data = out.data.join('');

						debug('[LiveView] app.js global variables: ', scope.locals[''], '\n');

						scope.locals[''].forEach(function (lexVar) {
							out.data = out.data + '\ntry { lvGlobal._globalCtx.' + lexVar + ' = ' + lexVar + '; } catch(e) {}';
						});

						response.write(out.data);
						response.end();
					} else {
						response.write(out.data);
						response.end();
					}
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

		client.on('end', function () {
			log('[LiveView]'.green, 'Client disconnected');
			// evtServer.clients.splice(client);
		});

		client.on('data', function (e) {
			log('data:' + e);
		});
	});

	evtServer.on('close', function (client) {
		var clients = evtServer.clients,
			clientLen = clients.length,
			i;

		for (i = 0; i < clientLen; i++) {
			log(client[i]);
			// clients.splice(i);
		}
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
		var clients = evtServer.clients.slice(0),
			clientLen = clients.length,
			i;

		logFsChange(file, 'Changed');

		for (i = 0; i < clientLen; i++) {
			try {
				clients[i].write(JSON.stringify({ type:'event', name:'reload' }));
				evtServer.clients.shift();
			} catch (e) {
				// clients.splice(i);
			}
		}
	});

	// start up event server
	evtServer.listen(parseInt(EPORT, 10), HOST, function () {
		log('[LiveView]'.green, 'Event Server Started on', ((HOST ? HOST : '0.0.0.0') + ':' + EPORT).bold);
	});

	/**
	 * watch Resources dir for file changes
	 */
	resourceWatcher = evtServer.watcher = fsWatcher.watch(RESOURCE_DIR, { persistent: true, ignoreInitial: true });

	resourceWatcher.on('change', function (file) {
		if (isBuilding) {
			return;
		}
		evtServer.emit('change', file);
	});

	resourceWatcher.on('error', function (path) {
		logError('[LiveView]'.red, 'Error loading watching file', path);
	});

	/**
	 * watch i18n dir for file changes
	 */
	if (hasLocale) {
		localeWatcher = evtServer.watcher = fsWatcher.watch(LOCALE_DIR, { persistent: true, ignoreInitial: true });

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
	if (fs.existsSync(ALLOY_DIR)) {
		alloyWatcher = fsWatcher.watch(ALLOY_DIR, { persistent: true, ignoreInitial: true });
		log('[LiveView]'.green, 'Alloy project monitor started');

		alloyWatcher.on('change', function (file) {
			if (isBuilding) {
				return log('[LiveView]'.green, 'File changes ignored while Alloy compiling');
			}
			isBuilding = true;
			log('[LiveView]'.green, 'Alloy recompile initiated for', PLATFORM);
			exec('appc alloy compile "' + ALLOY_DIR + '" --no-colors --config platform=' + PLATFORM, { silent: true }, function (code, error) {
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
