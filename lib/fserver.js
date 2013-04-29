/*!
 * liveview FileServer
 */

require('shelljs/global');

var FServer = module.exports = {},
	http = require('http'),
	net = require('net'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),
	fsWatcher = require('chokidar'),
	debug = require('debug')('liveview:server'),
	colors = require('coloring'),
	util = require('util');

var tmpDir = tempdir();
var pid = process.pid;
var pidFile = tmpDir + pid + '-liveview';

/**
 * [pids description]
 * @return {[type]} [description]
 */

FServer.pids = function () {
	var pids = [];
	try {
		pids = ls(tmpDir + '*-liveview');
	} catch (e) {
		debug(e);
		// do nothing
	}
	return pids;
};

/**
 * [status description]
 * @return {[type]} [description]
 */

FServer.status = function () {
	return (ls(tmpDir + '*-liveview').length > 0);
};

/**
 * [restart description]
 * @return {[type]} [description]
 */

FServer.restart = function () {
	var pids = FServer.pids();
	var paths = [];

	pids.forEach(function(path){
		fs.readFile(path, function (err, data) {
			if (err) { throw err; }
			paths.push('' + data);
		});
	});

	FServer.stop();

	paths.forEach(function(path){
		if (path.length) {
			FServer.start({
				path: path
			});
		}
	});
};

/**
 * [stop description]
 * @return {[type]} [description]
 */

FServer.stop = function () {
	var pids = ls(tmpDir + '*-liveview');
	if (!pids.length) {
		console.warn('[WARN]'.yellow, 'No running liveview servers');
		return;
	}

	pids.forEach(function (pidPath) {
		var _pid = pidPath.replace(tmpDir, '').split('-')[0];
		rm(pidPath);
		try {
			console.log('[LOG]'.green, 'Closing liveview server at path: ' + pidPath);
			process.kill(_pid);
		} catch (e) {
			debug('stop error', e);
		}
	});
};

/**
 * [start description]
 * @param  {[type]} opts [description]
 * @return {[type]}      [description]
 */

FServer.start = function(opts) {
	opts = opts || {};

	var projectDir = path.resolve(opts.path || opts.projectDir || process.cwd());

  projectDir = (projectDir.indexOf('Resources') > -1)
  	? projectDir
    : projectDir + '/Resources';

	if (FServer.status()) {
		console.error('[ERROR]'.red,'Server is already running');
		process.exit(1);
		return;
	}

	var dirExists = fs.existsSync(projectDir);
	var hasTiApp = fs.existsSync(projectDir + '/../tiapp.xml');

	if (!dirExists || !hasTiApp) {
		console.error('[ERROR]'.red, 'Project directory "' + projectDir + '" is not a valid Titanium project.');
		process.exit(1);
		return;
	}

	var fileCount = {},
		BASE_DIR = projectDir,
		PORT = opts.port || 8324,
		EPORT = opts.eport || 8323,
		ignoredPaths = [],
		ignoredExtensions = [],
		isAlloy = false,
		isBuilding = false;

	FServer.info = {
		url: '',
		port: PORT,
		eport: EPORT
	};

	process.on('SIGINT', function() {
		fs.existsSync(pidFile) && fs.unlinkSync(pidFile);
		process.exit(0);
	});

	// create new pid file
	fs.existsSync(pidFile) && fs.unlinkSync(pidFile);
	debug(pidFile, projectDir);
	fs.writeFileSync(pidFile, projectDir);

	// create static file server
	http.createServer(function(request, response) {
		var uri = url.parse(request.url).pathname,
			filename = path.join(BASE_DIR, uri);

		if (uri === '/') {
			response.writeHead(200, {
				'Content-Type': 'text/plain'
			});
			response.write('Appcelerator - liveview\n');
			response.end();
			return;
		}

		fs.exists(filename, function(exists) {
			fileCount[filename] = (fileCount[filename] || 0) + 1;

			// return 404 if file does not exist

			if (!exists) {
				response.writeHead(404, {
					'Content-Type': 'text/plain'
				});
				response.write('404 Not Found\n');
				response.end();
				return;
			}

			fs.readFile(filename, function(err, file) {
				var out = (err) ? {
					code: 500,
					data: err
				} : {
					code: 200,
					data: file
				};

				if (opts.verbose) {
					console.log('[INFO]'.green, ' File Server Response');
					console.log(' -REQUESTED:'.grey, fileCount[filename], 'times');
					console.log(' -FILE:'.grey, uri.replace('/', ''));
					console.log(' -RESPONSE:'.grey, out.code);
					console.log(' -LENGTH:'.grey, out.data.length);
				}

				response.writeHead(out.code, {
					'Content-Type': 'text/plain'
				});
				response.write(out.data);
				response.end();
			});
		});
	}).listen(parseInt(PORT, 10));

	console.log('[INFO]'.green, ' LiveView Server Started on Port', (PORT + '').bold);

	/**
	 * [logFsChange description]
	 * @param  {[type]} file  [description]
	 * @param  {[type]} event [description]
	 * @return {[type]}       [description]
	 */

	function logFsChange(file, event){
		console.log('[INFO]'.green, 'Reload Triggered');
		console.log('	-REASON:'.grey, 'File', event);
		console.log(' -FILE:'.grey, file);
	}

	/**
	 * [watchAlloy description]
	 * @return {[type]} [description]
	 */

	function checkAlloy() {
		if (isAlloy) { return; }
		fs.exists(BASE_DIR + '/../app', function (exists) {
			isAlloy = exists;
			if (!isAlloy) { return; }
			// watch alloy files for changes
			var alloyWatcher = fsWatcher.watch(BASE_DIR + '/../app', { persistent: true, ignoreInitial: true });
			console.log('[INFO]'.green, 'LiveView Alloy project monitor started');

			alloyWatcher.on('change', function (path) {
				logFsChange(path, 'Changed');

				isBuilding = true;
				exec('alloy compile', function (code, error) {
					isBuilding = false;
					if(code) { return	console.error('[ERROR]'.red, error); }
					console.log(code);
					evtServer.watcher.emit('change', 'app.js');
				});
			});
		});
	}


	// TCP Server for two messaging between running app and server

	var evtServer = net.createServer();

	evtServer.clients = [];

	evtServer.on('connection', function (client) {
		console.log('[INFO]'.green, 'client connected');
		evtServer.clients.push(client);
	});

	evtServer.on('close', function() {
		console.log('[INFO]'.green, 'server disconnected');
	});

	evtServer.listen(EPORT, function() {

		console.log('[INFO]'.green, ' Liveview Event Server Started on Port', (EPORT + '').bold);

		// watch Resources dir for file changes

		var watcher = evtServer.watcher = fsWatcher.watch(BASE_DIR, { persistent: true, ignoreInitial: true });

		// check if alloy project exists and should be watched
		checkAlloy();

		// reload app on file changes
		watcher.on('change', function (path) {
			if (!isAlloy) { checkAlloy(); }
			console.log(path);
			if (isBuilding) { return; }
			var clients = evtServer.clients;
			var clientLen = clients.length;

			logFsChange(path, 'Changed');

			for (var i = 0; i < clientLen; i++) {
				try {
					clients[i].write(JSON.stringify({type:'event', name:'reload'}));
				} catch(e){
					clients.splice(i);
				}
			}
		});

		watcher.on('error', function (path) {
			console.log('[WARN]'.yellow, 'error loading watching file', path);
		});
	});
};

process.on('uncaughtException', function (e) {
	console.error(e);
});