
/**
 * [ description]
 * @param  {[type]} [description]
 * @return {[type]} [description]
 */

(function(globalCtx) {
  Module.patch(globalCtx);

  Module.global.process.on('uncaughtException', function (err) {
    console.error('[LiveView]', err);
  });


  // Base window

  var win = Ti.UI.createWindow({backgroundColor:'#000000'});
  win.open();

  var app = require('app');

  /**
   * [reload description]
   * @return {[type]} [description]
   */

  Module.global.reload = function(){
    app = require('app');
  };

  /**
   * [ description]
   * @param  {[type]} [description]
   * @return {[type]}      [description]
   */

  var tcpConfig = {host: 'TCP_HOST', port: 8323};

  var client = net.connect(tcpConfig, function() {
    console.log('[LiveView]', 'Client connected');
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
    console.log('[LiveView]', 'Disconnected Event Server');
  });
})(this);