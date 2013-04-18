/*!
 * liveview FileServer
 */

var FServer = module.exports = {},
	http = require('http'),
	net = require('net'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),
	fsWatcher = require('chokidar'),
	path = require('path'),
	colors = require('./colors'),
	exec = require('child_process').exec,
	tmpDir = tempdir(),
	pid = process.pid,
	pidFile = tmpDir + pid + '-liveview';

FServer.getPids = function () {
	var pids = [];
	try {
		pids = ls(tmpDir + '*-liveview');
	} catch (e) {}
	return pids;
};

FServer.isRunning = function () {
	return FServer.getPids().length > 0;
};

FServer.killall = function () {
	FServer.getPids().forEach(function (pidPath) {
		var _pid = pidPath.replace(tmpDir, '').split('-')[0];
		rm(pidPath);
		try {
			process.kill(_pid);
		} catch (e) { }
	});
};

FServer.getProjectDir = function () {
	var pids = FServer.getPids();
	if (pids.length) {
		return fs.readFileSync(pids[0]).toString().trim();
	}
};

// main export
FServer.start = function(opts) {
	if (FServer.isRunning()) {
		throw new Error('LiveView is already running');
	}

	var fileCount = {},
		BASE_DIR = opts.path || process.cwd(),
		PORT = opts.port || 8324,
		EPORT = opts.eport || 8323,
		ignoredPaths = [],
		ignoredExtensions = [],
		isAlloy = false;

	process.on('SIGINT', function() {
		fs.existsSync(pidFile) && fs.unlinkSync(pidFile);
		process.exit(0);
	});

	// create new pid file
	fs.existsSync(pidFile) && fs.unlinkSync(pidFile);
	fs.writeFileSync(pidFile, opts.path ? path.basename(opts.path) : process.cwd());

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
		console.log(' [INFO]'.green, 'Reload Triggered');
		console.log('  -REASON:'.grey, 'File', event);
		console.log('  -FILE:'.grey, file);
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
				exec('alloy compile', function (error, stdout, stderr) {
					console.log(error ? stderr : stdout);
				});
			});
		});
	}

	// TCP Server for two messaging between running app and server
	var server = net.createServer(function(c) {
		// client disconnected
		c.on('end', function() {
			console.log('[INFO]'.green, 'Event Server disconnected');
		});

		// watch Resources dir for file changes
		var watcher = fsWatcher.watch(BASE_DIR, { persistent: true, ignoreInitial: true });

		// check if alloy project exists and should be watched
		checkAlloy();

		// reload app on file changes
		watcher.on('change', function (path) {
			if (!isAlloy) { checkAlloy(); }
			logFsChange(path, 'Changed');
			c.write(JSON.stringify({type:'event', name:'reload'}));
		});

		watcher.on('error', function (path) {
			console.log('[WARN]'.yellow, 'error loading watching file', path);
		});

	});

	server.listen(EPORT, function() { //'listening' listener
		console.log('[INFO]'.green, ' Liveview Event Server Started on Port', (EPORT + '').bold);
	});
};
