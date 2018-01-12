'use strict';

const _ = require('lodash');
const Bb = require('bluebird');

class MemoryDataSource {
  constructor(modelDef) {
    this.storage = [];
    this.modelDef = modelDef;
    this.defaultIdField = '_id';
    this.defaultArrayMethods = ['$addToSet', '$pop', '$push', '$pull'];
  }

  find(options) {
    const {
      fields, filter, q, qFields, sort, queryPipe,
    } = options;

    const limit = parseInt(options.limit, 10);
    const skip = parseInt(options.skip, 10);

    this._normalizeFilter(filter);

    let result = _.filter(this.storage, filter);

    if (q) {
      qFields.forEach((qField) => {
        result = _.unionBy(result, _.filter(this.storage, { [qField]: q }), '_id');
      });
    }
    if (sort) {
      result = _.sortBy(result, sort);
    }
    result = _.slice(result, skip, limit);

    if (queryPipe) {
      queryPipe(result);
    }

    const fieldNames = _.map(fields, 'name');
    result = _.map(result, obj => _.pick(obj, fieldNames));

    return Bb.resolve(result);
  }

  findOne(options) {
    const { fields, filter, queryPipe } = options;

    this._normalizeFilter(filter);

    let result = _.find(this.storage, filter);

    if (queryPipe) {
      queryPipe(result);
    }

    const fieldNames = _.map(fields, 'name');
    result = _.pick(result, fieldNames);

    return Bb.resolve(result);
  }

  create(data) {
    return Bb.resolve(_.pick(data, this.getModelFieldNames()));
  }

  save(doc) {
    const { _id } = doc;
    if (!_id) {
      doc._id = Date.now();
      this.storage.push(doc);
    } else {
      const existingOne = _.find(this.storage, { _id });
      if (existingOne) {
        Object.assign(existingOne, doc);
      } else {
        this.storage.push(doc);
      }
    }
    return Bb.resolve(doc);
  }

  remove(doc) {
    const { _id } = doc;
    _.remove(this.storage, { _id });
    return Bb.resolve();
  }

  count(options) {
    const {
      filter, q, qFields, queryPipe,
    } = options;

    this._normalizeFilter(filter);

    let result = _.filter(this.storage, filter);

    if (q) {
      qFields.forEach((qField) => {
        result = _.unionBy(result, _.filter(this.storage, { [qField]: q }), '_id');
      });
    }

    if (queryPipe) {
      queryPipe(result);
    }

    return Bb.resolve(result);
  }

  toObject(model) {
    return model;
  }

  getFieldValue(model, fieldName) {
    return model[fieldName];
  }

  setFieldValue(model, fieldName, value) {
    model[fieldName] = value;
  }

  proceedArrayMethod(source, methodName, fieldName, scope) {
    const { model: { [fieldName]: fieldValue = [] } } = scope;
    if (methodName === '$addToSet') {
      if (!_.find(fieldValue, source)) {
        fieldValue.push(source);
      }
    } else if (methodName === '$pop') {
      if (source === 1) {
        fieldValue.pop();
      } else if (source === -1) {
        fieldValue.shift();
      } else {
        throw new Error('Illegal param value for $pop method');
      }
    } else if (methodName === '$push') {
      fieldValue.push(source);
    } else if (methodName === '$pull') {
      fieldValue.pull(source);
    }
  }

  getModelFieldNames() {
    return this.modelDef;
  }

  _normalizeFilter(filter) {
    Object.keys(filter).forEach((key) => {
      if (key === '_id') {
        filter[key] = parseInt(filter[key], 10);
      }
    });
  }
}

module.exports = options => new MemoryDataSource(options.modelDef);
