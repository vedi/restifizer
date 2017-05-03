/**
 * Created by vedi on 10/10/15.
 */

'use strict';

const Restifizer = require('../../../..');

const ExpressTransport = Restifizer.ExpressTransport;

module.exports = (app) => {
  const transport = new ExpressTransport({
    app,
  });
  const restifizer = new Restifizer({
    transports: [transport],
  });

// eslint-disable-next-line global-require
  restifizer.addController(require('../controllers/user.controller'));
};
