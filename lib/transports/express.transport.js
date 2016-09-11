/**
 * Created by vedi on 10/09/16.
 */

const path = require('path');
const HTTP_STATUSES = require('http-statuses');

class ExpressTransport {

  constructor(options) {
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
    const limit = req.query.perPage || req.query['per_page'];

    return {
      page,
      limit
    };
  }

  getUser(scope) {
    return scope.transportData.req.user;
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

  addRoute(controller, method, path, action, handlerFn) {
    this.app[method](path + '/' + action.path,
      this.getAuth(action),
      (req, res) => {
        const scope = action.createScope(controller, action.transport);

        scope.transportData.req = req;
        scope.transportData.res = res;

        if (this.compatibilityMode) {
          scope.req = req;
          scope.res = res;
        }
        scope.model = {};

        handlerFn(scope);
      }
    );
  }

  setResData(data, scope, code) {
    const transportData = scope.transportData;
    const res = transportData.res;

    if (typeof data != 'undefined') {
      if (transportData.req.method.toLowerCase() !== 'head') {
        scope.restfulResult = data;
        res.restfulResult = data; // we need a way to get it from res
      }
      res.statusCode = code || (scope.newContent ? HTTP_STATUSES.CREATED.code : HTTP_STATUSES.OK.code);

    } else {
      res.statusCode = code || HTTP_STATUSES.NO_CONTENT.code;
    }
  }

  setResError(err, scope, log, controllerParseError, dsParseError) {

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

    this.setResData({error: errorStatus.message, message: errorMessage, details: errorDetails}, scope, errorStatus.code);
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
  }

  sendResult(result, scope) {
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