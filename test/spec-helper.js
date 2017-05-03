/**
 * Created by vedi on 08/07/16.
 */

'use strict';

const _ = require('lodash');
const Bb = require('bluebird');
const request = require('request-promise');

const testConfig = require('./config');

const FIXTURE_TYPES = {
  USER: 'user.data',
};

const specHelper = {

  FIXTURE_TYPES,

  get(uri, options) {
    return this.request('GET', uri, undefined, options);
  },
  post(uri, body, options) {
    return this.request('POST', uri, body, options);
  },
  patch(uri, body, options) {
    return this.request('PATCH', uri, body, options);
  },
  put(uri, body, options) {
    return this.request('PUT', uri, body, options);
  },
  delete(uri, body, options) {
    return this.request('DELETE', uri, body, options);
  },
  request(method, uri, body, options) {
    options = Object.assign({
      method,
      uri,
      body,
      resolveWithFullResponse: true,
      // simple: false,
      json: true,
    }, options);

    return request(options);
  },

  getFixture(fixtureType, seed) {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const fixtureProvider = require(`./data/${fixtureType}`);
    if (_.isArray(fixtureProvider)) {
      if (_.isUndefined(seed)) {
        seed = Math.floor(Math.random() * fixtureProvider.length);
      } else if (!_.isNumber(seed) || seed >= fixtureProvider.length) {
        throw new Error(`Wrong seed value: ${seed}`);
      }

      return Object.assign({}, fixtureProvider[seed]);
    } else if (_.isFunction(fixtureProvider)) {
      seed = seed || Math.floor(Math.random() * 1000000);
      return fixtureProvider(seed);
    } else {
      throw new Error(`Unsupported fixture provider: ${fixtureType}`);
    }
  },

  createUser(data) {
    return this
      .post(`${testConfig.baseUrl}/api/users`, data)
      .then((result) => {
        data._id = result.body._id;
        return result.body;
      });
  },

  getUser(userData, data, userId) {
    data = data || userData;
    userId = userId || data._id;
    return this
      .get(`${testConfig.baseUrl}/api/users/${userId}`, {})
      .then((result) => {
        data._id = result.body._id;
        return result.body;
      });
  },

  removeUser(data) {
    return this
      .delete(`${testConfig.baseUrl}/api/users/${data._id}`, {})
      .then(result => result.body);
  },
};

before(() => Bb
  .join(
  ));

module.exports = specHelper;
