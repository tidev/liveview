
/**
 * Initialize a new `Module`.
 *
 * @api public
 */

var module = module || {};

var Module = module.exports = function(id) {
  this.filename = id + '.js';
  this.id = id;
  this.exports = {};
  this.loaded = false;
};

// global namespace

var global = Module._global = Module.global = {};

// main process

var process = global.process = Process();

// set environment type

global.ENV = 'liveti';

// set logging

global.logging = false;

// catch uncaught errors

global.CATCH_ERRORS = false;

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
  return globalCtx.require = Module.require;
};

/**
 * include script loader
 * @param  {String} id
 *
 * @api public
 */

Module.include = function(id) {
  var file = id.replace('.js', '');
  var src = Module.prototype._getRemoteSource(file,3000);
  return eval(src);
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

  if (cached) {
    return cached.exports;
  }

  if (!Module.exists(fullPath)) {
    try {
      console.log('Loading Native Module');
      Module._requireNative(id);
    } catch (e) {
      throw new Error('No such module ' + id);
    }
  }

  var freshModule = new Module(fullPath);

  if (global.ENV !== 'liveti') { freshModule.cache(); }
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
    if(request.readyState === 4 ) {
      rsp = request.responseText;
    } else if((expireTime -  (new Date()).getTime()) <= 0) {
      rsp = true;
      throw new Error('Timed Out');
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
  var isRemote = /^(http|https)$/.test(id) || (global.ENV === 'liveti');

  if(isRemote){
    return this._getRemoteSource(null,3000);
  } else {
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
  var script = (global.CATCH_ERRORS) ? Module._errWrapper[0] + source + Module._errWrapper[1] : source;
  return Module._wrapper[0] + script + Module._wrapper[1];
};

// uncaught exception handler wrapper

Module._errWrapper = [
  'try {',
  '} catch (err) { process.emit("uncaughtException", {module: this, error: err})}'
];

// commonjs anon function wrapper

Module._wrapper = [
  '(function (exports, require, module, __filename, __dirname) { ',
  '})'
];

/**
 * compile commonjs module and string to js
 *
 * @api private
 */

Module.prototype._compile = function() {
  var source = Module._wrap(this._getSource());
  var fn = eval(source);
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