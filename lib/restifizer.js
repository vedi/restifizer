/**
 * Created by vedi on 02/10/16.
 */
'use strict';

const _ = require('lodash');
const RestifizerController = require('./controller');
const ExpressTransport = require('./transports/express.transport');
const WampTransport = require('./transports/wamp.transport');
const SocketIoTransport = require('./transports/socket-io.transport');
const WsTransport = require('./transports/ws.transport');
const config = require('./config');


class Restifizer {
  constructor(options) {
    this.restifizerOptions = options || {};
    if (!this.restifizerOptions.config) {
      this.restifizerOptions.config = config;
    }
  }

  createController(Controller) {
    return new Controller(_.clone(this.restifizerOptions));
  };

  addController(Controller) {
    this.bind(this.createController(Controller));
    return this;
  };

  bind(controller) {
    controller.bind();
    return this;
  };

}


Restifizer.Controller = RestifizerController;
Restifizer.ExpressTransport = ExpressTransport;
Restifizer.WampTransport = WampTransport;
Restifizer.SocketIoTransport = SocketIoTransport;
Restifizer.WsTransport = WsTransport;

module.exports = Restifizer;
