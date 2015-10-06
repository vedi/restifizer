'use strict';

var BaseController = require('./base');
var SequelizeDataSource = require('restifizer-sequelize-ds');
var Contact = require('../models/contact');

module.exports = BaseController.extend({
	dataSource: new SequelizeDataSource(Contact),
	path: '/api/contacts',
	fields: [
		'id',
		'username',
		'name',
		'lastName'
	],
	qFields: [
		'name',
		'lastName'
	]
});