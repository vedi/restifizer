var _         = require("lodash");
var restful   = require("./lib/restful");
var utils     = require("./lib/utils");

var HTTP_STATUSES = utils.HTTP_STATUSES;
var HttpError     = utils.HttpError;

module.exports.Restifizer     = Restifizer;
module.exports.HTTP_STATUSES  = HTTP_STATUSES;
module.exports.HttpError      = HttpError;

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
Restifizer.HttpError = HttpError;