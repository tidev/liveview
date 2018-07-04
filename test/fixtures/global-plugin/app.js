function foobar() {}
const foo = () => {};
const win = Ti.UI.createWindow({
	backgroundColor: 'white'
});
const textField = Ti.UI.createTextField({
	borderStyle: Ti.UI.INPUT_BORDERSTYLE_BEZEL,
	color: '#336699',
	top: 10, left: 10,
	width: 250, height: 60
});
win.add(textField);
win.open();
