'use strict';
const _path = require('path');

module.exports = function (babel) {
	var t = babel.types;
	return {
		name: 'liveview global transform',
		visitor: {
			Program: function (path) {
				if (_path.basename(this.file.opts.filename) !== 'app.js') {
					return;
				}
				for (const bodyPath of path.get('body')) {
					for (const name in t.getBindingIdentifiers(bodyPath.node, false, true)) {
						bodyPath.insertAfter(
							t.expressionStatement(
								t.assignmentExpression(
									'=',
									t.identifier(`global.${name} `),
									t.identifier(`${name}`)
								)
							)
						);
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
					}
				}
			}
		}
	};
};
