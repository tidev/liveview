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
	chalk = require('chalk'),
	fsWatcher = require('chokidar'),
	debug = require('debug')('liveview:server'),
	pkgConf = require('../package'),
	util = require('util'),
	detect = require('jsparse-tools2').lexscope,
	Hypar = require('hypar'),
	HOME_DIR = process.env.HOME || process.env.USERPROFILE,
	TMP_DIR = join(HOME_DIR, '.titanium'),
	PID = process.pid,
	PID_FILE = join(TMP_DIR, (PID + '-liveview')),
	/**
	 * main export
	 */
	FServer = module.exports = {};

const {
	bold,
	green,
	grey,
	red
} = chalk;

function log(message) {
	if (process.env.SILENT) {
		return;
	}
	console.log(green('[LiveView]'), message);
}

function logError(message) {
	if (process.env.SILENT) {
		return;
	}
	console.error(red('[LiveView]'), message);
}

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
		!!env && log('Current running servers pid files: ' + (pids.join(' ').trim() || grey('No Active Servers')) + '\n');
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
	!!env && log('Current running servers: ' + (paths.trim() || grey('No Active Servers')) + '\n');
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
		!!env && logError('No active servers');
		return;
	}

	pids.forEach(function (pidPath) {
		try {
			let _pid = pidPath.replace(TMP_DIR, '').split('-')[0];
			rm(pidPath);
			log('Closing file/event server process id: ' + _pid);
			process.kill(_pid);
		} catch (e) {
			logError(`Error closing server ${JSON.stringify(e)}`);
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
		reg: 174
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
	const options = opts || {},
		HOST = options.host || options.liveviewIp,
		FPORT = options.fport || options.liveviewFport || 8324,
		EPORT = options.eport || options.liveviewEport || 8323,
		PLATFORM = options.platform;
	debug('Liveview File Server Opts', options);
	debug('Running PIDS:', FServer.pids());
	log(`version ${pkgConf.version}`);
	let isBuilding = false,
		fileCount = {},
		evtServer;

	let RESOURCE_DIR = path.resolve(options.path || options.projectDir || process.cwd());
	RESOURCE_DIR = (!~RESOURCE_DIR.indexOf('Resources')) ? RESOURCE_DIR + '/Resources' : RESOURCE_DIR;
	const PROJECT_DIR = join(RESOURCE_DIR, '../');

	if (!fs.existsSync(RESOURCE_DIR) || !fs.existsSync(join(PROJECT_DIR, 'tiapp.xml'))) {
		logError(`Project directory "${PROJECT_DIR}" is not a valid Titanium project.\n`);
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
		const uri = url.parse(request.url).pathname || '',
			requestPlatform = request.headers['x-platform'] || PLATFORM,
			platformFilepath = join(RESOURCE_DIR, requestPlatform, uri),
			overridePath = join(__dirname, 'overrides', uri);

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
				fs.readFile(filename, function (err, file) {
					let out = (err) ? { code: 500, data: err } : { code: 200, data: file };

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
						const scope = detect(out.data);
						let shiftCount = 0;

						// TODO probably a better way to do this, but this fix will work for now.

						out.data = String(out.data).replace(/^#![^\n]*\n/, '').split('');

						const v = Object.keys(scope.lexvars['']);
						v.forEach(function (vr) {
							const line = scope.lexvars[''][vr];
							if (line.type === 'VariableDeclarator') {
								const start = line.parent.start + shiftCount;
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
	fServer.listen(parseInt(FPORT, 10), function () {
		log(`File Server Started on ${bold(((HOST ? HOST : '0.0.0.0') + ':' + FPORT))}`);
	});

	// TCP Server for two messaging between running app and server
	evtServer = net.createServer();

	// connect clients
	evtServer.clients = [];

	// listen for new client connections
	evtServer.on('connection', function (client) {
		log('Client connected');
		evtServer.clients.push(client);

		client.on('end', function () {
			log('Client disconnected');
			// evtServer.clients.splice(client);
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
				c.write(JSON.stringify({ type: 'event', name: 'reload' }));
				evtServer.clients.shift();
			} catch (e) {
				// clients.splice(i);
			}
		});
	});

	// start up event server
	evtServer.listen(parseInt(EPORT, 10), function () {
		log(`Event Server Started on ${bold(((HOST ? HOST : '0.0.0.0') + ':' + EPORT))}`);
	});

	/**
	 * watch Resources dir for file changes
	 */
	const resourceWatcher = evtServer.watcher = fsWatcher.watch(RESOURCE_DIR, { persistent: true, ignoreInitial: true });

	resourceWatcher.on('change', function (file) {
		if (isBuilding) {
			return;
		}
		evtServer.emit('change', file);
	});

	resourceWatcher.on('error', function (path) {
		logError(`Error loading watching file ${path}`);
	});

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
			logError(`Error loading watching file ${path}`);
		});
	}

	/**
	 * check if alloy project folder should be watched
	 */
	if (isAlloy) {
		const alloyWatcher = fsWatcher.watch(ALLOY_DIR, { persistent: true, ignoreInitial: true });
		log('Alloy project monitor started');

		alloyWatcher.on('change', function (file) {
			if (isBuilding) {
				return log('File changes ignored while Alloy compiling');
			}
			isBuilding = true;
			log(`Alloy recompile initiated for ${PLATFORM}`);
			exec('appc alloy compile "' + ALLOY_DIR + '" --no-colors --config platform=' + PLATFORM, { silent: true }, function (code, error) {
				isBuilding = false;
				if (code) {
					return logError(error);
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
	logError(e);
});

/**
 * [logFsChange description]
 * @param  {string} file  [description]
 * @param  {string} event [description]
 */
function logFsChange(file, event) {
	log('Reload Triggered');
	log(`${grey('  REASON:')} File ${event}`);
	log(`${grey('  FILE:')} ${file}`);
}
