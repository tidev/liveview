import {
	BinaryExpression,
	CallExpression,
	Expression,
	ExpressionStatement,
	TemplateLiteral
} from 'estree';
import { walk } from 'estree-walker';
import * as acorn from 'acorn';
import globby from 'globby';
import path from 'path';
import resolveId from 'resolve';
import { PartialResolvedId } from 'rollup';

interface NodeResolveResult {
	id: string;
	pkg?: any;
	pkgRoot: string;
}

const nodeResolve = async (id: string, opts: resolveId.AsyncOpts) => {
	return new Promise<NodeResolveResult | null>((resolve) => {
		let pkgRoot: string | undefined;
		resolveId(
			id,
			{
				...opts,
				packageFilter(pkg, pkgFile) {
					pkgRoot = path.dirname(pkgFile);
				}
			},
			(err, resolvedId, pkg) => {
				if (resolvedId && pkgRoot) {
					resolve({ id: resolvedId, pkg, pkgRoot });
				}
				resolve(null);
			}
		);
	});
};

export class VariableDynamicImportError extends Error {}

interface DynamicRequireContext {
	prefix: string;
	files: Record<string, string>;
}

export async function createDynamicRequireContext(
	requireExpression: string,
	importer: string,
	resolve: (id: string, importer: string) => Promise<PartialResolvedId | null>
): Promise<DynamicRequireContext | null> {
	const glob = dynamicRequireToGlob(requireExpression);
	if (!glob) {
		return null;
	}

	if (glob.startsWith('.') || glob.startsWith('/')) {
		// Ignore relative or absolute dynamic requires as Vite will not
		// try to optimize them and we can safely resolve them on demand.
		return null;
	}

	const moduleId = glob.substr(0, glob.indexOf('/'));
	// NOTE: We cannot use `resolve` here as that may already return
	// the path to the optimized dependency
	const result = await nodeResolve(moduleId, {
		basedir: path.dirname(importer)
	});
	if (result) {
		const { pkgRoot } = result;
		let relativeGlob = glob.replace(moduleId, '.');
		if (relativeGlob.endsWith('/*')) {
			relativeGlob = relativeGlob.slice(0, -2);
		}
		const files = globby.sync(relativeGlob, {
			cwd: pkgRoot,
			expandDirectories: {
				files: ['index', '*.js', '*.json', '*.ts'],
				extensions: ['js', 'json', 'ts']
			}
		});
		const paths: Record<string, string> = {};
		for (const file of files) {
			const withExtension = path.join(moduleId, file.replace(/^\.\//, ''));
			const withoutExtension = withExtension.replace(/\.[^/.]+$/, '');
			const candidates = [withExtension, withoutExtension];
			if (path.basename(withoutExtension) === 'index') {
				candidates.push(path.dirname(withoutExtension));
			}
			for (const id of candidates) {
				const result = await resolve(id, importer);
				if (result) {
					paths[id] = result.id;
				}
			}
		}
		return {
			prefix: glob.slice(0, glob.indexOf('*')),
			files: paths
		};
	}

	return null;
}

function dynamicRequireToGlob(requireExpression: string): string | null {
	const ast = acorn.parse(requireExpression, { ecmaVersion: 10 });
	let glob: string | null = null;

	walk(ast, {
		enter: (node) => {
			if (node.type !== 'ExpressionStatement') {
				return;
			}

			glob = expressionToGlob((node as ExpressionStatement).expression);
			if (!glob.includes('*')) {
				return null;
			}
			glob = glob.replace(/\*\*/g, '*');

			// TODO: Do we need more restrictions?

			if (glob.startsWith('*')) {
				glob = null;
			}
		}
	});

	return glob;
}

function expressionToGlob(node: Expression): string {
	switch (node.type) {
		case 'TemplateLiteral':
			return templateLiteralToGlob(node);
		case 'CallExpression':
			return callExpressionToGlob(node);
		case 'BinaryExpression':
			return binaryExpressionToGlob(node);
		case 'Literal': {
			return sanitizeString(node.value as any);
		}
		default:
			return '*';
	}
}

function templateLiteralToGlob(node: TemplateLiteral) {
	let glob = '';

	for (let i = 0; i < node.quasis.length; i += 1) {
		glob += sanitizeString(node.quasis[i].value.raw);
		if (node.expressions[i]) {
			glob += expressionToGlob(node.expressions[i]);
		}
	}

	return glob;
}

function callExpressionToGlob(node: CallExpression) {
	const { callee } = node;
	if (
		callee.type === 'MemberExpression' &&
		callee.property.type === 'Identifier' &&
		callee.property.name === 'concat'
	) {
		return `${expressionToGlob(callee.object as Expression)}${(
			node.arguments as Expression[]
		)
			.map(expressionToGlob)
			.join('')}`;
	}
	return '*';
}

function binaryExpressionToGlob(node: BinaryExpression) {
	if (node.operator !== '+') {
		throw new VariableDynamicImportError(
			`${node.operator} operator is not supported.`
		);
	}

	return `${expressionToGlob(node.left)}${expressionToGlob(node.right)}`;
}

function sanitizeString(str: string) {
	if (str?.includes('*')) {
		throw new VariableDynamicImportError(
			'A dynamic import cannot contain * characters.'
		);
	}
	return str;
}
