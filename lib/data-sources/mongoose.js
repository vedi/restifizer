'use strict';

const MongooseDataSource = require('restifizer-mongoose-ds');

module.exports = (options) => new MongooseDataSource(options.model);
