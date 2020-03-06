/* globals Process, Socket */
var global, process;

const path = require('path');

/**
 * Initialize a new `Module`.
 * @param {string} id The module identifier
 * @public
 */
function Module(id) {
	this.id = id;
	if (process.platform === 'ipad') {
		this.platform = 'iphone';
	} else if (process.platform === 'windowsphone' || process.platform === 'windowsstore') {
		this.platform = 'windows';
	} else {
		this.platform = process.platform;
	}
	this.exports = {};
	this.loaded = false;
}

function L(name, filler) {
	return (Module._globalCtx.localeStrings[Ti.Locale.currentLanguage] || {})[name] || filler || name;
}

// global namespace
global = Module._global = Module.global = {};

// main process
process = global.process = new Process();

// set environment type
global.ENV = 'liveview';

// set logging
global.logging = false;

// catch uncaught errors
global.CATCH_ERRORS = true;

// module cache
Module._cache = {};

/**
 * place holder for native require until patched
 *
 * @private
 */
Module._requireNative = function () {
	throw new Error('Module.patch must be run first');
};

/**
 * place holder for native require until patched
 *
 * @private
 */
Module._includeNative = function () {
	throw new Error('Module.patch must be run first');
};

/**
 * replace built in `require` function
 *
 * @param  {Object} globalCtx Global context
 * @param  {string} url The URL to use (default is '127.0.0.1', or '10.0.2.2' on android emulator)
 * @param  {number} port The port to use (default is 8324)
 * @private
 */
Module.patch = function (globalCtx, url, port) {
	const defaultURL = process.platform === 'android' && process.hardware === 'sdk' ? '10.0.2.2' : Ti.Platform.model === 'Simulator' ? '127.0.0.1' : 'FSERVER_HOST';
	Module._globalCtx = globalCtx;
	global._globalCtx = globalCtx;
	Module._url = url || defaultURL;
	Module._port = parseInt(port, 10) || 8324;
	Module._requireNative = globalCtx.require;
	Module.evtServer && Module.evtServer.close();
	Module._compileList = [];

	// FIX for android bug
	try {
		Ti.App.Properties.setBool('ti.android.bug2373.finishfalseroot', false);
	} catch (e) {
		// ignore
	}

	globalCtx.localeStrings = Module.require('localeStrings');
	Module.connectServer();
};

/**
 * [reload description]
 */
Module.global.reload = function () {
	try {
		Module.evtServer._proxy.close();
		console.log('[LiveView] Reloading App');
		Ti.App._restart();
	} catch (e) {
		console.log('[LiveView] Reloading App via Legacy Method');
		Module.require('app');
	}
};

/**
 * [description]
 */
Module.connectServer = function () {
	let retryInterval = null;
	const client = Module.evtServer = new Socket({ host: Module._url, port: parseInt('ESERVER_PORT', 10) }, function () {
		console.log('[LiveView]', 'Connected to Event Server');
	});

	client.on('close', function () {
		console.log('[LiveView]', 'Closed Previous Event Server client');
	});

	client.on('connect', function () {
		if (retryInterval) {
			clearInterval(retryInterval);
			console.log('[LiveView]', 'Reconnected to Event Server');
		}
	});

	client.on('data', function (data) {
		if (!data) {
			return;
		}
		try {
			const evt = JSON.parse('' + data);
			if (evt.type === 'event' && evt.name === 'reload') {
				Module._cache = {};
				Module.global.reload();
			}
		} catch (e) { /* discard non JSON data for now */ }
	});

	client.on('end', function () {
		console.error('[LiveView]', 'Disconnected from Event Server');
		retryInterval = setInterval(function () {
			console.log('[LiveView]', 'Attempting reconnect to Event Server');
			client.connect();
		}, 2000);
	});

	client.on('error', function (e) {
		let err = e.error;
		const code = ~~e.code;
		if (code === 61) {
			err = 'Event Server unavailable. Connection Refused @ ' + Module._url + ':' + Module._port + '\n[LiveView] Please ensure your device and computer are on the same network and the port is not blocked.';
		}
		throw new Error('[LiveView] ' + err);
	});

	client.connect();
	Module.require('app');
};

/**
 * include script loader
 * @param  {string} ctx context
 * @param  {string} id module identifier
 * @public
 */
Module.include = function (ctx, id) {
	const file = id.replace('.js', ''),
		src = Module.prototype._getRemoteSource(file, 10000);
	eval.call(ctx, src); // eslint-disable-line no-eval
};

/**
 * convert relative to absolute path
 * @param  {string} parent parent file path
 * @param  {string} relative relative path in require
 * @return {string} absolute path of the required file
 * @public
 */
Module.toAbsolute = function (parent, relative) {
	let newPath = parent.split('/'),
		parts = relative.split('/');

	newPath.pop();

	for (let i = 0; i < parts.length; i++) {
		if (parts[i] === '.') {
			continue;
		}

		if (parts[i] === '..') {
			newPath.pop();
		} else {
			newPath.push(parts[i]);
		}
	}
	return newPath.join('/');
};

/**
 * commonjs module loader
 * @param  {string} id module identifier
 * @returns {Object}
 * @public
 */
Module.require = function (id) {
	let fullPath = id;

	if (fullPath.indexOf('./') === 0 || fullPath.indexOf('../') === 0) {
		const parent = Module._compileList[Module._compileList.length - 1];
		fullPath = Module.toAbsolute(parent, fullPath);
	}

	const cached = Module.getCached(fullPath) || Module.getCached(fullPath.replace('/index', '')) || Module.getCached(fullPath + '/index');

	if (cached) {
		return cached.exports;
	}

	let filename;

	if (!(filename = Module.exists(fullPath))) {
		// if (fullPath.indexOf('/') === 0 && !(filename = Module.exists(fullPath + '/index'))) {
		if (filename = Module.exists(fullPath + '/index')) {
			fullPath += '/index';
		} else if (filename = Module.exists('node_modules/' + fullPath)) {
			fullPath = '/node_modules/' + fullPath;
		} else if (filename = Module.exists('node_modules/' + fullPath + '/index')) {
			fullPath = '/node_modules/' + fullPath + '/index';
		} else {
			const pkgPath = '/node_modules/' + fullPath + '/package.json';

			const pkgFile = this.platform ? Ti.Filesystem.getFile(Ti.Filesystem.resourcesDirectory + '/' + this.platform + pkgPath) : Ti.Filesystem.getFile(Ti.Filesystem.resourcesDirectory + pkgPath);
			if (pkgFile.exists()) {
				const pkgText = (pkgFile.read() || {}).text || '{}';
				let pkg;
				try {
					pkg = JSON.parse(pkgText);
					if (pkg.main) {
						const mainPath = path.join('node_modules', fullPath, pkg.main);

						filename = Module.exists(mainPath);
						fullPath = filename ? mainPath : fullPath;
					}
				} catch (ex) {
					console.warn(ex);
				}
			}

			if (!filename) {

				const hlDir = '/hyperloop/';
				if (fullPath.indexOf('.*') !== -1) {
					fullPath = id.slice(0, id.length - 2);
				}

				const modLowerCase = fullPath.toLowerCase();
				if (Module.exists(hlDir + fullPath)) {
					fullPath = hlDir + fullPath;
				} else if (Module.exists(hlDir + modLowerCase)) {
					fullPath = hlDir + modLowerCase;
				} else if (fullPath.indexOf('.') === -1 && Module.exists(hlDir + fullPath + '/' + fullPath)) {
					fullPath = hlDir + fullPath + '/' + fullPath;
				} else if (fullPath.indexOf('.') === -1 && Module.exists(hlDir + modLowerCase + '/' + modLowerCase)) {
					fullPath = hlDir + modLowerCase + '/' + modLowerCase;
				} else {
					const lastIndex = fullPath.lastIndexOf('.');
					const tempPath = hlDir + fullPath.slice(0, lastIndex) + '$' + fullPath.slice(lastIndex + 1);
					if (Module.exists(fullPath)) {
						fullPath = tempPath;
					}
				}
			}
		}
	}

	const freshModule = new Module(fullPath);

	freshModule.filename = filename || fullPath;
	freshModule.cache();
	freshModule._compile();

	while (!freshModule.loaded) { /* no-op */ }

	return freshModule.exports;
};

/**
 * [getCached description]
 * @param  {string} id module identifier
 * @return {Module} cached module
 *
 * @public
 */
Module.getCached = function (id) {
	return Module._cache[id];
};

/**
 * check if module file exists
 *
 * @param  {string} id module identifier
 * @return {boolean} whether the module exists
 * @public
 */
Module.exists = function (id) {
	const idPath = path.parse(id);

	// TIBUG: Fix for path.parse bug
	if (!id.includes('/')) {
		idPath.dir = '';
	}

	// Don't want this when formatting new paths.
	idPath.base = '';

	const isJs = idPath.ext === '.js';
	const isJson = idPath.ext === '.json';
	const isBlank = idPath.ext === '';

	if (!(isJs || isJson || isBlank)) {
		return false;
		// TODO: Check to see if this exists in cached list of native modules
	}

	let file;
	let formattedPath;
	let baseFilePath = Ti.Filesystem.resourcesDirectory;

	if (!isJson) {
		idPath.ext = '.js';
		formattedPath = path.format(idPath);

		file = Ti.Filesystem.getFile(baseFilePath, formattedPath);
		if (file.exists()) {
			return formattedPath;
		}
	}

	if (!isJs) {
		idPath.ext = '.json';
		formattedPath = path.format(idPath);

		file = Ti.Filesystem.getFile(baseFilePath, formattedPath);
		if (file.exists()) {
			return formattedPath;
		}
	}

	if (!this.platform) {
		return false;
	}

	baseFilePath = path.join(Ti.Filesystem.resourcesDirectory, this.platform);

	if (!isJson) {
		idPath.ext = '.js';
		formattedPath = path.format(idPath);

		file = Ti.Filesystem.getFile(baseFilePath, formattedPath);
		if (file.exists()) {
			return formattedPath;
		}
	}
	if (!isJs) {
		idPath.ext = '.json';
		formattedPath = path.format(idPath);

		file = Ti.Filesystem.getFile(baseFilePath, formattedPath);
		if (file.exists()) {
			return formattedPath;
		}
	}
};

/**
 * shady xhrSync request
 *
 * @param  {string} file file to load
 * @param  {number} timeout in milliseconds
 * @return {(string|boolean)} file contents if successful, false if not
 * @private
 */
Module.prototype._getRemoteSource = function (file, timeout) {
	const expireTime = new Date().getTime() + timeout;
	const request = Ti.Network.createHTTPClient();
	let rsp = null;
	let done = false;

	var url = 'http://' + Module._url + ':' + Module._port + '/' + (file || this.id);

	request.cache = false;
	request.open('GET', url);
	request.setRequestHeader('x-platform', this.platform);
	request.send();

	//
	// Windows only private API: _waitForResponse() waits for the response from the server.
	//
	if (this.platform === 'windows' && request._waitForResponse) {
		request._waitForResponse();
		if (request.readyState === 4 || request.status === 404) {
			rsp = request.status === 200 ? request.responseText : false;
		} else {
			throw new Error('[LiveView] File Server unavailable. Host Unreachable @ ' + Module._url + ':' + Module._port + '\n[LiveView] Please ensure your device and computer are on the same network and the port is not blocked.');
		}
		done = true;
	}

	while (!done) {
		if (request.readyState === 4 || request.status === 404) {
			rsp = request.status === 200 ? request.responseText : false;
			done = true;
		} else if (expireTime - new Date().getTime() <= 0) {
			rsp = false;
			done = true;
			throw new Error('[LiveView] File Server unavailable. Host Unreachable @ ' + Module._url + ':' + Module._port + '\n[LiveView] Please ensure your device and computer are on the same network and the port is not blocked.');
		}
	}

	return rsp;
};

/**
 * get module file source text
 * @return {string}
 * @private
 */
Module.prototype._getSource = function () {
	let id = this.id;
	const isRemote = /^(http|https)$/.test(id) || global.ENV === 'liveview';
	if (isRemote) {
		return this._getRemoteSource(this.filename, 10000);
	} else {
		if (id === 'app') {
			id = '_app';
		}
		const file = Ti.Filesystem.getFile(Ti.Filesystem.resourcesDirectory, id + '.js');
		return (file.read() || {}).text;
	}
};

/**
 * wrap module source text in commonjs anon function wrapper
 *
 * @param  {string} source The raw source we're wrapping in an IIFE
 * @return {string}
 * @private
 */
Module._wrap = function (source) {
	return global.CATCH_ERRORS ? Module._errWrapper[0] + source + Module._errWrapper[1] : source;
};

// uncaught exception handler wrapper
Module._errWrapper = [ 'try {\n', '\n} catch (err) {\nlvGlobal.process.emit("uncaughtException", {module: __filename, error: err, source: module.source});\n}' ];

/**
 * compile commonjs module and string to js
 *
 * @private
 */
Module.prototype._compile = function () {
	const src = this._getSource();
	if (!src) {
		this.exports = Module._requireNative(this.id);
		this.loaded = true;
		return;
	}
	Module._compileList.push(this.id);

	this.source = Module._wrap(src);
	try {
		const fn = new Function('exports, require, module, __filename, __dirname, lvGlobal, L', this.source); // eslint-disable-line no-new-func
		fn(this.exports, Module.require, this, this.filename, this.__dirname, global, L);
	} catch (err) {
		process.emit('uncaughtException', { module: this.id, error: err, source: ('' + this.source).split('\n') });
	}

	Module._compileList.pop();

	this.loaded = true;
};

/**
 * cache current module
 *
 * @public
 */
Module.prototype.cache = function () {
	this.timestamp = new Date().getTime();
	Module._cache[this.id] = this;
};
