/*!
 * liveview FileServer
 */

var http = require('http')
  , net = require('net')
  , url = require('url')
  , path = require('path')
  , fs = require('fs')
  , fsWatcher = require('chokidar')
  , path = require('path')
  , colors = require('colors');

var FServer = module.exports = {};

var fileCount = {};

// main export
FServer.start = function(opts) {

  var BASE_DIR = opts.path || process.cwd();
  var PORT = opts.port || 8324;
  var EPORT = opts.eport = 8323;
  var ignoredPaths = [];
  var ignoredExtensions = [];


  http.createServer(function(request, response) {

    var uri = url.parse(request.url).pathname;
    var filename = path.join(BASE_DIR, uri);

    if (uri === '/') {
      response.writeHead(200, {
        'Content-Type': 'text/plain'
      });
      response.write('Appcelerator - liveview\n');
      response.end();
      return;
    }

    fs.exists(filename, function(exists) {

      fileCount[filename] = (fileCount[filename] || 0) + 1;

      // return 404 if file does not exist

      if (!exists) {
        response.writeHead(404, {
          'Content-Type': 'text/plain'
        });
        response.write('404 Not Found\n');
        response.end();
        return;
      }

      fs.readFile(filename, function(err, file) {
        var out = (err) ? {
          code: 500,
          data: err
        } : {
          code: 200,
          data: file
        };

        console.log('[INFO]'.green, 'File Server Response');
        console.log(' -REQUESTED:'.grey, fileCount[filename], 'times');
        console.log(' -FILE:'.grey, uri.replace('/', ''));
        console.log(' -RESPONSE:'.grey, out.code);
        console.log(' -LENGTH:'.grey, out.data.length);

        response.writeHead(out.code, {
          'Content-Type': 'text/plain'
        });
        response.write(out.data);
        response.end();
      });
    });
  }).listen(parseInt(PORT, 10));

  console.log('[INFO]'.green, ' LiveView Server Started on Port', (PORT + '').bold);


  function logFsChange(file, event){
    console.log('[INFO]'.green, 'Reload Triggered');
    console.log(' -REASON:'.grey, 'File', event);
    console.log(' -FILE:'.grey, file.split('Resources')[1]);
  }


  // File Change Monitor

  var server = net.createServer(function(c) { //'connection' listener
    console.log('[INFO]'.green, 'Event Server started on port');

    c.on('end', function() {
      console.log('[INFO]'.green, 'Event Server disconnected');
    });

    var watcher = fsWatcher.watch(BASE_DIR, { persistent: true, ignoreInitial: true });
    console.log('[INFO]'.green, 'LiveView file monitor started');

    watcher.on('add', function (path) {
      logFsChange(path, 'Added');
      c.write(JSON.stringify({type:'event', name:'reload'}));
    });

    watcher.on('change', function (path) {
      logFsChange(path, 'Changed');
      c.write(JSON.stringify({type:'event', name:'reload'}));
    });

    watcher.on('unlink', function (path) {
      logFsChange(path, 'Removed');
      c.write(JSON.stringify({type:'event', name:'reload'}));
    });

    watcher.on('error', function (path) {
      console.log('[WARN]'.yellow, 'error loading watching file', path);
    });

  });
  server.listen(EPORT, function() { //'listening' listener
    console.log('[INFO]'.green, ' liveview Event Server Started on Port', (EPORT + '').bold);
  });
};