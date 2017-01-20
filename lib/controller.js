'use strict';

const path = require('path');
const _ = require('lodash');
const Bb = require('bluebird');
const HTTP_STATUSES = require('http-statuses');

const RestifizerScope = require('./scope');
const DataService = require('./data-service');
const utils = require('./utils');

const requireOptions = utils.requireOptions;

class Controller extends DataService {

  constructor(options) {

    super(options);

    const requiredOptions = ['dataSource', 'path', 'transports'];
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

  createScope(controller, transport) {
    const scope = new RestifizerScope(this, this.contextFactory);
    scope.owner = controller;
    scope.model = {};
    scope.transport = transport;
    scope.transportData = {};

    return scope;
  }

  bind() {

    if (typeof(this.path) === 'string') {
      this.path = [this.path];
    }
    _.forEach(_.sortBy(this.actions, 'priority'), (action) => {
      try {
        if (action.enabled) {
          if (typeof(action.method) === 'string') {
            action.method = [action.method];
          }
          _.forEach(action.method, (method) => {

            action.transports.forEach((transport) => transport.addRoute(this, method, this.path, action, (scope) => {
                return Bb
                  .try(() => {
                    return action.handler(scope);
                  })
                  .then((data) => {
                    action.setResData(data, scope);
                  })
                  .catch((err) => {
                    action.setResError(err, scope);
                  })
                  .then(() => {
                    action.sendResult(scope);
                  });
              }
            ));
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
  }

  setResData(data, scope, statusCode) {
    if (!statusCode) {
      if (data) {
        statusCode = (scope.newContent ? HTTP_STATUSES.CREATED.code : HTTP_STATUSES.OK.code);
      } else {
        statusCode = HTTP_STATUSES.NO_CONTENT.code;
      }
    }
    scope.transport.setResData(data, scope, statusCode);
  }

  setResError(err, scope, log, controllerParseError, dsParseError) {

    log = log || this.log;
    controllerParseError = controllerParseError || this.parseError;
    dsParseError = dsParseError || this.dataSource.parseError;

    const logError = log ? log.error.bind(log) : console.error.bind(console);

    let errorStatus;
    let errorMessage;
    let errorDetails;

    if (!err) {
      err = HTTP_STATUSES.INTERNAL_SERVER_ERROR.createError();
    } else if (!(err instanceof Error)) {
      err = new Error(err.message, err.details);
    }

    if (err.httpStatus) {
      errorStatus = err.httpStatus;
    } else {
      let parseResult;
      parseResult = controllerParseError && controllerParseError(err);
      if (parseResult) {
        errorStatus = parseResult.status;
        errorMessage = parseResult.message;
        errorDetails = parseResult.details;
      } else {
        parseResult = dsParseError && dsParseError(err);
        if (parseResult) {
          errorStatus = parseResult.status;
          errorMessage = parseResult.message;
          errorDetails = parseResult.details;
        } else {
          errorStatus = HTTP_STATUSES.INTERNAL_SERVER_ERROR;
        }
      }
    }

    errorMessage = errorMessage || err.message;
    errorDetails = errorDetails || err.errorDetails;

    scope.transport.setResData(
      {error: errorStatus.message, message: errorMessage, details: errorDetails}, scope, errorStatus.code);
    logError('Error(%d): %s: %s', errorStatus.code, errorMessage, errorDetails ? errorDetails : '');

    // extract stack data
    const data = {};

    try {
      const stacklist = err.stack.split('\n').slice(3);
      // Stack trace format :
      // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
      const s = stacklist[0], sp = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi
          .exec(s)
        || /at\s+()(.*):(\d*):(\d*)/gi.exec(s);
      if (sp && sp.length === 5) {
        data.method = sp[1];
        data.path = sp[2];
        data.line = sp[3];
        data.pos = sp[4];
        data.file = path.basename(data.path);
        data.stack = stacklist.join('\n');
      } else {
        data.raw = err.stack;
      }
    } catch (err) {
      logError('Error in error handler!');
      data.raw = err.stack;
    }

    logError(data);
  };

  sendResult(scope) {
    scope.transport.sendResult(scope.restfulResult, scope);
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