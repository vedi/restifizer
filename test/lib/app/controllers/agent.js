/**
 * Created by igor on 20.10.15.
 */
'use strict';

var MongooseDataSource = require('restifizer-mongoose-ds');
var Agent = require('../models/agent');
var BaseController = require('./base');

module.exports = BaseController.extend({
    dataSource: new MongooseDataSource(Agent),
    path: '/api/agents',
    fields: [
        'name',
        'lastName',
        'phones',
        'emails',
        'actionsCheck'
    ],
    qFields: [
        '_id',
        'name',
        'lastName',
        'emails'
    ],
    post: function (resource, req, res, callback) {
        resource.actionsCheck = {
            isSelect: req.restifizer.isSelect(),
            isChanging: req.restifizer.isChanging(),
            isInsert: req.restifizer.isInsert(),
            isUpdate: req.restifizer.isUpdate(),
            isDelete: req.restifizer.isDelete(),
            isSelectOne: req.restifizer.isSelectOne(),
            isReplace: req.restifizer.isReplace(),
            isCount: req.restifizer.isCount()
        };

        callback(null, resource);
    }
});