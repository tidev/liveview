import slugify from '@sindresorhus/slugify';
import http from 'http';
import Koa from 'koa';
import { Socket } from 'net';
import io from 'socket.io';

import Client from './client';
import { DeviceInfo } from './index';
import { Workspace, WorkspaceOptions } from './workspace';
import { getWorkspaceName, workspacePattern } from './utils';
import workspaceMiddleware from './middleware';

export interface ServerOptions {
	host?: string
	port?: number
}

/**
 * Multi-project LiveView server.
 */
export class LiveViewServer {
	public workspaces: Map<string, Workspace>
	private server!: http.Server
	private socketServer!: io.Server
	private connections = new Set<Socket>()

	constructor(private options: ServerOptions = {}) {
		this.workspaces = new Map();
	}

	/**
	 * Starts the internal HTTP and socket.io servers.
	 */
	async start(): Promise<void> {
		await this.createHttpServer();
		this.createSocketServer();
	}

	/**
	 * Creates a new HTTP server using Koa and attaches the workspace
	 * middleware.
	 */
	private async createHttpServer(): Promise<http.Server> {
		const { host = '0.0.0.0', port = 8323 } = this.options;

		const app = new Koa();
		app.use(workspaceMiddleware(this.workspaces));

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

	/**
	 * Create a namespaced socket.io, using a dedicated namespace for each
	 * workspace.
	 */
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

	/**
	 * Stops the internal HTTP and socket.io servers and destroys all open
	 * connections.
	 */
	async stop(): Promise<void> {
		for (const connection of this.connections) {
			connection.destroy();
			this.connections.delete(connection);
		}
		await new Promise<void>((resolve, reject) => {
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

	/**
	 * Adds a new workspace to this sever.
	 *
	 * Should the workspace already exist and its options were changed,
	 * it will be replaced. If the options did not change, this method just
	 * returns the existing workspace.
	 *
	 * @param options Workspace options
	 */
	async addWorkspace(options: WorkspaceOptions): Promise<Workspace> {
		const slug = slugify(options.name);
		const existingWorkspace = this.workspaces.get(slug);
		if (existingWorkspace) {
			if (existingWorkspace.didOptionsChange(options)) {
				await existingWorkspace.close();
			} else {
				return existingWorkspace;
			}
		}

		const workspace = new Workspace(options);
		this.workspaces.set(workspace.slug, workspace);
		return workspace;
	}
}
