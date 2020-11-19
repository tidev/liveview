import path from 'path';
import io from 'socket.io-client';

import { LiveViewServer } from '@liveview/server';

let server: LiveViewServer;

afterEach(async () => {
	await server.stop();
});

test('allow connection to known workspaces', async (done) => {
	server = new LiveViewServer();
	await server.start();
	server.addWorkspace({
		name: 'test',
		path: path.resolve(__dirname, '..', 'fixtures', 'workspace-a'),
		type: 'classic',
		transpile: {
			enabled: false
		}
	});
	const client = io('http://localhost:3000/workspace/test');
	client.on('connect', async () => {
		client.close();
		done();
	});
});

test('block connection to unknown workspaces', async (done) => {
	server = new LiveViewServer();
	await server.start();
	const client = io('http://localhost:3000/workspace/foobar');
	client.on('error', async () => {
		client.close();
		done();
	});
});
