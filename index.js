var _ = require("lodash");
var restful = require("./lib/restful");

module.exports.Restifizer = Restifizer;
var HTTP_STATUSES = require("./lib/utils").HTTP_STATUSES;
module.exports.HTTP_STATUSES = HTTP_STATUSES;

function Restifizer(app, options) {
  this.app = app;
  this.restifizerOptions = options || {};
  if (this.restifizerOptions.config) {
    this.restifizerOptions.config = {defaultPerPage: 25, maxPerPage: 100, redisKeyPrefix: "trigger"};
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

Restifizer.Controller = restful.Controller;
Restifizer.FileFieldController = restful.FileFieldController;
Restifizer.HTTP_STATUSES = HTTP_STATUSES;