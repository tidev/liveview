import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import io from 'socket.io-client';

import { LiveViewServer, WorkspaceOptions } from '@liveview/server';

const testWorkspace: WorkspaceOptions = {
	name: 'test',
	path: path.resolve(__dirname, '..', 'fixtures', 'classic'),
	type: 'classic',
	transpile: false
};
const baseUrl = 'http://localhost:8323';
let server: LiveViewServer;

afterEach(async () => {
	await server.stop();
});

test('allow connection to known workspaces', async (done) => {
	server = new LiveViewServer();
	await server.start();
	await server.addWorkspace(testWorkspace);
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

describe('middleware', () => {
	const outputPath = path.join(testWorkspace.path, 'build', 'iphone', 'liveview', 'assets');

	test('serve file from workspace', async (done) => {
		server = new LiveViewServer();
		await server.start();
		const workspace = await server.addWorkspace(testWorkspace);
		workspace.startLiveView({
			platform: 'ios',
			outputPath
		});
		const response = await axios.get(`${baseUrl}/workspace/${testWorkspace.name}/serve/ios/test.js`);
		const sourceFile = path.join(outputPath, 'test.js');
		expect(response.data).toEqual(await fs.readFile(sourceFile, 'utf-8'));
		done();
	});
});
