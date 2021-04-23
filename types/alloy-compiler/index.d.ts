declare module 'alloy-compiler' {
	interface BuildLog {
		write(): void;
	}

	interface CompilerCreateOptions {
		compileConfig: CompileConfig;
		webpack?: boolean;
	}

	interface CompileConfig {
		projectDir: string;
		alloyConfig: AlloyConfig;
		buildLog?: BuildLog;
	}

	interface ResolvedConfig {
		alloyConfig: AlloyConfig;
		dir: Record<string, string>;
		buildLog: BuildLog;
		dependencies: Record<string, string>;
		theme?: string;
		[key: string]: any;
	}

	interface AlloyConfig {
		platform: 'android' | 'ios';
		deploytype: 'development' | 'production';
	}

	interface CompileOptions {
		file: string;
	}

	interface ComponentCompileOptions extends CompileOptions {
		controllerContent?: string;
	}

	interface ModelCompileOptions extends CompileOptions {
		content: string;
	}

	interface CompileResult {
		code: string;
		map?: any;
		dependencies: string[];
	}

	interface AlloyCompiler {
		config: ResolvedConfig;
		compileComponent(options: ComponentCompileOptions): CompileResult;
		compileModel(options: ModelCompileOptions): CompileResult;
		purgeStyleCache(componentPath: string): void;
	}

	function createCompiler(options: CompilerCreateOptions): AlloyCompiler;

	interface CompileConfigOptions {
		projectDir: string;
		alloyConfig: AlloyConfig;
	}

	function createCompileConfig(options: CompileConfigOptions): ResolvedConfig;
}

declare module 'alloy-compiler/lib/compilerUtils' {
	import { AlloyConfig } from 'alloy-compiler';

	function parseConfig(file: string, alloyConfig: AlloyConfig, out: any): any;
}
