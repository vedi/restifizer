'use strict';

var Promise = require('bluebird');
var request = require('./supertester');

var errHandler = function(err, res){
    if (err) throw err;
};
var cbWrapper = function (callback) {
    return function (res) {
        callback(null, res);
    };
};


module.exports = {
    getPromise: function (path) {
        return Promise.fromNode(function (callback) {
            request.get(path).expect(cbWrapper(callback)).end(errHandler);
        });
    },
    postPromise: function (path, data) {
        return Promise.fromNode(function (callback) {
            request.post(path).send(data).expect(cbWrapper(callback)).end(errHandler);
        });
    },
    putPromise: function (path, data) {
        return Promise.fromNode(function (callback) {
            request.put(path).send(data).expect(cbWrapper(callback)).end(errHandler);
        });
    },
    patchPromise: function (path, data) {
        return Promise.fromNode(function (callback) {
            request.patch(path).send(data).expect(cbWrapper(callback)).end(errHandler);
        });
    },
    delPromise: function (path) {
        return Promise.fromNode(function (callback) {
            request.del(path).expect(cbWrapper(callback)).end(errHandler);
        });
    }
};