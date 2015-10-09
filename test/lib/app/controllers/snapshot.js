/**
 * Created by igor on 07.10.15.
 */
'use strict';

var BaseFileController = require('./base.file');
var Snapshot = require('../models/snapshot');
var MongooseDataSource = require('restifizer-mongoose-ds');

module.exports = BaseFileController.extend({
    dataSource: new MongooseDataSource(Snapshot),
    path: '/api/snapshots/:_id/picture',
    fileField: 'picture',
    supportedMethods: ['post', 'put', 'get', 'del']
});