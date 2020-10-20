/*
 * Event Emitters
 */

/**
 * Initialize a new `Emitter`.
 *
 * @param {Object} obj Object to be mixed in to emitter
 * @returns {Emitter}
 * @public
 */
export default function Emitter(obj) {
	if (obj) {
		return mixin(obj);
	}
}

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj object to be mixed in
 * @return {Object} object with Emitter properties mixed in
 * @private
 */
function mixin(obj) {
	for (const key in Emitter.prototype) {
		obj[key] = Emitter.prototype[key];
	}
	return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {string} event event name to hook callback to
 * @param {Function} fn callback function
 * @return {Emitter} this
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
 * @param {string} event event name to hook callback to
 * @param {Function} fn callback function
 * @return {Emitter} this
 * @public
 */
Emitter.prototype.once = function (event, fn) {
	const self = this;
	this._callbacks = this._callbacks || {};

	/**
	 * single-fire callback for event
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
 * @param {string} event event name to remove callback from
 * @param {Function} fn callback function
 * @return {Emitter} this
 * @public
 */
Emitter.prototype.off = function (event, fn) {
	this._callbacks = this._callbacks || {};
	let callbacks = this._callbacks[event];
	if (!callbacks) {
		return this;
	}

	// remove all handlers
	if (arguments.length === 1) {
		delete this._callbacks[event];
		return this;
	}

	// remove specific handler
	const i = callbacks.indexOf(fn._off || fn);
	if (~i) {
		callbacks.splice(i, 1);
	}
	return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {string} event event name
 * @return {Emitter}
 * @public
 */
Emitter.prototype.emit = function (event) {
	this._callbacks = this._callbacks || {};
	const args = [].slice.call(arguments, 1);
	let callbacks = this._callbacks[event];

	if (callbacks) {
		callbacks = callbacks.slice(0);
		for (let i = 0, len = callbacks.length; i < len; ++i) {
			callbacks[i].apply(this, args);
		}
	}

	return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {string} event event name
 * @return {Array} array of callbacks registered for that event
 * @public
 */
Emitter.prototype.listeners = function (event) {
	this._callbacks = this._callbacks || {};
	return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {string} event event name
 * @return {boolean}
 * @public
 */
Emitter.prototype.hasListeners = function (event) {
	return !!this.listeners(event).length;
};
