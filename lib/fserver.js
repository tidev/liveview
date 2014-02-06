/*!
 * liveview FileServer
 */

require('shelljs/global');

var http = require('http')
  , net = require('net')
  , url = require('url')
  , path = require('path')
  , join = path.join
  , fs = require('fs')
  , os = require('os')
  , fsWatcher = require('chokidar')
  , colors = require('coloring')
  , debug = require('debug')('liveview:server')
  , pkgConf = require('../package')
  , util = require('util')
  , detect = require('jsparse-tools').lexscope
  , Hypar = require('hypar');

var OS_TYPE = ('' + os.type()).toLowerCase();
var HOME_DIR = process.env.HOME || process.env.USERPROFILE;
var TMP_DIR = join(HOME_DIR, '/.titanium/')

var PID = process.pid;
var PID_FILE = join(TMP_DIR, (PID + '-liveview'));

/**
 * main export
 */

var FServer = module.exports = {};

/**
 * [pids description]
 * @return {[type]} [description]
 */

FServer.pids = function (env) {
  var pids = [];
  try {
    pids = ls(join(TMP_DIR, '*-liveview'));
    !!env && console.log('[LiveView]'.green, 'Current running servers pid files: ' + (pids.join(' ').trim() || 'No Active Servers'.grey) + '\n');
  } catch (e) {
    debug(e);
    // do nothing
  }
  return pids;
};

/**
 * [status description]
 * @return {[type]} [description]
 */

FServer.status = function (env) {
  var paths = cat(join(TMP_DIR, '*-liveview'));
  !!env && console.log('[LiveView]'.green, 'Current running servers: ' + (paths.trim() || 'No Active Servers'.grey) + '\n');
  return paths;
};

/**
 * [restart description]
 * @return {[type]} [description]
 */

FServer.restart = function () {
  var paths = FServer.status().split('\n');

  FServer.stop();

  paths.forEach(function(path){
    if (path.length) {
      FServer.start({
        path: path
      });
    }
  });
};

/**
 * [stop description]
 * @return {[type]} [description]
 */

FServer.stop = function (env) {
  var pids = ls(join(TMP_DIR, '*-liveview'));

  if (!pids.length) {
    !!env && console.error('[LiveView]'.red, 'No active servers');
    return;
  }

  pids.forEach(function (pidPath) {
    try {
      var _pid = pidPath.replace(TMP_DIR, '').split('-')[0];
      rm(pidPath);
      console.log('[LiveView]'.green, 'Closing file/event server process id: ' + _pid);
      process.kill(_pid);
    } catch (e) {
      console.error('[LiveView]'.red, 'Error closing server', e);
    }
  });

  debug('Killed PIDS:', pids);
};

/**
 * [start description]
 * @param  {[type]} opts [description]
 * @return {[type]}      [description]
 */

FServer.start = function(opts) {

  opts = opts || {};
  debug('Liveview File Server Opts', opts);

  debug('Running PIDS:', FServer.pids());
  console.log('[LiveView]'.green, 'version', pkgConf.version);

  var RESOURCE_DIR = path.resolve(opts.path || opts.projectDir || process.cwd());

  RESOURCE_DIR = (!~RESOURCE_DIR.indexOf('Resources'))
    ? RESOURCE_DIR + '/Resources'
    : RESOURCE_DIR;

  var PROJECT_DIR = join(RESOURCE_DIR, '../');
  var LV_DIR = join(__dirname, '../');
  var BIN_DIR = join(LV_DIR, '../bin');
  var ALLOY_DIR = join(PROJECT_DIR, 'app');
  var LOCALE_DIR = join(PROJECT_DIR, 'i18n');

  var FPORT = opts.fport || 8324;
  var EPORT = opts.eport || 8323;

  var isAlloy = fs.existsSync(ALLOY_DIR);
  var hasLocale = fs.existsSync(LOCALE_DIR);
  var isBuilding = false;
  var fileCount = {};
  var PLATFORM = opts.platform;

  if (!fs.existsSync(RESOURCE_DIR) || !fs.existsSync(join(PROJECT_DIR, 'tiapp.xml'))) {
    console.error('[LiveView]'.red, 'Project directory "' + PROJECT_DIR + '" is not a valid Titanium project.\n');
    process.exit(1);
    return;
  }

  // create new pid file
  fs.existsSync(PID_FILE) && fs.unlinkSync(PID_FILE);
  fs.writeFileSync(PID_FILE, PROJECT_DIR);

  // create static file server
  var fServer = http.createServer(function(request, response) {
    var uri = url.parse(request.url).pathname || '';
    var requestPlatform = request.headers['x-platform'] || PLATFORM;
    var platformFilepath = join(RESOURCE_DIR, requestPlatform, uri);
    var filename = join(RESOURCE_DIR, uri);
    var overridePath = join(__dirname, 'overrides', uri);

    if (uri === '/') {
      response.writeHead(200, {
        'Content-Type': 'application/json'
      });

      var data = {
        pid: process.pid,
        path: PROJECT_DIR,
        alloy: isAlloy
      };

      response.write(JSON.stringify(data));
      response.end();
      return;
    }

    if (uri === '/kill') {
      fServer.close();
      evtServer.close();
      rm('-rf', PID_FILE);
      process.exit(0);
    }

    debug('Request Headers:', '\n', util.inspect(request.headers), '\n');

    filename = (fs.existsSync(overridePath))
      ? overridePath
      : (fs.existsSync(platformFilepath))
        ? platformFilepath
        : filename;

    if (uri === '/localeStrings.js') {

      response.writeHead(200, {
        'Content-Type': 'text/plain',
        'Project-ID': 'GUID_XXXXXX'
      });

      if (!hasLocale) {
        response.write('module.exports = {};');
        response.end();
        return;
      }

      var langs = fs.readdirSync(LOCALE_DIR);
      var langData = {};

      function next(i) {
        if (!langs[i]) {
          response.write('module.exports = ' + JSON.stringify(langData) + ';');
          response.end();
          return;
        }

        var tags = {};
        var parser = Hypar();

        parser.on('tag', function (e) {
          if(e.name !== 'string') { return; }
          tags[e.attr.name] = this._text;
        });

        fs.createReadStream(join(LOCALE_DIR, langs[i], 'strings.xml'))
        .pipe(parser)
        .on('data', function (e) {
          langData[langs[i]] = tags;
          return next(i+1);
        });
      }
      next(0);

    } else {

      fs.exists(filename, function(exists) {
        fileCount[filename] = (fileCount[filename] || 0) + 1;

        // return 404 if file does not exist

        if (!exists) {
          response.writeHead(404, {
            'Content-Type': 'text/plain',
            'Project-ID': 'todo'
          });
          response.write('404 Not Found\n');
          response.end();
          return;
        }

        // responsd with file string

        fs.readFile(filename, function(err, file) {
          var out = (err)
            ? { code: 500, data: err }
            : { code: 200, data: file };

          debug('File Server Response',
            '\n' +
            '  requested: ' + fileCount[filename] + ' time(s)\n' +
            '  file: ' + uri.replace('/', '') + '\n' +
            '  response: ' + out.code + '\n' +
            '  length: ' + out.data.length + '\n'
          );

          response.writeHead(out.code, {
            'Content-Type': 'text/plain',
            'Project-ID': 'GUID_XXXXXX'
          });

          if (uri === '/app.js') {

            var scope = detect(out.data);

            // TODO probably a better way to do this, but this fix will work for now.

            out.data = String(out.data).replace(/^#![^\n]*\n/, '').split('');

            var v =  Object.keys(scope.lexvars['']);

            v.forEach(function (vr) {
              var start = scope.lexvars[''][vr].parent.start;
              out.data[start] = ' ';
              out.data[start + 1] = ' ';
              out.data[start + 2] = ' ';
            });
            out.data = out.data.join('');


            debug('[LiveView] app.js global variables: ', scope.locals[''], '\n');

            scope.locals[''].forEach(function(lexVar){
              out.data = out.data + '\nlvGlobal._globalCtx.' + lexVar + ' = ' + lexVar + ';';
            });

            response.write(out.data);
            response.end();
          } else {
            response.write(out.data);
            response.end();
          }
        });
      });
    }
  });

  // start listening for requests

  fServer.listen(parseInt(FPORT, 10));
  console.log('[LiveView]'.green, 'File Server Started on Port', (FPORT + '').bold);

  // TCP Server for two messaging between running app and server

  var evtServer = net.createServer();

  // connect clients

  evtServer.clients = [];

  // listen for new client connections

  evtServer.on('connection', function (client) {
    console.log('[LiveView]'.green, 'Client connected');
    evtServer.clients.push(client);

    client.on('end', function(e){
      console.log('[LiveView]'.green, 'Client disconnected');
      //evtServer.clients.splice(client);
    });

    client.on('data', function(e){
      console.log('data:'+e);
    });
  });

  evtServer.on('close', function (client) {
    var clients = evtServer.clients;
    var clientLen = clients.length;

    for (var i = 0; i < clientLen; i++) {
      console.log(client[i]);
      //clients.splice(i);
    }
  });



  evtServer.on('error', function (e) {
    if (e.code === 'EADDRINUSE') {
      console.log('Address in use, retrying...');
      setTimeout(function () {
        evtServer.close();
        evtServer.listen(parseInt(EPORT));
      }, 1000);
    }
  });

  evtServer.on('change', function(file){
    var clients = evtServer.clients.slice(0);
    var clientLen = clients.length;

    logFsChange(file, 'Changed');

    for (var i = 0; i < clientLen; i++) {
      try {
        clients[i].write(JSON.stringify({type:'event', name:'reload'}));
        evtServer.clients.shift();
      } catch(e){
        //clients.splice(i);
      }
    }
  });

  // start up event server

  evtServer.listen(parseInt(EPORT, 10), function() {
    console.log('[LiveView]'.green, 'Event Server Started on Port', (EPORT + '').bold);
  });

  /**
   * watch Resources dir for file changes
   */

  var resourceWatcher = evtServer.watcher = fsWatcher.watch(RESOURCE_DIR, { persistent: true, ignoreInitial: true });

  resourceWatcher.on('change', function (file) {
    if (isBuilding) { return; }
    evtServer.emit('change', file);
  });

  resourceWatcher.on('error', function (path) {
    console.error('[LiveView]'.red, 'Error loading watching file', path);
  });


  /**
   * watch i18n dir for file changes
   */

  if (hasLocale) {

    var localeWatcher = evtServer.watcher = fsWatcher.watch(LOCALE_DIR, { persistent: true, ignoreInitial: true });

    localeWatcher.on('change', function (file) {
      if (isBuilding) { return; }
      evtServer.emit('change', file);
    });

    localeWatcher.on('error', function (path) {
      console.error('[LiveView]'.red, 'Error loading watching file', path);
    });
  }

  /**
   * check if alloy project folder should be watched
   */

  if (fs.existsSync(ALLOY_DIR)) {
    var alloyWatcher = fsWatcher.watch(ALLOY_DIR, { persistent: true, ignoreInitial: true });
    console.log('[LiveView]'.green, 'Alloy project monitor started');

    alloyWatcher.on('change', function (file) {
      if (isBuilding) { return console.log('[LiveView]'.green, 'File changes ignored while Alloy compiling'); }
      isBuilding = true;
      console.log('[LiveView]'.green, 'Alloy recompile initiated for', PLATFORM);
      exec('alloy compile --no-colors --config platform=' + PLATFORM, {silent: true}, function (code, error) {
        isBuilding = false;
        if(code) { return console.error('[LiveView]'.red, error); }
        evtServer.emit('change', file);
      });
    });
  }

  process.on('SIGINT', function() {
    fServer.close();
    evtServer.close();
    rm('-rf', PID_FILE);
    process.exit(0);
  });
};

process.on('uncaughtException', function (e) {
  console.error('[LiveView]'.red, e);
});

/**
 * [escape description]
 * @param  {[type]} str [description]
 * @return {[type]}     [description]
 */

function escape() {
  var args = join.apply(this, [].slice.call(arguments));
  return '"' + args + '"';
}

  /**
   * [logFsChange description]
   * @param  {[type]} file  [description]
   * @param  {[type]} event [description]
   * @return {[type]}       [description]
   */

function logFsChange(file, event){
  console.log('[LiveView]'.green, 'Reload Triggered');
  console.log('  REASON:'.grey, 'File', event);
  console.log('  FILE:'.grey, file);
}