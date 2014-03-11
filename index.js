var restful = require("./lib/restful");

module.exports.Restifizer = Restifizer;
module.exports.HTTP_STATUSES = require("./lib/utils").HTTP_STATUSES;

function Restifizer(app, options) {
  this.app = app;
  this.restifizerOptions = options || {};
  if (this.restifizerOptions.config) {
    this.restifizerOptions.config = {defaultPerPage: 25, maxPerPage: 100, redisKeyPrefix: "trigger"};
  }
}

Restifizer.prototype.createController = function (options) {
  return restful.controller(options, this.restifizerOptions);
};

Restifizer.prototype.createFileFieldController = function (options) {
  return restful.fileFieldController(options, this.restifizerOptions);
};

Restifizer.prototype.addController = function (options) {
  this.bind(this.createController(options));
  return this;
};

Restifizer.prototype.addFileFieldController = function (options) {
  this.bind(this.createFileFieldController(options));
  return this;
};

Restifizer.prototype.bind = function (controller) {
  controller.bind(this.app);
  return this;
};


