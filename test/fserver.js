var Fserver = require('../lib/fserver'),
	path = require('path'),
	join = path.join,
	should = require('should'), // eslint-disable-line no-unused-vars
	FixtureApp = join(__dirname, 'platform'),
	request = require('request');

describe('FServer', function () {

	describe('#start()', function () {

		it('should start TCP and HTTP server', function () {
			Fserver.start({
				projectDir: FixtureApp,
				fport: 9011,
				eport: 9012
			});
		});

		it('should start 2 server instances', function () {

			Fserver.start({
				projectDir: FixtureApp,
				fport: 9021,
				eport: 9022
			});

			Fserver.start({
				projectDir: FixtureApp,
				fport: 9023,
				eport: 9024
			});
		});
	});

	describe('#pids()', function () {
		it('should return an empty Array', function () {
			Fserver.pids().should.be.an.instanceOf(Array);
		});

		before(function () {
			Fserver.start({
				projectDir: FixtureApp
			});

			Fserver.start({
				projectDir: FixtureApp,
				fport: 9033,
				eport: 9034
			});
		});

		after(function (done) {
			const opts = {
				url: 'http://localhost:8324/kill',
				headers: {
					'x-platform': 'foo'
				}
			};
			request(opts, function () {
				opts.url = 'http://localhost:9033/kill';
				request(opts, function () {
					done();
				});
			});
		});

		it('should return an Array of PIDS', function (done) {
			var pids = Fserver.pids();
			pids.should.be.an.instanceOf(Array);
			done();
		});
	});
});
