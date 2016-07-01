'use strict';

var _ = require('lodash');
var BaseController = require('./base.controller');
var Contact = require('../models/contact');

class ContactController extends BaseController {
  constructor(options) {

    options = options || {};
    _.assign(options, {
      dataSource: {
        type: 'sequelize',
        options: {
          model: Contact
        }
      },
      path: '/api/contacts',
      fields: [
        'id',
        'username',
        'name',
        'lastName'
      ],
      qFields: [
        'name',
        'lastName'
      ]
    });

    super(options);
  }
}

module.exports = ContactController;