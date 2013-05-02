
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

})(this);