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

  this.dataSource = require('./data-sources/' + this.dataSource.type)(this.dataSource.options);

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

  initialize: function() {},

  select: function (scope) {
    var limit;
    var page;

    return Promise
      .bind(this)
      .then(this.buildConditions.bind(this, scope))
      .then(this.pre.bind(this, scope))
      .then(this.getFilter.bind(this, scope))
      .then(function(filter) {
        // field list
        var fieldList = this.extractFieldList(scope);
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
          fields: fieldList,
          q: q,
          qFields: this.qFields,
          sort: orderBy,
          limit: limit,
          skip: (page - 1) * limit,
          queryPipe: this.queryPipe ? _.bind(function (query) {
            this.queryPipe(query, scope);
          }, this) : undefined
        });
      })
      .then(function (collection) {
        return this.collectionPost(collection, scope);
      })
      .then(function (collection) {
        var _this = this;
        return Promise.map(collection, function (item) {
          return _this.post(item, scope);
        });
      })
      .then(function (collection) {
        this.addLinkHeaders(page, limit, collection.length, scope);
        return collection;
      });
  },
  selectOne: function (scope) {
    return Promise
      .bind(this)
      .then(this.buildConditions.bind(this, scope))
      .then(this.pre.bind(this, scope))
      .then(this.locateModel.bind(this, true, scope))
      .then(function (result) {
        if (result) {
          return this.post(this.dataSource.toObject(result), scope);
        }
      })
      .then(function (result) {
        if (!result) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }
        return result;
      });
  },
  insert: function (scope) {
    return Promise
      .bind(this)
      .then(this.buildConditions.bind(this, scope))
      .then(this.pre.bind(this, scope))
      .then(this.prepareData.bind(this, scope))
      .then(function () {
        scope.source = _.assign(scope.req.body, scope.source);
      })
      .then(this.beforeAssignFields.bind(this, scope))
      .then(this.assignFields.bind(this, scope))
      .then(this.createDocument.bind(this, scope))
      .then(this.beforeSave.bind(this, scope))
      .then(this.saveDocument.bind(this, scope))
      .then(this.afterSave.bind(this, scope))
      .then(this.afterChange.bind(this, scope))
      .then(function () {
        var _this = this;
        if (this.queryPipe) {
          return Promise.fromCallback(function (callback) {
            _this.queryPipe(scope.model, scope, callback);
          });
        }
      })
      .then(function () {
        if (scope.model) {
          scope.model = this.dataSource.toObject(scope.model);
        }
        return this.post(scope.model, scope);
      })
      .then(function () {
        scope.res.statusCode = HTTP_STATUSES.CREATED.code;
        return _.pick(scope.model, this.defaultFields);
      });
  },
  replace: function (scope) {
    return Promise
      .bind(this)
      .then(this.buildConditions.bind(this, scope))
      .then(this.pre.bind(this, scope))
      .then(this.locateModel.bind(this, false, scope))
      .then(function (model) {
        scope.source = scope.req.body;
        return model;
      })
      .then(function (model) {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }
        scope.model = model;
        return this.beforeAssignFields(scope);
      })
      .then(this.assignFields.bind(this, scope))
      .then(this.beforeSave.bind(this, scope))
      .then(this.saveDocument.bind(this, scope))
      .then(this.afterSave.bind(this, scope))
      .then(this.afterChange.bind(this, scope))
      .then(function () {
        if (this.queryPipe) {
          var _this = this;
          return Promise.fromCallback(function (callback) {
            _this.queryPipe(scope.model, scope, callback);
          });
        }
      })
      .then(function () {
        if (scope.model) {
          scope.model = this.dataSource.toObject(scope.model);
        }
        return this.post(scope.model, scope);
      })
      .then(function () {
        return _.pick(scope.model, this.defaultFields);
      });
  },
  update: function (scope) {
    return Promise
      .bind(this)
      .then(this.buildConditions.bind(this, scope))
      .then(this.pre.bind(this, scope))
      .then(this.locateModel.bind(this, false, scope))
      .then(function (model) {
        scope.source = scope.req.body;
        return model;
      })
      .then(function (model) {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }
        scope.model = model;
        return this.beforeAssignFields(scope);
      })
      .then(this.assignFields.bind(this, scope))
      .then(this.proceedArrayMethods.bind(this, scope))
      .then(this.beforeSave.bind(this, scope))
      .then(this.saveDocument.bind(this, scope))
      .then(this.afterSave.bind(this, scope))
      .then(this.afterChange.bind(this, scope))
      .then(function () {
        if (this.queryPipe) {
          var _this = this;
          return Promise.fromCallback(function (callback) {
            _this.queryPipe(scope.model, scope, callback);
          });
        }
      })
      .then(function () {
        if (scope.model) {
          scope.model = this.dataSource.toObject(scope.model);
        }
        return this.post(scope.model, scope);
      })
      .then(function () {
        return scope.model;
      });
  },
  delete: function (scope) {
    return Promise
      .bind(this)
      .then(this.buildConditions.bind(this, scope))
      .then(this.pre.bind(this, scope))
      .then(this.locateModel.bind(this, false, scope))
      .then(function (model) {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }
        scope.model = model;
        return this.beforeDelete(scope);
      })
      .then(function () {
        return this.dataSource.remove(scope.model).then(function (model) {
          scope.mode = model;
        });
      })
      .then(this.afterChange.bind(this, scope))
      .then(function () {
        if (scope.model) {
          scope.model = this.dataSource.toObject(scope.model);
        }
        return this.post(scope.model, scope);
      })
      .then(function () {
        setResOk(scope, HTTP_STATUSES.NO_CONTENT.code);
        return undefined;
      });
  },
  count: function (scope) {
    return Promise
      .bind(this)
      .then(this.buildConditions.bind(this, scope))
      .then(this.pre.bind(this, scope))
      .then(this.getFilter.bind(this, scope))
      .then(function(filter) {
        return this.dataSource.count({
          filter: filter,
          q: scope.req.query.q,
          qFields: this.qFields
        });
      })
      .then(function (count) {
        scope.model = {count: count};
        return this.post(scope.model, scope);
      })
      .then(function () {
        return scope.model;
      });
  },
  getContext: function getContext(scope) {
    return scope.context;
  },
  extractFieldList: function (scope) {
    var fields;
    if (scope.req.query.fields) {
      fields = scope.req.query.fields.split(',');
      fields = _.intersection(fields, this.defaultFields);
      if (fields.length == 0) {
        fields.push(this.idField);
      }
    } else {
      fields = _.clone(this.defaultFields, true);
    }
    return fields;
  },
  getFilter: function (scope) {
    return Promise
      .bind(this)
      .then(function () {
        return this.buildConditions(scope);
      })
      .then(function (conditions) {
        var defaultFilter = this.defaultFilter ? this.defaultFilter : {};
        var queryFilter = scope.req.query.filter;
        var filter = _.assign((queryFilter ? JSON.parse(queryFilter) : defaultFilter), conditions);
        return filter;
      });
  },
  getOrderBy: function (scope) {
    var orderBy = scope.req.query.orderBy;
    return orderBy ? JSON.parse(orderBy) : this.orderBy;
  },
  getLimit: function (defaultPerPage, maxPerPage, scope) {
    var perPage = scope.req.query.perPage || scope.req.query['per_page'];
    if (!perPage) {
      return defaultPerPage;
    } else {
      return perPage <= maxPerPage ? perPage : maxPerPage;
    }
  },
  getPage: function (scope) {
    return parseInt(scope.req.query.page) || this.config.firstPageIndex;
  },
  addLinkHeaders: function (page, limit, currentLength, scope) {
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
  },

  /**
   * Assign all fields from scope.source to scope.dest or scope.model according defaultFields
   * @param scope
   */
  assignFields: function (scope) {
    var _this = this;
    var fields = _.filter(_.keys(scope.source), function (field) {
      return _this.assignFilter(scope.source, field, scope);
    });
    return Promise.map(fields, function (fieldName) {
      return _this.assignField(fieldName, scope);
    });
  },

  /**
   * Assign single field with name fieldName from scope.source to scope.dest or scope.model
   * @param fieldName
   * @param scope
   */
  assignField: function (fieldName, scope) {
    var obj = scope.isInsert() ? scope.dest : scope.model;
    if (_.isFunction(this.dataSource.assignField)) {
      return this.dataSource.assignField(fieldName, scope);
    } else {
      return this.setProp(obj, fieldName, scope.source[fieldName]);
    }
  },

  /**
   * Filter assigning field with name fieldName
   * @param queryParams
   * @param fieldName
   * @param scope
   * @returns {boolean} true if field should be assigned
   */
  assignFilter: function (queryParams, fieldName, scope) {
    return _.contains(this.modelFieldNames, fieldName) && // It's an allowable field
      (scope.action !== RestifizerScope.ACTIONS.UPDATE || queryParams[fieldName] !== undefined);
  },

  /**
   * Proceed supported array methods.
   * @param scope
   */
  proceedArrayMethods: function proceedArrayMethods(scope) {
    return Promise
      .bind(this)
      .then(function () {
        // each supported method
        _.each(this.arrayMethods, function (methodName) {
          var _this = this;
          var methodBody = scope.source[methodName];
          if (methodBody) {
            var fields = _.filter(_.keys(methodBody), function (field) {
              return (_this.assignFilter(methodBody, field, scope));
            });
            return Promise.map(fields, function (fieldName) {
              return Promise.bind(_this).then(function () {
                return this.beforeArrayMethod(methodBody[fieldName], methodName, fieldName, scope);
              }).then(function () {
                return this.proceedArrayMethod(methodBody[fieldName], methodName, fieldName, scope);
              });
            });
          }
        }, this);
      });
  },

  /**
   * Proceed supported array methods.
   * @param source
   * @param methodName
   * @param fieldName
   * @param scope
   */
  proceedArrayMethod: function proceedArrayMethod(source, methodName, fieldName, scope) {
    return this.dataSource.proceedArrayMethod(source, methodName, fieldName, scope);
  },

  /**
   * Create query, which locates document regarding scope.req params, and returns it to callback
   * @param withQueryPipe
   * @param scope
   */
  locateModel: function (withQueryPipe, scope) {
    return Promise
      .bind(this)
      .then(function() {
        return this.buildConditions(scope);
      })
      .then(function (filter) {
        var fieldList = this.extractFieldList(scope);
        return this.dataSource.findOne({
          filter: filter,
          fields: fieldList,
          queryPipe: (withQueryPipe && this.queryPipe) ? _.bind(function (query) {
            this.queryPipe(query, scope);
          }, this) : undefined
        });
      });
  },

  /**
   * Builds object to passed as condition to dataSource
   * @param scope
   * @returns {*}
   */
  buildConditions: function (scope) {
    var params = scope.req.params;
    return scope.source = _.pick(params, _.keys(params));
  },

  /**
   * Create new document instance, called when you create new instance of your resource after all assignments
   * are already done, but immediately before saving it to your database.
   * @param scope
   */
  createDocument: function (scope) {
    return Promise.resolve(this.dataSource.create(scope.dest)).then(function (model) {
      scope.model = model;
    });
  },

  /**
   * Save document to db, called in inserts and updates
   * @param scope
   */
  saveDocument: function (scope) {
    return this.dataSource.save(scope.model).then(function (model) {
      scope.model = model;
    });
  },

  afterChange: function (scope) {},

  afterSave: function (scope) {},

  beforeArrayMethod: function (queryParam, methodName, fieldName, scope) {},

  beforeAssignFields: function (scope) {},

  /**
   * Before delete handler
   * @param scope
   */
  beforeDelete: function (scope) {},

  /**
   * Handler, called when you change existing instance of your resource after all assignments are already done,
   * but immediately before saving it to your database.
   * @param scope
   */
  beforeSave: function (scope) {},

  collectionPost: function (collection, scope) { return collection; },

  post: function (model, scope) { return model; },

  pre: function (scope) {},

  prepareData: function (scope) {},

  setResData: setResData,

  setResError: function (err, scope) {
    setResError(err, scope, this.log, this.parseError, this.dataSource.parseError);
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
        name: 'select',
        path: ''
      },
      this.actions.select
    );

    this.actions.count = _.defaults(this.actions.count || {}, this.actions.select);
    this.restActions.count = _.assign(
      {
        method: ['get', 'head'],
        handler: 'count',
        name: 'count',
        path: 'count'
      },
      this.actions.count
    );

    this.actions.selectOne = _.defaults(this.actions.selectOne || {}, this.actions.select);
    this.restActions.selectOne = _.assign(
      {
        method: ['get', 'head'],
        handler: 'selectOne',
        name: 'selectOne',
        path: ':' + this.idField
      },
      this.actions.selectOne
    );

    this.actions.insert = _.defaults(this.actions.insert || {}, this.actions.default);
    this.restActions.insert = _.assign(
      {
        method: 'post',
        handler: 'insert',
        name: 'insert',
        path: ''
      },
      this.actions.insert
    );

    this.actions.update = _.defaults(this.actions.update || {}, this.actions.insert);
    this.restActions.update = _.assign(
      {
        method: 'patch',
        handler: 'update',
        name: 'update',
        path: ':' + this.idField
      },
      this.actions.update
    );

    this.actions.replace = _.defaults(this.actions.replace || {}, this.actions.update);
    this.restActions.replace = _.assign(
      {
        method: 'put',
        handler: 'replace',
        name: 'replace',
        path: ':' + this.idField
      },
      this.actions.replace
    );

    this.actions.delete = _.defaults(this.actions.delete || {}, this.actions.update);
    this.restActions.delete = _.assign(
      {
        method: 'delete',
        handler: 'delete',
        name: 'delete',
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
                  var scope = new RestifizerScope(action.name, _this.contextFactory);
                  scope.req = req;
                  scope.res = res;
                  scope.dest = {};
                  scope.model = {};

                  _this[action.handler].call(_this, scope)
                    .then(function (data) {
                      if (typeof data != 'undefined') {
                        _this.setResData(data, scope);
                      }
                      next();
                    })
                    .catch(function (err) {
                      _this.setResError(err, scope);
                      next();
                    });
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
