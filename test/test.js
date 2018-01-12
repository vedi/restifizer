/**
 * Created by vedi on 08/07/16.
 */

'use strict';

const path = require('path');
const Mocha = require('mocha');


// Instantiate a Mocha instance.
const mocha = new Mocha({
  ui: 'bdd',
  fullTrace: true,
});

mocha.addFile(path.join(__dirname, 'spec/user.spec.js'));

// Run the tests.
mocha.run((failures) => {
  process.exit(failures); // exit with non-zero status if there were failures
});
