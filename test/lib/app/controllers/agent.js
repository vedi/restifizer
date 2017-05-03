/**
 * Created by igor on 20.10.15.
 */

'use strict';

const _ = require('lodash');
const Agent = require('../models/agent');
const BaseController = require('./base.controller');

class AgentController extends BaseController {
  constructor(options) {
    options = options || {};
    _.assign(options, {
      dataSource: {
        type: 'mongoose',
        options: {
          model: Agent,
        },
      },
      path: '/api/agents',
      fields: [
        'name',
        'lastName',
        'phones',
        'emails',
        'actionsCheck',
      ],
      qFields: [
        '_id',
        'name',
        'lastName',
        'emails',
      ],
      post(model, scope) {
        model.actionsCheck = {
          isSelect: scope.isSelect(),
          isChanging: scope.isChanging(),
          isInsert: scope.isInsert(),
          isUpdate: scope.isUpdate(),
          isDelete: scope.isDelete(),
          isSelectOne: scope.isSelectOne(),
          isReplace: scope.isReplace(),
          isCount: scope.isCount(),
        };

        return model;
      },
    });

    super(options);
  }
}

module.exports = AgentController;
