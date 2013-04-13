/*!
 * liveview FileServer
 */

var http = require('http'),
  net = require('net'),
  url = require('url'),
  path = require('path'),
  fs = require('fs'),
  fsWatcher = require('chokidar'),
  path = require('path'),
  colors = require('colors');

var FServer = module.exports = {};

var tmpDir = tempdir();
var pid = process.pid;
var argv = process.argv || [];
var fileCount = {};
var disableCliColor = (argv.indexOf('--no-colors') !== -1);

// strip color if --no-colors flag is present in argv
if (disableCliColor) {
  colors.mode = 'none';
}

// main export
FServer.start = function(opts) {

  var BASE_DIR = opts.path || process.cwd();
  var PORT = opts.port || 8324;
  var EPORT = opts.eport || 8323;
  var ignoredPaths = [];
  var ignoredExtensions = [];
  var isAlloy = false;
  var openPids = ls(tmpDir + '*-liveview');

  if ((openPids||[]).length) {
    openPids.forEach(function (pidPath) {
      var _pid = pidPath.replace(tmpDir, '').split('-')[0];
      console.log('[INFO]'.green, ' Closing running liveview process id:' + _pid);
      rm(pidPath);
      process.kill(_pid);
    });
  }

  // create new pid file
  exec('touch ' + tmpDir + pid + '-liveview', {silent:true});

  process.on('SIGINT', function() {
    console.log('\n[INFO]'.green, ' Closing running liveview process id:' + pid);
    rm(tmpDir + pid + '-liveview' );
    process.exit(0);
  });
  // create static file server
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

        if (opts.verbose) {
          console.log('[INFO]'.green, ' File Server Response');
          console.log(' -REQUESTED:'.grey, fileCount[filename], 'times');
          console.log(' -FILE:'.grey, uri.replace('/', ''));
          console.log(' -RESPONSE:'.grey, out.code);
          console.log(' -LENGTH:'.grey, out.data.length);
        }

        response.writeHead(out.code, {
          'Content-Type': 'text/plain'
        });
        response.write(out.data);
        response.end();
      });
    });
  }).listen(parseInt(PORT, 10));

  console.log('[INFO]'.green, ' LiveView Server Started on Port', (PORT + '').bold);

  /**
   * [logFsChange description]
   * @param  {[type]} file  [description]
   * @param  {[type]} event [description]
   * @return {[type]}       [description]
   */

  function logFsChange(file, event){
    console.log(' [INFO]'.green, 'Reload Triggered');
    console.log('  -REASON:'.grey, 'File', event);
    console.log('  -FILE:'.grey, file);
  }

  /**
   * [watchAlloy description]
   * @return {[type]} [description]
   */

  function checkAlloy() {
    if (isAlloy) { return; }
    fs.exists(BASE_DIR + '/../app', function (exists) {
      isAlloy = exists;
      if (!isAlloy) { return; }
      // watch alloy files for changes
      var alloyWatcher = fsWatcher.watch(BASE_DIR + '/../app', { persistent: true, ignoreInitial: true });
      console.log('[INFO]'.green, 'LiveView Alloy project monitor started');

      alloyWatcher.on('change', function (path) {
        logFsChange(path, 'Changed');
        console.log(exec('alloy compile', {silent:true}).output);
      });
    });
  }

  // TCP Server for two messaging between running app and server
  var server = net.createServer(function(c) {

    // client disconnected
    c.on('end', function() {
      console.log('[INFO]'.green, 'Event Server disconnected');
    });

    // watch Resources dir for file changes
    var watcher = fsWatcher.watch(BASE_DIR, { persistent: true, ignoreInitial: true });

    // check if alloy project exists and should be watched
    checkAlloy();

    // reload app on file changes
    watcher.on('change', function (path) {
      if (!isAlloy) { checkAlloy(); }
      logFsChange(path, 'Changed');
      c.write(JSON.stringify({type:'event', name:'reload'}));
    });

    watcher.on('error', function (path) {
      console.log('[WARN]'.yellow, 'error loading watching file', path);
    });

  });
  server.listen(EPORT, function() { //'listening' listener
    console.log('[INFO]'.green, ' Liveview Event Server Started on Port', (EPORT + '').bold);
  });
};