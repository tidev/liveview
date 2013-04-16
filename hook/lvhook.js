require('shelljs/global');

exports.cliVersion = '>=3.0.25';

exports.init = function (logger, config, cli) {

  var path = require('path')
    , fserver = require('../lib/fserver');

  function doConfig(data, finished) {
    var r = data.result || {};
    r.flags || (r.flags = {});
    r.flags.liveview = {
      default: false,
      desc: 'enables LiveView'
    };
    finished(null, data);
  }

  cli.addHook('build.android.config', doConfig);
  cli.addHook('build.ios.config', doConfig);

  cli.addHook('build.ios.copyResource', {
    pre: function (data, finished) {
      if (cli.argv.liveview) {
        var srcFile = data.args[0],
          destFile = data.args[1];
        if (srcFile == path.join(this.projectDir, 'Resources', 'app.js')) {
          data.args[0] = path.join(tempdir(), 'liveview.js');
        }
      }
      finished(data);
    }
  });

  cli.addHook('build.ios.writeBuildManifest', {
    pre: function (data, finished) {
      if (cli.argv.liveview) {
        data.args[0].liveview = true;
      }
      finished(data);
    }
  });

  cli.addHook('build.android.setBuilderPyEnv', { priority: 2000}, function (data, finished) {
    if (cli.argv.liveview) {
      data.args[0].LIVEVIEW = '1';
    }
    finished(data);
  });

  cli.addHook('build.pre.compile', {
    priority: 2000,
    post: function (build, finished) {
      if (cli.argv.liveview) {
        var liveviewJS = path.join(tempdir(), 'liveview.js');
        cp('-f', __dirname +'/../build/liveview.min.js', liveviewJS);
        require('dns').lookup(require('os').hostname(), function (err, add, fam) {
          sed('-i', 'FSERVER_HOST', add, liveviewJS);
          sed('-i', 'TCP_HOST', add, liveviewJS);
        });
      }
      finished();
    }
  });

  cli.addHook('build.post.compile', function (build, finished) {
    if (cli.argv.liveview) {
      var resourceDir = path.join(build.projectDir, 'Resources');
      fserver.start({path: resourceDir });
    }
    finished();
  });

};
