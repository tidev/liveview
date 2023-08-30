/*
 * This analyzer for `require()` usage is ported from the `es-module-lexer` package.
 *
 * @see https://github.com/guybedford/es-module-lexer/blob/d44ad4ae1f5493a6956e226668008c9b2cd7f3fd/src/lexer.c#L845
 */

interface RequireExpression {
	start: number;
	end: number;
	statementStart: number;
	statementEnd: number;
	safe: boolean;
	next?: RequireExpression;
}

interface RequireInfo extends RequireExpression {
	specifier?: string;
}

// Paren = odd, Brace = even
enum OpenTokenState {
	AnyParen = 1, // (
	AnyBrace = 2, // {
	Template = 3, // `
	TemplateBrace = 4, // ${
	ImportParen = 5, // import(),
	ClassBrace = 6,
	AsyncParen = 7 // async()
}

interface OpenToken {
	token: OpenTokenState;
	pos: number;
}

export function parseRequires(code: string, filename = '@'): RequireInfo[] {
	const requires: RequireExpression[] = [];
	let pos = -1;
	const end = code.length;
	let lastTokenPos = Infinity;
	let openTokenDepth = 0;
	const openTokenStack: OpenToken[] = new Array(1024);
	for (let i = 0; i < openTokenStack.length; i++) {
		openTokenStack[i] = {
			token: 0,
			pos: 0
		} as any;
	}
	let lastSlashWasDivision = false;
	let firstRequire: RequireExpression | undefined;
	let requireWriteHead: RequireExpression | undefined;
	let requireWriteHeadLast: RequireExpression | undefined;
	let hasError = false;
	let errorPos = 0;
	let nextBraceIsClass = false;

	const tryParseRequire = () => {
		const startPos = pos;
		pos += 7;

		let ch = skipCommentAndWhitespace(true);
		if (ch === '(') {
			openTokenStack[openTokenDepth].token = OpenTokenState.ImportParen;
			openTokenStack[openTokenDepth++].pos = pos;
			if (code.charAt(lastTokenPos) === '.') {
				return;
			}
			// try parse a string, to record a safe require string
			pos++;
			ch = skipCommentAndWhitespace(true);
			addRequire(startPos, pos + 1, 0);
			if (ch === "'") {
				parseString("'");
			} else if (ch === '"') {
				parseString('"');
			} else {
				pos--;
				return;
			}
			pos++;
			const endPos = pos;
			ch = skipCommentAndWhitespace(true);
			if (ch === ')') {
				openTokenDepth--;
				if (!requireWriteHead) {
					syntaxError();
					return;
				}
				requireWriteHead.end = endPos;
				requireWriteHead.statementEnd = pos + 1;
				requireWriteHead.safe = true;
			} else {
				pos--;
			}
		}
	};

	const addRequire = (statementStart: number, start: number, end: number) => {
		const def: RequireExpression = {
			start,
			end,
			statementStart,
			statementEnd: end + 1,
			safe: false
		};
		if (!requireWriteHead) {
			firstRequire = def;
		} else {
			requireWriteHead.next = def;
		}
		requireWriteHeadLast = requireWriteHead;
		requireWriteHead = def;
		requires.push(def);
	};

	const isKeywordStart = (pos: number) => {
		return pos === 0 || isBrOrWsOrPunctuatorNotDot(code.charCodeAt(pos - 1));
	};

	const skipCommentAndWhitespace = (br: boolean) => {
		let ch;
		do {
			ch = code.charAt(pos);
			if (ch === '/') {
				const nextCh = code.charAt(pos + 1);
				if (nextCh === '/') {
					skipLineComment();
				} else if (nextCh === '*') {
					skipBlockComment(br);
				} else {
					return ch;
				}
			} else if (!isBrOrWs(ch.charCodeAt(0))) {
				return ch;
			}
		} while (pos++ < end);
		return ch;
	};

	const skipLineComment = () => {
		while (pos++ < end) {
			const ch = code.charAt(pos);
			if (ch === '\n' || ch === '\r') {
				return;
			}
		}
	};

	const skipBlockComment = (br: boolean) => {
		pos++;
		while (pos++ < end) {
			const ch = code.charAt(pos);
			if (!br && isBr(ch)) {
				return;
			}
			if (ch === '*' && code.charAt(pos + 1) === '/') {
				pos++;
				return;
			}
		}
	};

	const parseString = (quoteChar: string) => {
		while (pos++ < end) {
			let ch = code.charAt(pos);
			if (ch === quoteChar) {
				return;
			}
			if (ch === '\\') {
				ch = code.charAt(++pos);
				if (ch === '\r' && code.charAt(pos + 1) === '\n') {
					pos++;
				}
			} else if (isBr(ch)) {
				break;
			}
		}
		syntaxError();
	};

	const skipTemplateString = () => {
		while (pos++ < end) {
			const ch = code.charAt(pos);
			if (ch === '$' && code.charAt(pos + 1) === '{') {
				pos++;
				openTokenStack[openTokenDepth].token = OpenTokenState.TemplateBrace;
				openTokenStack[openTokenDepth++].pos = pos;
				return;
			}
			if (ch === '`') {
				if (
					openTokenStack[--openTokenDepth].token !== OpenTokenState.Template
				) {
					syntaxError();
				}
				return;
			}
			if (ch === '\\') {
				pos++;
			}
		}
		syntaxError();
	};

	const skipRegexCharacterClass = () => {
		while (pos++ < end) {
			const ch = code.charAt(pos);
			if (ch === ']') {
				return ch;
			}
			if (ch === '\\') {
				pos++;
			} else if (ch === '\n' || ch === '\r') {
				break;
			}
		}
		syntaxError();
		return '';
	};

	const skipRegularExpression = () => {
		while (pos++ < end) {
			let ch = code.charAt(pos);
			if (ch === '/') {
				return;
			}
			if (ch === '[') {
				ch = skipRegexCharacterClass();
			} else if (ch === '\\') {
				pos++;
			} else if (ch === '\n' || ch === '\r') {
				break;
			}
		}
		syntaxError();
	};

	const isBr = (c: string) => {
		return c === '\r' || c === '\n';
	};

	const isWsNotBr = (c: number) => {
		return c == 9 || c == 11 || c == 12 || c == 32 || c == 160;
	};

	const isBrOrWs = (c: number) => {
		return (c > 8 && c < 14) || c === 32 || c === 160;
	};

	const isBrOrWsOrPunctuatorNotDot = (c: number) => {
		const str = String.fromCharCode(c);
		return (
			(c > 8 && c < 14) ||
			c === 32 ||
			c === 160 ||
			(isPunctuator(c) && str !== '.')
		);
	};

	// Detects one of case, debugger, delete, do, else, in, instanceof, new,
	//   return, throw, typeof, void, yield ,await
	const isExpressionKeyword = (pos: number) => {
		switch (code.charAt(pos)) {
			case 'd':
				switch (code.charAt(pos - 1)) {
					case 'i':
						// void
						return readPrecedingKeyword(pos - 2, 'vo');
					case 'l':
						// yield
						return readPrecedingKeyword(pos - 2, 'yie');
					default:
						return false;
				}
			case 'e':
				switch (code.charAt(pos - 1)) {
					case 's':
						switch (code.charAt(pos - 2)) {
							case 'l':
								// else
								return readPrecedingKeyword(pos - 3, 'e');
							case 'a':
								// case
								return readPrecedingKeyword(pos - 3, 'c');
							default:
								return false;
						}
					case 't':
						// delete
						return readPrecedingKeyword(pos - 2, 'dele');
					default:
						return false;
				}
			case 'f':
				if (code.charAt(pos - 1) !== 'o' || code.charAt(pos - 2) !== 'e') {
					return false;
				}
				switch (code.charAt(pos - 3)) {
					case 'c':
						// instanceof
						return readPrecedingKeyword(pos - 4, 'instan');
					case 'p':
						// typeof
						return readPrecedingKeyword(pos - 4, 'ty');
					default:
						return false;
				}
			case 'n':
				// in, return
				return (
					readPrecedingKeyword(pos - 1, 'i') ||
					readPrecedingKeyword(pos - 1, 'retur')
				);
			case 'o':
				// do
				return readPrecedingKeyword(pos - 1, 'd');
			case 'r':
				// debugger
				return readPrecedingKeyword(pos - 1, 'debugge');
			case 't':
				// await
				return readPrecedingKeyword(pos - 1, 'awai');
			case 'w':
				switch (code.charAt(pos - 1)) {
					case 'e':
						// new
						return readPrecedingKeyword(pos - 2, 'n');
					case 'o':
						// throw
						return readPrecedingKeyword(pos - 2, 'thr');
					default:
						return false;
				}
		}
		return false;
	};

	const isParenKeyword = (curPos: number) => {
		return (
			readPrecedingKeyword(curPos, 'while') ||
			readPrecedingKeyword(curPos, 'for') ||
			readPrecedingKeyword(curPos, 'if')
		);
	};

	const readPrecedingKeyword = (pos: number, keyword: string) => {
		const length = keyword.length;
		if (pos - (length - 1) < 0) {
			return false;
		}
		return (
			code.substring(pos - (length - 1), length) === keyword &&
			(pos - (length - 1) === 0 ||
				isBrOrWsOrPunctuatorNotDot(code.charCodeAt(pos - length)))
		);
	};

	const isPunctuator = (ch: number) => {
		// 23 possible punctuator endings: !%&()*+,-./:;<=>?[]^{}|~
		const str = String.fromCharCode(ch);
		return (
			str === '!' ||
			str === '%' ||
			str === '&' ||
			(ch > 39 && ch < 48) ||
			(ch > 57 && ch < 64) ||
			str === '[' ||
			str === ']' ||
			str === '^' ||
			(ch > 122 && ch < 127)
		);
	};

	const isExpressionPunctuator = (ch: number) => {
		// 20 possible expression endings: !%&(*+,-.:;<=>?[^{|~
		const str = String.fromCharCode(ch);
		return (
			str === '!' ||
			str === '%' ||
			str === '&' ||
			(ch > 39 && ch < 47 && ch !== 41) ||
			(ch > 57 && ch < 64) ||
			str === '[' ||
			str === '^' ||
			(ch > 122 && ch < 127 && str !== '}')
		);
	};

	const isBreakOrContinue = (curPos: number) => {
		switch (code.charAt(curPos)) {
			case 'k':
				return readPrecedingKeyword(curPos - 1, 'brea');
			case 'e':
				if (code.charAt(curPos - 1) == 'u')
					return readPrecedingKeyword(curPos - 2, 'contin');
		}
		return false;
	};

	const isExpressionTerminator = (curPos: number) => {
		// detects:
		// => ; ) finally catch else class X
		// as all of these followed by a { will indicate a statement brace
		switch (code.charAt(curPos)) {
			case '>':
				return code.charAt(curPos - 1) === '=';
			case ';':
			case ')':
				return true;
			case 'h':
				return readPrecedingKeyword(curPos - 1, 'catc');
			case 'y':
				return readPrecedingKeyword(curPos - 1, 'finall');
			case 'e':
				return readPrecedingKeyword(curPos - 1, 'els');
		}
		return false;
	};

	const syntaxError = () => {
		hasError = true;
		errorPos = pos;
		pos = end + 1;
	};

	while (pos++ < end) {
		const ch = code.charAt(pos);

		const charCode = code.charCodeAt(pos);
		if (charCode === 32 || (charCode < 14 && charCode > 8)) {
			continue;
		}

		switch (ch) {
			case 'r': {
				if (isKeywordStart(pos) && code.substring(pos, pos + 7) === 'require') {
					tryParseRequire();
				}
				break;
			}
			case 'c':
				if (
					isKeywordStart(pos) &&
					code.substring(pos, pos + 5) === 'class' &&
					isBrOrWs(code.charCodeAt(pos + 5))
				)
					nextBraceIsClass = true;
				break;
			case '(': {
				openTokenStack[openTokenDepth].token = OpenTokenState.AnyParen;
				openTokenStack[openTokenDepth++].pos = lastTokenPos;
				break;
			}
			case ')': {
				if (openTokenDepth === 0) {
					syntaxError();
					break;
				}
				openTokenDepth--;
				if (
					requireWriteHead &&
					requireWriteHead.start === openTokenStack[openTokenDepth].pos
				) {
					requireWriteHead.end = pos;
					requireWriteHead.statementEnd = pos + 1;
				}
				break;
			}
			case '{':
				// require followed by { is not a reuire (so remove)
				// this is a sneaky way to get around { require () {} } v { require () }
				// block / object ambiguity without a parser (assuming source is valid)
				if (
					code.charAt(lastTokenPos) == ')' &&
					requireWriteHead &&
					requireWriteHead.end == lastTokenPos
				) {
					requireWriteHead = requireWriteHeadLast;
					if (requireWriteHead) {
						requireWriteHead.next = undefined;
					} else {
						firstRequire = undefined;
					}
				}
				openTokenStack[openTokenDepth].token = nextBraceIsClass
					? OpenTokenState.ClassBrace
					: OpenTokenState.AnyBrace;
				openTokenStack[openTokenDepth++].pos = lastTokenPos;
				nextBraceIsClass = false;
				break;
			case '}':
				if (openTokenDepth === 0) {
					syntaxError();
					break;
				}
				if (
					openTokenStack[--openTokenDepth].token ===
					OpenTokenState.TemplateBrace
				) {
					skipTemplateString();
				}
				break;
			case "'":
				parseString("'");
				break;
			case '"':
				parseString('"');
				break;
			case '/': {
				const nextCh = code.charAt(pos + 1);
				if (nextCh === '/') {
					skipLineComment();
					continue;
				} else if (nextCh === '*') {
					skipBlockComment(true);
					continue;
				} else {
					// Division / regex ambiguity handling based on checking backtrack analysis of:
					// - what token came previously (lastToken)
					// - if a closing brace or paren, what token came before the corresponding
					//   opening brace or paren (lastOpenTokenIndex)
					const lastToken = code.charAt(lastTokenPos);
					const prevLastToken = code.charAt(lastTokenPos - 1);
					if (
						(isExpressionPunctuator(lastToken.charCodeAt(0)) &&
							!(
								lastToken === '.' &&
								prevLastToken >= '0' &&
								prevLastToken <= '9'
							) &&
							!(lastToken === '+' && prevLastToken === '+') &&
							!(lastToken === '-' && prevLastToken === '-')) ||
						(lastToken === ')' &&
							isParenKeyword(openTokenStack[openTokenDepth].pos)) ||
						(lastToken === '}' &&
							(isExpressionTerminator(openTokenStack[openTokenDepth].pos) ||
								openTokenStack[openTokenDepth].token ===
									OpenTokenState.ClassBrace)) ||
						isExpressionKeyword(lastTokenPos) ||
						(lastToken === '/' && lastSlashWasDivision) ||
						!lastToken
					) {
						skipRegularExpression();
						lastSlashWasDivision = false;
					} else {
						// Final check - if the last token was "break x" or "continue x"
						while (
							lastTokenPos > 0 &&
							!isBrOrWsOrPunctuatorNotDot(code.charCodeAt(--lastTokenPos))
						);
						if (isWsNotBr(code.charCodeAt(lastTokenPos))) {
							while (
								lastTokenPos > 0 &&
								isWsNotBr(code.charCodeAt(--lastTokenPos))
							);
							if (isBreakOrContinue(lastTokenPos)) {
								skipRegularExpression();
								lastSlashWasDivision = false;
								break;
							}
						}
						lastSlashWasDivision = true;
					}
				}
				break;
			}
			case '`': {
				openTokenStack[openTokenDepth].pos = lastTokenPos;
				openTokenStack[openTokenDepth++].token = OpenTokenState.Template;
				skipTemplateString();
				break;
			}
		}

		lastTokenPos = pos;
	}

	const decode = (str: string): string | undefined => {
		try {
			// eslint-disable-next-line no-eval
			return (0, eval)(str);
		} catch {
			// not possible to evaluate to a valid string, return undefined
			return undefined;
		}
	};

	if (openTokenDepth || hasError) {
		const line = code.slice(0, errorPos).split('\n').length;
		const column = errorPos - code.lastIndexOf('\n', errorPos - 1);
		const error = new ParseError(`Parse error ${filename}:${line}:${column}`);
		error.idx = errorPos;
		throw error;
	}

	return requires.map((expression) => ({
		...expression,
		specifier: decode(code.slice(expression.start, expression.end + 1))
	}));
}

class ParseError extends Error {
	public idx = 0;
}
