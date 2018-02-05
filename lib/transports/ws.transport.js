/**
 * Created by vedi on 10/09/16.
 */

'use strict';

const handlers = {};
let subscribed = false;

class WsTransport {
  constructor(options) {
    this.transportName = 'ws';
    this.wss = options.wss;
    this.prefix = options.prefix || 'restifizer';

    if (!subscribed) {
      this.wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          try {
            if (typeof message === 'string') {
              message = JSON.parse(message);
            }
            if (!Array.isArray(message) || message.length === 0 || message[0] !== this.prefix) {
              return;
            }
            const payload = message.length > 1 ? message[1] : {};
            this.handle(ws, payload);
          } catch (err) {
            ws.send(JSON.stringify(['error', err]));
          }
        });
      });
      subscribed = true;
    }
  }

  addRoute(controller, method, paths, action, handlerFn) {
    handlers[`${method}:${paths[0]}${action.path.length > 0 ? '/' : ''}${action.path}`] = (ws, payload) => {
      const scope = action.createScope(controller, this);

      payload.params = payload.params || {};

      scope.transportData.socket = ws;
      scope.transportData.payload = payload;
      scope.transportData.result = {};

      handlerFn(scope)
        .then(() => {
          ws.send(JSON.stringify([this.prefix,
            { method, path: paths[0], result: scope.transportData.result }]));
        });
    };
  }

  removeRoute(method, paths, action) {
    delete handlers[`${method}:${paths[0]}${action.path.length > 0 ? '/' : ''}${action.path}`];
  }

  pre() {
  }

  post() {
  }

  getQ(scope) {
    return scope.transportData.payload.q;
  }

  getBody(scope) {
    return scope.transportData.payload.body;
  }

  getParams(scope) {
    return scope.transportData.payload.params;
  }

  getQuery(scope) {
    return scope.transportData.payload.query;
  }

  getFields(scope) {
    return scope.transportData.payload.fields;
  }

  getFilter(scope) {
    return scope.transportData.payload.filter;
  }

  getOrderBy(scope) {
    return scope.transportData.payload.orderBy;
  }

  getPagination(scope) {
    return scope.transportData.payload.pagination;
  }

  setResData(data, scope, statusCode) {
    if (typeof data !== 'undefined') {
      scope.restfulResult = data;
    }
    scope.statusCode = statusCode;
  }

  sendResult(result, scope) {
    result = result || scope.restfulResult;
    scope.transportData.result.body = result;
    scope.transportData.result.statusCode = scope.statusCode;
  }

  handle(socket, payload) {
    const handler = handlers[payload.route];
    if (!handler) {
      throw new Error(`Unhandled route: ${payload.route}`);
    }

    handler(socket, payload);
  }
}

module.exports = WsTransport;
