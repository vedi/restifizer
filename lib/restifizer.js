'use strict';

var
  path = require('path'),
  _ = require('lodash'),
  Promise = require('bluebird'),
  HTTP_STATUSES = require('http-statuses'),

  RestifizerScope = require('./restifizer-scope'),
  utils = require('./utils');

var
  extend = utils.extend,
  resolveProp = utils.resolveProp,
  setProp = utils.setProp,
  requireOptions = utils.requireOptions,
  CommonController = utils.CommonController,
  setResData = utils.setResData,
  setResError = utils.setResError,
  setResOk = utils.setResOk;

function DataService(options) {

  _.extend(this, options);

  var requiredOptions = ['dataSource'];
  requireOptions(this, requiredOptions);

  this.idField = this.idField || this.dataSource.defaultIdField;

  this.fieldMap = this._normalizeFields(this.fields || this.dataSource.getModelFieldNames());

  // extract name list for quick access
  this.modelFieldNames = _.keys(this.fieldMap);

  // make sure there is an ID field
  this.modelFieldNames.push(this.idField);
  this.modelFieldNames = _.uniq(this.modelFieldNames);

  this.defaultFields = this.defaultFields || this.modelFieldNames;

  this.arrayMethods = this.arrayMethods || this.dataSource.defaultArrayMethods;

  if (_.isFunction(this.dataSource.initialize)) {
    this.dataSource.initialize.call(this.dataSource, this);
  }

  this.initialize.apply(this, arguments);
}

_.extend(DataService.prototype, {

  initialize: function() {
    Promise.promisifyAll(this);
    this.dataSource = Promise.promisifyAll(this.dataSource);
  },

  select: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.SELECT, this.contextFactory);
    var limit;
    var page;

    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        // filter
        return this.getFilterAsync(req)
      })
      .then(function(filter) {
        // field list
        var fieldList = this.extractFieldList(req);
        // q
        var q = req.query.q;
        // orderBy
        var orderBy = this.getOrderBy(req);
        // limit
        var limit = this.getLimit(req, this.config.defaultPerPage, this.config.maxPerPage);
        // page
        page = this.getPage(req);

        return this.dataSource.findAsync({
          filter: filter,
          fields: fieldList,
          q: q,
          qFields: this.qFields,
          sort: orderBy,
          limit: limit,
          skip: (page - 1) * limit,
          queryPipe: this.queryPipe ? _.bind(function (query) {
            this.queryPipe(query, req, res);
          }, this) : undefined
        });
      })
      .then(function (collection) {
        // run collection post processing
        if (this.collectionPostAsync) {
          return this.collectionPostAsync(collection, req, res);
        } else {
          return collection;
        }
      })
      .then(function (collection) {
        // run post processing
        if (this.postAsync) {
          var promises = _.collect(collection, function(doc) {
            return this.postAsync(doc, req, res);
          }, this);
          return Promise.all(promises);
        } else {
          return collection;
        }
      })
      .then(function (collection) {
        this.addLinkHeaders(req, res, page, limit, collection.length);
        setResData(req, res, collection);
        next();
      })
      .catch(function (err) {
        this.setResError(req, res, err);
        next();
      }
    );
  },
  selectOne: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.SELECT_ONE, this.contextFactory);
    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req, res, true);
      })
      .then(function (doc) {
        if (doc) {
          doc = this.dataSource.toObject(doc);
        }
        // run post processing
        if (doc && this.postAsync) {
          return this.postAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        if (!doc) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          setResData(req, res, doc);
          next();
        }
      })
      .catch(function (err) {
        this.setResError(req, res, err);
        next();
      })
    ;
  },
  insert: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.INSERT, this.contextFactory);
    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        if (this.prepareDataAsync) {
          return this.prepareDataAsync(req, res);
        } else {
          return {};
        }
      })
      .then(function (data) {
        // add params
        var paramKeys = _.keys(req.params);
        var params = _.pick(req.params, paramKeys);
        var source = _.assign(req.body, params);

        if (this.beforeAssignFieldsAsync) {
          return this.beforeAssignFieldsAsync(data, source, req)
            .bind(this)
            .then(function() {
              return this.assignFieldsAsync(data, source, req);
            });
        } else {
          return this.assignFieldsAsync(data, source, req);
        }
      })
      .then(function (data) {
        return this.createDocumentAsync(data, req, res);
      })
      .then(function (doc) {
        return this.beforeSaveAsync(doc, req, res);
      })
      .then(function (doc) {
        return this.saveDocumentAsync(doc, req, res);
      })
      .then(function (doc) {
        if (this.afterSaveAsync) {
          return this.afterSaveAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        if (this.afterChangeAsync) {
          return this.afterChangeAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        if (this.queryPipeAsync) {
          return this.queryPipeAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        if (doc) {
          doc = this.dataSource.toObject(doc);
        }
        // run post processing
        if (this.postAsync) {
          return this.postAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        res.statusCode = HTTP_STATUSES.CREATED.code;
        setResData(req, res, _.pick(doc, this.defaultFields));
        next();
      })
      .catch(function (err) {
        this.setResError(req, res, err);
        next();
      }
    );
  },
  replace: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.REPLACE, this.contextFactory);
    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req, res, false);
      })
      .then(function (doc) {
        if (!doc) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }
        if (this.beforeAssignFieldsAsync) {
          return this.beforeAssignFieldsAsync(doc, req.body, req)
            .bind(this)
            .then(function() {
              return this.assignFieldsAsync(doc, req.body, req);
            });
        } else {
          return this.assignFieldsAsync(doc, req.body, req);
        }
      })
      .then(function (doc) {
        return this.beforeSaveAsync(doc, req, res);
      })
      .then(function (doc) {
        return this.saveDocumentAsync(doc, req, res);
      })
      .then(function (doc) {
        if (this.afterSaveAsync) {
          return this.afterSaveAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        if (this.afterChangeAsync) {
          return this.afterChangeAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        if (this.queryPipeAsync) {
          return this.queryPipeAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        if (doc) {
          doc = this.dataSource.toObject(doc);
        }
        if (this.postAsync) {
          return this.postAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        setResData(req, res, _.pick(doc, this.defaultFields));
        next();
      })
      .catch(function (err) {
        this.setResError(req, res, err);
        next();
      });
  },
  update: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.UPDATE, this.contextFactory);

    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req, res, false);
      })
      .then(function (doc) {
        if (!doc) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }
        if (this.beforeAssignFieldsAsync) {
          return this.beforeAssignFieldsAsync(doc, req.body, req)
            .bind(this)
            .then(function() {
              return this.assignFieldsAsync(doc, req.body, req)
            });
        } else {
          return this.assignFieldsAsync(doc, req.body, req);
        }
      })
      .then(function (doc) {
        return this.proceedArrayMethodsAsync(doc, req.body, req);
      })
      .then(function (doc) {
        return this.beforeSaveAsync(doc, req, res);
      })
      .then(function (doc) {
        return this.saveDocumentAsync(doc, req, res);
      })
      .then(function (doc) {
        if (this.afterSaveAsync) {
          return this.afterSaveAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        if (this.afterChangeAsync) {
          return this.afterChangeAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        if (this.queryPipeAsync) {
          return this.queryPipeAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        if (doc) {
          doc = this.dataSource.toObject(doc);
        }
        if (this.postAsync) {
          return this.postAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        setResData(req, res, _.pick(doc, this.defaultFields));
        next();
      })
      .catch(function (err) {
        this.setResError(req, res, err);
        next();
      });
  },
  delete: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.DELETE, this.contextFactory);

    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req, res, false);
      })
      .then(function (doc) {
        if (!doc) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          return this.beforeDeleteAsync(doc, req);
        }
      })
      .then(function (doc) {
        return this.dataSource.removeAsync(doc);
      })
      .then(function (doc) {
        if (this.afterChangeAsync) {
          return this.afterChangeAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        if (doc) {
          doc = this.dataSource.toObject(doc);
        }
        if (this.postAsync) {
          return this.postAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function () {
        setResOk(res, HTTP_STATUSES.NO_CONTENT.code);
        next();
      })
      .catch(function (err) {
        this.setResError(req, res, err);
        next();
      });
  },
  count: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.COUNT, this.contextFactory);
    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        // filter
        return this.getFilterAsync(req);
      })
      .then(function(filter) {
        return this.dataSource.countAsync({
          filter: filter,
          q: req.query.q,
          qFields: this.qFields
        });
      })
      .then(function (count) {
        var countData = {count: count};
        if (this.postAsync) {
          return this.postAsync(countData, req, res);
        } else {
          return countData;
        }
      })
      .then(function (countData) {
        setResData(req, res, countData);
        next();
      })
      .catch(function (err) {
        this.setResError(req, res, err);
        next();
      }
    );
  },
  getContext: function getContext(req) {
    return req.restifizer.context;
  },
  extractFieldList: function (req) {
    var fields;
    if (req.query.fields) {
      fields = req.query.fields.split(',');
      fields = _.intersection(fields, this.defaultFields);
      if (fields.length == 0) {
        fields.push(this.idField);
      }
    } else {
      fields = _.clone(this.defaultFields, true);
    }
    return fields;
  },
  getFilter: function (req, callback) {
    Promise
      .bind(this)
      .then(function () {
        // get from params
        return this.buildConditionsAsync(req);
      })
      .then(function (conditions) {
        var filter = _.assign({}, this.defaultFilter);
        if (req.query.filter) {
          filter = _.assign(filter, JSON.parse(req.query.filter));
        }
        filter = _.assign(filter, conditions);
        callback(null, filter);
      })
      .catch(function (err) {
        callback(err);
      })
    ;
  },
  getOrderBy: function (req) {
    return req.query.orderBy ? JSON.parse(req.query.orderBy) : this.orderBy;
  },
  getLimit: function (req, defaultPerPage, maxPerPage) {
    var perPage = req.query.perPage || req.query['per_page'];
    if (!perPage) {
      return defaultPerPage;
    } else {
      return perPage <= maxPerPage ? perPage : maxPerPage;
    }
  },
  getPage: function (req) {
    return parseInt(req.query.page) || 1;
  },
  addLinkHeaders: function (req, res, page, limit, currentLength) {
    var initialUrl = req.url;
    var cleanedUrl = initialUrl
      .replace('perPage=' + limit, '')
      .replace('page=' + page, '')
      .replace('&&', '&')
      .replace('&&', '&')
      .replace('?&', '?');

    var fullURL = req.protocol + '://' + req.get('host') + cleanedUrl;
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
    res.links(links);
  },

  /**
   * Assign all fields from source to dest according defaultFields
   * @param dest
   * @param source
   * @param req
   * @param callback
   */
  assignFields: function (dest, source, req, callback) {
    var promises = [];
    _.each(_.keys(source), function (fieldName) {
      if (this.assignFilter(dest, source, fieldName, req)) {
        promises.push(this.assignFieldAsync(dest, source, fieldName, req));
      }
    }, this);

    Promise
      .all(promises)
      .then(function() {
        callback(null, dest);
      })
      .catch(function(err) {
        callback(err);
      })
    ;
  },

  /**
   * Assign single field with name fieldName from source to dest
   * @param dest
   * @param source
   * @param fieldName
   * @param req
   * @param callback
   */
  assignField: function (dest, source, fieldName, req, callback) {
    if (_.isFunction(this.dataSource.assignFieldAsync)) {
      this.dataSource.assignFieldAsync(dest, source, fieldName, req).
        nodeify(callback);
    } else {
      this.setProp(dest, fieldName, source[fieldName]);
      callback();
    }
  },

  /**
   * Filter assigning field with name fieldName
   * @param dest
   * @param source
   * @param fieldName
   * @param req
   * @returns {boolean} true if field should be assigned
   */
  assignFilter: function (dest, source, fieldName, req) {
    return _.contains(this.modelFieldNames, fieldName) && // It's an allowable field
      (req.restifizer.action !== RestifizerScope.ACTIONS.UPDATE || source[fieldName] !== undefined);
  },

  /**
   * Proceed supported array methods.
   * @param dest
   * @param source
   * @param req
   * @param callback
   */
  proceedArrayMethods: function proceedArrayMethods(dest, source, req, callback) {
    Promise
      .bind(this)
      .then(function () {
        // each supported method
        _.each(this.arrayMethods, function (methodName) {
          var methodBody = source[methodName];
          if (methodBody) {

            var promises = [];
            // each affected field
            _.each(_.keys(methodBody), function (fieldName) {
              if (this.assignFilter(dest, methodBody, fieldName, req)) {
                promises.push(
                  Promise
                    .bind(this)
                    .then(function () {
                      if (this.beforeArrayMethod) {
                        return this.beforeArrayMethodAsync(dest, methodBody[fieldName], methodName, fieldName, req);
                      }
                    })
                    .then(function() {
                      return this.proceedArrayMethodAsync(dest, methodBody[fieldName], methodName, fieldName, req);
                    })
                );
              }
            }, this);

            return Promise
              .all(promises)
              .then(function() {
                callback(null, dest);
              })
              .catch(function(err) {
                callback(err);
              })
              ;
          }
        }, this);
      })
      .then(function () {
        return dest;
      })
      .nodeify(callback)
    ;
  },

  /**
   * Proceed supported array methods.
   * @param dest
   * @param source
   * @param methodName
   * @param fieldName
   * @param req
   */
  proceedArrayMethod: function proceedArrayMethod(dest, source, methodName, fieldName, req, callback) {
    this.dataSource.proceedArrayMethod(dest, source, methodName, fieldName);
    callback();
  },

  /**
   * Create query, which locates document regarding req params, and returns it to callback
   * @param req
   * @param withQueryPipe
   * @param callback
   */
  locateModel: function (req, res, withQueryPipe, callback) {
    Promise
      .bind(this)
      .then(function() {
        return this.buildConditionsAsync(req);
      })
      .then(function (filter) {
        var fieldList = this.extractFieldList(req);
        return this.dataSource.findOneAsync({
          filter: filter,
          fields: fieldList,
          queryPipe: (withQueryPipe && this.queryPipe) ? _.bind(function (query) {
            this.queryPipe(query, req, res);
          }, this) : undefined
        });
      })
      .nodeify(callback)
    ;
  },

  /**
   * Builds object to passed as condition to dataSource
   * @param req
   * @param callback
   * @returns {*}
   */
  buildConditions: function (req, callback) {
    return callback(null, _.pick(req.params, _.keys(req.params)));
  },

  /**
   * Create new document instance, called when you create new instance of your resource after all assignments are already done, but immediately before saving it to your database.
   * @param data
   * @param req
   * @param res
   * @param callback
   */
  createDocument: function (data, req, res, callback) {
    this.dataSource.create(data, callback);
  },

  /**
   * Handler, called when you change existing instance of your resource after all assignments are already done, but immediately before saving it to your database.
   * @param doc
   * @param req
   * @param res
   * @param callback
   */
  beforeSave: function (doc, req, res, callback) {
    callback(null, doc);
  },

  /**
   * Save document to db, called in inserts and updates
   * @param doc
   * @param req
   * @param res
   * @param callback
   */
  saveDocument: function (doc, req, res, callback) {
    this.dataSource.saveAsync(doc).nodeify(callback);
  },

  /**
   * Before delete handler
   * @param doc
   * @param req
   * @param callback
   */
  beforeDelete: function (doc, req, callback) {
    callback(null, doc);
  },

  setResData: setResData,

  setResError: function (req, res, err) {
    setResError(req, res, err, this.log, this.parseError, this.dataSource.parseError);
  },

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
  _normalizeFields: function _normalizeFields(fields) {
    var fieldMap = {};
    // 1. build objects for every field
    _.each(fields, function (field) {
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
  },
  resolveProp: resolveProp,
  setProp: setProp
});

DataService.extend = extend;

var Controller = DataService.extend(_.extend(CommonController, {
  constructor: function(options) {
    DataService.apply(this, arguments);

    var requiredOptions = ['dataSource', 'path'];
    requireOptions(this, requiredOptions);

    this.actions = this.actions || [];

    // init

    this.actions.default = this.actions.default || {};

    this.defaultOptions = _.assign(
      {
        enabled: true,
        method: 'get'
      },
      this.actions.default
    );

    this.restActions = {};

    this.actions.select = _.defaults(this.actions.select || {}, this.actions.default);
    this.restActions.select = _.assign(
      {
        method: ['get', 'head'],
        handler: 'select',
        path: ''
      },
      this.actions.select
    );

    this.actions.count = _.defaults(this.actions.count || {}, this.actions.select);
    this.restActions.count = _.assign(
      {
        method: ['get', 'head'],
        handler: 'count',
        path: 'count'
      },
      this.actions.count
    );

    this.actions.selectOne = _.defaults(this.actions.selectOne || {}, this.actions.select);
    this.restActions.selectOne = _.assign(
      {
        method: ['get', 'head'],
        handler: 'selectOne',
        path: ':' + this.idField
      },
      this.actions.selectOne
    );

    this.actions.insert = _.defaults(this.actions.insert || {}, this.actions.default);
    this.restActions.insert = _.assign(
      {
        method: 'post',
        handler: 'insert',
        path: ''
      },
      this.actions.insert
    );

    this.actions.update = _.defaults(this.actions.update || {}, this.actions.insert);
    this.restActions.update = _.assign(
      {
        method: 'patch',
        handler: 'update',
        path: ':' + this.idField
      },
      this.actions.update
    );

    this.actions.replace = _.defaults(this.actions.replace || {}, this.actions.update);
    this.restActions.replace = _.assign(
      {
        method: 'put',
        handler: 'replace',
        path: ':' + this.idField
      },
      this.actions.replace
    );

    this.actions.delete = _.defaults(this.actions.delete || {}, this.actions.update);
    this.restActions.delete = _.assign(
      {
        method: 'delete',
        handler: 'delete',
        path: ':' + this.idField
      },
      this.actions.delete
    )

    this.actions = _.omit(this.actions, 'default', 'select', 'count', 'selectOne', 'insert', 'replace', 'update', 'delete');
    _.forEach(this.actions, function (action, actionKey) {
      if (typeof(action) !== 'object') {
        // interpret it as bool
        action = {
          enabled: !!action
        };
        this.actions[actionKey] = action;
      }
      _.defaults(action, this.defaultOptions);
      action.path = action.path || actionKey;
      action.handler = action.handler || actionKey;
      action.name = actionKey;
    }, this);
  },
  qFields: [],

  initialize: function() {
    DataService.prototype.initialize.apply(this, arguments);
  },

  bind: function (app) {
    var _this = this;

    if (typeof(this.path) === 'string') {
      this.path = [this.path];
    }
    _.forEach(this.path, _.bind(function (path) {
      _.forEach(_.union(_.values(this.actions), _.values(this.restActions)), function (action) {
        try {
          if (action.enabled) {
            if (typeof(action.method) === 'string') {
              action.method = [action.method];
            }
            _.forEach(action.method, _.bind(function (method) {
              app[method](path + '/' + action.path,
                this.getAuth(action),
                function (req, res, next) {
                  _this[action.handler].apply(_this, arguments);
                },
                this.resultSender
              );
            }, this));
          }
        } catch (err) {
          if (this.log) {
            this.log.error('Set route for action: ' + action.name + ' and path ' + path + '/' + action.path);
            this.log.error('Error', err);
          } else {
            console.log('Set route for action: ' + action.name + ' and path ' + path + '/' + action.path);
            console.log('Error', err);
          }

          throw err;
        }
      }, this);
    }, this));
  },
  resultSender: function(req, res) {
    res.send(res.restfulResult);
  }
}));

Controller.extend = extend;
Controller.ACTIONS = RestifizerScope.ACTIONS;

module.exports = Controller;
