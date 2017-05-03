'use strict';

const _ = require('lodash');

const Employee = require('../models/employee');
const BaseController = require('./base.controller');

class EmployeeController extends BaseController {
  constructor(options) {
    options = options || {};
    _.assign(options, {
      dataSource: {
        type: 'mongoose',
        options: {
          model: Employee,
        },
      },
      path: '/api/employees',
      fields: [
        'name',
        'lastName',
        'phones',
        'emails',
        'hiredAt',
        'firedAt',
      ],
      qFields: [
        'name',
        'lastName',
        'emails',
      ],
    });

    super(options);
  }
}

module.exports = EmployeeController;
