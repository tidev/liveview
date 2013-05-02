var server = require('../lib/fserver')
  , path = require('path')
  , request = require('supertest')
  , net = require('net');

describe('server', function() {

  it('should start up http file server', function (done) {

    server.start({
      path: __dirname + '/platform'
    });

    request('http://127.0.0.1:8324')
      .get('/')
      .expect('Content-Type', /text/)
      .expect(200)
      .end(function(err){
        done(err);
      });
  });

  it('should start up tcp event server', function (done){
    var client = net.connect({port: 8323}, function() {
      client.write('test');
      server.stop();
      done();
    });
  });
});