'use strict';

const _ = require('lodash');

function resolveProp(obj, stringPath) {
  stringPath = stringPath.replace(/\[(\w+)]/g, '.$1');  // convert indexes to properties
  stringPath = stringPath.replace(/^\./, '');           // strip a leading dot
  const pathArray = stringPath.split('.');
  while (pathArray.length) {
    const pathItem = pathArray.shift();
    if (pathItem in obj) {
      obj = obj[pathItem];
    } else {
      return;
    }
  }
  return obj;
}

function setProp(obj, stringPath, value, force) {
  stringPath = stringPath.replace(/\[(\w+)]/g, '.$1');  // convert indexes to properties
  stringPath = stringPath.replace(/^\./, '');           // strip a leading dot
  const pathArray = stringPath.split('.');
  while (pathArray.length - 1) {
    const pathItem = pathArray.shift();
    if (pathItem in obj) {
      obj = obj[pathItem];
    } else if (force) {
      obj[pathItem] = {};
      obj = obj[pathItem];
    } else {
      return;
    }
  }
  obj[pathArray.length ? pathArray[0] : stringPath] = value;
  return value;
}

function requireOptions(options, requireOptionKeys) {
  for (let i = 0; i < requireOptionKeys.length; i += 1) {
    const key = requireOptionKeys[i];
    if (_.isUndefined(options[key])) {
      throw new TypeError(`"${key}" is required`);
    }
  }
}

const CommonController = {
};


module.exports.resolveProp = resolveProp;
module.exports.setProp = setProp;
module.exports.requireOptions = requireOptions;
module.exports.CommonController = CommonController;
