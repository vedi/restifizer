'use strict';

const SequelizeDataSource = require('restifizer-sequelize-ds');

module.exports = (options) => new SequelizeDataSource(options.model);
