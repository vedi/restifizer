/**
 * Created by vedi on 08/07/16.
 */

'use strict';

const chakram = require('chakram');

const config = require('../config');
const specHelper = require('../spec-helper');

const { expect } = chakram;

describe('User profile', () => {
  const user = specHelper.getFixture(specHelper.FIXTURE_TYPES.USER);

  describe('Sign up', () => {
    let response;

    before('send post', () => chakram
      .post(`${config.baseUrl}/api/users`, user)
      .then((result) => {
        response = result;
      }));

    it('should return status 201', () => expect(response).to.have.status(201));

    it('should contain _id', () => {
      user._id = response.body._id;
      return expect(response.body._id).to.exist;
    });
  });

  describe('Get List', () => {
    let response;

    before('send request', () => chakram
      .get(`${config.baseUrl}/api/users`, {})
      .then((result) => {
        response = result;
      }));

    it('should return status 200', () => {
      expect(response).to.have.status(200);
    });
  });

  describe('Get My Profile', () => {
    let response;

    before('send request', () => chakram
      .get(`${config.baseUrl}/api/users/${user._id}`, {})
      .then((result) => {
        response = result;
      }));

    it('should return status 200', () => {
      expect(response).to.have.status(200);
    });

    it('should be the same _id', () => {
      expect(response).to.have.json('_id', user._id);
    });

    it('should be the same username', () => {
      expect(response).to.have.json('username', user.username);
    });
  });

  describe('Change Profile', () => {
    const NEW_VALUE = 'new-username';

    let response;

    before('send request', () => chakram
      .patch(
        `${config.baseUrl}/api/users/${user._id}`,
        {
          username: NEW_VALUE,
        },
        {},
      )
      .then((result) => {
        response = result;
      }));

    it('should return status 200', () => {
      expect(response).to.have.status(200);
    });

    it('should change username', () => {
      expect(response).to.have.json('username', NEW_VALUE);
    });
  });

  describe('Remove Profile', () => {
    let response;

    before('send request', () => chakram
      .delete(`${config.baseUrl}/api/users/${user._id}`, {}, {})
      .then((result) => {
        response = result;
      }));

    it('should return status 204', () => {
      expect(response).to.have.status(204);
    });
  });

  after('remove user', () => specHelper.removeUser(user));
});
