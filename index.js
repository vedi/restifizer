'use strict';
var
  RestifizerController = require("./lib/restifizer");


function Restifizer(app, options) {
  this.app = app;
  this.restifizerOptions = options || {};
  if (!this.restifizerOptions.config) {
    this.restifizerOptions.config = {defaultPerPage: 25, maxPerPage: 100};
  }
}

Restifizer.prototype.createController = function (Controller) {
  return new Controller(this.restifizerOptions);
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
