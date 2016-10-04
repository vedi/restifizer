/**
 * Created by vedi on 10/09/16.
 */

'use strict';

const path = require('path');

class ExpressTransport {

  constructor(options) {
    this.transportName = 'express';
    this.app = options.app;
    this.compatibilityMode = options.compatibilityMode;
  }

  pre(scope) {
    return scope;
  }

  post(scope) {
    if (scope.collection) {
      this._addLinkHeaders(scope.pagination, scope.collection.length, scope);
    }
  }

  getQ(scope) {
    return scope.transportData.req.query.q;
  }

  getBody(scope) {
    return scope.transportData.req.body;
  }

  getParams(scope) {
    return scope.transportData.req.params;
  }

  getFields(scope) {
    const fields = scope.transportData.req.query.fields;
    return fields ? fields.split(',') : undefined;
  }

  getFilter(scope) {
    const filter = scope.transportData.req.query.filter;
    return filter ? JSON.parse(filter) : undefined;
  }

  getOrderBy(scope) {
    const orderBy = scope.transportData.req.query.orderBy;
    return orderBy ? JSON.parse(orderBy) : undefined;
  }

  getPagination(scope) {
    const req = scope.transportData.req;
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.perPage || req.query['per_page']);

    return {
      page,
      limit
    };
  }

  /**
   * Returns handler for authentication.
   * @param action
   * @returns function to handle
   */
  getAuth(action) {
    return function(req, res, callback) {
      callback();
    };
  }

  addRoute(controller, method, paths, action, handlerFn) {
    paths.forEach((path) => {
      this.app[method](path + '/' + action.path,
        this.getAuth(action),
        (req, res) => {
          const scope = action.createScope(controller, this);

          scope.transportData.req = req;
          scope.transportData.res = res;

          if (this.compatibilityMode) {
            scope.req = req;
            scope.res = res;
          }

          handlerFn(scope);
        }
      );
    });
  }

  setResData(data, scope, statusCode) {
    const transportData = scope.transportData;
    const res = transportData.res;

    if (typeof data !== 'undefined') {
      if (transportData.req.method.toLowerCase() !== 'head') {
        scope.restfulResult = data;
        res.restfulResult = data; // we need a way to get it from res
      }
    }

    res.statusCode = statusCode;
  }

  sendResult(result, scope) {
    result = result || scope.restfulResult;
    scope.transportData.res.send(result);
  }

  _addLinkHeaders(pagination, currentLength, scope) {
    const transportData = scope.transportData;
    const page = pagination.page;
    const limit = pagination.limit;
    const initialUrl = transportData.req.url;
    const cleanedUrl = initialUrl
      .replace('perPage=' + limit, '')
      .replace('page=' + page, '')
      .replace('&&', '&')
      .replace('&&', '&')
      .replace('?&', '?');

    const fullURL = transportData.req.protocol + '://' + transportData.req.get('host') + cleanedUrl;
    const links = {};
    // add prev
    if (page > 1) {
      let prevLink = fullURL + '&page=' + (page - 1) + '&perPage=' + limit;
      prevLink = prevLink
        .replace('&&', '&')
        .replace('?&', '?');
      links.prev = prevLink;
    }
    if (currentLength >= limit) {
      let nextLink = fullURL + '&page=' + (page + 1) + '&perPage=' + limit;
      nextLink = nextLink
        .replace('&&', '&')
        .replace('?&', '?');
      links.next = nextLink;
    }
    transportData.res.links(links);
  }
}

module.exports = ExpressTransport;