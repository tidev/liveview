
var Fserver = require('../lib/fserver'),
	path = require('path'),
	join = path.join,
	should = require('should');

//
var FixtureApp = join(__dirname, 'platform');

describe('FServer', function () {

	describe('#start()', function () {

		it('should start TCP and HTTP server', function () {
			Fserver.start({
				projectDir: FixtureApp,
				fport:9011,
				eport:9012
			});
		});

		it('should start 2 server instances', function () {

			Fserver.start({
				projectDir: FixtureApp,
				fport:9021,
				eport:9022
			});

			Fserver.start({
				projectDir: FixtureApp,
				fport:9023,
				eport:9024
			});
		});
	});

	describe('#pids()', function () {

		it('should return an empty Array', function () {
			Fserver.pids().should.be.an.instanceOf(Array);
		});

		var server1 = null;
		var server2 = null;

		before(function () {
			Fserver.start({
				projectDir: FixtureApp
			});

			server1 = Fserver.pidFile;

			Fserver.start({
				projectDir: FixtureApp,
				fport:9033,
				eport:9034
			});
			server2 = Fserver.pidFile;
		});

		it('should return an Array of PIDS', function (done) {
			var pids = Fserver.pids();
			pids.should.be.an.instanceOf(Array);
			done();
		});
	});
});
