/* globals Emitter */
/**
 * Expose `Socket`.
 */
if (typeof module !== 'undefined') {
	module.exports = Socket;
}

/**
 * [Socket description]
 * @param {Object} opts [description]
 * @returns {Socket}
 */
function Socket(opts) {
	if (!(this instanceof Socket)) {
		return new Socket(opts);
	}
	opts = opts || {};
	this.timeout = 5000;
	this.host = opts.host;
	this.port = opts.port;
	this.retry = opts.retry;
	this.bytesRead = 0;
	this.bytesWritten = 0;
	this.ignore = [];
}

/**
 * Inherit from `Emitter.prototype`.
 */
Object.setPrototypeOf(Socket.prototype, Emitter.prototype);

/**
 * [connect description]
 * @param  {Object}   opts [description]
 * @param  {Function} fn   [description]
 */
Socket.prototype.connect = function (opts, fn) {
	opts = opts || {};
	if (typeof opts === 'function') {
		fn = opts;
		opts = {};
	}

	const self = this;
	self.host = opts.host || self.host || '127.0.0.1';
	self.port = opts.port || self.port;
	self.retry = opts.retry || self.retry;

	const reConnect = !!opts.reConnect;
	this._proxy = Ti.Network.Socket.createTCP({
		host: self.host,
		port: self.port,
		/**
		 * [description]
		 * @param  {Object} e [description]
		 */
		connected: function (e) {
			self.connected = true;
			self._connection = e.socket;
			fn && fn(e);
			self.emit(((reConnect) ? 'reconnect' : 'connect'), e);

			Ti.Stream.pump(e.socket, function (e) {
				if (e.bytesProcessed < 0 || !!e.errorStatus) {
					self._proxy.close();
					self.close(true);
					return;
				} else {
					self.emit('data', '' + e.buffer);
				}
			}, 1024, true);
		},
		/**
		 * [description]
		 * @param  {Object} e [description]
		 * @returns {undefined}
		 */
		error: function (e) {
			if (!~self.ignore.indexOf(e.code)) {
				return self.emit('error', e);
			}
			self.emit('error ignored', e);
		}
	});

	this._proxy.connect();
};

/**
 * [close description]
 * @param {boolean} serverEnded [description]
 */
Socket.prototype.close = function (serverEnded) {
	const self = this;

	self.connected = false;
	self.closing = !serverEnded;

	if (self.closing) {
		self.write(function () {
			self._proxy.close();
			self.emit('close');
		});
		return;
	}

	const retry = ~~self.retry;

	self.emit('end');
	if (!retry) {
		return;
	}

	setTimeout(function () {
		self.emit('reconnecting');
		self.connect({ reConnect: true });
	}, retry);
};

/**
 * [description]
 * @param  {string}   data [description]
 * @param  {Function} fn   [description]
 */
Socket.prototype.write = function (data, fn) {
	if (typeof data === 'function') {
		fn = data;
		data = null;
	}

	data = (data) ?  ('' + data) : '';

	const msg = Ti.createBuffer({ value:  data });

	const callback = fn || function () {};

	Ti.Stream.write(this._connection, msg, function () {
		callback([].slice(arguments));
	});

};

/**
 * [setKeepAlive description]
 * @param {boolean} enable       [description]
 * @param {number} initialDelay [description]
 */
Socket.prototype.setKeepAlive = function (enable, initialDelay) {
	const self = this;
	if (!enable) {
		self._keepAlive && clearInterval(self._keepAlive);
		self._keepAlive = null;
		return;
	}
	self._keepAlive = setInterval(function () {
		self.write('ping');
	}, initialDelay || 300000);
};
