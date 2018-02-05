'use strict';

const path = require('path');
const _ = require('lodash');
const Bb = require('bluebird');
const HTTP_STATUSES = require('http-statuses');

const RestifizerScope = require('./scope');
const DataService = require('./data-service');
const utils = require('./utils');

const { requireOptions } = utils;

const ERROR_TYPE = 'restifizer';

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
        priority: 1,
      },
      this.actions.default || {},
    );

    this.actions.select = _.merge(
      {},
      this.actions.default,
      {
        method: ['get', 'head'],
        handler: 'select',
        name: 'select',
        path: '',
      },
      this.actions.select,
    );

    this.actions.distinct = _.merge(
      {},
      _.omit(this.actions.default, 'orderBy'),
      {
        method: ['get', 'head'],
        handler: 'distinct',
        name: 'distinct',
        path: 'distinct/:distinctField'
      },
      this.actions.distinct
    );

    this.actions.count = _.merge(
      {},
      this.actions.select,
      {
        method: ['get', 'head'],
        handler: 'count',
        name: 'count',
        path: 'count',
      },
      this.actions.count,
    );

    this.actions.selectOne = _.merge(
      {},
      this.actions.select,
      {
        method: ['get', 'head'],
        handler: 'selectOne',
        name: 'selectOne',
        path: `:${this.idField}`,
      },
      this.actions.selectOne,
    );

    this.actions.insert = _.merge(
      {},
      this.actions.default,
      {
        method: 'post',
        handler: 'insert',
        name: 'insert',
        path: '',
      },
      this.actions.insert,
    );

    this.actions.update = _.merge(
      {},
      this.actions.insert,
      {
        method: 'patch',
        handler: 'update',
        name: 'update',
        path: `:${this.idField}`,
      },
      this.actions.update,
    );

    this.actions.replace = _.merge(
      {},
      this.actions.update,
      {
        method: 'put',
        handler: 'replace',
        name: 'replace',
        path: `:${this.idField}`,
      },
      this.actions.replace,
    );

    this.actions.delete = _.merge(
      {},
      this.actions.update,
      {
        method: 'delete',
        handler: 'delete',
        name: 'delete',
        path: `:${this.idField}`,
      },
      this.actions.delete,
    );

    delete this.actions.default;

    this.actions = _.mapValues(
      this.actions,
      (action, actionKey) => this.normalizeAction(action, actionKey),
    );

    if (options.plugins) {
      options.plugins.forEach((pluginData) => {
        pluginData.plugin(this, pluginData.options);
      });
    }
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
    if (typeof this.path === 'string') {
      this.path = [this.path];
    }
    _.sortBy(this.actions, 'priority').forEach((action) => {
      try {
        if (action.enabled) {
          if (typeof action.method === 'string') {
            action.method = [action.method];
          }
          action.method.forEach((method) => {
            action.transports.forEach(transport =>
              transport.addRoute(this, method, this.path, action, scope =>
                Bb
                  .try(() => action.handler(scope))
                  .then((data) => {
                    action.setResData(data, scope);
                  })
                  .catch((err) => {
                    action.setResError(err, scope);
                  })
                  .then(() => {
                    action.sendResult(scope);
                  })));
          });
        }
      } catch (err) {
        if (this.log) {
          this.log.error(`Cannot set route for action: ${action.name} and path ${this.path}/${action.path}`);
          this.log.error('Error', err);
        } else {
          // eslint-disable-next-line no-console
          console.error(`Cannot set route for action: ${action.name} and path ${this.path}/${action.path}`);
          // eslint-disable-next-line no-console
          console.error('Error', err);
        }

        throw err;
      }
    });
  }

  unbind() {
    if (typeof this.path === 'string') {
      this.path = [this.path];
    }
    _.sortBy(this.actions, 'priority').forEach((action) => {
      try {
        if (action.enabled) {
          if (typeof action.method === 'string') {
            action.method = [action.method];
          }
          action.method.forEach((method) => {
            action.transports.forEach(transport =>
              transport.removeRoute(method, this.path, action));
          });
        }
      } catch (err) {
        if (this.log) {
          this.log.error(
            `Cannot unset route for action: ${action.name} and path ${this.path}/${action.path}`);
          this.log.error('Error', err);
        } else {
          // eslint-disable-next-line no-console
          console.error(`Cannot unset route for action: ${action.name} and path ${this.path}/${action.path}`);
          // eslint-disable-next-line no-console
          console.error('Error', err);
        }

        throw err;
      }
    });
  }

  setResData(data, scope, statusCode) {
    if (!statusCode) {
      if (typeof data !== 'undefined') {
        statusCode = (scope.newContent ? HTTP_STATUSES.CREATED.code : HTTP_STATUSES.OK.code);
      } else {
        statusCode = HTTP_STATUSES.NO_CONTENT.code;
      }
    }
    scope.transport.setResData(data, scope, statusCode);
  }

  setResError(
    err, scope, log = this.log,
    controllerParseError = this.parseError,
    dsParseError = this.dataSource.parseError,
  ) {
    const {
      type = ERROR_TYPE,
      httpStatus = false,
      error,
      message = httpStatus.message,
      details,
    } = err;
    // eslint-disable-next-line no-console
    const logError = log ? log.error.bind(log) : console.error.bind(console);

    if (!err) {
      err = HTTP_STATUSES.INTERNAL_SERVER_ERROR.createError();
    } else if (!(err instanceof Error)) {
      err = new Error(err.message, err.details);
    }

    const result = {
      type,
      status: httpStatus.code,
      error,
      message,
      details,
    };

    if (!httpStatus) {
      const parseResult = ((controllerParseError && controllerParseError(err)) ||
      (dsParseError && dsParseError(err)));

      if (parseResult) {
        Object.assign(result, parseResult);
        if (result.status.code) {
          result.status = result.status.code;
        }
      } else {
        Object.assign(result, { status: HTTP_STATUSES.INTERNAL_SERVER_ERROR.code });
      }
    }

    scope.transport.setResData(result, scope, result.status);
    logError('Error(%d): %s: %s', result.status, result.message, result.details);

    // extract stack data
    const data = {};

    try {
      const stacklist = err.stack.split('\n').slice(3);
      // Stack trace format :
      // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
      const s = stacklist[0];
      const sp = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi
        .exec(s)
        || /at\s+()(.*):(\d*):(\d*)/gi.exec(s);
      if (sp && sp.length === 5) {
        [, data.method, data.path, data.line, data.pos] = sp;
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
  }

  sendResult(scope) {
    scope.transport.sendResult(scope.restfulResult, scope);
  }

  normalizeAction(action, actionKey) {
    if (typeof (action) !== 'object') {
      // interpret it as bool
      action = {
        enabled: !!action,
      };
    }
    _.defaults(action, this.defaultOptions);
    if (action.path === undefined) {
      action.path = action.path || actionKey;
    }
    action.name = actionKey;
    action.priority = action.priority || 1;
    Object.setPrototypeOf(action, this);

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
