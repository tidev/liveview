import fs from 'fs-extra';
import jsanalyze = require('node-titanium-sdk/lib/jsanalyze');
import path from 'path';

import { AbstractTransformer, TransformerOptions } from "./base";
import { TranspileOptions } from '../workspace';
import { TransferInfo } from "..";

export interface AssetsTransformerOptions extends TransformerOptions {
  transpile: TranspileOptions
}

let _jsAnalyze: typeof jsanalyze;

/**
 * Transformer for app assets under the project's `Resources` directory.
 *
 * Currently only `.js` files will be transformed if transpilation is enabled.
 */
export class AssetsTransformer extends AbstractTransformer {
  private transpile: TranspileOptions

  constructor(options: AssetsTransformerOptions) {
    super(options);

    this.transpile = options.transpile;
    if (this.transpile.enabled) {
      _jsAnalyze = require('node-titanium-sdk/lib/jsanalyze');
    }
  }

  async transform(changes: string[]): Promise<TransferInfo[]> {
    const files: TransferInfo[] = [];
    for (const file of changes) {
      const relativePath = path.relative(this.basePath, file);
      const ext = path.extname(file);
      let sourceFile = file;

      if (ext === '.js' && this.transpile.enabled) {
        const filename = path.basename(file);
        const transpiled = _jsAnalyze.analyzeJsFile(file, {
          filename: filename,
          minify: false,
          transpile: true,
          targets: this.transpile.targets,
          sourceMap: false
        });
        if (transpiled.contents) {
          const outputPath = path.join(this.intermediateBuildDir, relativePath);
          fs.outputFileSync(outputPath, transpiled.contents);
          sourceFile = outputPath;
        }
      }

      files.push({
        from: path.relative(this.workspacePath, sourceFile),
        to: path.relative(this.basePath, file)
      });
    }

    return files;
  }
}
