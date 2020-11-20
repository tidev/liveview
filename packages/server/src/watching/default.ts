import path from 'path';
import { TypedEmitter } from 'tiny-typed-emitter';

import { Watching, WatchingEvents, WatchingOptions } from './index';
import { Watcher } from '../watcher';
import { AssetsTransformer, I18nTransformer } from '../transformers';

export class DefaultWatching extends TypedEmitter<WatchingEvents> implements Watching {
  private assetsWatcher: Watcher

  private i18nWatcher: Watcher

  private assetsTransformer: AssetsTransformer

  private i18nTransformer: I18nTransformer

  constructor(options: WatchingOptions) {
    super();

    const assetsPath = path.join(options.path, 'Resources');
    this.assetsWatcher = new Watcher(assetsPath);
    this.assetsWatcher.on(
			'aggregated',
			(changes, removals) => this.onAssetChanges(changes, removals)
    );
    this.assetsTransformer = new AssetsTransformer({
      workspacePath: options.path,
      basePath: assetsPath,
      transpile: options.transpile
    });

    const i18nPath = path.join(options.path, 'i18n');
    this.i18nWatcher = new Watcher(i18nPath);
		this.i18nWatcher.on(
			'aggregated',
			(changes, removals) => this.onI18nChanges(changes, removals)
    );
    this.i18nTransformer = new I18nTransformer({
      workspacePath: options.path,
      basePath: i18nPath,
    });
  }

  public async close(): Promise<void> {
    await this.assetsWatcher.close();
    await this.i18nWatcher.close();
  }

  public async onAssetChanges(changes: Set<string>, removals: Set<string>) {
    const transformedChanges = await this.assetsTransformer.transform(Array.from(changes));
		this.emit('manifest', transformedChanges, Array.from(removals));
  }

  public async onI18nChanges(changes: Set<string>, removals: Set<string>) {
    const transformedChanges = await this.i18nTransformer.transform(
      Array.from(changes),
      Array.from(removals)
    );
    this.emit('manifest', transformedChanges, []);
  }
}
