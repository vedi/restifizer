'use strict';

var path = require('path');
var _ = require('lodash');

var RestifizerScope = require('./scope');
var DataService = require('./data-service');
var utils = require('./utils');

var requireOptions = utils.requireOptions;
var CommonController = utils.CommonController;

class Controller extends DataService {

  constructor(options) {

    super(options);

    var requiredOptions = ['dataSource', 'path'];
    requireOptions(this, requiredOptions);

    this.actions = this.actions || [];

    // init

    this.defaultOptions = _.merge(
      {
        enabled: true,
        method: 'get'
      },
      this.actions.default || {}
    );

    this.actions.select = _.merge(
      {},
      this.actions.default,
      {
        method: ['get', 'head'],
        handler: 'select',
        name: 'select',
        path: ''
      },
      this.actions.select
    );

    this.actions.count = _.merge(
      {},
      this.actions.select,
      {
        method: ['get', 'head'],
        handler: 'count',
        name: 'count',
        path: 'count'
      },
      this.actions.count
    );

    this.actions.selectOne = _.merge(
      {},
      this.actions.select,
      {
        method: ['get', 'head'],
        handler: 'selectOne',
        name: 'selectOne',
        path: ':' + this.idField
      },
      this.actions.selectOne
    );

    this.actions.insert = _.merge(
      {},
      this.actions.default,
      {
        method: 'post',
        handler: 'insert',
        name: 'insert',
        path: ''
      },
      this.actions.insert
    );

    this.actions.update = _.merge(
      {},
      this.actions.insert,
      {
        method: 'patch',
        handler: 'update',
        name: 'update',
        path: ':' + this.idField
      },
      this.actions.update
    );

    this.actions.replace = _.merge(
      {},
      this.actions.update,
      {
        method: 'put',
        handler: 'replace',
        name: 'replace',
        path: ':' + this.idField
      },
      this.actions.replace
    );

    this.actions.delete = _.merge(
      {},
      this.actions.update,
      {
        method: 'delete',
        handler: 'delete',
        name: 'delete',
        path: ':' + this.idField
      },
      this.actions.delete
    );

    delete this.actions.default;

    this.actions = _.mapValues(this.actions, (action, actionKey) => {
      return this.normalizeAction(action, actionKey);
    });

    _.each(options.plugins, (pluginData) => {
      pluginData.plugin(this, pluginData.options);
    });
  }

  bind(app) {

    if (typeof(this.path) === 'string') {
      this.path = [this.path];
    }
    _.forEach(this.path, (path) => {
      _.forEach(this.actions, (action) => {
        try {
          if (action.enabled) {
            if (typeof(action.method) === 'string') {
              action.method = [action.method];
            }
            _.forEach(action.method, (method) => {
              app[method](path + '/' + action.path,
                this.getAuth(action),
                (req, res, next) => {
                  var scope = new RestifizerScope(action, this.contextFactory);
                  scope.owner = this;
                  scope.req = req;
                  scope.res = res;
                  scope.model = {};

                  action[action.handler](scope)
                    .then((data) => {
                      if (typeof data != 'undefined') {
                        this.setResData(data, scope);
                      }
                      next();
                    })
                    .catch((err) => {
                      this.setResError(err, scope);
                      next();
                    });
                },
                this.resultSender
              );
            });
          }
        } catch (err) {
          if (this.log) {
            this.log.error(`Set route for action: ${action.name} and path ${path}/${action.path}`);
            this.log.error('Error', err);
          } else {
            console.log((`Set route for action: ${action.name} and path ${path}/${action.path}`));
            console.log('Error', err);
          }

          throw err;
        }
      });
    });
  }

  resultSender(req, res) {
    res.send(res.restfulResult);
  }

  normalizeAction(action, actionKey) {
    if (typeof(action) !== 'object') {
      // interpret it as bool
      action = {
        enabled: !!action
      };
    }
    _.defaults(action, this.defaultOptions);
    if (action.path === undefined) {
      action.path = action.path || actionKey;
    }
    action.handler = action.handler || actionKey;
    action.name = actionKey;
    action.__proto__ = this;

    return action;
  }
}

Controller.ACTIONS = RestifizerScope.ACTIONS;
Controller.prototype.getAuth = CommonController.getAuth;

module.exports = Controller;