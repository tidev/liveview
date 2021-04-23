/**
 * Most of these are copied from Vite as they are not exported directly and there
 * is no reliable deep import URL since Vite's dist build is split into chunks with
 * random hashes.
 *
 * @see https://github.com/vitejs/vite/blob/61ea32056048e902ca69d88e1b0a2d21660dae2a/packages/vite/src/node/utils.ts
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { pathToFileURL, URL } from 'url';

export function slash(p: string): string {
	return p.replace(/\\/g, '/');
}

const isWindows = os.platform() === 'win32';

export function normalizePath(id: string): string {
	return path.posix.normalize(isWindows ? slash(id) : id);
}

const queryRE = /\?.*$/;
const hashRE = /#.*$/;

export const cleanUrl = (url: string) =>
	url.replace(hashRE, '').replace(queryRE, '');

const knownJsSrcRE = /\.((j|t)sx?|mjs)($|\?)/;
export const isJSRequest = (url: string): boolean => {
	if (knownJsSrcRE.test(url)) {
		return true;
	}
	url = cleanUrl(url);
	if (!path.extname(url) && !url.endsWith('/')) {
		return true;
	}
	return false;
};

const importQueryRE = /(\?|&)import(?:&|$)/;
export const isImportRequest = (url: string): boolean =>
	importQueryRE.test(url);

export function injectQuery(url: string, queryToInject: string): string {
	// encode percents for consistent behavior with pathToFileURL
	// see #2614 for details
	let resolvedUrl = new URL(url.replace(/%/g, '%25'), 'relative:///');
	if (resolvedUrl.protocol !== 'relative:') {
		resolvedUrl = pathToFileURL(url);
	}
	let { pathname } = resolvedUrl;
	const { protocol, search, hash } = resolvedUrl;
	if (protocol === 'file:') {
		pathname = pathname.slice(1);
	}
	pathname = decodeURIComponent(pathname);
	return `${pathname}?${queryToInject}${search ? '&' + search.slice(1) : ''}${
		hash || ''
	}`;
}

export function lookupFile(
	dir: string,
	formats: string[],
	pathOnly = false
): string | undefined {
	for (const format of formats) {
		const fullPath = path.join(dir, format);
		if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
			return pathOnly ? fullPath : fs.readFileSync(fullPath, 'utf-8');
		}
	}
	const parentDir = path.dirname(dir);
	if (parentDir !== dir) {
		return lookupFile(parentDir, formats, pathOnly);
	}
}

const splitRE = /\r?\n/;

const range = 2;

export function posToNumber(
	source: string,
	pos: number | { line: number; column: number }
): number {
	if (typeof pos === 'number') {
		return pos;
	}
	const lines = source.split(splitRE);
	const { line, column } = pos;
	let start = 0;
	for (let i = 0; i < line - 1; i++) {
		start += lines[i].length + 1;
	}
	return start + column;
}

export function numberToPos(
	source: string,
	offset: number | { line: number; column: number }
): { line: number; column: number } {
	if (typeof offset !== 'number') {
		return offset;
	}
	if (offset > source.length) {
		throw new Error('offset is longer than source length!');
	}
	const lines = source.split(splitRE);
	let counted = 0;
	let line = 0;
	let column = 0;
	for (; line < lines.length; line++) {
		const lineLength = lines[line].length + 1;
		if (counted + lineLength >= offset) {
			column = offset - counted + 1;
			break;
		}
		counted += lineLength;
	}
	return { line: line + 1, column };
}

export function generateCodeFrame(
	source: string,
	start: number | { line: number; column: number } = 0,
	end?: number
): string {
	start = posToNumber(source, start);
	end = end || start;
	const lines = source.split(splitRE);
	let count = 0;
	const res: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		count += lines[i].length + 1;
		if (count >= start) {
			for (let j = i - range; j <= i + range || end > count; j++) {
				if (j < 0 || j >= lines.length) {
					continue;
				}
				const line = j + 1;
				res.push(
					`${line}${' '.repeat(Math.max(3 - String(line).length, 0))}|  ${
						lines[j]
					}`
				);
				const lineLength = lines[j].length;
				if (j === i) {
					// push underline
					const pad = start - (count - lineLength) + 1;
					const length = Math.max(
						1,
						end > count ? lineLength - pad : end - start
					);
					res.push('   |  ' + ' '.repeat(pad) + '^'.repeat(length));
				} else if (j > i) {
					if (end > count) {
						const length = Math.max(Math.min(end - count, lineLength), 1);
						res.push('   |  ' + '^'.repeat(length));
					}
					count += lineLength + 1;
				}
			}
			break;
		}
	}
	return res.join('\n');
}
