
/**
 * Initialize a new `Module`.
 *
 * @api public
 */

if (typeof module !== 'undefined') {
  module.exports = Module;
}

/**
 * [Module description]
 * @param {[type]} id [description]
 */

function Module(id) {
  this.filename = id + '.js';
  this.id = id;
  this.exports = {};
  this.loaded = false;
}

// global namespace

var global = Module._global = Module.global = {};

// main process

var process = global.process = Process();

// set environment type

global.ENV = 'liveview';

// set logging

global.logging = false;

// catch uncaught errors

global.CATCH_ERRORS = true;

// module cache

Module._cache = {};

/**
 * place holder for native require until patched
 *
 * @api private
 */

Module._requireNative = function(){
  throw new Error('Module.patch must be run first');
};

/**
 * place holder for native require until patched
 *
 * @api private
 */

Module._includeNative = function(){
  throw new Error('Module.patch must be run first');
};

/**
 * replace built in `require` function
 *
 * @param  {Object} globalCtx
 * @return {Function}
 * @api private
 */

Module.patch = function (globalCtx, port, url) {
  Module._url = url || 'FSERVER_HOST';
  Module._port = port || 8324;
  Module._requireNative = globalCtx.require;

  /**
   * [reload description]
   * @return {[type]} [description]
   */

  this.global.reload = function(){
    console.log('[LiveView] Reloading App');
    try {
      Ti.App._restart();
    } catch(e){
      require('app');
    }
  };

  var retryInterval = null;

  var client = this.evtServer = new Socket({host: 'TCP_HOST', port: 8323}, function() {
    console.log('[LiveView]', 'Connected to Event Server');
  });

  client.on('connect', function(){
    if (retryInterval) {
      clearInterval(retryInterval);
      console.log('[LiveView]', 'Reconnected to Event Server');
    }
  });

  client.on('data', function(data) {
    if (!data) { return; }
    try{
      var evt = JSON.parse(''+data);
      if (evt.type === 'event' && evt.name === 'reload') {
        Module._cache = [];
        Module.global.reload();
      }
    } catch (e) { /*discard non JSON data for now*/ }
  });

  client.on('end', function () {
    console.error('[LiveView]', 'Disconnected from Event Server');
    retryInterval = setInterval(function(){
      console.log('[LiveView]', 'Attempting reconnect to Event Server');
      client.connect();
    }, 2000);
  });

  client.on('error', function(e){
    var err = e.error;
    var code = ~~e.code;
    if (code === 61) { err = 'Event Server unavailable. Connection Refused'; }
    console.error('[LiveView] ' + err);
  });

  client.connect();
  Module.require('app');
};

/**
 * include script loader
 * @param  {String} id
 *
 * @api public
 */

Module.include = function(id) {
  var file = id.replace('.js', '');
  var src = Module.prototype._getRemoteSource(file,10000);
  eval(src);
};

/**
 * commonjs module loader
 * @param  {String} id
 *
 * @api public
 */

Module.require = function(id) {
  var fullPath = id;
  var cached = Module.getCached(fullPath);
  if (!!cached) {
    return cached.exports;
  }

  var freshModule = new Module(fullPath);

  freshModule.cache();
  freshModule._compile();

  while (!freshModule.loaded) {}

  return freshModule.exports;
};

/**
 * [getCached description]
 * @param  {String} id
 * @return {Object}
 *
 * @api public
 */

Module.getCached = function(id) {
  return Module._cache[id];
};

/**
 * check if module file exists
 *
 * @param  {String} id
 * @return {[type]}    [description]
 * @api public
 */

Module.exists = function(id) {
  var path = Ti.Filesystem.resourcesDirectory + id + '.js';
  var file = Ti.Filesystem.getFile(path);
  return file.exists();
};

/**
 * shady xhrSync request
 *
 * @param  {String} url
 * @param  {Number} timeout
 * @return {String}
 * @api private
 */

Module.prototype._getRemoteSource = function(file,timeout){
  var expireTime  = new Date().getTime() + timeout;
  var request = Ti.Network.createHTTPClient();
  var rsp = null;
  var file = 'http://' + Module._url + ':' + Module._port + '/' + (file || this.id) + '.js';
  request.cache = false;
  request.open("GET", file);
  request.send();

  while(!rsp){
    if (request.readyState === 4 ) {
      if (request.status !== 200) {
        rsp = true;
        return null;
      }
      rsp = request.responseText;
    } else if ((expireTime -  (new Date()).getTime()) <= 0) {
      rsp = true;
      throw new Error('[LiveView]', 'File Server unavailable. Host Unreachable');
    }
  }

  return rsp;
};

/**
 * get module file source text

 * @return {String}
 * @api private
 */

Module.prototype._getSource = function() {
  var id = this.id;
  var isRemote = /^(http|https)$/.test(id) || (global.ENV === 'liveview');

  if (isRemote){
    return this._getRemoteSource(null,3000);
  } else {
    if (id === 'app') { id = '_app'; }
    var file = Ti.Filesystem.getFile(Ti.Filesystem.resourcesDirectory, id + '.js');
    return (file.read()||{}).text;
  }
};

/**
 * wrap module source text in commonjs anon function wrapper
 *
 * @param  {String} script
 * @return {String}
 * @api private
 */

Module._wrap = function(source) {
  source = source.replace(/Ti(tanium)?.include/g, 'Module.include');
  return (global.CATCH_ERRORS) ? Module._errWrapper[0] + source + Module._errWrapper[1] : source;
};

// uncaught exception handler wrapper

Module._errWrapper = [
  'try {',
  '} catch (err) { process.emit("uncaughtException", {module: __filename, error: err})}'
];

/**
 * compile commonjs module and string to js
 *
 * @api private
 */

Module.prototype._compile = function() {
  var src = this._getSource();
  if (!src) {
    this.exports = Module._requireNative(this.id);
    this.loaded = true;
    return;
  }
  var source = Module._wrap(src);
  var fn = Function('exports, require, module, __filename, __dirname',source);
  fn(this.exports, Module.require, this, this.filename, this.__dirname);
  this.loaded = true;
};

/**
 * cache current module
 *
 * @api public
 */

Module.prototype.cache = function() {
  this.timestamp = (new Date()).getTime();
  Module._cache[this.id] = this;
};
