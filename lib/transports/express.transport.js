/**
 * Created by vedi on 10/09/16.
 */

'use strict';

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

  getQuery(scope) {
    return scope.transportData.req.query;
  }

  getFields(scope) {
    const { fields } = scope.transportData.req.query;
    return fields ? fields.split(',') : undefined;
  }

  getFilter(scope) {
    const { filter } = scope.transportData.req.query;
    return filter ? JSON.parse(filter) : undefined;
  }

  getOrderBy(scope) {
    const { orderBy } = scope.transportData.req.query;
    return orderBy ? JSON.parse(orderBy) : undefined;
  }

  getPagination(scope) {
    const { req } = scope.transportData;
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.perPage || req.query.per_page, 10);

    return {
      page,
      limit,
    };
  }

  /**
   * Returns handler for authentication.
   * @param action
   * @returns function to handle
   */
  // eslint-disable-next-line no-unused-vars
  getAuth(action) {
    return (req, res, callback) => {
      callback();
    };
  }

  addRoute(controller, method, paths, action, handlerFn) {
    paths.forEach((path) => {
      this.app[method](
        `${path}/${action.path}`,
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
        },
      );
    });
  }

  removeRoute(method, paths, action) {
    paths.forEach((path) => {
      for (let i = 0; i < this.app.routes[method].length; i += 1) {
        if (this.app.routes[method][i].path === `${path}/${action.path}`) {
          this.app.routes[method].splice(i, 1);
        }
      }
    });
  }

  setResData(data, scope, statusCode) {
    const { transportData } = scope;
    const { res } = transportData;

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
    const { transportData } = scope;
    const { limit, page } = pagination;
    const initialUrl = transportData.req.url;
    const cleanedUrl = initialUrl
      .replace(`perPage=${limit}`, '')
      .replace(`page=${page}`, '')
      .replace('&&', '&')
      .replace('&&', '&')
      .replace('?&', '?');

    const fullURL = `${transportData.req.protocol}://${transportData.req.get('host')}${cleanedUrl}`;
    const links = {};
    // add prev
    if (page > 1) {
      let prevLink = `${fullURL}&page=${page - 1}&perPage=${limit}`;
      prevLink = prevLink
        .replace('&&', '&')
        .replace('?&', '?');
      links.prev = prevLink;
    }
    if (currentLength >= limit) {
      let nextLink = `${fullURL}&page=${page + 1}&perPage=${limit}`;
      nextLink = nextLink
        .replace('&&', '&')
        .replace('?&', '?');
      links.next = nextLink;
    }
    transportData.res.links(links);
  }
}

module.exports = ExpressTransport;
