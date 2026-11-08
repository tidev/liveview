import Process from './process';
import Socket from './socket';

/**
 * Initialize a new `Module`.
 * @param {string} id The module identifier
 * @public
 */
export default function Module(id) {
	this.filename = id + '.js';
	this.id = id;
	this.platform = Module._platform();
	this.exports = {};
	this.loaded = false;
}

/**
 * Platform name as the file server expects it in the x-platform header.
 * @return {string}
 */
Module._platform = function () {
	if (process.platform === 'ipad') {
		return 'iphone';
	}
	if (process.platform === 'windowsphone' || process.platform === 'windowsstore') {
		return 'windows';
	}
	return process.platform;
};

function L(name, filler) {
	return (Module._globalCtx.localeStrings[Ti.Locale.currentLanguage] || {})[name] || filler || name;
}

// global namespace
const global = Module._global = Module.global = {};

// main process
const process = global.process = new Process();
process.on('uncaughtException', function (err) {
	console.log('[LiveView] Error Evaluating', err.module, '@ Line:', err.error.line);
	// console.error('Line ' + err.error.line, ':', err.source[err.error.line]);
	console.error('' + err.error);
	console.error('File:', err.module);
	console.error('Line:', err.error.line);
	console.error('SourceId:', err.error.sourceId);
	console.error('Backtrace:\n', ('' + err.error.backtrace).replace(/'\n'/g, '\n'));
});

// set environment type
global.ENV = 'liveview';

// set logging
global.logging = false;

// catch uncaught errors
global.CATCH_ERRORS = true;

// module cache
Module._cache = {};

// request timeout for the file server, in milliseconds
const REQUEST_TIMEOUT = 10000;

// request path of the prefetch manifest on the file server
const MANIFEST_PATH = '__liveview/manifest';

// number of files that the prefetch downloads at the same time
const PREFETCH_CONCURRENCY = 4;

// name of the prefetch cache folder below the application cache directory
const CACHE_DIR_NAME = 'liveview';

/*
 * Prefetch cache.
 *
 * Ti.App._restart() disposes the JavaScript runtime, and the restarted runtime loads every
 * module through a synchronous request that busy-waits on the main thread. A restart that
 * needs more than five seconds for that is an ANR on Android. So before a restart the client
 * downloads the changed files asynchronously into a folder on disk, and the restarted runtime
 * reads them from there. The manifest in that folder lists the cached ids with the hash that the
 * server reported, plus `pendingRestart`, which is true only between a prefetch and the restart
 * that follows it. A cold start without that flag ignores the cache and loads from the server.
 */

/**
 * Module id as the manifest spells it: forward slashes, no leading ./ or /, no .js
 * @param  {string} id module id
 * @return {string}
 */
Module._normalizeId = function (id) {
	return ('' + id).replace(/\\/g, '/').replace(/\.js$/, '').replace(/^(\.\/|\/)+/, '').replace(/\/{2,}/g, '/');
};

/**
 * Folder of the prefetch cache. Created when missing.
 * @return {Ti.Filesystem.File}
 */
Module._cacheDir = function () {
	const dir = Ti.Filesystem.getFile(Ti.Filesystem.applicationCacheDirectory, CACHE_DIR_NAME);
	if (!dir.exists()) {
		dir.createDirectory();
	}
	return dir;
};

/**
 * A file inside the prefetch cache folder
 * @param  {string} name file name
 * @return {Ti.Filesystem.File}
 */
Module._cacheFile = function (name) {
	Module._cacheDir();
	return Ti.Filesystem.getFile(Ti.Filesystem.applicationCacheDirectory, CACHE_DIR_NAME, name);
};

/**
 * File name of a cached source inside the cache folder. Ti.Filesystem.getFile decodes percent
 * escapes, so slashes are escaped with a tilde instead: `~` becomes `~~` and `/` becomes `~s`.
 * @param  {string} id normalized module id
 * @return {string}
 */
Module._cacheFileName = function (id) {
	return id.replace(/~/g, '~~').replace(/\//g, '~s') + '.js';
};

/**
 * Module id of a cache file name, the inverse of Module._cacheFileName
 * @param  {string} name file name
 * @return {string}
 */
Module._cacheFileId = function (name) {
	return name.replace(/\.js$/, '').replace(/~(~|s)/g, function (match, c) {
		return c === 's' ? '/' : '~';
	});
};

/**
 * Reads the cache manifest from disk
 * @return {(Object|null)}
 */
Module._readCacheManifest = function () {
	try {
		const file = Module._cacheFile('manifest.json');
		if (!file.exists()) {
			return null;
		}
		return JSON.parse(file.read().text);
	} catch (e) {
		return null;
	}
};

/**
 * Writes the cache manifest to disk
 * @param  {Object} manifest manifest
 */
Module._writeCacheManifest = function (manifest) {
	Module._cacheFile('manifest.json').write(JSON.stringify(manifest));
};

/**
 * Whether a cached source exists on disk
 * @param  {string} id normalized module id
 * @return {boolean}
 */
Module._hasCachedSource = function (id) {
	try {
		return Module._cacheFile(Module._cacheFileName(id)).exists();
	} catch (e) {
		return false;
	}
};

/**
 * Reads one cached source
 * @param  {string} id normalized module id
 * @return {(string|null)} source, or null when the file is missing
 */
Module._readCachedSource = function (id) {
	try {
		const file = Module._cacheFile(Module._cacheFileName(id));
		if (!file.exists()) {
			return null;
		}
		const blob = file.read();
		return blob ? blob.text : null;
	} catch (e) {
		return null;
	}
};

/**
 * Writes one cached source
 * @param  {string} id normalized module id
 * @param  {string} source source text
 */
Module._writeCachedSource = function (id, source) {
	Module._cacheFile(Module._cacheFileName(id)).write(source);
};

/**
 * Deletes cached sources that the manifest no longer lists
 * @param  {Object} files id to hash map of the new manifest
 */
Module._pruneCache = function (files) {
	try {
		const dir = Module._cacheDir();
		dir.getDirectoryListing().forEach(function (name) {
			if (name === 'manifest.json') {
				return;
			}
			const file = Module._cacheFile(name);
			if (file.isDirectory()) {
				// left over from a cache written with percent-encoded names
				file.deleteDirectory(true);
				return;
			}
			const id = Module._cacheFileId(name);
			if (!Object.prototype.hasOwnProperty.call(files, id)) {
				file.deleteFile();
			}
		});
	} catch (e) {
		// a stale file in the cache does no harm
	}
};

/**
 * Called once per runtime start. When a prefetch ran just before this start, the cached
 * sources are used for this start only.
 */
Module._loadPrefetchedSources = function () {
	Module._useCache = false;
	Module._manifestFiles = {};
	const manifest = Module._readCacheManifest();
	if (!manifest || !manifest.pendingRestart || !manifest.files) {
		return;
	}
	Module._useCache = true;
	Module._manifestFiles = manifest.files;
	manifest.pendingRestart = false;
	try {
		Module._writeCacheManifest(manifest);
	} catch (e) {
		console.log('[LiveView] Cannot update prefetch manifest: ' + e);
	}
	console.log('[LiveView] Loading prefetched sources');
};

/**
 * Returns the prefetched source of a module, or null when the cache does not hold it
 * @param  {string} id module id as passed to require
 * @return {(string|null)}
 */
Module._readPrefetched = function (id) {
	if (!Module._useCache) {
		return null;
	}
	const normalized = Module._normalizeId(id);
	if (!Object.prototype.hasOwnProperty.call(Module._manifestFiles, normalized)) {
		return null;
	}
	return Module._readCachedSource(normalized);
};

/**
 * Asynchronous GET on the file server
 * @param  {string}   path request path without leading slash
 * @param  {Function} callback called with (status, responseText or null)
 */
Module._httpGet = function (path, callback) {
	let called = false;
	function finish(status, text) {
		if (!called) {
			called = true;
			callback(status, text);
		}
	}
	const request = Ti.Network.createHTTPClient({
		timeout: REQUEST_TIMEOUT,
		onload: function () {
			finish(this.status, this.responseText);
		},
		onerror: function () {
			finish(this.status || 0, null);
		}
	});
	request.cache = false;
	request.open('GET', 'http://' + Module._url + ':' + Module._port + '/' + encodeURI(path));
	request.setRequestHeader('x-platform', Module._platform());
	request.send();
};

/**
 * Downloads the files that changed since the last prefetch into the cache folder and marks the
 * cache for the next restart. Calls `done` in every case, so that the reload goes on even when
 * the server cannot be reached. The restarted runtime then loads from the server as before.
 * @param  {Function} done called when the prefetch ended
 */
Module._prefetch = function (done) {
	const started = Date.now();
	Module._httpGet(MANIFEST_PATH, function (status, text) {
		let manifest = null;
		if (status === 200 && text) {
			try {
				manifest = JSON.parse(text);
			} catch (e) {
				manifest = null;
			}
		}
		if (!manifest || !manifest.files) {
			console.log('[LiveView] Prefetch skipped, manifest request returned ' + status);
			return done();
		}

		const previous = Module._readCacheManifest();
		const sameServer = !!(previous && previous.signature === manifest.signature && previous.files);
		const files = manifest.files;
		const ids = Object.keys(files).filter(function (id) {
			return !sameServer || previous.files[id] !== files[id] || !Module._hasCachedSource(id);
		});
		const next = { signature: manifest.signature, files: {}, pendingRestart: false };
		Object.keys(files).forEach(function (id) {
			if (ids.indexOf(id) === -1) {
				next.files[id] = files[id];
			}
		});

		let index = 0;
		let inFlight = 0;
		let failed = 0;

		function finish() {
			Module._pruneCache(next.files);
			next.pendingRestart = true;
			try {
				Module._writeCacheManifest(next);
			} catch (e) {
				console.log('[LiveView] Cannot write prefetch manifest: ' + e);
			}
			console.log('[LiveView] Prefetched ' + (ids.length - failed) + ' of ' + ids.length
				+ ' changed file(s) in ' + (Date.now() - started) + ' ms');
			done();
		}

		/**
		 * Downloads one file into the cache and keeps the queue going
		 * @param  {string} id module id
		 */
		function fetchOne(id) {
			inFlight++;
			Module._httpGet(id + '.js', function (fileStatus, body) {
				inFlight--;
				if (fileStatus === 200 && body !== null) {
					try {
						Module._writeCachedSource(id, body);
						next.files[id] = files[id];
					} catch (e) {
						failed++;
					}
				} else {
					failed++;
				}
				if (index >= ids.length && inFlight === 0) {
					finish();
				} else {
					pump();
				}
			});
		}

		/**
		 * Starts downloads until PREFETCH_CONCURRENCY are in flight
		 */
		function pump() {
			while (inFlight < PREFETCH_CONCURRENCY && index < ids.length) {
				fetchOne(ids[index++]);
			}
		}

		if (ids.length === 0) {
			finish();
		} else {
			pump();
		}
	});
};

/**
 * Reload request from the event server. Runs the prefetch, then restarts. A reload that arrives
 * during a prefetch is folded into it: the prefetch runs once more before the restart.
 */
Module.scheduleReload = function () {
	if (Module._reloading) {
		Module._reloadAgain = true;
		return;
	}
	Module._reloading = true;
	Module._reloadAgain = false;
	Module._prefetch(function () {
		if (Module._reloadAgain) {
			Module._reloading = false;
			Module.scheduleReload();
			return;
		}
		Module.global.reload();
	});
};

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
	const  defaultURL = (process.platform === 'android' && process.hardware === 'sdk')
		? '10.0.2.2'
		: (Ti.Platform.model === 'Simulator' ? '127.0.0.1' : 'FSERVER_HOST');
	Module._globalCtx = globalCtx;
	global._globalCtx = globalCtx;
	Module._url = url || defaultURL;
	Module._port = parseInt(port, 10) || 8324;
	Module._requireNative = require;
	Module.evtServer && Module.evtServer.close();
	Module._compileList = [];
	Module._reloading = false;
	Module._reloadAgain = false;

	// FIX for android bug
	try {
		Ti.App.Properties.setBool('ti.android.bug2373.finishfalseroot', false);
	} catch (e) {
		// ignore
	}

	Module._loadPrefetchedSources();
	globalCtx.localeStrings = Module.require('localeStrings');
	Module.connectServer();
};

/**
 * Restarts the app. The prefetch has run at this point, see Module.scheduleReload.
 */
Module.global.reload = function () {
	Module._cache = {};
	Module._compileList = [];
	try {
		Module.evtServer._proxy.close();
		console.log('[LiveView] Reloading App');
		Ti.App._restart();
	} catch (e) {
		console.log('[LiveView] Reloading App via Legacy Method');
		Module._loadPrefetchedSources();
		Module._reloading = false;
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
		if (retryInterval !== null) {
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
				Module.scheduleReload();
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
		if (retryInterval !== null) {
			// The server is down and the reconnect timer is running. The error code differs between
			// platforms, so every error is ignored while the client retries.
			return;
		}

		if (code === 61) {
			err = 'Event Server unavailable. Connection Refused @ '
				+ Module._url + ':' + Module._port
				+ '\n[LiveView] Please ensure your device and computer are on the same network and the port is not blocked.';
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
	const file = id.replace('.js', '');
	let src = Module._readPrefetched(file);
	if (src === null) {
		src = Module.prototype._getRemoteSource(file, REQUEST_TIMEOUT);
	}
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

	if (!Module.exists(fullPath)) {
		if (fullPath.indexOf('/') === 0 && Module.exists(fullPath + '/index')) {
			fullPath += '/index';
		} else {
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

	const freshModule = new Module(fullPath);

	freshModule.cache();
	freshModule._compile();

	while (!freshModule.loaded) { /* no-op */ }

	return freshModule.exports;
};

/**
 * [getCached description]
 * @param  {string} id moduel identifier
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
	const path = Ti.Filesystem.resourcesDirectory + id + '.js',
		file = Ti.Filesystem.getFile(path);

	if (file.exists()) {
		return true;
	}
	if (!this.platform) {
		return false;
	}

	const pFolderPath = Ti.Filesystem.resourcesDirectory + '/' + this.platform + '/' + id + '.js';
	const pFile = Ti.Filesystem.getFile(pFolderPath);
	return pFile.exists();
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
	const expireTime  = new Date().getTime() + timeout;
	const request = Ti.Network.createHTTPClient({
		waitsForConnectivity: true
	});
	let rsp = null;
	let done = false;
	const url = 'http://' + Module._url + ':' + Module._port + '/' + (file || this.id) + '.js';
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
			rsp = (request.status === 200) ? request.responseText : false;
			done = true;
		} else if ((expireTime -  (new Date()).getTime()) <= 0) {
			rsp = false;
			done = true;
			throw new Error('[LiveView] File Server unavailable. Host Unreachable @ '
				+ Module._url + ':' + Module._port
				+ '\n[LiveView] Please ensure your device and computer are on the same network and the port is not blocked.');
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
	const isRemote = /^(http|https)$/.test(id) || (global.ENV === 'liveview');
	if (isRemote) {
		const prefetched = Module._readPrefetched(id);
		if (prefetched !== null) {
			return prefetched;
		}
		return this._getRemoteSource(null, REQUEST_TIMEOUT);
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
	return (global.CATCH_ERRORS) ? Module._errWrapper[0] + source + Module._errWrapper[1] : source;
};

// uncaught exception handler wrapper
Module._errWrapper = [
	'try {\n',
	'\n} catch (err) {\nlvGlobal.process.emit("uncaughtException", {module: __filename, error: err, source: module.source});\n}'
];

/**
 * compile commonjs module and string to js
 *
 * @private
 */
Module.prototype._compile = function () {
	const src = this._getSource();
	if (!src) {
		// Not a file on the server: a native module such as ti.audio, or a core module.
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
	this.timestamp = (new Date()).getTime();
	Module._cache[this.id] = this;
};
