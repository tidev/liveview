module.exports = function (grunt) {

	// Project configuration.
	grunt.initConfig({
		mocha_istanbul: {
			coverage: {
				src: [ 'test/*.js' ],
				options: {
					timeout: 3500,
					reporter: 'mocha-jenkins-reporter',
					reportFormats: [ 'lcov', 'cobertura' ],
					ignoreLeaks: false,
					globals: [
						'requestSSLInitializing',
						'requestSSLInsideHook',
						'requestSSLInitialized'
					]
				}
			}
		},
		clean: {
			test: [ 'tmp', 'coverage' ],
			dist: [ 'build'  ]
		},
		appcJs: {
			options: {
				force: false
			},
			// Don't lint lib/_head.js or lib/_tail.js because they're fragments
			src: [ 'Gruntfile.js', 'index.js', 'lib/**/!(_)*.js', 'test/*.js', 'hook/**/*.js', 'bin/*' ]
		},
		bump: {
			options: {
				files: [ 'package.json' ],
				commitFiles: [ 'package.json' ],
				pushTo: 'appcelerator'
			}
		},
		concat: {
			options: {
				separator: '',
			},
			dist: {
				src: [
					'lib/platform/_head.js',
					'lib/platform/process.js',
					'lib/platform/events.js',
					'lib/platform/socket.js',
					'lib/platform/require.js',
					'lib/platform/_tail.js'
				],
				dest: 'build/liveview.js',
			},
		},
		'node-minify': {
			babili: {
				compressor: 'babili',
				// TODO Turn off mangle!
				files: {
					'build/liveview.min.js': [ 'build/liveview.js' ]
				}
			}
		}
	});

	// Load grunt plugins for modules
	grunt.loadNpmTasks('grunt-appc-js');
	grunt.loadNpmTasks('grunt-bump');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-node-minify');
	grunt.loadNpmTasks('grunt-mocha-istanbul');

	grunt.registerTask('build', [ 'clean:dist', 'concat:dist', 'node-minify' ]);
	grunt.registerTask('lint', [ 'appcJs' ]);
	grunt.registerTask('test', [ 'build', 'lint', 'clean:test', 'mocha_istanbul:coverage' ]);
	grunt.registerTask('default', [ 'build' ]);

};
