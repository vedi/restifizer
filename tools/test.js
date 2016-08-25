/**
 * Created by eugene on 25/08/16.
 */

'use strict';

let Mocha = require('mocha');

module.exports = function () {

  // TODO: testing preparations

  // Instantiate a Mocha instance.
  var mocha = new Mocha({
    ui: 'bdd',
    fullTrace: true
  });

  // TODO: populate tests

  // Run the tests.
  mocha.run(function (failures) {
    process.exit(failures);  // exit with non-zero status if there were failures
  });
};

