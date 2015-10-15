/**
 * Created by igor on 13.10.15.
 */

'use strict';

var MongooseDataSource = require('restifizer-mongoose-ds');
var Employee = require('../models/employee');
var BaseController = require('./base');

module.exports = BaseController.extend({
    dataSource: new MongooseDataSource(Employee),
    path: '/api/employeesInfo',
    defaultFields: [
        'name',
        'lastName'
    ],
    qFields: [
        'name',
        'lastName',
        'emails'
    ]
});