'use strict';

var Employee = require('../models/employee');
var BaseController = require('./base');

module.exports = BaseController.extend({
	dataSource: {
		type: 'mongoose',
		options: {
			model: Employee
		}
	},
	path: '/api/employees',
	fields: [
		'name',
		'lastName',
		'phones',
		'emails',
		'hiredAt',
		'firedAt'
	],
	qFields: [
		'name',
		'lastName',
		'emails'
	]
});