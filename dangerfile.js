/* global fail */

// requires
const eslint = require('@seadub/danger-plugin-eslint').default;
const junit = require('@seadub/danger-plugin-junit').default;
const dependencies = require('@seadub/danger-plugin-dependencies').default;

async function main() {
  await Promise.all([
    eslint(),
    junit({ pathToReport: './junit.xml' }),
    dependencies({ type: 'yarn' }),
  ]);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    fail(err.toString());
    process.exit(1);
  });
