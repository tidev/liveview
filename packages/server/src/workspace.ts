import { EventEmitter} from 'events';
import isEqual from 'lodash.isequal';
import path from 'path';

import Client from './client';
import { createTransformer, SourceTransformer } from './transformers';
import { WorkspaceWatcher } from './watcher';

export type WorkspaceType = 'alloy' | 'classic' | 'webpack';

const sourcePaths = {
	alloy: 'app',
	classic: 'Resources',
	webpack: 'Resources'
};

export interface TranspileOptions {
	enabled: boolean,
	targets?: { [key: string]: string }
}

export interface WorkspaceOptions {
	name: string,
	path: string,
	type: WorkspaceType,
	transpile: TranspileOptions
}

export class Workspace extends EventEmitter {
	public name: string

	public path: string

	public clients: Set<Client> = new Set();

	private options: WorkspaceOptions;

	private sourceDir: string

	private watcher: WorkspaceWatcher

	private sourceTransformer: SourceTransformer

	constructor(options: WorkspaceOptions) {
		super();

		this.name = options.name;
		this.path = options.path;
		this.options = options;
		this.sourceDir = path.join(this.path, sourcePaths[options.type]);
		this.sourceTransformer = createTransformer(options.type, {
			workspacePath: this.path,
			basePath: this.sourceDir,
			transpile: options.transpile
		});
		this.watcher = new WorkspaceWatcher(this.sourceDir);
		this.watcher.on(
			'aggregated',
			(changes, removals) => this.onSourceChanges(changes, removals)
		);
	}

	async close(): Promise<void> {
		return this.watcher.close();
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

	public onSourceChanges(changes: Set<string>, removals: Set<string>): void {
		const transformedChanges = this.sourceTransformer.transform(Array.from(changes));
		this.clients.forEach(client => client.sendManifest(transformedChanges, removals));
	}
}
