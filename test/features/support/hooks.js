'use strict';

var request = require('../../lib/promised-request-json');
var config = require('../../lib/app/config').express;

module.exports = function () {
	this.Before(function (callback) {
		this.restClient = request.createClient('http://0.0.0.0:' + config.port);

        callback();
	});
};