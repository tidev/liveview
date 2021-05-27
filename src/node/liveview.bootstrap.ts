/* eslint-disable @typescript-eslint/no-explicit-any */

import path from 'path';

import { CLIENT_PUBLIC_PATH } from './constants';
import { isBuiltinModule } from './utils/titanium';
import { cleanUrl, isJSRequest, isImportRequest } from './utils/vite';

// injected by the hook when copied
declare const __SERVER_HOSTNAME__: string;
declare const __SERVER_PORT__: string;

let __vite__injectQuery = (url: string, queryToInject: string) => url;

const fetchRemote = (filename: string) => {
	if (!isJSRequest(filename) && !isImportRequest(filename)) {
		// Usually this already would have been done by Vite on the server, but
		// there are some rare edge cases that will not be processes by Vite, e.g.
		// the bootstrap loader or `binding.redirect`.
		filename = __vite__injectQuery(filename, 'import');
	}

	const url = `http://${__SERVER_HOSTNAME__}:${__SERVER_PORT__}${filename}`;
	const request = Ti.Network.createHTTPClient();
	request.cache = true;
	request.open('GET', url, false);
	request.send();
	if (Ti.Platform.osname === 'android') {
		const timeout = 10 * 1000;
		const expireTime = new Date().getTime() + timeout;
		let done = false;
		// FIXME: Wow this is bad, but Android does not support sync HTTP requests
		while (!done) {
			if (request.readyState === 4 || request.status === 404) {
				done = true;
			} else if (expireTime - new Date().getTime() <= 0) {
				console.debug(
					`[LiveView] Failed to load "${filename}", request timeout`
				);
				return;
			}
		}
	}

	if (request.status !== 200) {
		if (request.status === 408) {
			(Ti.App as any)._restart();
		}
		console.debug(
			`[LiveView] Failed to load "${url}" with status code ${request.status}`
		);
		console.debug(request.responseText);
		return;
	}

	return request.responseText;
};

function patchRequire() {
	const Module = (global as any).Module;
	if (Module.__liveview_installed__ === true) {
		return;
	}
	const originalRequire = Module.prototype.require;
	const skipLoad = new Set();
	Module.prototype.require = function liveViewRequire(
		request: string,
		context: any
	) {
		let filename: string | undefined;
		if (request.startsWith('/@native/')) {
			// shortcut for native modules that vite already identified during the transform phase
			const moduleId = cleanUrl(request.substr(9));
			const loaded = this.loadCoreModule(moduleId);
			if (loaded) {
				return loaded;
			}
		} else if (request.startsWith('./') || request.startsWith('..')) {
			filename = path.normalize(this.path + '/' + request);
		} else if (request.startsWith('/')) {
			filename = request;
		} else if (!isBuiltinModule(request)) {
			filename = path.normalize(`/@id/${request}`);
		}

		if (filename && !skipLoad.has(cleanUrl(request))) {
			// First check the cache if this was alrady loaded
			if (Module.cache[filename]) {
				return Module.cache[filename].exports;
			}

			// Fetch from remote dev server
			const source = fetchRemote(filename);
			if (source) {
				const module = new Module(filename, this);
				if (filename.slice(-4) === 'json') {
					module.filename = filename;
					module.path = path.dirname(filename);
					Module.cache[filename] = module;
					module.exports = JSON.parse(source);
					module.loaded = true;
				} else {
					module.load(filename, source);
				}

				if (request.includes('build/.vite')) {
					// Optimized deps from Vite are always converted to ES modules first
					// and then back to CJS for use in Titanium. Add an ES module interop
					// to properly assign `default` exports back to `module.exports`.
					module.exports = esModuleInterop(module.exports);
				}

				return module.exports;
			}
		}

		request = cleanUrl(request).replace('/@id/', '');
		const loaded = originalRequire.call(this, request, context);
		if (loaded) {
			skipLoad.add(request);
		}
		return loaded;
	};

	Module.__liveview_installed__ = true;
}

export async function execute(done: () => void): Promise<void> {
	patchRequire();
	// eslint-disable-next-line @typescript-eslint/no-var-requires, security/detect-non-literal-require
	const { connect, injectQuery } = require(CLIENT_PUBLIC_PATH);
	__vite__injectQuery = injectQuery;
	await connect();
	done();
}

const esModuleInterop = (module: any) => {
	const getOwnPropNames = (target: any) => Object.getOwnPropertyNames(target);
	const namedExports = (target: any) =>
		getOwnPropNames(target).filter(
			(n) => n !== '__esModule' && n !== 'default'
		);
	if (
		module.__esModule &&
		'default' in module &&
		namedExports(module).length === 0
	) {
		if (
			typeof module.default === 'object' ||
			typeof module.default === 'function'
		) {
			module.default.default = module.default;
		}
		return module.default;
	}

	return module;
};
