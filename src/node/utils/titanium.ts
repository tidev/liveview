import fs from 'fs';
import os from 'os';
import path from 'path';

import { ProjectType, Platform } from '../types';

export function determineProjectType(builder: any): ProjectType {
	if (builder.useWebpack) {
		return 'webpack';
	} else if (fs.existsSync(path.join(builder.projectDir, 'app'))) {
		return 'alloy';
	} else {
		return 'classic';
	}
}

export function normalizePlatformName(platform: string): Platform {
	if (['iphone', 'ipad'].includes(platform)) {
		return 'ios';
	} else if (platform === 'android') {
		return 'android';
	}

	throw new Error(`Unnsuported platform "${platform}"`);
}

const builtins = [
	'console',
	'path',
	'os',
	'tty',
	'util',
	'assert',
	'events',
	'buffer',
	'string_decoder',
	'fs',
	'stream'
];

/**
 * Check if a string matches the name of a Node.js builtin module shim provided
 * by Titanium.
 */
export function isBuiltinModule(id: string): boolean {
	return builtins.includes(id);
}

export function resolveHost() {
	const interfaces = os.networkInterfaces();

	for (const name in interfaces) {
		const inter = interfaces[name];
		if (inter === undefined) {
			continue;
		}
		for (const interfaceInfo of inter) {
			if (interfaceInfo.family === 'IPv4' && !interfaceInfo.internal) {
				return interfaceInfo.address;
			}
		}
	}
}
