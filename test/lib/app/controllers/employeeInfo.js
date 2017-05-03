/**
 * Created by igor on 13.10.15.
 */

'use strict';

const _ = require('lodash');
const Employee = require('../models/employee');
const BaseController = require('./base.controller');

class EmployeeInfoController extends BaseController {
  constructor(options) {
    options = options || {};
    _.assign(options, {
      dataSource: {
        type: 'mongoose',
        options: {
          model: Employee,
        },
      },
      path: '/api/employeesInfo',
      defaultFields: [
        'name',
        'lastName',
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

module.exports = EmployeeInfoController;
