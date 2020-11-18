module.exports = {
  overrides: [
    {
      files: ['rollup.config.js'],
      rules: {
        'node/no-unsupported-features/es-syntax': ['warn', {
          ignores: ['modules']
        }]
      }
    }
  ]
};
