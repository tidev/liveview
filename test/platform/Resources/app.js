var Window = Ti.UI.createWindow;

var win = module.exports = Ti.UI.createWindow({
    backgroundImage: 'KS_nav_ui.png'
});

// var label = Ti.UI.createLabel({
//   textAlign: Ti.UI.TEXT_ALIGNMENT_CENTER,
//   text:'Appcelerator LiveTi\n\n\n' +
//        'Check It Out!\n' +
//        'A Random Number\n' +
//        '[' + Math.floor((Math.random()*100)+1) + ']'
// });
// win.add(label);

var test1 = require('test1');
test1();

Ti.include('test2.js');

win.open();