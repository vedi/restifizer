'use strict';

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Restifizer = require('../../../index.js');

const config = require('./config');

mongoose.connect(config.mongoose.connectionString, (err) => {
  if (err) {
    console.error('Cannot connect to mongo');
    return console.log(err);
  }
});

const app = express();
app.use(bodyParser.json());

const restifizer = new Restifizer(app, {});
restifizer.addController(require('./controllers/employee'));
restifizer.addController(require('./controllers/employeeInfo'));
restifizer.addController(require('./controllers/contact'));
restifizer.addController(require('./controllers/agent'));
restifizer.addController(require('./controllers/mission'));

module.exports = app;
