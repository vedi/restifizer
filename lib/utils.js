/**
 * Created by vedi on 3/11/14.
 */

var _         = require('lodash');
var util      = require('util');

var HTTP_STATUSES = {
    OK: {code: 200, message: 'OK'},
    CREATED: {code: 201, message: 'Created'},
    BAD_REQUEST: {code: 400, message: 'Bad Request'},
    UNAUTHORIZED: {code: 401, message: 'Unauthorized'},
    FORBIDDEN: {code: 403, message: 'Forbidden'},
    NOT_FOUND: {code: 404, message: 'Not Found'},
    INTERNAL_ERROR: {code: 500, message: 'Internal Server Error'}
};

// Helper function to correctly set up the prototype chain, for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
var extend = function(protoProps, staticProps) {
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

function HttpError(httpStatus, message, details) {
  Error.call(this, message || httpStatus.message);
  Error.captureStackTrace(this, HttpError); //super helper method to include stack trace in error object
  this.name = this.constructor.name;
  this.httpStatus = httpStatus;
  this.details = details;

}

util.inherits(HttpError, Error);

HttpError.HTTP_STATUSES = HTTP_STATUSES;

module.exports.HTTP_STATUSES  = HTTP_STATUSES;
module.exports.HttpError      = HttpError;
module.exports.extend         = extend;