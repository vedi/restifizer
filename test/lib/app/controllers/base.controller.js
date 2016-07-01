'use strict';

var _ = require('lodash');

var Restifizer = require('../../../../index.js');

class BaseController extends Restifizer.Controller {
  constructor(options) {
    let defaultAction = {
      'default': {
        enabled: true
      }
    };

    options = options || {actions: defaultAction};
    options.actions = options.actions || defaultAction;

    super(options);
  }

  static createAction(options) {
    return _.defaults(options, defaultAction);
  }
}

module.exports = BaseController;