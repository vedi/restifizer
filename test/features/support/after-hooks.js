'use strict';

var mongoose = require('mongoose');

module.exports = function () {
  this.registerHandler('AfterFeatures', function (event, callback) {
    mongoose.connection.db.dropDatabase(function (err, result) {
      if (err) {
        console.log('\n\nCannot drop MongoDB test database!\nError: ' + err);
      } else {
        console.log('\n\nMongoDB test database successfully removed.');
      }
      mongoose.connection.close();
      callback();
    });
  });
};