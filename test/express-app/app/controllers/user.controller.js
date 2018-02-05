/**
 * Created by vedi on 23/08/14.
 */

'use strict';

const Restifizer = require('../../../..');

class UserController extends Restifizer.Controller {
  constructor(options = {}) {
    Object.assign(options, {
      dataSource: {
        type: 'memory',
        options: {
          modelDef: [
            'username',
            'password',
            'createdAt',
            'updatedAt',
          ],
        },
      },
      path: '/api/users',
      fields: [
        'username',
        'password',
        'createdAt',
      ],
      qFields: ['username'],
      readOnlyFields: [
        'createdAt',
        'updatedAt',
      ],
      actions: {
        default: {
          enabled: true,
        },
      },
    });

    super(options);
  }
}

module.exports = UserController;
