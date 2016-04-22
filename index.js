'use strict';

var _ = require('lodash');
var RestifizerController = require('./lib/restifizer');
var config = require('./lib/config');


function Restifizer(app, options) {
  if (!(this instanceof Restifizer)) {
    return new Restifizer(app, options);
  }

  this.app = app;
  this.restifizerOptions = options || {};
  if (!this.restifizerOptions.config) {
    this.restifizerOptions.config = config;
  }
}

Restifizer.prototype.createController = function (Controller) {
  return new Controller(_.clone(this.restifizerOptions));
};

Restifizer.prototype.addController = function (Controller) {
  this.bind(this.createController(Controller));
  return this;
};

Restifizer.prototype.bind = function (controller) {
  controller.bind(this.app);
  return this;
};

Restifizer.Controller = RestifizerController;

module.exports = Restifizer;
