'use strict';

var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var Restifizer = require('../../../index.js');

var config = require('./config');

mongoose.connect(config.mongoose.connectionString, function (err) {
    if (err) {
        console.error('Cannot connect to mongo');
        return console.log(err);
    }
});

var app = express();
app.use(bodyParser.json());

var restifizer = new Restifizer(app, {});
restifizer.addController(require('./controllers/employee'));
restifizer.addController(require('./controllers/employeeInfo'));
restifizer.addController(require('./controllers/contact'));

module.exports = app;