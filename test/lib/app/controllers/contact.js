'use strict';

var BaseController = require('./base');
var Contact = require('../models/contact');

module.exports = BaseController.extend({
	dataSource: {
    type: 'sequelize',
    options: {
      model: Contact
    }
	},
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