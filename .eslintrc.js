'use strict';

module.exports = {
  extends: 'airbnb-base',
  rules: {
    'class-methods-use-this': 0,
    'consistent-return': 0,
    'function-paren-newline': 0,
    'no-else-return': 0,
    'no-param-reassign': 0,
    'no-shadow': 0,
    'no-underscore-dangle': 0,
    'object-curly-newline': 0,
    'strict': ['error', 'global'],
  },
  parserOptions: {
    sourceType: 'script',
  },

  settings: {
    'import/resolver': {
      node: {
        moduleDirectory: [
          'node_modules',
          '.',
        ]
      }
    }
  }
};
