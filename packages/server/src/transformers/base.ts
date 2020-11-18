import fs from 'fs-extra';
import path from 'path';

import { TransferInfo } from '../index';
import { TranspileOptions } from '../workspace';

export interface TransformerOptions {
  workspacePath: string
  basePath: string,
  transpile: TranspileOptions
}

export interface SourceTransformer {
  transform(files: string[]): TransferInfo[];
}

export interface AssetTransform {
  apply(file: string): string;
}

export abstract class AbstractTransformer implements SourceTransformer {
  public workspacePath: string

  public basePath: string

  protected intermediateBuildDir: string

  protected transforms: Map<string, AssetTransform> = new Map();

  constructor(options: TransformerOptions) {
    this.workspacePath = options.workspacePath;
    this.basePath = options.basePath;
    this.intermediateBuildDir = path.join(this.workspacePath, 'build', 'liveview');
  }

  transform(files: string[]): TransferInfo[] {
    return files.map(file => {
      const relativePath = path.relative(this.basePath, file);
      const ext = path.extname(file);
      let sourceFile = file;

      const transform = this.transforms.get(ext);
      if (transform) {
        const content = transform.apply(file);
        const outputPath = path.join(this.intermediateBuildDir, relativePath);
        fs.outputFileSync(outputPath, content);
        sourceFile = outputPath;
      }

      return {
        from: path.relative(this.workspacePath, sourceFile),
        to: path.relative(this.basePath, file)
      };
    });
  }
}

export class NoopTransformer extends AbstractTransformer {

}
