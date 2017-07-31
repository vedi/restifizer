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
    this.controllers = [];
  }

  createController(Controller) {
    return new Controller(_.clone(this.restifizerOptions));
  }

  addController(Controller) {
    const controller = this.createController(Controller);
    this.controllers.push(controller);
    this.bind(controller);
    return this;
  }

  removeController(controller) {
    this.unbind(controller);
    this.controllers.splice(this.controllers.indexOf(controller), 1);
    return this;
  }

  bind(controller) {
    controller.bind();
    return this;
  }

  unbind(controller) {
    controller.unbind();
    return this;
  }
}

Restifizer.Controller = RestifizerController;
Restifizer.ExpressTransport = ExpressTransport;
Restifizer.WampTransport = WampTransport;
Restifizer.SocketIoTransport = SocketIoTransport;
Restifizer.WsTransport = WsTransport;

module.exports = Restifizer;
