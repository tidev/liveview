'use strict';

module.exports = function (babel) {
	var t = babel.types;

	return {
		name: 'liveview global transform',
		visitor: {
			Program: function (path) {
				path.get('body').forEach(function (bodyPath) {
					if (!bodyPath.isDeclaration()) {
						return;
					}

					for (const name in t.getBindingIdentifiers(bodyPath.node, false, true)) {
						path.pushContainer('body',
							[
								t.expressionStatement(
									t.assignmentExpression(
										'=',
										t.identifier(`\nglobal.${name} `),
										t.identifier(`${name}`)
									)
								),
								t.tryStatement(
									t.blockStatement(
										[
											t.toStatement(
												t.assignmentExpression(
													'=',
													t.identifier(`lvGlobal._globalCtx.${name}`),
													t.identifier(name)
												)
											)
										]
									),
									t.catchClause(t.identifier('e'), t.blockStatement([]))
								)
							]
						);
					}
				});
			}
		}
	};
};
