import slugify from '@sindresorhus/slugify';
import { EventEmitter} from 'events';
import isEqual from 'lodash.isequal';
import { TransferInfo } from './index';

import Client from './client';
import {
	AlloyWatching,
	DefaultWatching,
	Watching,
	WatchingOptions
} from './watching';

export type WorkspaceType = 'alloy' | 'classic' | 'webpack';

export interface TranspileOptions {
	enabled: boolean
	targets?: { [key: string]: string }
}

export interface WorkspaceOptions {
	name: string
	path: string
	type: WorkspaceType
	transpile: TranspileOptions
	hmr: boolean
}

export class Workspace extends EventEmitter {
	/**
	 * Worksapce name.
	 */
	public name: string

	/**
	 * Slugified workspace name.
	 */
	public slug: string

	/**
	 * Full path to this workspace.
	 */
	public path: string

	/**
	 * List of clients currently connected to this workspace.
	 */
	public clients: Set<Client> = new Set()

	/**
	 * The options used to create this workspace.
	 */
	private options: WorkspaceOptions

	private watching: Watching

	constructor(options: WorkspaceOptions) {
		super();

		this.name = options.name;
		this.slug = slugify(this.name);
		this.path = options.path;
		this.options = options;
		const watchingOptions: WatchingOptions = {
			path: this.path,
			transpile: options.transpile,
			hmr: options.hmr
		};
		this.watching = options.type === 'alloy'
			? new AlloyWatching(watchingOptions)
			: new DefaultWatching(watchingOptions);
		this.watching.on(
			'manifest',
			(changes, removals) => this.handleUpdateManifest(changes, removals)
		);
	}

	async close(): Promise<void> {
		await this.watching.close();
	}

	public addClient(client: Client): void {
		this.clients.add(client);
	}

	public removeClient(client: Client): void {
		this.clients.delete(client);
	}

	public didOptionsChange(options: WorkspaceOptions): boolean {
		return !isEqual(this.options, options);
	}

	public handleUpdateManifest(changes: TransferInfo[], removals: string[]) {
		if (this.options.hmr) {
			// When HMR is enabled let the client decide if he can hot update firs
			return;
		}

		this.clients.forEach(c => c.sendManifest(changes, removals));
	}
}
