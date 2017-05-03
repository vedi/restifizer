'use strict';

const _ = require('lodash');
const BaseController = require('./base.controller');
const Contact = require('../models/contact');

class ContactController extends BaseController {
  constructor(options) {
    options = options || {};
    _.assign(options, {
      dataSource: {
        type: 'sequelize',
        options: {
          model: Contact,
        },
      },
      path: '/api/contacts',
      fields: [
        'id',
        'username',
        'name',
        'lastName',
      ],
      qFields: [
        'name',
        'lastName',
      ],
    });

    super(options);
  }
}

module.exports = ContactController;
