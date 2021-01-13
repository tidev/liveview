import { exec as execCb } from 'child_process';
import path from 'path';
import { promisify } from 'util';

import { WatchOptions } from './index';
import { DefaultWatching } from './default';
import { Watcher } from '../watcher';
import { Compiler } from '../compiler';

const exec = promisify(execCb);

const fullRecompileFiles = [
	'app/styles/app.tss',
	'app/config.json'
];

/**
 * Alloy specific watching behavior that extends the default behavior.
 *
 * Watches the `app` dir for changs and executes the appropriate alloy compile
 * command.
 */
export class AlloyWatching extends DefaultWatching {
  private alloyWatcher?: Watcher

  private alloyStartTime?: number;

  private appPath: string

  private alloyCmd: string

  constructor(compiler: Compiler, options: WatchOptions) {
    super(compiler, options);

    this.appPath = path.join(compiler.projectPath, 'app');
    this.alloyCmd = process.platform === 'win32' ? 'alloy.cmd' : 'alloy';
    if (process.env.ALLOY_PATH) {
      this.alloyCmd = process.env.ALLOY_PATH;
    }
  }

  public watch() {
    super.watch();

    if (this.closed) {
      return;
    }

    const oldAlloyWatcher = this.alloyWatcher;

    this.alloyWatcher = new Watcher([this.appPath]);
    this.alloyWatcher.once(
      'aggregated',
      (changes) => this.runAlloyCompile(changes)
    );
    this.alloyWatcher.watch({ startTime: this.alloyStartTime });

    if (oldAlloyWatcher) {
      oldAlloyWatcher.close();
    }
  }

  public async close() {
    await super.close();
    if (this.alloyWatcher) {
      await this.alloyWatcher.close();
    }
  }

  public async runAlloyCompile(changes: Set<string>): Promise<void> {
    this.startTime = Date.now();
    this.watcher?.pause();
    this.alloyStartTime = Date.now();
    this.alloyWatcher?.pause();

    try {
      if (changes.size === 1) {
        const file = Array.from(changes).pop()!;
        if (this.needsFullCompile(file)) {
          await this.runFullCompile();
        } else {
          await this.runSelectiveCompile(file);
        }
      } else {
        await this.runFullCompile();
      }
      this.done();
    } catch (e) {
      this.done(e);
    }
  }

  private async runSelectiveCompile(file: string): Promise<void> {
    const relativeFile = path.relative(this.compiler.projectPath, file);
    console.log(`[LiveView] Running selective Alloy compile for ${relativeFile}`);
    const config = `file=${relativeFile}`;
    await exec(`${this.alloyCmd} compile ${this.createCompileArgs(config)}`);
  }

  private async runFullCompile() {
    console.log('[LiveView] Multiple files changed, re-compiling Alloy project.');
    await exec(`${this.alloyCmd} compile ${this.createCompileArgs()}`);
  }

  /**
   * Checks whether there were changes in one of the files that require a full
   * Alloy compile.
   *
   * @param file Path of changed file
   */
  private needsFullCompile(file: string) {
    const relativePath = path.relative(this.compiler.projectPath, file);
    const isFullCompileFile = fullRecompileFiles.includes(relativePath);
    return isFullCompileFile || relativePath.startsWith('app/themes/');
  }

  private createCompileArgs(config = '') {
    if (config.length > 0) {
      config = ',' + config;
    }
    return `${this.appPath} --config=platform=${this.platform}${config} --noBanner --no-colors`;
  }
}
