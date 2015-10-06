'use strict';

var config = require('../../lib/app/config').mongoose;
var mongoose = require('mongoose');

module.exports = function () {
	this.registerHandler('AfterFeatures', function (event, callback) {  
	    mongoose.connect(config.connectionString, function (err) {
			if (err) {
				console.log('\n\nCannot connect to MongoDB!\nError: ' + err);
				console.log('\n\n"npm run test-clear" to clean MySQL database!');
				return callback();
			}
			mongoose.connection.db.dropDatabase(function (err, result) {
				if (err) {
					console.log('\n\nCannot drop MongoDB test database!\nError: ' + err);
				} else {
					console.log('\n\nMongoDB test database successfully removed.');
				}
				console.log('\n\n"npm run test-clear" to clean MySQL database!');
				callback();
			});
		});	    
	});
};