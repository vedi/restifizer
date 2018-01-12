/**
 * Created by vedi on 10/09/16.
 */

'use strict';

class WampTransport {
  constructor(options) {
    this.transportName = 'wamp';
    this.routes = {};
    this.session = options.session;
    this.prefix = options.prefix || 'restifizer';
  }

  addRoute(controller, method, paths, action, handlerFn) {
    const currentRoute = `${this.prefix}.${method}.${paths[0]}`;
    this.routes[currentRoute] = this.session.register(currentRoute, (payload) => {
      const scope = action.createScope(controller, this);

      scope.transportData.payload = payload;
      scope.transportData.result = {};

      handlerFn(scope)
        .then(() => scope.transportData.result);
    });
  }

  removeRoute(method, paths) {
    this.session.unregister(this.routes[`${this.prefix}.${method}.${paths[0]}`]);
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
    scope.transportData.result.data = result;
    scope.transportData.result.statusCode = scope.statusCode;
  }
}

module.exports = WampTransport;
