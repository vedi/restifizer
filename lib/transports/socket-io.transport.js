/**
 * Created by vedi on 10/09/16.
 */

'use strict';

const handlers = {};
let subscribed = false;

class SocketIoTransport {

  constructor(options) {
    this.transportName = 'socket.io';
    this.sio = options.sio;
    this.prefix = options.prefix || 'restifizer';

    if (!subscribed) {
      this.sio.on('connection', (socket) => {
        socket.on(this.prefix, (payload) => {
          try {
            this.handle(socket, payload);
          } catch (err) {
            socket.emit('error', err);
          }
        });
      });
      subscribed = true;
    }
  }

  addRoute(controller, method, paths, action, handlerFn) {
    handlers[`${method}:${paths[0]}${action.path.length > 0 ? '/' : ''}${action.path}`] = (socket, payload) => {
      const scope = action.createScope(controller, this);

      payload.params = payload.params || {};

      scope.transportData.socket = socket;
      scope.transportData.payload = payload;
      scope.transportData.result = {};

      handlerFn(scope)
        .then(() => {
          socket.emit(this.prefix, { method, path: paths[0], result: scope.transportData.result });
        });
    };
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

module.exports = SocketIoTransport;
