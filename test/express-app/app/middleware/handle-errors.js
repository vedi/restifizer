/**
 * Created by vedi on 10/10/15.
 */

'use strict';

const log = console;

module.exports = (app) => {
  // Assume 'not found' in the error msgs is a 404. this is somewhat silly,
  // but valid, you can do whatever you like, set properties, use instanceof etc.
  app.use((err, req, res, next) => {
    // If the error object doesn't exists
    if (!err) {
      return next();
    }

    // Log it
    log.error(err);
    log.error(`Stack: ${err.stack}`);

    // Error page
    res.status(err.status || 500);
    if (req.method === 'HEAD') {
      return res.end();
    }

    const { message, error_description: errorDescription } = err;

    const errorObject = {
      type: err.type || 'Unknown',
      error: err.error || 'Unknown',
      message,
      error_description: errorDescription,
    };

    res.send(errorObject);
  });

  // Assume 404 since no middleware responded
  app.use((req, res) => {
    res.status(404);
    if (req.method === 'HEAD') {
      return res.end();
    }

    res.send({
      type: 'Express',
      error: 'PathNotFound',
      message: 'Not Found',
      url: req.originalUrl,
    });
  });
};
