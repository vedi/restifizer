'use strict';

const Bb = require('bluebird');
const expect = require('chai').expect;
const resolveProp = require('../../lib/prop-util').resolveProp;

module.exports = function () {
  // Send request
  this.When(/^I send (targeted )?(get|post|put|patch|delete) request to ([^\s]+)$/, function (isTargeted, method, resourceName, callback) {
    const _this = this;
    Bb.try(() => {
      let path = `/api/${resourceName}`;

      if (isTargeted) {
        path += `/${_this.data._id ? _this.data._id : _this.data.id}`;
      }
      switch (method) {
        case 'get':
          return _this.restClient.getPromise(_this.addQueryStringToPath(path));
        case 'post':
          return _this.restClient.postPromise(path, _this.data);
        case 'put':
          return _this.restClient.putPromise(path, _this.data);
        case 'patch':
          return _this.restClient.patchPromise(path, _this.data);
        case 'delete':
          return _this.restClient.delPromise(path);
        default:
          throw new Error(`Unknown method: ${method}`);
      }
    })
      .then((res) => {
        _this.res = res;
        _this.body = res.body;
      })
      .then(callback)
      .catch(callback.fail);
  });

  // Response status
  this.Then(/^I should get (success|fail) with code ([\d]*)$/, function (flag, code, callback) {
    expect(parseInt(code)).to.be.equal(this.res.statusCode);
    callback();
  });

  // Response data analize
  this.Then(/^I get "([^"]*)" with( strict)? value "([^"]*)" in response$/, function (key, strict, value, callback) {
    if (key !== 'undefined') {
      const resolvedProp = resolveProp(this.body, key);

      if (strict) {
        expect(resolvedProp).to.be.equal(value);
      } else {
        expect((resolvedProp ? resolvedProp.toString() : '') == value).to.be.true;
      }
    }
    callback();
  });
  this.Then(/^I get "([^"]*)" with value equals to ([^\s]+) in response$/, function (key, source, callback) {
    const resolvedResponse = resolveProp(this.body, key);
    const resolvedSource = resolveProp(this.dataSource, source);
    expect(resolvedResponse).to.be.equal(resolvedSource);
    callback();
  });
  this.Then(/^I get "([^"]*)" in response$/, function (key, callback) {
    expect(this.body[key]).not.to.be.undefined;
    callback();
  });
  this.Then(/^I get not "([^"]*)" in response$/, function (key, callback) {
    expect(this.body[key]).to.be.undefined;
    callback();
  });
  this.Then(/^I get an array with length equals to ([\d]*) in response$/, function (value, callback) {
    expect(this.body.length).to.be.equal(+value);
    callback();
  });
  this.Then(/^I get "([^"]*)" in the ([\d]*) element with value equals to value of ([^\s]+) in response$/, function (propName, index, source, callback) {
    expect(this.body[+index][propName]).to.be.equal(resolveProp(this.dataSource, source));
    callback();
  });

  // Set request parameter(s) value(s).
  this.When(/^I put "([^"]*)" with value "([^"]*)" to request$/, function (key, value, callback) {
    if (key) {
      this.putData(key, value);
    }
    callback();
  });
  this.When(/^I put ([^\s]+) as parameters to request$/, function (datasourcePath, callback) {
    this.putDataFromObject(resolveProp(this.dataSource, datasourcePath));
    callback();
  });
  this.When(/^I put "([^\s]+)" from ([^\s]+) to request$/, function (paramName, datasourcePath, callback) {
    this.putData(paramName, resolveProp(this.dataSource, datasourcePath)[paramName]);
    callback();
  });
  this.When(/^I put "([^\s]+)" from ([^\s]+) to the query string of request$/, function (paramName, datasourcePath, callback) {
    this.addToQueryString(resolveProp(this.dataSource, datasourcePath)[paramName]);
    callback();
  });
};
