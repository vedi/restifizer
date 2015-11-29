'use strict';
/**
 * Created by vedi on 3/11/14.
 */

var
  _ = require('lodash'),
  path = require('path'),
  HTTP_STATUSES = require('http-statuses');

// Helper function to correctly set up the prototype chain, for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
var extend = function extend(protoProps, staticProps) {
  var parent = this;
  var child;

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent's constructor.
  if (protoProps && _.has(protoProps, 'constructor')) {
    child = protoProps.constructor;
  } else {
    child = function() {
      return parent.apply(this, arguments);
    };
  }

  // Add static properties to the constructor function, if supplied.
  _.extend(child, parent, staticProps);

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function.
  var Surrogate = function(){ this.constructor = child; };
  Surrogate.prototype = parent.prototype;
  child.prototype = new Surrogate;

  // Add prototype properties (instance properties) to the subclass,
  // if supplied.
  if (protoProps) _.extend(child.prototype, protoProps);

  // Set a convenience property in case the parent's prototype is needed
  // later.
  child.__super__ = parent.prototype;

  return child;
};

var resolveProp = function resolveProp(obj, stringPath) {
  stringPath = stringPath.replace(/\[(\w+)]/g, '.$1');  // convert indexes to properties
  stringPath = stringPath.replace(/^\./, '');           // strip a leading dot
  var pathArray = stringPath.split('.');
  while (pathArray.length) {
    var pathItem = pathArray.shift();
    if (pathItem in obj) {
      obj = obj[pathItem];
    } else {
      return;
    }
  }
  return obj;
};

var setProp = function setProp(obj, stringPath, value, force) {
  stringPath = stringPath.replace(/\[(\w+)]/g, '.$1');  // convert indexes to properties
  stringPath = stringPath.replace(/^\./, '');           // strip a leading dot
  var pathArray = stringPath.split('.');
  while (pathArray.length - 1) {
    var pathItem = pathArray.shift();
    if (pathItem in obj) {
      obj = obj[pathItem];
    } else {
      if (force) {
        obj = obj[pathItem] = {};
      } else {
        return;
      }
    }
  }
  return obj[pathArray.length ? pathArray[0] : stringPath] = value;
};

var requireOptions = function requireOptions(options, requireOptionKeys) {
  for (var i = 0; i < requireOptionKeys.length; i++) {
    var key = requireOptionKeys[i];
    if (_.isUndefined(options[key])) {
      throw new TypeError('"' + key  + '" is required');
    }
  }
};

var CommonController = {
  /**
   * Returns handler for authentication.
   * @param options options of the current method
   * @returns function to handle
   */
  getAuth: function (options) {
    return function(req, res, callback) {
      callback();
    };
  }
};


var setResData = function setResData(data, scope) {
  if (scope.req.method.toLowerCase() !== 'head') {
    scope.res.restfulResult = data;
  }
};

var setResError = function setResError(err, scope, log, controllerParseError, dsParseError) {
  var errorStatus,
    errorMessage,
    errorDetails;

  if (!err) {
    err = HTTP_STATUSES.INTERNAL_SERVER_ERROR.createError();
  }
  else if (!(err instanceof Error)) {
    err = new Error(err.message, err.details);
  }

  if (err.httpStatus) {
    errorStatus = err.httpStatus;
  } else {
    var parseResult;
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

  scope.res.statusCode = errorStatus.code;
  setResData({error: errorStatus.message, message: errorMessage, details: errorDetails}, scope);
  if (log) {
    log.error('Error(%d): %s: %s', errorStatus.code, errorMessage, errorDetails ? errorDetails : '');
  } else {
    console.log('error: ' + 'Error(' + errorStatus.code + '): ' + errorMessage + ': ' + errorDetails ? errorDetails : '');
  }

  // extract stack data
  var data = {};

  try {
    var stacklist = err.stack.split('\n').slice(3);
    // Stack trace format :
    // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
    var s = stacklist[0], sp = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi
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
  } catch (e) {
    if (log) {
      log.error('Error in error handler!');
    } else {
      console.log('error: ' + 'Error in error handler!');
    }
    data.raw = err.stack;
  }

  if (log) {
    log.error(data);
  } else {
    console.log('error: ' + data);
  }
};

var setResOk = function setResOk(scope, code) {
  scope.res.statusCode = code || HTTP_STATUSES.OK.code;
};

module.exports.extend = extend;
module.exports.resolveProp = resolveProp;
module.exports.setProp = setProp;
module.exports.requireOptions = requireOptions;
module.exports.CommonController = CommonController;
module.exports.setResData = setResData;
module.exports.setResError = setResError;
module.exports.setResOk = setResOk;
