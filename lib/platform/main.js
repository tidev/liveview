/**
 * liveview Titanium CommonJS require with some Node.js love and dirty hacks
 * Copyright (c) 2013-2017 Appcelerator
 */
import Module from './require';

Object.setPrototypeOf = Object.setPrototypeOf || function (obj, proto) {
	// eslint-disable-next-line no-proto
	obj.__proto__ = proto;
	return obj;
};

Module.patch(global, 'FSERVER_HOST', 'FSERVER_PORT');

// Prevent display from sleeping

Titanium.App.idleTimerDisabled = true;
