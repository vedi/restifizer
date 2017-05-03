'use strict';

const _ = require('lodash');

const Restifizer = require('../../../../index.js');

class BaseController extends Restifizer.Controller {
  constructor(options) {
    const defaultAction = {
      default: {
        enabled: true,
      },
    };

    options = options || { actions: defaultAction };
    options.actions = options.actions || defaultAction;

    super(options);
  }

  static createAction(options) {
    return _.defaults(options, defaultAction);
  }
}

module.exports = BaseController;
