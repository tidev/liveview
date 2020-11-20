import axios from 'axios';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import io from 'socket.io-client';

import { LiveViewServer, WorkspaceOptions } from '@liveview/server';

const testWorkspace: WorkspaceOptions = {
	name: 'test',
	path: path.resolve(__dirname, '..', 'fixtures', 'classic'),
	type: 'classic',
	transpile: {
		enabled: false
	},
	hmr: false
};
const baseUrl = 'http://localhost:8323';
let server: LiveViewServer;

afterEach(async () => {
	await server.stop();
});

test('allow connection to known workspaces', async (done) => {
	server = new LiveViewServer();
	await server.start();
	server.addWorkspace(testWorkspace);
	const client = io(`${baseUrl}/workspace/${testWorkspace.name}`);
	client.on('connect', async () => {
		client.close();
		done();
	});
});

test('block connection to unknown workspaces', async (done) => {
	server = new LiveViewServer();
	await server.start();
	const client = io(`${baseUrl}/workspace/foobar`);
	client.on('error', async () => {
		client.close();
		done();
	});
});

describe('serve assets', () => {
	const tmpDir = path.join(os.tmpdir(), 'server.spec-serve');

	beforeEach(async () => {
		await fs.emptyDir(tmpDir);
	});

	afterEach(async () => {
		await fs.remove(tmpDir);
	});

	test('serve file from workspace', async (done) => {
		server = new LiveViewServer();
		await server.start();
		server.addWorkspace(testWorkspace);
		const file = path.join('build', 'liveview', 'assets', 'test.js');
		const response = await axios.post(`${baseUrl}/workspace/${testWorkspace.name}/serve`, {
			file
		});
		const sourceFile = path.join(testWorkspace.path, file);
		expect(response.data).toEqual(await fs.readFile(sourceFile, 'utf-8'));
		done();
	});
});
