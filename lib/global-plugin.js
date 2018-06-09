'use strict';

module.exports = function (babel) {
	var t = babel.types;

	return {
		visitor: {
			Program: function (path) {
				path.get('body').forEach(function (bodyPath) {
					if (!bodyPath.isDeclaration()) {
						return;
					}

					for (var name in t.getBindingIdentifiers(bodyPath.node, false, true)) {
						bodyPath.insertAfter(
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
						);
						bodyPath.insertAfter(
							t.expressionStatement(
								t.assignmentExpression(
									'=',
									t.identifier(`global.${name}`),
									t.identifier(name)
								)
							)
						);
					}
				});
			}
		}
	};
};
