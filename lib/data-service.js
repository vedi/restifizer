'use strict';

const path = require('path');
const _ = require('lodash');
const Bb = require('bluebird');
const HTTP_STATUSES = require('http-statuses');

const RestifizerScope = require('./scope');
const utils = require('./utils');

const resolveProp = utils.resolveProp;
const setProp = utils.setProp;
const requireOptions = utils.requireOptions;

class DataService {

  constructor(options) {

    this.qFields = [];
    // TODO: Populate fields in inserts

    Object.assign(this, options);

    const requiredOptions = ['dataSource'];
    requireOptions(this, requiredOptions);

    this.dataSource = require('./data-sources/' + this.dataSource.type)(this.dataSource.options);

    this.idField = this.idField || this.dataSource.defaultIdField;

    this.fieldMap = this._normalizeFields(this.fields || this.dataSource.getModelFieldNames());
    if (!this.fieldMap[this.idField]) {
      this.fieldMap[this.idField] = {
        name: this.idField
      };
    }

    // extract name list for quick access
    this.modelFieldNames = _.keys(this.fieldMap);

    // make sure there is an ID field
    this.modelFieldNames.push(this.idField);
    this.modelFieldNames = _.uniq(this.modelFieldNames);

    if (this.defaultFields) {
      this.defaultFieldNames = this.defaultFields;
      this.defaultFields = _.pick(this.fieldMap, this.defaultFieldNames);
    } else {
      this.defaultFields = this.fieldMap;
      this.defaultFieldNames = _.keys(this.defaultFields);
    }

    // make sure there is an ID field
    this.defaultFieldNames.push(this.idField);
    this.defaultFieldNames = _.uniq(this.defaultFieldNames);

    this.arrayMethods = this.arrayMethods || this.dataSource.defaultArrayMethods;

    this.smartPut = !!this.smartPut;  // if set, put will create new record, if no record found

    if (_.isFunction(this.dataSource.initialize)) {
      this.dataSource.initialize.call(this.dataSource, this);
    }

    this.initialize(options);
  }

  initialize() {
  }

  select(scope) {
    return Bb
      .try(this._handlePre.bind(this, scope))
      .then(this.getFilter.bind(this, scope))
      .then((filter) => {
        // field list
        scope.fieldList = this.extractFieldList(scope);
        // q
        const q = scope.getQ();
        // orderBy
        const orderBy = this.getOrderBy(scope);
        const pagination = scope.scope.pagination = this.getPagination(scope);

        return this.dataSource.find({
          filter: filter,
          fields: scope.fieldList,
          q: q,
          qFields: this.qFields,
          sort: orderBy,
          limit: pagination.limit,
          skip: (pagination.page - 1) * pagination.limit,
          queryPipe: this.queryPipe ? (query) => {
            this.queryPipe(query, scope);
          } : undefined
        });
      })
      .then((collection) => {
        return this._handleCollectionPost(collection, scope);
      })
      .then((collection) => {
        return this._handlePostForCollection(collection, scope);
      });
  }

  selectOne(scope) {
    return this
      .locateModel(scope, true, true)
      .then((model) => {
        scope.model = this.dataSource.toObject(model);
        return this._handlePost(scope.model, scope);
      });
  }

  insert(scope) {
    return Bb
      .try(this._handlePre.bind(this, scope))
      .then(this.buildConditions.bind(this, scope))
      .then(this.prepareData.bind(this, scope))
      .then((data) => {
        scope.source = Object.assign(scope.source, data, scope.getBody());
        return this.createDocument(scope);
      })
      .then(this._makeChanges.bind(this, scope, false))
      .then(() => {
        scope.newContent = true;
        // TODO: Send in Location service with new URL
        return _.pick(scope.model, this.defaultFieldNames);
      });
  }

  replace(scope) {
    return this
      .locateModel(scope, !this.smartPut, false)
      .then((model) => {
        if (!model) {
          // it's for smartPut only
          scope.inserting = true;
          return Bb
            .try(this.prepareData.bind(this, scope))
            .then((data) => {
              scope.source = Object.assign(scope.source, data, scope.getBody());
              return this.createDocument(scope);
            });
        }
        scope.source = scope.getBody();
        scope.model = model;
      })
      .then(this._makeChanges.bind(this, scope, false))
      .then(() => {
        scope.newContent = scope.inserting;
        return _.pick(scope.model, this.defaultFieldNames);
      });
  }

  update(scope) {
    return this
      .locateModel(scope, true, false)
      .then((model) => {
        scope.source = scope.getBody();
        scope.model = model;
      })
      .then(this._makeChanges.bind(this, scope, true));
  }

  'delete'(scope) {
    return this
      .locateModel(scope, true, false)
      .then((model) => {
        scope.model = model;
        return this.beforeDelete(scope);
      })
      .then(() => {
        return this.dataSource
          .remove(scope.model)
          .then((model) => {
            scope.model = model;
          });
      })
      .then(this.afterChange.bind(this, scope))
      .then(() => {
        if (scope.model) {
          scope.model = this.dataSource.toObject(scope.model);
        }
        return this._handlePost(scope.model, scope);
      })
      .then(() => {
        return undefined;
      });
  }

  count(scope) {
    return Bb
      .try(this._handlePre.bind(this, scope))
      .then(this.getFilter.bind(this, scope))
      .then((filter) => {
        return this.dataSource.count({
          filter: filter,
          q: scope.getQ(),
          qFields: this.qFields
        });
      })
      .then((count) => {
        scope.model = {count: count};
        return this._handlePost(scope.model, scope);
      })
      .then((model) => {
        scope.model = model;
        return scope.model;
      });
  }

  extractFieldList(scope) {
    let fields = scope.getFields();
    if (fields) {
      fields = _.pick(this.fieldMap, _.intersection(fields, this.modelFieldNames));
      if (!fields[this.idField]) {
        // we need to force adding id (only field with $slice, can lead to fetching all fields)
        fields[this.idField] = this.getField(this.idField);
      }
    } else {
      fields = _.clone(this.defaultFields, true);
    }
    return fields;
  }

  getFilter(scope) {
    return Bb
      .try(() => {
        return this.buildConditions(scope);
      })
      .then((conditions) => {
        const defaultFilter = this.defaultFilter ? this.defaultFilter : {};
        let queryFilter = scope.getFilter() || scope.getBody().filter;
        return Object.assign({}, (queryFilter ? queryFilter : defaultFilter), conditions);
      });
  }

  getOrderBy(scope) {
    return scope.getOrderBy() || this.orderBy;
  }

  getPagination(scope) {
    const pagination = scope.getPagination();

    pagination.page = pagination.page || this.config.firstPageIndex;

    if (!pagination.limit) {
      pagination.limit = this.config.defaultPerPage;
    } else {
      pagination.limit = pagination.perPage <= this.config.maxPerPage ? pagination.perPage : this.config.maxPerPage;
    }

    return pagination;
  }

  getField(name) {
    return this.fieldMap[name];
  }

  /**
   * Assigns all fields from `scope.source` to `scope.model`
   * @param scope
   */
  assignFields(scope) {
    const fields = _.filter(_.keys(scope.source), (field) => {
      return this.assignFilter(scope.source, field, scope);
    });
    return Bb.map(fields, (fieldName) => {
      return this.assignField(fieldName, scope);
    });
  }

  /**
   * Assigns single field with name fieldName from `scope.source` to `scope.model`
   * @param fieldName
   * @param scope
   */
  assignField(fieldName, scope) {
    const obj = scope.model;
    if (_.isFunction(this.dataSource.assignField)) {
      return this.dataSource.assignField(fieldName, scope);
    } else {
      return this.setProp(obj, fieldName, scope.source[fieldName]);
    }
  }

  /**
   * Filter assigning field with name `fieldName`
   * @param queryParams
   * @param fieldName
   * @param scope
   * @returns {boolean} true if field should be assigned
   */
  assignFilter(queryParams, fieldName, scope) {
    return _.contains(this.modelFieldNames, fieldName) &&   // It's an allowable field
      !_.includes(this.readOnlyFields, fieldName) &&        // It's a read-only field
      (scope.action !== RestifizerScope.ACTIONS.UPDATE || queryParams[fieldName] !== undefined);
  }

  /**
   * Proceed supported array methods.
   * @param scope
   */
  proceedArrayMethods(scope) {
    return Bb
      .map(this.arrayMethods, (methodName) => {
        // each supported method
        const methodBody = scope.source[methodName];
        if (methodBody) {
          const fields = _.filter(_.keys(methodBody), (field) => {
            return (this.assignFilter(methodBody, field, scope));
          });
          return Bb
            .map(fields, (fieldName) => {
              return Bb
                .try(() => {
                  return this.beforeArrayMethod(methodBody[fieldName], methodName, fieldName, scope);
                })
                .then(() => {
                  return this.proceedArrayMethod(methodBody[fieldName], methodName, fieldName, scope);
                });
            });
        }
      });
  }

  /**
   * Proceed supported array methods.
   * @param source
   * @param methodName
   * @param fieldName
   * @param scope
   */
  proceedArrayMethod(source, methodName, fieldName, scope) {
    return this.dataSource.proceedArrayMethod(source, methodName, fieldName, scope);
  }

  /**
   * Perform all preparations, create query, which locates document regarding scope.req params,
   * and returns it to callback
   * @param scope scope
   * @param strict throws NOT_FOUND if no record found, default is `true`
   * @param withQueryPipe pass it through queryPipe, default is `true`
   * @returns {Promise<model>}
   */
  locateModel(scope, strict, withQueryPipe) {
    strict = strict !== undefined ? strict : true;
    withQueryPipe = withQueryPipe !== undefined ? withQueryPipe : true;
    return Bb
      .try(this._handlePre.bind(this, scope))
      .then(this.buildConditions.bind(this, scope))
      .then((filter) => {
        scope.fieldList = this.extractFieldList(scope);
        return this.dataSource.findOne({
          filter: filter,
          fields: scope.fieldList,
          queryPipe: (withQueryPipe && this.queryPipe) ? (query) => {
            this.queryPipe(query, scope);
          } : undefined
        });
      })
      .then((model) => {
        if (strict && !model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }

        return model;
      });
  }

  /**
   * Builds object to passed as condition to dataSource
   * @param scope
   * @returns {*}
   */
  buildConditions(scope) {
    const params = scope.getParams();
    return scope.source = _.pick(params, _.keys(params));
  }

  /**
   * Create new document instance, called when you create new instance of your resource after all assignments
   * are already done, but immediately before saving it to your database.
   * @param scope
   */
  createDocument(scope) {
    return Bb
      .resolve(this.dataSource.create({}))
      .then((model) => {
        scope.model = model;
      });
  }

  /**
   * Saves document to db, called in inserts and updates.
   * @param scope
   */
  saveDocument(scope) {
    return this.dataSource
      .save(scope.model)
      .then((model) => {
        scope.model = model;
      });
  }

  afterChange(scope) {}

  afterSave(scope) {}

  beforeArrayMethod(queryParam, methodName, fieldName, scope) {}

  beforeAssignFields(scope) {}

  /**
   * Before delete handler
   * @param scope
   */
  beforeDelete(scope) {}

  /**
   * Handler, called when you change existing instance of your resource after all assignments are already done,
   * but immediately before saving it to your database.
   * @param scope
   */
  beforeSave(scope) {}

  // collectionPost(collection, scope) {
  //   return collection;
  // }
  //
  // post(model, scope) {
  //   return model;
  // }
  //
  // pre(scope) {}

  prepareData(scope) {
    return {};
  }

  /**
   * {
   *  field1: {name: field1},
   *  field2: {name: field2, fields: {
   *    subField1: {name: subField1},
   *    subField2: {name: subField2, fields: {
   *      subSubField1: {name: subSubField1}
   *    },
   *  }},
   * }
   * @param fields
   * @private
   */
  _normalizeFields(fields) {
    const fieldMap = {};
    // 1. build objects for every field
    _.each(fields, (field) => {
      let result;
      if (typeof(field) === 'string') {
        result = {name: field};
      } else if (typeof(field) === 'object') {
        result = field;
      } else {
        throw new Error('Wrong field type: ' + field);
      }

      if (result.fields) {
        result.fields = this._normalizeFields(result.fields);
      }

      fieldMap[result.name] = result;
    }, this);

    return fieldMap;
  }

  _makeChanges(scope, shouldProceedArrayMethods) {
    return Bb
      .try(this.beforeAssignFields.bind(this, scope))
      .then(this.assignFields.bind(this, scope))
      .then(() => {
        if (shouldProceedArrayMethods) {
          return this.proceedArrayMethods(scope);
        }
      })
      .then(this.beforeSave.bind(this, scope))
      .then(this.saveDocument.bind(this, scope))
      .then(this.afterSave.bind(this, scope))
      .then(this.afterChange.bind(this, scope))
      .then(() => {
        if (this.queryPipe) {
          return this.queryPipe(scope.model, scope);
        }
      })
      .then(() => {
        if (scope.model) {
          scope.model = this.dataSource.toObject(scope.model);
        }
        return this._handlePost(scope.model, scope);
      })
      .then((model) => {
        scope.model = model;
        return scope.model;
      });
  }

  _handlePre(scope) {
    return Bb
      .try(() => scope.transport.pre(scope))
      .then(() => {
        if (_.isFunction(this.pre)) {
          return this.pre(scope);
        } else {
          return scope;
        }
      });
  }

  _handlePost(model, scope) {
    return Bb
      .try(() => {
        if (_.isFunction(this.post)) {
          return this
            .post(model, scope)
            .then((result) => model = result);
        }
      })
      .then(() => scope.transport.post(scope))
      .then(() => model);
  }

  _handlePostForCollection(collection, scope) {
    scope.collection = collection;
    return Bb
      .try(() => {
        if (_.isFunction(this.post)) {
          return Bb
            .map(collection, (item) => {
              return this.post(item, scope);
            })
            .then((result) => scope.collection = collection = result);
        }
      })
      .then(() => scope.transport.post(scope))
      .then(() => collection);
  }

  _handleCollectionPost(collection, scope) {

    return Bb
      .try(() => {
        if (_.isFunction(this.collectionPost)) {
          return this
            .collectionPost(collection, scope)
            .then((result) => collection = result);
        }
      })
      .then(() => collection);
  }
}

DataService.prototype.resolveProp = resolveProp;
DataService.prototype.setProp = setProp;

module.exports = DataService;