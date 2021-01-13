import { Platform, platformFolder } from '@liveview/shared-utils';
import fs from 'fs-extra';
import path from 'path';
import { TypedEmitter } from 'tiny-typed-emitter';

import { CompilerOptions } from './index';
import { Watching, WatchOptions } from './watching/index';
import { AlloyWatching } from './watching/alloy';
import { DefaultWatching } from './watching/default';
import { Transform } from './transforms';

/**
 * A rule to specify the compilation behvaior of files.
 *
 * By default a compile rule will simply copy all files it matches. Additional
 * processing of files can be added with the `transform` options.
 */
export interface CompileRule {
  /**
   * Pattern used to match the files that this rule will apply to.
   */
  test: RegExp

  /**
   * The transform to apply to files that match this rule.
   */
  transform?: Transform

  /**
   * Pattern to exclude certain files from the transform.
   */
  exclude?: RegExp

  /**
   * The root path for input files of this rule. Used to determine the relative
   * path for emitted files inside the compiler's `outputPath`.
   *
   * Uses the projects `Resources` directory by default.
   */
  rootPath?: string

  /**
   * Optional function to customize the output path of files in this rule.
   *
   * @param from The absolute from of the input file.
   * @param to The default relative path inside the output directory.
   * @return New relative path inside the output directory
   */
  transformPath?(from: string, to: string): string
}

export interface Asset {
  /**
   * The asset's content
   */
  content: string

  /**
   * The full path of the asset's source file.
   */
  absolutePath: string

  /**
   * Relative path inside the compiler's output path where this asset will
   * be emitted to.
   */
  targetPath: string
}

interface CompilerEvents {
  afterEmit(assets: Map<string, Asset>): void
}

export class Compiler extends TypedEmitter<CompilerEvents> {
  public modifiedFiles: Set<string> = new Set()

  public removedFiles: Set<string> = new Set()

  public assets: Map<string, Asset> = new Map()

  public readonly projectPath: string

  public readonly outputPath: string

  public readonly platform: Platform

  /**
   * Specifies the default root directory of input files. Used as a fallback
   * when a rule does not specify a `rootPath`.
   */
  private defaultRootPath: string

  private rules: CompileRule[] = []

  private watching?: Watching

  constructor(options: CompilerOptions) {
    super();

    this.platform = options.platform;
    this.projectPath = options.projectPath;
    this.defaultRootPath = path.join(options.projectPath, 'Resources');
    this.outputPath = options.outputPath;
    this.rules = options.rules || [];
  }

  async compile(): Promise<void> {
    this.assets = new Map();
    const platformFolderRegex = new RegExp(`^${platformFolder[this.platform]}[\\\\/]`);

    if (this.rules.length === 0) {
      return;
    }

    for (const file of this.modifiedFiles) {
      for (const rule of this.rules) {
        if (!rule.test.test(file)) {
          continue;
        }

        let content = await fs.readFile(file, 'utf-8');
        if (!rule.exclude?.test(file) && rule.transform) {
          content = await rule.transform.apply(file, content);
        }

        const rootPath = rule.rootPath || this.defaultRootPath;
        let relativePath = path.relative(rootPath, file);
        relativePath = relativePath.replace(platformFolderRegex, '');
        if (rule.transformPath) {
          relativePath = rule.transformPath(file, relativePath);
        }

        this.assets.set(
          file,
          { content, absolutePath: file, targetPath: relativePath }
        );
      }
    }
  }

  async emitAssets(): Promise<void> {
    for (const [_, asset] of this.assets) {
      const destPath = path.join(this.outputPath, asset.targetPath);
      await fs.outputFile(destPath, asset.content);
    }

    this.emit('afterEmit', this.assets);
  }

  watch(options: WatchOptions): void {
    if (options.type === 'alloy') {
      this.watching = new AlloyWatching(this, options);
    } else {
      this.watching = new DefaultWatching(this, options);
    }
    this.watching.watch();
  }

  async close(): Promise<void> {
    if (this.watching) {
      await this.watching.close();
    }
  }
}
