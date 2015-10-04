'use strict';

var Restifizer = require('../../../../index.js');
var Employee = require('../models/employee');

var BaseController = Restifizer.Controller.extend({
	actions: {
		'default': {
			enabled: true
		}
	}
});

module.exports = BaseController;