import chokidar, { FSWatcher } from 'chokidar';
import { TypedEmitter } from 'tiny-typed-emitter';

const DEFAULT_IGNORES = [
  '**/.git',
  '.DS_Store'
];

export interface WatchOptions {
  /**
   * Array of file/path globs to ignore
   */
  ignored: string[],
  /**
   * Timeout to fire the `aggregated` event when after a change no additional
   * change occoured. Defaults to 100ms.
   */
  aggregateTimeout: number
}

interface WatcherEvents {
  aggregated: (changes: Set<string>, removals: Set<string>) => void
  ready: () => void
}

/**
 * A workspace watcher based on chokidar that aggregates fs events.
 */
export class WorkspaceWatcher extends TypedEmitter<WatcherEvents> {
  private watcher: FSWatcher;
  private aggregateTimer?: number;
  private aggregatedRemovals: Set<string>
  private aggregatedChanges: Set<string>;
  private aggregateTimeout: number;

  constructor(path: string, options?: Partial<WatchOptions>) {
    super();

    const {
      aggregateTimeout = 100,
      ignored = DEFAULT_IGNORES
    } = options || {};
    this.aggregateTimeout = aggregateTimeout;
    this.aggregatedChanges = new Set();
    this.aggregatedRemovals = new Set();
    this.watcher = chokidar.watch(path, {
      ignoreInitial: true,
      ignored
    });
    this.watcher.on('ready', () => this.emit('ready'));
    this.watcher.on('add', path => this.onChange(path));
    this.watcher.on('change', path => this.onChange(path));
    this.watcher.on('unlink', path => this.onRemove(path));
  }

  /**
   * Closes the internal chokidar watcher and removes all listeners.
   */
  public close(): Promise<void> {
    if (this.aggregateTimer) {
      clearTimeout(this.aggregateTimer);
    }
    this.aggregatedChanges.clear();
    this.aggregatedRemovals.clear();
    this.removeAllListeners();
    return this.watcher.close();
  }

  private onChange(file: string) {
    if (this.aggregateTimer) {
      clearTimeout(this.aggregateTimer);
    }
    this.aggregatedRemovals.delete(file);
    this.aggregatedChanges.add(file);
    this.aggregateTimer = setTimeout(() => this.onTimeout(), this.aggregateTimeout);
	}

	private onRemove(file: string) {
    if (this.aggregateTimer) {
      clearTimeout(this.aggregateTimer);
    }
    this.aggregatedChanges.delete(file);
    this.aggregatedRemovals.add(file);
    this.aggregateTimer = setTimeout(() => this.onTimeout(), this.aggregateTimeout);
  }

  private onTimeout() {
    this.aggregateTimer = undefined;
    const changes = this.aggregatedChanges;
    const removals = this.aggregatedRemovals;
    this.aggregatedChanges = new Set();
    this.aggregatedRemovals = new Set();
    this.emit('aggregated', changes, removals);
  }
}
