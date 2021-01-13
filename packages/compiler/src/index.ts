import { Platform, TranspileTargets } from '@liveview/shared-utils';
import path from 'path';

import { Compiler, CompileRule} from './compiler';
import { I18nTransform, Transform, TranspileTransform } from './transforms';
import { localePattern } from "./utils";

export { Compiler } from './compiler';
export { Watching, WatchOptions } from './watching';

export interface CompilerOptions {
  /**
   * Project root directory
   */
  projectPath: string

  /**
   * Output directory
   */
  outputPath: string

  /**
   * The platform to compile for
   */
  platform: Platform

  /**
   * Object of minimum environment versions to support
   *
   * @see https://babeljs.io/docs/en/babel-preset-env#targets
   */
  transpileTargets?: TranspileTargets

  /**
   * The list of rules for this compiler
   */
  rules?: CompileRule[]
}

export function createCompiler(
  { projectPath, outputPath, platform, transpileTargets, rules: additionalRules }: CompilerOptions
): Compiler {
  // @todo: should we make this configurable? That way we could teach LiveView
  // how to handle additonal file types.
  const rules: CompileRule[] = [];
  const i18nPath = path.join(projectPath, 'i18n');
  const i18nTransform = new I18nTransform();
  rules.push({
    test: localePattern,
    transform: i18nTransform,
    rootPath: i18nPath,
    transformPath(absolutePath, targetPath) {
      const locale = path.dirname(targetPath);
      return path.join('__i18n__', `${locale}.json`);
    }
  });
  const resourcesPath = path.join(projectPath, 'Resources');
  let jsTransform: Transform | undefined;
  if (transpileTargets) {
    jsTransform = new TranspileTransform({
      targets: transpileTargets
    });
  }
  rules.push({
    test: /\.js$/i,
    exclude: /node_modules/,
    transform: jsTransform
  });
  rules.push({
    test: /\.(png|svg|jpg|jpeg|gif)$/i
  });
  rules.push(...additionalRules || []);
  return new Compiler({
    projectPath,
    outputPath,
    platform,
    rules
  });
}
