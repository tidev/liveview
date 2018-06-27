function foobar() {};
var foo = () => {};

var win = Ti.UI.createWindow({
	backgroundColor: 'white'
});

var textField = Ti.UI.createTextField({
	borderStyle: Ti.UI.INPUT_BORDERSTYLE_BEZEL,
	color: '#336699',
	top: 10, left: 10,
	width: 250, height: 60
});

win.add(textField);
win.open();

global.foobar = foobar;

try {
	lvGlobal._globalCtx.foobar = foobar;
} catch (e) {}


global.foo = foo;

try {
	lvGlobal._globalCtx.foo = foo;
} catch (e) {}


global.win = win;

try {
	lvGlobal._globalCtx.win = win;
} catch (e) {}


global.textField = textField;

try {
	lvGlobal._globalCtx.textField = textField;
} catch (e) {}
