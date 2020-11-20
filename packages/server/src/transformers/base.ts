import path from 'path';

import { TransferInfo } from '../index';

export interface TransformerOptions {
  workspacePath: string
  basePath: string
}

export interface Transformer {
  transform(files: string[]): Promise<TransferInfo[]>
}

export abstract class AbstractTransformer implements Transformer {
  public workspacePath: string

  public basePath: string

  protected intermediateBuildDir: string

  constructor(options: TransformerOptions) {
    this.workspacePath = options.workspacePath;
    this.basePath = options.basePath;
    this.intermediateBuildDir = path.join(this.workspacePath, 'build', 'liveview', 'assets');
  }

  public abstract async transform(files: string[]): Promise<TransferInfo[]>
}
