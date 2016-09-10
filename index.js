'use strict';

var _ = require('lodash');
var RestifizerController = require('./lib/controller');
var ExpressTransport = require('./lib/transports/express.transport');
var config = require('./lib/config');


class Restifizer {
  constructor(options) {
    if (!(this instanceof Restifizer)) {
      return new Restifizer(app, options);
    }

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
    controller.bind();
    return this;
  };

}


Restifizer.Controller = RestifizerController;
Restifizer.ExpressTransport = ExpressTransport;

module.exports = Restifizer;
