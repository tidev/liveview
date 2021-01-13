import { TranspileTargets } from '@liveview/shared-utils';
import jsanalyze = require('node-titanium-sdk/lib/jsanalyze');

import { Transform } from "./transform";

export interface TranspileTransformOptions {
  targets: TranspileTargets
}

let _jsAnalyze: typeof jsanalyze;

/**
 * Transpiles .js files using jsanalyze.
 */
export class TranspileTransform implements Transform {
  private targets: TranspileTargets

  constructor(options: TranspileTransformOptions) {
    this.targets = options.targets;

    _jsAnalyze = require('node-titanium-sdk/lib/jsanalyze');
  }

  async apply(file: string, content: string): Promise<string> {
    const transpiled = _jsAnalyze.analyzeJs(content, {
      filename: file,
      minify: false,
      transpile: true,
      targets: this.targets,
      sourceMap: false
    });
    // transpiled.contents can be empty if the file was ignored via babel config
    return transpiled.contents ? transpiled.contents : content;
  }
}
