'use strict';

var Bb = require('bluebird');
var request = require('request-json');

request.JsonClient.prototype.getPromise = function (path, parse) {
    var _this = this;
    return Bb.fromNode(function (callback) {
        _this.get(path, callback, parse);
    });
};

request.JsonClient.prototype.postPromise = function (path, json, parse) {
    var _this = this;
    return Bb.fromNode(function (callback) {
        _this.post(path, json, callback, parse);
    });
};

request.JsonClient.prototype.putPromise = function (path, json, parse) {
    var _this = this;
    return Bb.fromNode(function (callback) {
        _this.put(path, json, callback, parse);
    });
};

request.JsonClient.prototype.patchPromise = function (path, json, parse) {
    var _this = this;
    return Bb.fromNode(function (callback) {
        _this.patch(path, json, callback, parse);
    });
};

request.JsonClient.prototype.delPromise = request.JsonClient.prototype.deletePromise = function (path, parse) {
    var _this = this;
    return Bb.fromNode(function (callback) {
        _this.del(path, callback, parse);
    });
};

module.exports = request;