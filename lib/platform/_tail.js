
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
    app.close();
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