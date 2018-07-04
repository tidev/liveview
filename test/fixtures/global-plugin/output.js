function foobar() {}

try {
	lvGlobal._globalCtx.foobar = foobar;
} catch (e) {}

global.foobar = foobar;
const foo = () => {};

try {
	lvGlobal._globalCtx.foo = foo;
} catch (e) {}

global.foo = foo;
const win = Ti.UI.createWindow({
	backgroundColor: 'white'
});

try {
	lvGlobal._globalCtx.win = win;
} catch (e) {}

global.win = win;
const textField = Ti.UI.createTextField({
	borderStyle: Ti.UI.INPUT_BORDERSTYLE_BEZEL,
	color: '#336699',
	top: 10, left: 10,
	width: 250, height: 60
});

try {
	lvGlobal._globalCtx.textField = textField;
} catch (e) {}

global.textField = textField;
win.add(textField);
win.open();
