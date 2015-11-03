/**
 * Created by igor on 20.10.15.
 */
'use strict';

var Agent = require('../models/agent');
var BaseController = require('./base');

module.exports = BaseController.extend({
    dataSource: {
        type: 'mongoose',
        options: {
          model: Agent
        }
    },
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
    post: function (model, scope) {
        model.actionsCheck = {
            isSelect: scope.isSelect(),
            isChanging: scope.isChanging(),
            isInsert: scope.isInsert(),
            isUpdate: scope.isUpdate(),
            isDelete: scope.isDelete(),
            isSelectOne: scope.isSelectOne(),
            isReplace: scope.isReplace(),
            isCount: scope.isCount()
        };

        return model;
    }
});