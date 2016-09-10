'use strict';

const path = require('path');
const _ = require('lodash');
const Bb = require('bluebird');

const RestifizerScope = require('./scope');
const DataService = require('./data-service');
const utils = require('./utils');

const requireOptions = utils.requireOptions;

let defaultTransport;

class Controller extends DataService {

  constructor(options) {

    super(options);

    this.transport = options.transport;

    if (this.transport) {
      if (!defaultTransport) {
        defaultTransport = new (require('./transports/express.transport'));
      }

      this.transport = defaultTransport;
    }

    const requiredOptions = ['dataSource', 'path'];
    requireOptions(this, requiredOptions);

    this.actions = this.actions || [];

    // init

    this.defaultOptions = _.merge(
      {
        enabled: true,
        method: 'get',
        priority: 1
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

  createScope(transport) {
    const scope = new RestifizerScope(action, this.contextFactory);
    scope.owner = this;
    scope.transport = transport;
    scope.transportData = {};
  }

  bind(app) {

    if (typeof(this.path) === 'string') {
      this.path = [this.path];
    }
    _.forEach(this.path, (path) => {
      _.forEach(_.sortBy(this.actions, 'priority'), (action) => {
        try {
          if (action.enabled) {
            if (typeof(action.method) === 'string') {
              action.method = [action.method];
            }
            _.forEach(action.method, (method) => {

              action.transport.addRoute(method, path, action,
                Bb
                  .try(() => {
                    return action.handler.call(action, scope);
                  })
                  .then((data) => {
                    action.setResData(data, scope);
                  })
                  .catch((err) => {
                    action.setResError(err, scope);
                  })
                  .then(() => {
                    action.sendResult(scope);
                  })
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

  setResData(data, scope) {
    scope.transport.setResData(data, scope);
  }

  setResError(err, scope, log, controllerParseError, dsParseError) {

    log = log || this.log;
    controllerParseError = controllerParseError || this.parseError;
    dsParseError = dsParseError || this.dataSource.parseError;

    scope.transport.setResError(err, scope, log, controllerParseError, dsParseError);
  };


  sendResult(scope) {
    scope.transport.sendResult(scope.restfulResult);
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
    action.name = actionKey;
    action.priority = action.priority || 1;
    action.__proto__ = this;

    if (!_.isFunction(action.handler)) {
      action.handler = action[action.handler || actionKey];
    }

    if (!_.isFunction(action.handler)) {
      throw new Error(`Wrong handler for ${actionKey}`);
    }

    return action;
  }
}

Controller.ACTIONS = RestifizerScope.ACTIONS;

module.exports = Controller;