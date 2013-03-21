
/**
 * [ description]
 * @param  {[type]} [description]
 * @return {[type]} [description]
 */

(function(globalCtx) {
  Module.patch(globalCtx);

  // Base window

  var win = Ti.UI.createWindow({backgroundColor:'#000000'});
  win.open();

  var app = require('app');

  /**
   * [reload description]
   * @return {[type]} [description]
   */

  Module.global.reload = function(){
    try {
      app.close();
    } catch (e){
      console.error('Invalid or missing root element exported from app.js. Please export the application root element. (ex. window, tabview, etc...)');
      Ti.UI.createAlertDialog({title:'Titanium LiveView', message:'Invalid or missing root element exported from app.js. Please export the application root element. (ex. window, tabview, etc...)'})
    }
    app = require('app');
  };

  /**
   * [ description]
   * @param  {[type]} [description]
   * @return {[type]}      [description]
   */

  Ti.Gesture.addEventListener('shake', function(e){
    Module.global.reload();
  });

})(this);