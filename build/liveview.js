
/*!
 * liveview Titanium CommonJS require with some Node.js love and dirty hacks
 * Copyright (c) 2013 Appcelerator
 */

function consoleBanner(){
  console.log(' ');
  console.log('################################################################');
  console.log('#      liveview, Titanium Live file runner, version 0.1.0      #');
  console.log('# Copyright (c) 2013, Appcelerator, Inc.  All Rights Reserved. #');
  console.log('#                                                              #');
  console.log('# Please report bugs to http://jira.appcelerator.org/          #');
  console.log('################################################################');
  console.log(' ');
}
/*!
 * Event Emitters
 */

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) { return mixin(obj); }
}

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  fn._off = on;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off = function(event, fn){
  this._callbacks = this._callbacks || {};
  var callbacks = this._callbacks[event];
  if (!callbacks) { return this; }

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var i = callbacks.indexOf(fn._off || fn);
  if (~i) { callbacks.splice(i, 1); }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1);
  var callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};
/**
 * Initialize a new `Process`.
 *
 * @api public
 */

function Process() {
  if (!(this instanceof Process)){ return new Process(); }
  this.title = 'titanium';
  this.version = '';
  this.moduleLoadList = [];
  this.versions = {};
  this.arch = Ti.Platform.architecture;
  this.platform = Ti.Platform.name;
  this.hardware = Ti.Platform.model;
}

// inherit from EventEmitter

Process.prototype.__proto__ = Emitter.prototype;
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

global.ENV = 'liveview';

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

  if (global.ENV !== 'liveview') { freshModule.cache(); }
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
      rsp = request.responseText;
    } else if ((expireTime -  (new Date()).getTime()) <= 0) {
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
  var isRemote = /^(http|https)$/.test(id) || (global.ENV === 'liveview');

  if (isRemote){
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
  //source = source.replace(/Ti(tanium)?.include/g, 'Module.include');
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
/**
 * [ description]
 * @param  {[type]} [description]
 * @return {[type]} [description]
 */

(function(globalCtx) {
  Module.patch(globalCtx);

  // Base window

  var win = Ti.UI.createWindow({backgroundColor:'#000000'});
  win.open();

  var app = require('app');

  /**
   * [reload description]
   * @return {[type]} [description]
   */

  Module.global.reload = function(){
    try {
      app.close();
    } catch (e){
      console.error('Invalid or missing root proxy object export from app.js. Please export the application root proxy object. (ex. window, tabview, etc...)');
    }
    app = require('app');
  };

  /**
   * [ description]
   * @param  {[type]} [description]
   * @return {[type]}      [description]
   */

  Ti.Gesture.addEventListener('shake', function(e){
    Module.global.reload();
  });

})(this);