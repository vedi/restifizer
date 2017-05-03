'use strict';

const Promise = require('bluebird');
const request = require('./supertester');

const errHandler = function (err, res) {
  if (err) throw err;
};
const cbWrapper = function (callback) {
  return function (res) {
    callback(null, res);
  };
};


module.exports = {
  getPromise(path) {
    return Promise.fromNode((callback) => {
      request.get(path).expect(cbWrapper(callback)).end(errHandler);
    });
  },
  postPromise(path, data) {
    return Promise.fromNode((callback) => {
      request.post(path).send(data).expect(cbWrapper(callback)).end(errHandler);
    });
  },
  putPromise(path, data) {
    return Promise.fromNode((callback) => {
      request.put(path).send(data).expect(cbWrapper(callback)).end(errHandler);
    });
  },
  patchPromise(path, data) {
    return Promise.fromNode((callback) => {
      request.patch(path).send(data).expect(cbWrapper(callback)).end(errHandler);
    });
  },
  delPromise(path) {
    return Promise.fromNode((callback) => {
      request.del(path).expect(cbWrapper(callback)).end(errHandler);
    });
  },
};
