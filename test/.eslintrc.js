'use strict';

module.exports = {
  rules: {
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'mocha/no-exclusive-tests': 'error',
    'mocha/no-identical-title': 'error',
    'mocha/no-pending-tests': 'warn',
  },
  env: {
    mocha: true,
  },
  plugins: [
    'mocha',
  ],
};
