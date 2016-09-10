'use strict';

const path = require('path');
const _ = require('lodash');
const HTTP_STATUSES = require('http-statuses');


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
};


module.exports.resolveProp = resolveProp;
module.exports.setProp = setProp;
module.exports.requireOptions = requireOptions;
module.exports.CommonController = CommonController;