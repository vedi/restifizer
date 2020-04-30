'use strict';

const app = require('./app/express');

app.set('port', process.env.PORT || 3000);

const server = app.listen(app.get('port'), () => {
  // eslint-disable-next-line no-console
  console.log(`Express server listening on port ${server.address().port}`);
});
