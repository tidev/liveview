
/**
 * [ description]
 * @param  {[type]} [description]
 * @return {[type]} [description]
 */

  process.on('uncaughtException', function (err) {
    console.log('[LiveView] Error Evaluating', err.module, '@ Line:', err.error.line);
    console.error('Line ' + err.error.line, ':', err.source[err.error.line]);
    console.error('' + err.error);
    console.error('File:', err.module);
    console.error('Line:', err.error.line);
    console.error('SourceId:', err.error.sourceId);
    console.error('Backtrace:\n', ('' + err.error.backtrace).replace(/'\n'/g, '\n'));


    var win = Ti.UI.createWindow({backgroundColor:'red'});
    win.add(Ti.UI.createLabel({text:JSON.stringify(err)}));
  });

  Module.patch(globalScope);

})(this);