'use strict';

const _ = require('lodash');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const bodyParser = require('body-parser');

const routes = require('./routes/index');

const app = express();

/* eslint-disable import/no-dynamic-require, global-require */

app.use(logger('dev'));
app.use(bodyParser.json());

require('./middleware/restifizer')(app);

// init restifizer

app.use('/', routes);

require('./middleware/handle-errors')(app);

/* eslint-enable import/no-dynamic-require, global-require */

module.exports = app;
