'use strict';

var _ = require('lodash');
var RestifizerController = require('./lib/controller');
var config = require('./lib/config');


class Restifizer {
  constructor(app, options) {
    if (!(this instanceof Restifizer)) {
      return new Restifizer(app, options);
    }

    this.app = app;
    this.restifizerOptions = options || {};
    if (!this.restifizerOptions.config) {
      this.restifizerOptions.config = config;
    }
  }

  createController(Controller) {
    return new Controller(_.clone(this.restifizerOptions));
  };

  addController(Controller) {
    this.bind(this.createController(Controller));
    return this;
  };

  bind(controller) {
    controller.bind(this.app);
    return this;
  };

}


Restifizer.Controller = RestifizerController;

module.exports = Restifizer;
