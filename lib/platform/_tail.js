
/**
 * [ description]
 * @param  {[type]} [description]
 * @return {[type]} [description]
 */

(function(globalCtx) {
  Module.patch(globalCtx);

  Module.global.process.on('uncaughtException', function (err) {
    console.error('[LiveView] ', err);
    Ti.UI.createAlertDialog({
      message: '[FILE]: ' + err.module + '\n[ERROR]: ' + err.error ,
      ok: 'close',
      title: 'LiveView [Error]'
    }).show();
  });


  // Base window

  var win = Ti.UI.createWindow({backgroundColor:'#000000'});
  win.open();

  var firstRun = true;

  var app = require('app');

  /**
   * [reload description]
   * @return {[type]} [description]
   */

  Module.global.reload = function(){
    try {
      app.close();
    } catch (e){
      if (firstRun) {
        firstRun = false;
        console.warn('[LiveView] Invalid or missing root proxy object export from app.js.\n[LiveView] Please export the application root proxy object (ex. window, tabview, etc...) to avoid possible performance issues with LiveView.');
      }
    }
    app = require('app');
  };

  /**
   * [ description]
   * @param  {[type]} [description]
   * @return {[type]}      [description]
   */

  var tcpConfig = {host: 'TCP_HOST', port: 8323};

  var client = net.connect(tcpConfig, function() {
    console.log('Client connected');
  });
  client.on('data', function(data) {
    if (!data) { return; }
    try{
      var evt = JSON.parse(''+data);

      if (evt.type === 'event' && evt.name === 'reload') {
        Module.global.reload();
      }
    } catch (e) {
      //discard non json data for now
    }

  });
  client.on('end', function(data) {
    console.log('Disconnected from LiveView Event Server');
  });

  Ti.Gesture.addEventListener('shake', function(e){
    Module.global.reload();
  });

})(this);