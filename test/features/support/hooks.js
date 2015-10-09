'use strict';

var request = require('../../lib/promised-request-json');
var requestFile = require('../../lib/promised-request-file');
var config = require('../../lib/app/config').express;
var fileConfig = require('../../lib/dal').files.testFile;

module.exports = function () {
	this.Before(function (callback) {
		this.restClient = request.createClient('http://0.0.0.0:' + config.port);
        this.fileRestClient = new requestFile(fileConfig.url, fileConfig.fileFormDataName);

        callback();
	});
};