var exec = require('child_process').exec;

module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		mocha_istanbul: {
			coverage: {
				src: ['test/*.js'],
				options: {
					timeout: 3500,
					reporter: 'mocha-jenkins-reporter',
					reportFormats: ['lcov', 'cobertura'],
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
			test: ['tmp', 'coverage'],
			dist: ['build']
		},
		eslint: {
			
			target: ['index.js', 'lib/**/!(_)*.js', 'test/*.js', 'hook/**/*.js', 'bin/*']
		},
		appcJs: {
			options: {
				force: false
			},
			// Don't lint lib/_head.js or lib/_tail.js because they're fragments
			src: ['index.js', 'lib/**/!(_)*.js', 'test/*.js', 'hook/**/*.js', 'bin/*']
		},
		bump: {
			options: {
				files: ['package.json'],
				commitFiles: ['package.json'],
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
		uglify: {
			options: {
				mangle: false
			},
			dist: {
				files: {
					'build/liveview.min.js': ['build/liveview.js']
				}
			}
		}
	});

	// Load grunt plugins for modules
	grunt.loadNpmTasks('grunt-eslint');
	grunt.loadNpmTasks('grunt-bump');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-mocha-istanbul');

	grunt.registerTask('build', ['clean:dist', 'concat:dist', 'uglify:dist']);
	grunt.registerTask('lint', ['eslint']);
	grunt.registerTask('test', ['build', 'lint', 'clean:test', 'mocha_istanbul:coverage']);
	grunt.registerTask('default', ['build']);

};