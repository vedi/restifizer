'use strict';

var dataSource = require('../../lib/dal/index');
var _ = require('lodash');

function World() {
  this.dataSource = dataSource;

  this.putData = function (keyOrObject, value) {
    if (!this.data) {
      this.data = {};
    }

    this.data[keyOrObject] = value;
  };

  this.putDataFromObject = function (dataObject) {
    var _this = this;
    if (!this.data) {
      this.data = {};
    }
    _.forOwn(dataObject, function (value, key) {
      _this.data[key] = value;
    });
  };

  this.addToQueryString = function (param) {
    if (!this.queryString) {
      this.queryString = [];
    }
    this.queryString.push(param);
  };

  this.addQueryStringToPath = function (path) {
    if (this.queryString && this.queryString.length) {
      return path + '?' + this.queryString.join('&');
    }
    return path;
  };
}

module.exports = function () {
  this.World = World;
};