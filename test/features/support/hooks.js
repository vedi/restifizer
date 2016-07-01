'use strict';

var request = require('../../lib/promised-supertester');

module.exports = function () {
  this.Before(function () {
    this.restClient = request;
  });
};