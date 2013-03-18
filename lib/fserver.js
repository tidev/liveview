
/*!
 * liveview FileServer
 */

var http = require('http')
  , url = require('url')
  , path = require('path')
  , fs = require('fs')
  , colors = require('colors');

// main export

var FServer = module.exports = {};

var fileCount = {};

FServer.start = function (opts) {

  var BASE_DIR = opts.path || process.cwd();
  var PORT = opts.port || 8324;


  http.createServer(function(request, response) {

    var uri = url.parse(request.url).pathname
      , filename = path.join(BASE_DIR, uri);

      if (uri === '/') {
        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.write('Appcelerator - liveview\n');
        response.end();
        return;
      }

      fs.exists(filename, function(exists) {

      fileCount[filename] = (fileCount[filename]||0) + 1;

      // return 404 if file does not exist

      if (!exists) {
        response.writeHead(404, {'Content-Type': 'text/plain'});
        response.write('404 Not Found\n');
        response.end();
        return;
      }

      fs.readFile(filename, function(err, file) {
        var out = (err) ? { code: 500, data: err } : {code: 200, data: file };

        console.log('[INFO]'.green, 'File Server Response');
        console.log(' -REQUESTED:', fileCount[filename], 'times');
        console.log(' -FILE:'.grey, uri.replace('/', ''));
        console.log(' -RESPONSE:'.grey, out.code);
        console.log(' -LENGTH:'.grey, out.data.length);

        response.writeHead(out.code, {'Content-Type': 'text/plain'});
        response.write(out.data);
        response.end();
      });
    });
  }).listen(parseInt(PORT, 10));

  console.log(' [INFO]:'.green,'liveview Server Started on Port', (PORT + '').bold);

};