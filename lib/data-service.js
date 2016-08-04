'use strict';

var path = require('path');
var _ = require('lodash');
var Bb = require('bluebird');
var HTTP_STATUSES = require('http-statuses');

var RestifizerScope = require('./scope');
var utils = require('./utils');

var resolveProp = utils.resolveProp;
var setProp = utils.setProp;
var requireOptions = utils.requireOptions;
var setResData = utils.setResData;
var setResError = utils.setResError;
var setResOk = utils.setResOk;

class DataService {

  constructor(options) {

    this.qFields = [];
    // TODO: Populate fields in inserts

    _.extend(this, options);

    var requiredOptions = ['dataSource'];
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
    var limit;
    var page;

    return Bb
      .try(this._handlePre.bind(this, scope))
      .then(this.getFilter.bind(this, scope))
      .then((filter) => {
        // field list
        scope.fieldList = this.extractFieldList(scope);
        // q
        var q = scope.req.query.q;
        // orderBy
        var orderBy = this.getOrderBy(scope);
        // limit
        var limit = this.getLimit(this.config.defaultPerPage, this.config.maxPerPage, scope);
        // page
        page = this.getPage(scope);

        return this.dataSource.find({
          filter: filter,
          fields: scope.fieldList,
          q: q,
          qFields: this.qFields,
          sort: orderBy,
          limit: limit,
          skip: (page - 1) * limit,
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
      })
      .then((collection) => {
        this.addLinkHeaders(page, limit, collection.length, scope);
        return collection;
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
        scope.source = _.assign(scope.source, data, scope.req.body);
        return this.createDocument(scope);
      })
      .then(this._makeChanges.bind(this, scope, false))
      .then(() => {
        scope.res.statusCode = HTTP_STATUSES.CREATED.code;
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
              scope.source = _.assign(scope.source, data, scope.req.body);
              return this.createDocument(scope);
            });
        }
        scope.source = scope.req.body;
        scope.model = model;
      })
      .then(this._makeChanges.bind(this, scope, false))
      .then(() => {
        if (scope.inserting) {
          scope.res.statusCode = HTTP_STATUSES.CREATED.code;
        }
        return _.pick(scope.model, this.defaultFieldNames);
      });
  }

  update(scope) {
    return this
      .locateModel(scope, true, false)
      .then((model) => {
        scope.source = scope.req.body;
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
        setResOk(scope, HTTP_STATUSES.NO_CONTENT.code);
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
          q: scope.req.query.q,
          qFields: this.qFields
        });
      })
      .then((count) => {
        scope.model = {count: count};
        return this._handlePost(scope.model, scope);
      })
      .then(() => {
        return scope.model;
      });
  }

  extractFieldList(scope) {
    var fields;
    if (scope.req.query.fields) {
      fields = scope.req.query.fields.split(',');
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
        var defaultFilter = this.defaultFilter ? this.defaultFilter : {};
        var queryFilter = scope.req.query.filter || scope.req.body.filter;
        if (queryFilter && typeof queryFilter === 'string') {
          queryFilter = JSON.parse(queryFilter);
        }
        return _.assign((queryFilter ? queryFilter : defaultFilter), conditions);
      });
  }

  getOrderBy(scope) {
    var orderBy = scope.req.query.orderBy;
    return orderBy ? JSON.parse(orderBy) : this.orderBy;
  }

  getLimit(defaultPerPage, maxPerPage, scope) {
    var perPage = scope.req.query.perPage || scope.req.query['per_page'];
    if (!perPage) {
      return defaultPerPage;
    } else {
      return perPage <= maxPerPage ? perPage : maxPerPage;
    }
  }

  getPage(scope) {
    return parseInt(scope.req.query.page) || this.config.firstPageIndex;
  }

  addLinkHeaders(page, limit, currentLength, scope) {
    var initialUrl = scope.req.url;
    var cleanedUrl = initialUrl
      .replace('perPage=' + limit, '')
      .replace('page=' + page, '')
      .replace('&&', '&')
      .replace('&&', '&')
      .replace('?&', '?');

    var fullURL = scope.req.protocol + '://' + scope.req.get('host') + cleanedUrl;
    var links = {};
    // add prev
    if (page > 1) {
      var prevLink = fullURL + '&page=' + (page - 1) + '&perPage=' + limit;
      prevLink = prevLink
        .replace('&&', '&')
        .replace('?&', '?');
      links.prev = prevLink;
    }
    if (currentLength >= limit) {
      var nextLink = fullURL + '&page=' + (page + 1) + '&perPage=' + limit;
      nextLink = nextLink
        .replace('&&', '&')
        .replace('?&', '?');
      links.next = nextLink;
    }
    scope.res.links(links);
  }

  getField(name) {
    return this.fieldMap[name];
  }

  /**
   * Assigns all fields from `scope.source` to `scope.model`
   * @param scope
   */
  assignFields(scope) {
    var fields = _.filter(_.keys(scope.source), (field) => {
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
    var obj = scope.model;
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
        var _this = this;
        var methodBody = scope.source[methodName];
        if (methodBody) {
          var fields = _.filter(_.keys(methodBody), (field) => {
            return (_this.assignFilter(methodBody, field, scope));
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
    var params = scope.req.params;
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

  setResError(err, scope) {
    setResError(err, scope, this.log, this.parseError, this.dataSource.parseError);
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
    var fieldMap = {};
    // 1. build objects for every field
    _.each(fields, (field) => {
      var result;
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
      });
  }

  _handlePre(scope) {
    if (_.isFunction(this.pre)) {
      return this.pre(scope);
    } else {
      return Bb.resolve(scope);
    }
  }

  _handlePost(model, scope) {
    if (_.isFunction(this.post)) {
      return this.post(model, scope);
    } else {
      return model;
    }
  }

  _handlePostForCollection(collection, scope) {
    if (_.isFunction(this.post)) {
      return Bb.map(collection, (item) => {
        return this.post(item, scope);
      });
    } else {
      return collection;
    }
  }

  _handleCollectionPost(collection, scope) {
    if (_.isFunction(this.collectionPost)) {
      return this.collectionPost(collection, scope);
    } else {
      return collection;
    }
  }
}

DataService.prototype.setResData = setResData;
DataService.prototype.resolveProp = resolveProp;
DataService.prototype.setProp = setProp;

module.exports = DataService;