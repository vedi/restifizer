'use strict';

const mongoose = require('mongoose');

module.exports = function () {
  this.registerHandler('AfterFeatures', (event, callback) => {
    mongoose.connection.db.dropDatabase((err, result) => {
      if (err) {
        console.log(`\n\nCannot drop MongoDB test database!\nError: ${err}`);
      } else {
        console.log('\n\nMongoDB test database successfully removed.');
      }
      mongoose.connection.close();
      callback();
    });
  });
};
