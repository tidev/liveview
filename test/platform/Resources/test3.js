
/*!
 * win2 test
 */


// Main Export

var win2 = module.exports = {};

// Base Window

var _win = Ti.UI.createWindow({backgroundColor:'red'});

// Close Button

var button = Ti.UI.createButton({title:'exit', height:50, width:100});
_win.add(button);

button.addEventListener('click', function(){
  _win.close();
});

/**
 * [open description]
 * @return {[type]} [description]
 */

win2.open = function () {
  _win.open();
};

