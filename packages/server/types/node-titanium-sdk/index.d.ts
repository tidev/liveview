declare module "node-titanium-sdk/lib/jsanalyze" {
  interface JsAnalyzeOptions {
    filename: string
    dest?: string
    minify?: boolean
    transpile?: boolean
    targets?: { [key: string]: string }
    platform?: string
    plugins?: any[]
    sourceMap?: boolean
    logger?: any
    transform?: any
  }

  interface JsAnaylzeResult {
    contents: string,
    symbols: string[]
  }

  function analyzeJsFile(file: string, options?: JsAnalyzeOptions): JsAnaylzeResult
  function analyzeJs(contents: string, options?: JsAnalyzeOptions): JsAnaylzeResult
}
