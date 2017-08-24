/*!
 * liveview Titanium CommonJS require with some Node.js love and dirty hacks
 * Copyright (c) 2013-2017 Appcelerator
 */
(function (globalScope) {

	Object.setPrototypeOf = Object.setPrototypeOf || function(obj, proto) {
		obj.__proto__ = proto;
		return obj;
	}
