'use strict';

const _ = require('lodash');
const HTTP_STATUSES = require('http-statuses');

const RestifizerScope = require('./scope');
const utils = require('./utils');

const { requireOptions, resolveProp, setProp } = utils;

class DataService {
  constructor(options) {
    this.qFields = [];
    // TODO: Populate fields in inserts

    Object.assign(this, options);

    const requiredOptions = ['dataSource'];
    requireOptions(this, requiredOptions);

    if (this.dataSource && this.dataSource.type) {
      // eslint-disable-next-line import/no-dynamic-require,global-require
      this.dataSource = require(`./data-sources/${this.dataSource.type}`)(this.dataSource.options);
    }

    this.idField = this.idField || this.dataSource.defaultIdField;

    this.fieldMap = this._normalizeFields(this.fields || this.dataSource.getModelFieldNames());
    if (!this.fieldMap[this.idField]) {
      this.fieldMap[this.idField] = {
        name: this.idField,
      };
    }

    // extract name list for quick access
    this.modelFieldNames = Object.keys(this.fieldMap);

    // make sure there is an ID field
    this.modelFieldNames.push(this.idField);
    this.modelFieldNames = _.uniq(this.modelFieldNames);

    if (this.defaultFields) {
      this.defaultFieldNames = this.defaultFields.map((field) => field.name || field);
      this.defaultFields = _.pick(this.fieldMap, this.defaultFieldNames);
    } else {
      this.defaultFields = this.fieldMap;
      this.defaultFieldNames = Object.keys(this.defaultFields);
    }

    // make sure there is an ID field
    this.defaultFieldNames.push(this.idField);
    this.defaultFieldNames = _.uniq(this.defaultFieldNames);

    this.arrayMethods = this.arrayMethods || this.dataSource.defaultArrayMethods;
    this.restrictFields = this.restrictFields !== undefined ? !!this.restrictFields : true;

    this.smartPut = !!this.smartPut; // if set, put will create new record, if no record found

    if (_.isFunction(this.dataSource.initialize)) {
      this.dataSource.initialize.call(this.dataSource, this);
    }

    this.initialize(options);
  }

  initialize() {
  }

  async select(scope) {
    await this._handlePre(scope);
    const filter = await this.getFilter(scope);
    // field list
    scope.fieldList = this.extractFieldList(scope);
    // q
    const { q } = scope;
    // orderBy
    const orderBy = this.getOrderBy(scope);
    const pagination = this.getPagination(scope);

    let collection = await this.dataSource.find({
      filter,
      fields: scope.fieldList,
      q,
      qFields: this.qFields,
      restrictFields: this.restrictFields,
      sort: orderBy,
      limit: pagination.limit,
      skip: (pagination.page - 1) * pagination.limit,
      queryPipe: this.queryPipe ? (query) => {
        this.queryPipe(query, scope);
      } : undefined,
    });
    collection = await this._handleCollectionPost(collection, scope);
    collection = await this._handlePostForCollection(collection, scope);
    return collection;
  }

  async selectOne(scope) {
    const model = await this.locateModel(scope, true, true);
    scope.model = this.dataSource.toObject(model);
    return this._handlePost(scope.model, scope);
  }

  async insert(scope) {
    await this._handlePre(scope);
    await this.buildConditions(scope);
    const data = await this.prepareData(scope);
    scope.source = Object.assign(scope.source, data, scope.body);
    scope.newContent = true;
    await this.createDocument(scope);
    await this._makeChanges(scope, false);
    // TODO: Send in Location service with new URL
    return this.restrictFields ? _.pick(scope.model, this.defaultFieldNames) : scope.model;
  }

  async replace(scope) {
    const model = await this.locateModel(scope, !this.smartPut, false);
    const { body } = scope;
    if (!model) {
      // it's for smartPut only
      scope.inserting = true;
      const data = await this.prepareData(scope);
      scope.source = Object.assign(scope.source, data, body);
      await this.createDocument(scope);
    } else {
      scope.source = body;
      scope.model = model;
    }

    await this._makeChanges(scope, false);

    scope.newContent = scope.inserting;

    return this.restrictFields ? _.pick(scope.model, this.defaultFieldNames) : scope.model;
  }

  async update(scope) {
    const model = await this.locateModel(scope, true, false);
    scope.source = scope.body;
    scope.model = model;

    return this._makeChanges(scope, true);
  }

  async delete(scope) {
    scope.model = await this.locateModel(scope, true, false);
    await this.beforeDelete(scope);

    scope.model = await this.dataSource.remove(scope.model);

    await this.afterChange(scope);

    if (scope.model) {
      scope.model = this.dataSource.toObject(scope.model);
    }
    await this._handlePost(scope.model, scope);

    return undefined;
  }

  async count(scope) {
    await this._handlePre(scope);
    const filter = await this.getFilter(scope);
    const count = await this.dataSource.count({
      filter,
      q: scope.q,
      qFields: this.qFields,
    });

    scope.model = { count };
    scope.model = await this._handlePost(scope.model, scope);

    return scope.model;
  }

  extractFieldList(scope) {
    let { fields } = scope;
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

  async getFilter(scope) {
    const conditions = await this.buildConditions(scope);
    const { filter, body } = scope;
    const defaultFilter = this.defaultFilter || {};
    const queryFilter = filter || (body && body.filter);
    return { ...(queryFilter || defaultFilter), ...conditions };
  }

  getOrderBy(scope) {
    return scope.orderBy || this.orderBy;
  }

  getPagination(scope) {
    const { pagination = {} } = scope;

    pagination.page = pagination.page || this.config.firstPageIndex;

    if (!pagination.limit) {
      pagination.limit = this.config.defaultPerPage;
    } else {
      pagination.limit = pagination.limit <= this.config.maxPerPage
        ? pagination.limit : this.config.maxPerPage;
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
    const fields = Object
      .keys(scope.source)
      .filter((field) => this.assignFilter(scope.source, field, scope));
    return Promise.all(
      fields.map((fieldName) => this.assignField(fieldName, scope)),
    );
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
    // It's an allowable field
    return (!this.restrictFields || _.includes(this.modelFieldNames, fieldName))
      && !_.includes(this.readOnlyFields, fieldName) // It's a read-only field
      && (scope.action !== RestifizerScope.ACTIONS.UPDATE || queryParams[fieldName] !== undefined);
  }

  /**
   * Proceed supported array methods.
   * @param scope
   */
  proceedArrayMethods(scope) {
    return Promise.all(
      this.arrayMethods.map(async (methodName) => {
        // each supported method
        const methodBody = scope.source[methodName];
        if (methodBody) {
          const fields = Object
            .keys(methodBody)
            .filter((field) => (this.assignFilter(methodBody, field, scope)));
          return Promise.all(
            fields.map(async (fieldName) => {
              await this.beforeArrayMethod(methodBody[fieldName], methodName, fieldName, scope);
              this.proceedArrayMethod(methodBody[fieldName], methodName, fieldName, scope);
            }),
          );
        }
      }),
    );
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
  async locateModel(scope, strict, withQueryPipe) {
    strict = strict !== undefined ? strict : true;
    withQueryPipe = withQueryPipe !== undefined ? withQueryPipe : true;
    await this._handlePre(scope);
    const filter = await this.buildConditions(scope);
    scope.fieldList = this.extractFieldList(scope);
    const model = await this.dataSource.findOne({
      filter,
      fields: scope.fieldList,
      queryPipe: (withQueryPipe && this.queryPipe) ? (query) => {
        this.queryPipe(query, scope);
      } : undefined,
      restrictFields: this.restrictFields,
    });

    if (strict && !model) {
      throw HTTP_STATUSES.NOT_FOUND.createError(
        'Cannot locate resource', { error: 'ResourceNotFound' });
    }

    return model;
  }

  /**
   * Builds object to passed as condition to dataSource
   * @param scope
   * @returns {*}
   */
  buildConditions(scope) {
    const { params } = scope;
    scope.source = _.pick(params, Object.keys(params));
    return scope.source;
  }

  /**
   * Create new document instance, called when you create new instance of your resource after all
   * assignments are already done, but immediately before saving it to your database.
   * @param scope
   */
  async createDocument(scope) {
    scope.model = await this.dataSource.create({});
  }

  /**
   * Saves document to db, called in inserts and updates.
   * @param scope
   */
  async saveDocument(scope) {
    scope.model = await this.dataSource.save(scope.model);
  }

  // eslint-disable-next-line no-unused-vars
  afterChange(scope) {}

  // eslint-disable-next-line no-unused-vars
  afterSave(scope) {}

  // eslint-disable-next-line no-unused-vars
  beforeArrayMethod(queryParam, methodName, fieldName, scope) {}

  // eslint-disable-next-line no-unused-vars
  beforeAssignFields(scope) {}

  /**
   * Before delete handler
   * @param scope
   */
  // eslint-disable-next-line no-unused-vars
  beforeDelete(scope) {}

  /**
   * Handler, called when you change existing instance of your resource after all assignments are
   * already done, but immediately before saving it to your database.
   * @param scope
   */
  // eslint-disable-next-line no-unused-vars
  beforeSave(scope) {}

  // eslint-disable-next-line no-unused-vars
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
      if (typeof (field) === 'string') {
        result = { name: field };
      } else if (typeof (field) === 'object') {
        result = field;
      } else {
        throw new Error(`Wrong field type: ${field}`);
      }

      if (result.fields) {
        result.fields = this._normalizeFields(result.fields);
      }

      fieldMap[result.name] = result;
    }, this);

    return fieldMap;
  }

  async _makeChanges(scope, shouldProceedArrayMethods) {
    await this.beforeAssignFields(scope);
    await this.assignFields(scope);
    if (shouldProceedArrayMethods) {
      await this.proceedArrayMethods(scope);
    }
    await this.beforeSave(scope);
    await this.saveDocument(scope);
    await this.afterSave(scope);
    await this.afterChange(scope);
    if (this.queryPipe) {
      await this.queryPipe(scope.model, scope);
    }

    if (scope.model) {
      scope.model = this.dataSource.toObject(scope.model);
    }
    scope.model = await this._handlePost(scope.model, scope);
    return scope.model;
  }

  async _handlePre(scope) {
    await scope.transport.pre(scope);
    if (_.isFunction(this.pre)) {
      return this.pre(scope);
    } else {
      return scope;
    }
  }

  async _handlePost(model, scope) {
    if (_.isFunction(this.post)) {
      model = await this.post(model, scope);
    }
    // TODO: Maybe set scope.model?
    await scope.transport.post(scope);

    return model;
  }

  async _handlePostForCollection(collection, scope) {
    scope.collection = collection;
    if (_.isFunction(this.post)) {
      const result = await Promise.all(collection.map(async (item) => this.post(item, scope)));
      scope.collection = result;
      collection = result;
    }
    await scope.transport.post(scope);
    return collection;
  }

  async _handleCollectionPost(collection, scope) {
    if (_.isFunction(this.collectionPost)) {
      const result = await this.collectionPost(collection, scope);
      scope.collection = result;
      collection = result;
    }

    return collection;
  }
}

DataService.prototype.resolveProp = resolveProp;
DataService.prototype.setProp = setProp;

module.exports = DataService;
