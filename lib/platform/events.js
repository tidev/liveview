
/*
 * Event Emitters
 */

/**
 * Initialize a new `Emitter`.
 *
 * @param {Object} obj
 * @returns {Emitter}
 * @public
 */
function Emitter(obj) {
	if (obj) { return mixin(obj); }
}

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @private
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
 * @param {string} event
 * @param {Function} fn
 * @return {Emitter}
 * @public
 */
Emitter.prototype.on = function (event, fn) {
	this._callbacks = this._callbacks || {};
	(this._callbacks[event] = this._callbacks[event] || [])
		.push(fn);
	return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {string} event
 * @param {Function} fn
 * @return {Emitter}
 * @public
 */
Emitter.prototype.once = function (event, fn) {
	var self = this;
	this._callbacks = this._callbacks || {};

	/**
	 * [on description]
	 */
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
 * @param {string} event
 * @param {Function} fn
 * @return {Emitter}
 * @public
 */
Emitter.prototype.off = function (event, fn) {
	this._callbacks = this._callbacks || {};
	var callbacks = this._callbacks[event];
	if (!callbacks) { return this; }

	// remove all handlers
	if (1 === arguments.length) {
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
 * @param {string} event
 * @param {Mixed} ...
 * @return {Emitter}
 * @public
 */
Emitter.prototype.emit = function (event) {
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
 * @param {string} event
 * @return {Array}
 * @public
 */
Emitter.prototype.listeners = function (event) {
	this._callbacks = this._callbacks || {};
	return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {string} event
 * @return {boolean}
 * @public
 */
Emitter.prototype.hasListeners = function (event) {
	return !!this.listeners(event).length;
};
