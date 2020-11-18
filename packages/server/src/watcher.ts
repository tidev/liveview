import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';

const DEFAULT_IGNORES = [
  '**/.git',
  '.DS_Store'
];

interface WatchOptions {
  ignored: string[],
  aggregateTimeout: number
}

export class WorkspaceWatcher extends EventEmitter {
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
    this.watcher.on('add', path => this.onChange(path));
    this.watcher.on('change', path => this.onChange(path));
    this.watcher.on('unlink', path => this.onRemove(path));
  }

  public close(): Promise<void> {
    if (this.aggregateTimer) {
      clearTimeout(this.aggregateTimer);
    }
    return this.watcher.close();
  }

  public on(event: 'aggregated', listener: (changes: Set<string>, removals: Set<string>) => void): this {
    return super.on(event, listener);
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
