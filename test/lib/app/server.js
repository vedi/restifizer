'use strict';

var express = require('express');
var http = require('http');
var Restifizer = require('../../../index.js');
var config = require('./config');
var bodyParser = require('body-parser');

var mongoose = require('mongoose');
mongoose.connect(config.mongoose.connectionString, function (err) {
	if (err) {
		console.error('Cannot connect to mongo');
		return console.log(err);
	}

	var app = express();
	app.use(bodyParser.json());
	app.route('/').get(function (req, res) {
		res.end('Restifizer test application.');
	});

	var restifizer = new Restifizer(app, {});
	restifizer.addController(require('./controllers/employee'));
	restifizer.addController(require('./controllers/employeeInfo'));
	restifizer.addController(require('./controllers/contact'));

	var server = http.Server(app);
	server.listen(config.express.port);
	console.log('Test app server is listening on port ', config.express.port);
});