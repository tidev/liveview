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
	colors = require('coloring'),
	debug = require('debug')('liveview:server'),
	pkgConf = require('../package'),
	util = require('util'
		);

var tmpDir = tempdir();
var pid = process.pid;
var pidFile = tmpDir + pid + '-liveview';

/**
 * [pids description]
 * @return {[type]} [description]
 */

FServer.pids = function (env) {
	var pids = [];
	try {
		pids = ls(tmpDir + '*-liveview');
		!!env && console.log('[LiveView]'.green, 'Current running servers pid files: ' + (pids.join(' ').trim() || 'No Active Servers'.grey) + '\n');
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

FServer.status = function (env) {
	var paths = cat(tmpDir + '*-liveview');
	!!env && console.log('[LiveView]'.green, 'Current running servers: ' + (paths.trim() || 'No Active Servers'.grey) + '\n');
	return paths;
};

/**
 * [restart description]
 * @return {[type]} [description]
 */

FServer.restart = function () {
	var paths = FServer.status().split('\n');

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

FServer.stop = function (env) {
	var pids = ls(tmpDir + '*-liveview');
	if (!pids.length) {
		!!env && console.error('[LiveView]'.red, 'No active servers');
		return;
	}

	pids.forEach(function (pidPath) {
		var _pid = pidPath.replace(tmpDir, '').split('-')[0];
		rm(pidPath);
		try {
			console.log('[LiveView]'.green, 'Closing file/event server process id: ' + _pid);
			process.kill(_pid);
		} catch (e) {
			console.error('[LiveView]'.red, 'Error closing server', e);
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

	debug('Server Start called');
	console.log('[LiveView]'.green, 'version', pkgConf.version);
	var projectDir = path.resolve(opts.path || opts.projectDir || process.cwd());

  projectDir = (!~projectDir.indexOf('Resources'))
  	? projectDir + '/Resources'
    : projectDir;


	if (opts.daemonize) {
		debug('Starting server as background process');
		var fserverBin = path.join(__dirname.replace(/\s/g, '\\ ') + '/../bin/liveview-server');

		var cmdOpts = [
			fserverBin,
			'start',
			'--project-dir',
			projectDir
		];

		!opts.colors && cmdOpts.push('--no-colors');

		require('child_process').spawn(process.execPath, cmdOpts, {
			detached: true,
			stdio: 'inherit'
		});
		return;
	}


	var dirExists = fs.existsSync(projectDir);
	var hasTiApp = fs.existsSync(projectDir + '/../tiapp.xml');

	if (!dirExists || !hasTiApp) {
		console.error('[LiveView]'.red, 'Project directory "' + projectDir + '" is not a valid Titanium project.\n');
		process.exit(1);
		return;
	}

  var status = FServer.status();

	if (!~FServer.status().indexOf(projectDir)) {
		!!opts.args && console.error('[LiveView]'.green,'Stopping active server');
		FServer.stop();
	} else {
		!~opts.args.indexOf('hook-call') && console.error('[LiveView]'.red,'Server is already running\n');
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
	fs.writeFileSync(pidFile, projectDir);

	// create static file server
	http.createServer(function(request, response) {
		var uri = url.parse(request.url).pathname,
			filename = path.join(BASE_DIR, uri);

		if (uri === '/') {
			response.writeHead(200, {
				'Content-Type': 'text/plain',
				'Project-ID': 'todo'
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
					'Content-Type': 'text/plain',
					'Project-ID': 'todo'
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
					console.log('[LiveView]'.green, ' File Server Response');
					console.log(' -REQUESTED:'.grey, fileCount[filename], 'times');
					console.log(' -FILE:'.grey, uri.replace('/', ''));
					console.log(' -RESPONSE:'.grey, out.code);
					console.log(' -LENGTH:'.grey, out.data.length);
				}

				response.writeHead(out.code, {
					'Content-Type': 'text/plain',
					'Project-ID': 'todo'
				});
				response.write(out.data);
				response.end();
			});
		});
	}).listen(parseInt(PORT, 10));

	console.log('[LiveView]'.green, 'File Server Started on Port', (PORT + '').bold);

	/**
	 * [logFsChange description]
	 * @param  {[type]} file  [description]
	 * @param  {[type]} event [description]
	 * @return {[type]}       [description]
	 */

	function logFsChange(file, event){
		console.log('[LiveView]'.green, 'Reload Triggered');
		console.log('	-REASON:'.grey, 'File', event);
		console.log(' -FILE:'.grey, file);
	}

	/**
	 * [watchAlloy description]
	 * @return {[type]} [description]
	 */

	function checkAlloy() {
		debug('Checking if project is Alloy Project');

		if (isAlloy) { return; }
		fs.exists(BASE_DIR + '/../app', function (exists) {
			isAlloy = exists;
			if (!isAlloy) { return; }
			// watch alloy files for changes
			var alloyWatcher = fsWatcher.watch(BASE_DIR + '/../app', { persistent: true, ignoreInitial: true });
			console.log('[LiveView]'.green, 'Alloy project monitor started');

			alloyWatcher.on('change', function (path) {
				logFsChange(path, 'Changed');

				isBuilding = true;
				exec('alloy compile', function (code, error) {
					isBuilding = false;
					if(code) { return	console.error('[LiveView]'.red, error); }
					evtServer.watcher.emit('change', 'app.js');
				});
			});
		});
	}


	// TCP Server for two messaging between running app and server

	var evtServer = net.createServer();

	evtServer.clients = [];

	evtServer.on('connection', function (client) {
		console.log('[LiveView]'.green, 'Client connected');
		evtServer.clients.push(client);
	});

	evtServer.listen(EPORT, function() {

		console.log('[LiveView]'.green, 'Event Server Started on Port', (EPORT + '').bold);

		// watch Resources dir for file changes

		var watcher = evtServer.watcher = fsWatcher.watch(BASE_DIR, { persistent: true, ignoreInitial: true });

		// check if alloy project exists and should be watched
		checkAlloy();

		// reload app on file changes
		watcher.on('change', function (path) {
			if (!isAlloy) { checkAlloy(); }
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
			console.error('[LiveView]'.red, 'Error loading watching file', path);
		});
	});
};

process.on('uncaughtException', function (e) {
	console.error('[LiveView]'.red, e);
});