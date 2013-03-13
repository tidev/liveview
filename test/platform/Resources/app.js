
/*!
 * Main App Entry Point
 */

// Base Window

var win = module.exports = Ti.UI.createWindow({
    backgroundColor: '#ececec'
});

// Label to demo base module reload

var label = Ti.UI.createLabel({
  textAlign: Ti.UI.TEXT_ALIGNMENT_CENTER,
  text:'Appcelerator LiveTi\n\n\n' +
       'Check It Out!\n' +
       'A Random Number\n' +
       '[' + Math.floor((Math.random()*100)+1) + ']'
});
win.add(label);

// TEST 1 for CommonJS Module

var test1 = require('test1');
test1();

// TEST 2 for Ti.include File

Ti.include('test2.js');

// New window button

var button = Ti.UI.createButton({
  bottom:10,
  width:150,
  height:50,
  title:'Open Window'
});
win.add(button);




var test3 = require('test3');

button.addEventListener('click', function(){
  test3.open();
});

win.open();