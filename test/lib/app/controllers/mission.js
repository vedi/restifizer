/**
 * Created by igor on 20.10.15.
 */
'use strict';

var MongooseDataSource = require('restifizer-mongoose-ds');
var Mission = require('../models/mission');
var BaseController = require('./base');

module.exports = BaseController.extend({
    dataSource: new MongooseDataSource(Mission),
    path: '/api/missions',
    fields: [
        '_id',
        'description',
        'agent'
    ],
    qFields: [
        '_id',
        'description'
    ],
    queryPipe: function (query, scope, callback) {
        return query.populate("agent", callback);
    }
});