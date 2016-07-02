'use strict';

var path = require('path');
var _ = require('lodash');

var RestifizerScope = require('./scope');
var DataService = require('./data-service');
var utils = require('./utils');

var requireOptions = utils.requireOptions;
var CommonController = utils.CommonController;
var setResData = utils.setResData;

class Controller extends DataService {

  constructor(options) {
    
    super(options);

    var requiredOptions = ['dataSource', 'path'];
    requireOptions(this, requiredOptions);

    this.actions = this.actions || [];

    // init

    this.actions.default = this.actions.default || {};

    this.defaultOptions = _.assign(
      {
        enabled: true,
        method: 'get'
      },
      this.actions.default
    );

    this.restActions = {};

    this.actions.select = _.defaults(this.actions.select || {}, this.actions.default);
    this.restActions.select = _.assign(
      {
        method: ['get', 'head'],
        handler: 'select',
        name: 'select',
        path: ''
      },
      this.actions.select
    );

    this.actions.count = _.defaults(this.actions.count || {}, this.actions.select);
    this.restActions.count = _.assign(
      {
        method: ['get', 'head'],
        handler: 'count',
        name: 'count',
        path: 'count'
      },
      this.actions.count
    );

    this.actions.selectOne = _.defaults(this.actions.selectOne || {}, this.actions.select);
    this.restActions.selectOne = _.assign(
      {
        method: ['get', 'head'],
        handler: 'selectOne',
        name: 'selectOne',
        path: ':' + this.idField
      },
      this.actions.selectOne
    );

    this.actions.insert = _.defaults(this.actions.insert || {}, this.actions.default);
    this.restActions.insert = _.assign(
      {
        method: 'post',
        handler: 'insert',
        name: 'insert',
        path: ''
      },
      this.actions.insert
    );

    this.actions.update = _.defaults(this.actions.update || {}, this.actions.insert);
    this.restActions.update = _.assign(
      {
        method: 'patch',
        handler: 'update',
        name: 'update',
        path: ':' + this.idField
      },
      this.actions.update
    );

    this.actions.replace = _.defaults(this.actions.replace || {}, this.actions.update);
    this.restActions.replace = _.assign(
      {
        method: 'put',
        handler: 'replace',
        name: 'replace',
        path: ':' + this.idField
      },
      this.actions.replace
    );

    this.actions.delete = _.defaults(this.actions.delete || {}, this.actions.update);
    this.restActions.delete = _.assign(
      {
        method: 'delete',
        handler: 'delete',
        name: 'delete',
        path: ':' + this.idField
      },
      this.actions.delete
    );

    this.actions = _.omit(this.actions,
      'default', 'select', 'count', 'selectOne', 'insert', 'replace', 'update', 'delete');
    _.forEach(this.actions, (action, actionKey) => {
      if (typeof(action) !== 'object') {
        // interpret it as bool
        action = {
          enabled: !!action
        };
        this.actions[actionKey] = action;
      }
      _.defaults(action, this.defaultOptions);
      action.path = action.path || actionKey;
      action.handler = action.handler || actionKey;
      action.name = actionKey;
    });
  }

  bind(app) {

    if (typeof(this.path) === 'string') {
      this.path = [this.path];
    }
    _.forEach(this.path, (path) => {
      _.forEach(_.union(_.values(this.actions), _.values(this.restActions)), (action) => {
        try {
          if (action.enabled) {
            if (typeof(action.method) === 'string') {
              action.method = [action.method];
            }
            _.forEach(action.method, (method) => {
              app[method](path + '/' + action.path,
                this.getAuth(action),
                (req, res, next) => {
                  // TODO: Implement payload for methods
                  var scope = new RestifizerScope(action.name, this.contextFactory);
                  scope.req = req;
                  scope.res = res;
                  scope.model = {};
                  
                  this[action.handler](scope)
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
            this.log.error('Set route for action: ' + action.name + ' and path ' + path + '/' + action.path);
            this.log.error('Error', err);
          } else {
            console.log('Set route for action: ' + action.name + ' and path ' + path + '/' + action.path);
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
}

Controller.ACTIONS = RestifizerScope.ACTIONS;
Controller.prototype.getAuth = CommonController.getAuth;

module.exports = Controller;