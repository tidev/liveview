import slugify from '@sindresorhus/slugify';
import http from 'http';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import route from 'koa-route';
import send from 'koa-send';
import { Socket } from 'net';
import io from 'socket.io';

import Client from './client';
import { DeviceInfo } from './index';
import { Workspace, WorkspaceOptions } from './workspace';
import { getWorkspaceName, workspacePattern } from './utils';

export interface LiveViewOptions {
	host?: string
	port?: number
}

export class LiveViewServer {
	public workspaces: Map<string, Workspace>
	private server!: http.Server
	private socketServer!: io.Server
	private connections = new Set<Socket>()

	constructor(private options: LiveViewOptions = {}) {
		this.workspaces = new Map();
	}

	async start(): Promise<void> {
		await this.createHttpServer();
		this.createSocketServer();
	}

	private async createHttpServer(): Promise<http.Server> {
		const { host = '0.0.0.0', port = 8323 } = this.options;

		const app = new Koa();
		app.use(bodyParser());
		app.use(route.post('/workspace/:name/serve', async (ctx, name) => {
			const workspace = this.workspaces.get(name);
			if (!workspace) {
				return ctx.throw(404, 'Worksapce not found');
			}
			const data = ctx.request.body;
			if (!data.file) {
				return ctx.throw(400);
			}
			await send(ctx, data.file, { root: workspace.path });
		}));

		const server = this.server = http.createServer(app.callback());
		server.on('connection', socket => {
			this.connections.add(socket);
			socket.once('close', () => {
				this.connections.delete(socket);
			});
		});
		return new Promise((resolve, reject) => {
			function onError(e: Error) {
				server.close();
				reject(e);
			}
			server.once('error', onError);
			server.once('listening', () => {
				server.off('error', onError);
				resolve(server);
			});
			server.listen(port, host);
		});
	}

	private createSocketServer() {
		this.socketServer = io(this.server, {
			serveClient: false
		});
		const nsp = this.socketServer.of(workspacePattern);

		nsp.use((socket, next) => {
			const name = getWorkspaceName(socket.nsp);
			if (name === null) {
				return next(new Error('Invalid workspace'));
			}
			if (!this.workspaces.has(name)) {
				return next(new Error('Invalid workspace'));
			}
			next();
		});

		nsp.on('connection', socket => {
			socket.once('ident', (device: DeviceInfo) => {
				const name = getWorkspaceName(socket.nsp);
				if (name === null) {
					return;
				}
				const workspace = this.workspaces.get(name);
				if (workspace === undefined) {
					return;
				}
				const client = new Client(socket, device);
				workspace.addClient(client);
				socket.on('disconnect', () => workspace.removeClient(client));
			});
		});
	}

	async stop(): Promise<void> {
		for (const connection of this.connections) {
			connection.destroy();
			this.connections.delete(connection);
		}
		await new Promise((resolve, reject) => {
			this.server.close(err => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
		await Promise.all(
			Array.from(this.workspaces.values()).map(w => w.close())
		);
		this.workspaces.clear();
	}

	async addWorkspace(options: WorkspaceOptions): Promise<Workspace> {
		const slug = slugify(options.name);
		const existingWorkspace = this.workspaces.get(slug);
		if (existingWorkspace) {
			await existingWorkspace.close();
		}
		const workspace = new Workspace(options);
		this.workspaces.set(workspace.slug, workspace);
		return workspace;
	}
}
