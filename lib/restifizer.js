var
  util = require('util'),
  path = require('path'),

  _ = require('lodash'),
  Promise = require('bluebird'),
  mongoose  = require('mongoose'),
  HTTP_STATUSES   = require('http-statuses'),

  mmm = require('mmmagic'),
  Magic = mmm.Magic,

  RestifizerScope = require('./restifizer-scope'),
  gridfs = require('./gridfs'),
  utils = require('./utils');

var
  extend  = utils.extend,
  ObjectID = mongoose.mongo.BSONPure.ObjectID;

function Restful(options) {

  _.extend(this, options);

  this.options = options;

  var requiredOptions = ['ModelClass'];
  requireOptions(this, requiredOptions);

  this.modelFieldNames = this.fields || this.getModelFieldNames(this.ModelClass);
  this.modelFieldNames.push('_id');
  this.modelFieldNames = _.uniq(this.modelFieldNames);

  this.arrayMethods = this.arrayMethods || ['$addToSet', '$pop', '$push', '$pull'];

  this.initialize.apply(this, arguments);

  this.__temp = Math.round(Math.random() * 1000);
};

_.extend(Restful.prototype, {

  initialize: function() {
    Promise.promisifyAll(this);
    this.ModelClass = Promise.promisifyAll(this.ModelClass);
  },

  select: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.SELECT);
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
        var fieldList = this.getFieldList(req, this.modelFieldNames);
        // q can override filter params
        var q = req.query.q;
        if (q) {
          var qExpr = [];
          _.forEach(this.qFields, function (qField) {
            var obj = {};
            obj[qField] = {$regex: '.*' + q + '.*', $options: 'i'}; // TODO: Extract a method
            qExpr.push(obj);
          });
          if (qExpr.length > 0) {
            filter.$or = qExpr;
          }
        }
        var query = this.ModelClass.find(filter, fieldList);
        // orderBy
        var orderBy = this.getOrderBy(req);
        if (orderBy) {
          query.sort(orderBy);
        }
        // limit
        limit = this.getLimit(req, this.config.defaultPerPage, this.config.maxPerPage);
        query.limit(limit);
        // page
        page = this.getPage(req);
        if (page > 1) {
          query.skip((page - 1) * limit);
        }
        return query;
      })
      .then(function (query) {
        return this.queryPipe ? this.queryPipe(query, req, res) : query;
      })
      .then(function (query) {
        return Promise.method(_.bind(query.lean().exec, query))();
      })
      .then(function (collection) {
        // run collection post precessing
        if (this.collectionPostAsync) {
          return this.collectionPostAsync(collection, req, res);
        } else {
          return collection;
        }
      })
      .then(function (collection) {
        // run post precessing
        if (this.postAsync) {
          var promises = _.collect(collection, function(model) {
            return this.postAsync(model, req, res);
          }, this);
          return Promise.all(promises);
        } else {
          return collection;
        }
      })
      .then(function (collection) {
        this.addLinkHeaders(req, res, page, limit, collection.length);
        setResData(res, collection);
        next();
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      }
    );
  },
  selectOne: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.SELECT_ONE);
    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req);
      })
      .then(function (query) {
        return this.queryPipe ? this.queryPipe(query, req, res) : query;
      })
      .then(function (query) {
        return Promise.method(_.bind(query.lean().exec, query))();
      })
      .then(function (model) {
        // run post precessing
        if (model && this.postAsync) {
          return this.postAsync(model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          setResData(res, model);
          next();
        }
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      })
    ;
  },
  insert: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.INSERT);
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
        const paramKeys = _.keys(req.params);
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
      .then(function (doc) {
        data = _.omit(doc, ['_id']); //  exclude _id
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
      .then(function (model) {
        model = model.toObject();
        // run post precessing
        if (this.postAsync) {
          return this.postAsync(model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        res.statusCode = HTTP_STATUSES.CREATED.code;
        setResData(res, _.pick(model, this.modelFieldNames));
        next();
      })
      .catch(function (err) {
        this.setResError(err, res);
        next();
      }
    );
  },
  update: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.UPDATE);
    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.buildConditionsAsync(req);
      })
      .then(function (conditions) {
        return this.ModelClass.findOneAsync(conditions);
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
        if (this.afterChange.Async) {
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
      .then(function (model) {
        model = model.toObject();
        if (this.postAsync) {
          return this.postAsync(model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        setResData(res, _.pick(model, this.modelFieldNames));
        next();
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      });
  },
  partialUpdate: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.PARTIAL_UPDATE);

    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.buildConditionsAsync(req);
      })
      .then(function (conditions) {
        return this.ModelClass.findOneAsync(conditions);
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
      .then(function (model) {
        model = model.toObject();
        if (this.postAsync) {
          return this.postAsync(model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        setResData(res, _.pick(model, this.modelFieldNames));
        next();
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      });
  },
  delete: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.DELETE);

    var vars = {};
    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req);
      })
      .then(function (query) {
        return Promise.method(_.bind(query.exec, query))();
      })
      .then(function (model) {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          vars.model = model;
          return this.beforeDeleteAsync(model, req);
        }
      })
      .then(function () {
        return vars.model.removeAsync();
      })
      .then(function (doc) {
        if (this.afterChangeAsync) {
          return this.afterChangeAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function (doc) {
        doc = doc.toObject();
        if (this.postAsync) {
          return this.postAsync(doc, req, res);
        } else {
          return doc;
        }
      })
      .then(function () {
        setResOk(res);
        next();
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      });
  },
  count: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.COUNT);
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
        var query = this.ModelClass.count(filter);
        return Promise.method(_.bind(query.exec, query))();
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
        setResData(res, countData);
        next();
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      }
    );
  },
  aggregate: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.AGGREGATE);

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
        // field list
        var project = {};
        _.forEach(this.modelFieldNames, function (field) {
          project[field] = 1;
        });
        // filter
        return this.getFilterAsync(req);
      })
      .then(function(filter) {
        // req agg conditions
        try {
          var reqAggConditions = this.getAggConditions(req);
        } catch (e) {
          throw HTTP_STATUSES.BAD_REQUEST.createError();
        }

        var aggConditions = [
          {$match: filter},
          {$project: project}
        ];
        _.forEach(reqAggConditions, function (aggCondition) {
          aggConditions.push(aggCondition);
        });

        // orderBy
        var orderBy = getOrderBy(req);
        if (orderBy) {
          aggConditions.push({$sort: orderBy});
        }
        // limit
        limit = this.getLimit(req, this.config.defaultPerPage, this.config.maxPerPage);
        aggConditions.push({$limit: parseInt(limit)});

        // page
        page = getPage(req);
        if (page > 1) {
          aggConditions.push({$skip: (page - 1) * limit});
        }
        aggConditions.push(this);
        this.ModelClass.aggregate.apply(this.ModelClass, aggConditions);
      })
      .then(function (collection) {
        // run collection post precessing
        if (this.collectionPostAsync) {
          return this.collectionPostAsync(collection, req, res);
        } else {
          return collection;
        }
      })
      .then(function (collection) {
        // run post precessing
        if (this.postAsync) {
          var promises = _.collect(collection, function(model) {
            return this.postAsync(model, req, res);
          }, this);
          return Promise.all(promises);
        } else {
          return collection;
        }
      })
      .then(function (collection) {
        this.addLinkHeaders(req, res, page, limit, collection.length);
        setResData(res, collection);
        next();
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      }
    );
  },
  getContext: function getContext(req) {
    return req.restifizer.context;
  },
  getModelFieldNames: function (ModelClass) {
    var paths = _.pluck(this.ModelClass.schema.paths, 'path');
    return _.filter(paths, function (fieldName) {
      return (fieldName == '_id' || fieldName.substr(0, 2) !== '__');
    })
  },
  getFieldList: function (req, modelFieldNames) {
    var fields;
    if (req.query.fields) {
      fields = req.query.fields.split(',');
      fields = _.intersection(fields, modelFieldNames)
      if (fields.length == 0) {
        fields.push('_id');
      }
    } else {
      fields = modelFieldNames;
    }
    return fields.join(' ');
  },
  getFilter: function (req, callback) {
    Promise
      .bind(this)
      .then(function () {
        return this.buildConditionsAsync(req);
      })
      .then(function (conditions) {
        var defaultFilter = this.defaultFilter ? this.defaultFilter : {};
        var filter = _.assign((req.query.filter ? JSON.parse(req.query.filter) : defaultFilter), conditions);
        this._normalizeFilter(filter, this.ModelClass);
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
    if (!req.query.per_page) {
      return defaultPerPage;
    } else {
      return req.query.per_page > maxPerPage ? maxPerPage : req.query.per_page;
    }
  },
  getPage: function (req) {
    return parseInt(req.query.page) || 1;
  },
  getAggConditions: function (req) {
    return req.query.conditions ? JSON.parse(req.query.conditions) : [];
  },
  addLinkHeaders: function (req, res, page, limit, currentLength) {
    var initialUrl = req.url;
    var cleanedUrl = initialUrl
      .replace('per_page=' + limit, '')
      .replace('page=' + page, '')
      .replace('&&', '&')
      .replace('&&', '&')
      .replace('?&', '?');

    var fullURL = req.protocol + '://' + req.get('host') + cleanedUrl;
    var links = {};
    // add prev
    if (page > 1) {
      var prevLink = fullURL + '&page=' + (page - 1) + '&per_page=' + limit;
      prevLink = prevLink
        .replace('&&', '&')
        .replace('?&', '?');
      links.prev = prevLink;
    }
    if (currentLength >= limit) {
      var nextLink = fullURL + '&page=' + (page + 1) + '&per_page=' + limit;
      nextLink = nextLink
        .replace('&&', '&')
        .replace('?&', '?');
      links.next = nextLink;
    }
    res.links(links);
  },
  /**
   * Assign all fields from source to dest according modelFieldNames
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
    this.setProp(dest, fieldName, source[fieldName]);
    callback();
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
      fieldName !== '_id' &&                                // It's not _id
      fieldName.substr(0, 2) !== '__' &&                    // It's not started with __ (version)
      (req.restifizer.action !== 'partialUpdate' || source[fieldName] !== undefined);
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
            // each affected field
            _.each(_.keys(methodBody), function (fieldName) {
              if (this.assignFilter(dest, methodBody, fieldName, req)) {
                if (this.beforeArrayMethod) {
                  this.beforeArrayMethod(dest, methodBody[fieldName], methodName, fieldName, req);
                }
                this.proceedArrayMethod(dest, methodBody[fieldName], methodName, fieldName, req);
              }
            }, this);
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
  proceedArrayMethod: function proceedArrayMethod(dest, source, methodName, fieldName, req) {

    // get sure we have an array
    if (dest[fieldName] === undefined) {
      dest[fieldName] = [];
    }

    if (methodName === '$addToSet') {
      dest[fieldName].addToSet(source);
    } else if (methodName === '$pop') {
      if (source === 1) {
        dest[fieldName].pop();
      } else if (source === -1) {
        dest[fieldName].shift();
      } else {
        throw new Error('Illegal param value for $pop method');
      }
    } else if (methodName === '$push') {
      dest[fieldName].push(source);
    } else if (methodName === '$pull') {
      dest[fieldName].pull(source);
    }
  },

  addLinkField: function (req, model, fieldName, pathFormat, hideOriginal) {
    if (model[fieldName]) {
      model[fieldName + '_url'] = req.protocol + '://' + req.get('host') +
      util.format(pathFormat, model[fieldName]);
      if (model._doc) {
        model._doc[fieldName + '_url'] = model[fieldName + '_url'];
      }
      if (hideOriginal) {
        model[fieldName] = undefined;
      }
    }
  },


  /**
   * Create query, which locates document regarding req params, and returns it to callback
   * @param req
   * @param callback
   */
  locateModel: function (req, callback) {
    Promise
      .bind(this)
      .then(function() {
        return this.buildConditionsAsync(req);
      })
      .then(function (conditions) {
        var fieldList = this.getFieldList(req, this.modelFieldNames);
        return this.ModelClass.findOne(conditions, fieldList);
      })
      .then(function (query) {
        callback(null, query);
      })
      .catch(function (err) {
        callback(err);
      })
    ;
  },

  /**
   * Builds object to passed as condition to mongoose
   * @param req
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
    callback(null, new this.ModelClass(data));
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
    doc.save(function(err, doc, numberAffected) {
      callback(err, doc);
    });
  },

  /**
   * Before delete handler
   * @param doc
   * @param req
   * @param callback
   */
  beforeDelete: function (doc, req, callback) {
    callback();
  },
  setResError: function (err, res) {
    setResError(err, res, this.log);
  },
  resolveProp: resolveProp,
  setProp: setProp,

  _normalizeFilter: function _normalizeFilter(filter, root) {
    _.forEach(_.keys(filter), function (key) {
      var path = root.schema.paths[key];
      // if it's an operator
      if (key.substr(0, 1) === '$') {
        // increase the level without changing the root
        this._normalizeFilter(filter[key], root);
      } else if (path) {
        var typeName = path.options.type.name;
        // it's embedded document
        if (!_.isUndefined(path.schema)) {
          this._normalizeFilter(filter[key], root.schema.paths[key]);
        } else if (typeName === 'ObjectId') {
          filter[key] = ObjectID(filter[key]);
        } else if (typeName === 'Date') {
          if (typeof(filter[key]) === 'string') {
            filter[key] = new Date(filter[key]);
          }
          else if (typeof(filter[key]) === 'object') {
            _.forOwn(filter[key], function (value, innerKey) {
              if (typeof(value) === 'string') {
                filter[key][innerKey] = new Date(value);
              }
            });
          }
        }
      }
    }, this);
  }
});

function RestfulFileField(options) {

  _.extend(this, options);

  this.options = options;

  var requiredOptions = ['ModelClass'];
  requireOptions(this, requiredOptions);

  this.modelFieldNames = this.fields || this.getModelFieldNames(this.ModelClass);

  this.initialize.apply(this, arguments);
}

_.extend(RestfulFileField.prototype, {

  initialize: function() {
    Promise.promisifyAll(this);
    this.ModelClass = Promise.promisifyAll(this.ModelClass);
  },

  selectOne: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.SELECT_ONE);

    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req);
      })
      .spread(function (model, fileField) {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          return [model, fileField];
        }
      })
      .spread(function (model, fileField) {
        return this.getFileFieldAsync(fileField, model);
      })
      .spread(function (file, contentType) {
        if (this.postAsync) {
          this.postAsync(file, req, res)
            .then(function() {
              return [file, contentType];
            });
        } else {
          return [file, contentType];
        }
      })
      .spread(function (file, contentType) {
        if (file) {
          res.header('Content-Type', contentType);
          file.stream(true).pipe(res);
        } else {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      }
    );
  },

  update: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.UPDATE);

    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req);
      })
      .spread(function (model, fileField) {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          return this.setFileFieldAsync(fileField, model, req, this.converter);
        }
      })
      .then(function(model) {
        return model.saveAsync();
      })
      .spread(function (model) {
        if (this.postAsync) {
          return this.postAsync(model, req, res);
        } else {
          return model;
        }
      })
      .then(function () {
        setResOk(res);
        next();
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      });
  },

  delete: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.DELETE);

    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req);
      })
      .spread(function (model, fileField) {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          return this.cleanFileField(fileField, model);
        }
      })
      .then(function(model) {
        return model.saveAsync();
      })
      .spread(function (model) {
        if (this.postAsync) {
          return this.postAsync(model, req, res);
        } else {
          return model;
        }
      })
      .then(function () {
        setResOk(res);
        next();
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      });
  },

  getFileField: function (fieldName, model, callback) {
    var fileMeta = this.getFieldValue(model, fieldName);
    if (fileMeta) {
      if (typeof(fileMeta) === 'object') {
        Promise
          .bind(this)
          .then(function () {
            return gridfs.getFileAsync(this.ModelClass.db.db, fileMeta.fileId);
          })
          .then(function (file) {
            callback(null, file, fileMeta.contentType);
          })
          .catch(function (err) {
            callback(err);
          });
      } else {
        callback(new Error('Wrong fileMeta'));
      }
    } else {
      callback(HTTP_STATUSES.NOT_FOUND.createError());
    }
  },

  setFileField: function (fieldName, model, req, converter, callback) {
    var file = req.files && req.files[fieldName];
    if (file) {
      Promise
        .bind(this)
        .then(function () {
          var magic = new Magic(mmm.MAGIC_MIME_TYPE);
          Promise.promisifyAll(magic);
          return magic.detectFileAsync(file.path);
        })
        .then(function (mimeType) {
          var options = {mimeType: mimeType, path: file.path};
          if (converter) {
            return this.converterAsync(options)
          } else {
            return options;
          }
        })
        .then(function (result) {
          var options = {content_type: result.mimeType};
          var fieldValue = this.getFieldValue(model, fieldName);
          if (fieldValue) {
            return gridfs.replaceFileAsync(this.ModelClass.db.db, fieldValue.fileId, result.path, options);
          } else {
            return gridfs.putFileAsync(this.ModelClass.db.db, result.path, options);
          }
        })
        .then(function (result) {
          var fieldValue = this.setFieldValue(model, fieldName, result);
          callback(null, model);
        })
        .catch(function (err) {
          callback(err);
        })
      ;
    } else {
      callback(null, model);
    }
  },

  cleanFileField: function (fieldName, model, callback) {
    var fileMeta = this.getFieldValue(model, fieldName);
    if (fileMeta) {
      Promise
        .bind(this)
        .then(function () {
          return gridfs.deleteFileAsync(this.ModelClass.db.db, fileMeta.fileId);
        })
        .then(function () {
          this.setFieldValue(model, fieldName, undefined);
          callback(null, model);
        })
        .catch(function (err) {
          callback(err);
        })
      ;
    } else {
      callback(HTTP_STATUSES.NOT_FOUND.createError());
    }
  },

  getModelFieldNames: function (ModelClass) {
    var paths = _.pluck(this.ModelClass.schema.paths, 'path');
    return _.filter(paths, function (fieldName) {
      return (fieldName == '_id' || fieldName.substr(0, 2) !== '__');
    })
  },

  locateModel: function (req, callback) {
    var fileField;
    if (this.fileField.type === 'function') {
      fileField = this.fileField();
    } else {
      fileField = this.fileField;
    }
    // fill params
    _.each(_.keys(req.params), function(key) {
      fileField = fileField.replace(':' + key, req.params[key]);
    });
    Promise
      .bind(this)
      .then(function () {
        return this.buildConditionsAsync(req);
      })
      .then(function (conditions) {
        return this.ModelClass.findOneAsync(conditions, fileField);
      })
      .then(function (model) {
        callback(null, model, fileField);
      })
      .catch(function (err) {
        callback(err);
      })
  },

  buildConditions: function (req, callback) {
    return callback(null, _.pick(req.params, _.keys(req.params)));
  },

  getFieldValue: function(model, fieldName) {
    return model.get(fieldName);
  },

  setFieldValue: function(model, fieldName, value) {
    this.setProp(model, fieldName, value);
  },

  resolveProp: resolveProp,

  setProp: setProp
});

Restful.extend = RestfulFileField.extend = extend;

var CommonController = {
  /**
   * Returns handler for authentication.
   * @param options options of the current method
   * @returns function to handle
   */
  getAuth: function (options) {
    return function(req, res, callback) {
      callback();
    };
  }
};

var Controller = Restful.extend(_.extend(CommonController, {
  constructor: function(options) {
    Restful.apply(this, arguments)

    var requiredOptions = ['ModelClass', 'path'];
    requireOptions(this, requiredOptions);

    // init
    this.defaultOptions = _.defaults(this.defaultOptions || {} ,
      {
        enabled: true
      });

    this.selectOptions        = _.defaults(this.selectOptions         || {}, this.defaultOptions);
    this.selectOneOptions     = _.defaults(this.selectOneOptions      || this.selectOptions, this.defaultOptions);
    this.insertOptions        = _.defaults(this.insertOptions         || {}, this.defaultOptions);
    this.updateOptions        = _.defaults(this.updateOptions         || this.insertOptions, this.defaultOptions);
    this.partialUpdateOptions = _.defaults(this.partialUpdateOptions  || this.updateOptions, this.defaultOptions);
    this.deleteOptions        = _.defaults(this.deleteOptions         || this.updateOptions, this.defaultOptions);
    this.countOptions         = _.defaults(this.countOptions          || this.selectOptions, this.defaultOptions);
    this.aggregateOptions     = _.defaults(this.aggregateOptions      || this.selectOptions, this.defaultOptions);
  },
  qFields: [],
  idField: '_id',

  initialize: function() {
    Restful.prototype.initialize.apply(this, arguments);
  },

  bind: function (app) {
    var _this = this;

    if (typeof(this.path) === 'string') {
      this.path = [this.path];
    }
    _.forEach(this.path, _.bind(function (path) {
      if (this.selectOptions.enabled) {
        app.get(path,
          this.getAuth(this.selectOptions),
          function (req, res, next) {
            _this.select.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.countOptions.enabled) {
        app.get(path + '/count',
          this.getAuth(this.countOptions),
          function (req, res, next) {
            _this.count.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.aggregateOptions.enabled) {
        app.get(path + '/aggregate',
          this.getAuth(this.aggregateOptions),
          function (req, res, next) {
            _this.aggregate.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.selectOneOptions.enabled) {
        app.get(path + '/:' + this.idField,
          this.getAuth(this.selectOneOptions),
          function (req, res, next) {
            _this.selectOne.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.insertOptions.enabled) {
        app.post(path,
          this.getAuth(this.insertOptions),
          function (req, res, next) {
            _this.insert.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.updateOptions.enabled) {
        app.put(path + '/:' + this.idField,
          this.getAuth(this.updateOptions),
          function (req, res, next) {
            _this.update.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.partialUpdateOptions.enabled) {
        app.patch(path + '/:' + this.idField,
          this.getAuth(this.partialUpdateOptions),
          function (req, res, next) {
            _this.partialUpdate.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.deleteOptions.enabled) {
        app.delete(path + '/:' + this.idField,
          this.getAuth(this.deleteOptions),
          function (req, res, next) {
            _this.delete.apply(_this, arguments);
          },
          this.resultSender
        );
      }
    }, this));
  },
  resultSender: function(req, res) {
    res.send(res.restfulResult);
  }
}));

var FileFieldController = RestfulFileField.extend(_.extend(CommonController, {

  supportedMethod: 'put',
  supportedMethods: null,

  constructor: function(options) {
    RestfulFileField.apply(this, arguments);

    _.extend(this, options);

    var requiredOptions = ['ModelClass', 'path'];
    requireOptions(this, requiredOptions);

    // init

    this.defaultOptions = {
      enabled: true
    };

    this.selectOneOptions = _.defaults(this.selectOneOptions  || {}, this.defaultOptions);
    this.updateOptions    = _.defaults(this.updateOptions     || {}, this.defaultOptions);
    this.deleteOptions    = _.defaults(this.deleteOptions     || {}, this.defaultOptions);
  },

  initialize: function() {
    RestfulFileField.prototype.initialize.apply(this, arguments);
  },

  bind: function (app) {
    var _this = this;
    if (typeof(this.path) === 'string') {
      this.path = [this.path];
    }
    _.forEach(this.path, _.bind(function (path) {
      if (this.selectOneOptions.enabled) {
        app.get(path,
          this.getAuth(this.selectOneOptions),
          function (req, res, next) {
            _this.selectOne.apply(_this, arguments);
          },
          _this.resultSender
        );
      }
      if (this.updateOptions.enabled) {
        var supportedMethods = _this.supportedMethods || [_this.supportedMethod];
        _.each(supportedMethods, function (supportedMethod) {
          app[supportedMethod.toLowerCase()](path,
            _this.getAuth(_this.updateOptions),
            function (req, res, next) {
              _this.update.apply(_this, arguments);
            },
            _this.resultSender
          );
        })
      }
      if (this.deleteOptions.enabled) {
        app.delete(path,
          this.getAuth(this.deleteOptions),
          function (req, res, next) {
            _this.delete.apply(_this, arguments);
          },
          _this.resultSender
        );
      }
    }, this));
  },
  resultSender: function(req, res) {
    res.send(res.restfulResult);
  }
}));

function merge(originalOptions, defaults) {
  var options = _.defaults(originalOptions, defaults);
  options.select = _.defaults(options.select, defaults.select);
  options.selectOne = _.defaults(options.selectOne, defaults.selectOne);
  options.insert = _.defaults(options.insert, defaults.insert);
  options.update = _.defaults(options.update, defaults.update);
  options.partialUpdate = _.defaults(options.partialUpdate, defaults.partialUpdate);
  options.delete = _.defaults(options.delete, defaults.delete);
  options.count = _.defaults(options.count, defaults.count);
  options.aggregate = _.defaults(options.aggregate, defaults.aggregate);
  return options;
}

function setResData(res, data) {
  res.restfulResult = data;
}

function setResError(err, res, log) {
  var errorStatus,
    errorMessage,
    errorDetails;

  if (!err) {
    err = HTTP_STATUSES.INTERNAL_SERVER_ERROR.createError();
  }
  else if (!(err instanceof Error)) {
    err = new Error(err.message, err.details);
  }

  if (err.httpStatus) {
    errorStatus = err.httpStatus;
  }
  else if (err.name == 'ValidationError') {
    errorStatus = HTTP_STATUSES.BAD_REQUEST;
    errorDetails = err.errors;
  }
  else if (err.name == 'CastError') {
    errorStatus = HTTP_STATUSES.BAD_REQUEST;
    errorDetails = {};
    errorDetails[err.path] = {
      message: err.message,
      name: err.name,
      path: err.path,
      type: err.type,
      value: err.value
    };
    errorMessage = 'CastError';
  }
  else if (err.name == 'MongoError' && (err.code == 11000 || err.code == 11001)) { // E11000(1) duplicate key error index
    errorStatus = HTTP_STATUSES.BAD_REQUEST;
    errorDetails = err.err;
  }
  else if (err.name == 'VersionError') {
    errorStatus = HTTP_STATUSES.CONFLICT;
    errorDetails = err.message;
  }
  else {
    errorStatus = HTTP_STATUSES.INTERNAL_SERVER_ERROR;
  }

  errorMessage = errorMessage || err.message;
  errorDetails = errorDetails || err.errorDetails;

  res.statusCode = errorStatus.code;
  setResData(res, {error: errorStatus.message, message: errorMessage, details: errorDetails});
  if (log) {
    log.error('Error(%d): %s: %s', errorStatus.code, errorMessage, errorDetails ? errorDetails : '');
  } else {
    console.log('error: ' + 'Error(' + errorStatus.code + '): ' + errorMessage + ': ' + errorDetails ? errorDetails : '');
  }

  // extract stack data
  var data = {};

  try {
    var stacklist = err.stack.split('\n').slice(3);
    // Stack trace format :
    // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
    var s = stacklist[0], sp = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi
        .exec(s)
      || /at\s+()(.*):(\d*):(\d*)/gi.exec(s);
    if (sp && sp.length === 5) {
      data.method = sp[1];
      data.path = sp[2];
      data.line = sp[3];
      data.pos = sp[4];
      data.file = path.basename(data.path);
      data.stack = stacklist.join('\n');
    } else {
      data.raw = err.stack;
    }
  } catch (e) {
    if (log) {
      log.error('Error in error handler!');
    } else {
      console.log('error: ' + 'Error in error handler!');
    }
    data.raw = err.stack;
  }

  if (log) {
    log.error(data);
  } else {
    console.log('error: ' + data);
  }
}

function requireOptions(options, requireOptionKeys) {
  for (var i = 0; i < requireOptionKeys.length; i++) {
    var key = requireOptionKeys[i];
    if (_.isUndefined(options[key])) {
      throw new TypeError('"' + key  + '" is required');
    }
  }
}

function setResOk(res) {
  res.statusCode = HTTP_STATUSES.OK.code;
}

function resolveProp(obj, stringPath) {
  stringPath = stringPath.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
  stringPath = stringPath.replace(/^\./, '');           // strip a leading dot
  var pathArray = stringPath.split('.');
  while (pathArray.length) {
    var pathItem = pathArray.shift();
    if (pathItem in obj) {
      obj = obj[pathItem];
    } else {
      return;
    }
  }
  return obj;
}

function setProp(obj, stringPath, value) {
  stringPath = stringPath.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
  stringPath = stringPath.replace(/^\./, '');           // strip a leading dot
  var pathArray = stringPath.split('.');
  while (pathArray.length - 1) {
    var pathItem = pathArray.shift();
    if (pathItem in obj) {
      obj = obj[pathItem];
    } else {
      return;
    }
  }
  return obj[pathArray.length ? pathArray[0] : stringPath] = value;
}

Controller.extend = FileFieldController.extend = extend;
Controller.ACTIONS = FileFieldController.ACTIONS = RestifizerScope.ACTIONS;

module.exports.Controller = Controller;
module.exports.FileFieldController = FileFieldController;
