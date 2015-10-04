'use strict';

var config = require('../../lib/app/config').mongoose;
var mongoose = require('mongoose');

module.exports = function () {
	this.registerHandler('AfterFeatures', function (event, callback) {  
	    mongoose.connect(config.connectionString, function (err) {
			if (err) {
				console.log('\n\nCannot connect to mongo!\nError: ' + err);
				return callback();
			} 
			mongoose.connection.db.dropDatabase(function (err, result) {
				if (err) {
					console.log('\n\nCannot drop test database!\nError: ' + err);
				} else {
					console.log('\n\nTest database succesfully removed.');
				}				
				callback();
			});
		});	    
	});
};