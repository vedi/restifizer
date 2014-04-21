var util      = require('util');
var path      = require('path');
var _         = require('lodash');
var Q         = require('q');
var passport  = require('passport');

var mongoose  = require("mongoose");

var mmm       = require('mmmagic'),
  Magic       = mmm.Magic;

var gridfs    = require('./gridfs');
var utils     = require('./utils');

var HTTP_STATUSES   = utils.HTTP_STATUSES;
var extend          = utils.extend;
var HttpError       = utils.HttpError;
var ObjectID        = mongoose.mongo.BSONPure.ObjectID;

Q.longStackSupport = true;

function Restful(options) {

  _.extend(this, options);

  this.options = options;

  var requiredOptions = ['ModelClass'];
  requireOptions(this, requiredOptions);

  this.modelFieldNames = this.fields || this.getModelFieldNames(this.ModelClass);
  this.modelFieldNames.push("_id");
  this.modelFieldNames = _.uniq(this.modelFieldNames);

  this.initialize.apply(this, arguments);
};

_.extend(Restful.prototype, {

  initialize: function() {
  },

  select: function (req, res, next) {
    req.restifizer = {
      action: 'select',
      context: {}
    };
    var limit;
    var page;
    _this = this;
    Q
      .nfcall(_.bind(_this.selectOptions.pre, _this), req, res)
      .then(function () {
        // filter
        return Q.ninvoke(_this, 'getFilter', req);
      })
      .then(function(filter) {
        // field list
        var fieldList = _this.getFieldList(req, _this.modelFieldNames);
        // q can override filter params
        var q = req.query.q;
        if (q) {
          var qExpr = [];
          _.forEach(_this.qFields, function (qField) {
            var obj = {};
            obj[qField] = {$regex: '.*' + q + ".*", $options: 'i'};
            qExpr.push(obj);
          });
          if (qExpr.length > 0) {
            filter.$or = qExpr;
          }
        }
        var query = _this.ModelClass.find(filter, fieldList);
        // orderBy
        var orderBy = _this.getOrderBy(req);
        if (orderBy) {
          query.sort(orderBy);
        }
        // limit
        limit = _this.getLimit(req, _this.config.defaultPerPage, _this.config.maxPerPage);
        query.limit(limit);
        // page
        page = _this.getPage(req);
        if (page > 1) {
          query.skip((page - 1) * limit);
        }
        return query;
      })
      .then(function (query) {
        return _this.selectOptions.queryPipe ? _this.selectOptions.queryPipe.apply(_this, [query, req, res]) : query;
      })
      .then(function (query) {
        return Q.ninvoke(query.lean(), 'exec');
      })
      .then(function (collection) {
        // run collection post precessing
        if (_this.selectOptions.collectionPost) {
          return Q.nfcall(_.bind(_this.selectOptions.collectionPost, _this), collection, req, res);
        } else {
          return collection;
        }
      })
      .then(function (collection) {
        // run post precessing
        if (_this.selectOptions.post) {
          var promises = _.collect(collection, function(model) {
            return Q.nfcall(_.bind(_this.selectOptions.post, _this), model, req, res);
          });
          return Q.all(promises);
        } else {
          return collection;
        }
      })
      .then(function (collection) {
        _this.addLinkHeaders(req, res, page, limit, collection.length);
        setResData(res, collection);
        next();
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      }
    );
  },
  selectOne: function (req, res, next) {
    req.restifizer = {
      action: 'selectOne',
      context: {}
    };
    var _this = this;
    //noinspection JSCheckFunctionSignatures
    Q
      .nfcall(_.bind(_this.selectOneOptions.pre, _this), req, res)
      .then(function () {
        return Q.ninvoke(_this, 'locateModel', req);
      })
      .then(function (query) {
        return _this.selectOptions.queryPipe ? _this.selectOptions.queryPipe.apply(_this, [query, req, res]) : query;
      })
      .then(function (query) {
        return Q.ninvoke(query.lean(), 'exec');
      })
      .then(function (model) {
        // run post precessing
        if (model && _this.selectOneOptions.post) {
          return Q.nfcall(_.bind(_this.selectOneOptions.post, _this), model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        if (!model) {
          throw createHttpStatusError(HTTP_STATUSES.NOT_FOUND);
        } else {
          setResData(res, model);
          next();
        }
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      }
    );
  },
  insert: function (req, res, next) {
    req.restifizer = {
      action: 'insert',
      context: {}
    };
    var _this = this;
    Q
      .try(function () {
        return Q.nfcall(_.bind(_this.insertOptions.pre, _this), req, res);
      })
      .then(function () {
        return Q.ninvoke(_this, 'prepareData', req, res);
      })
      .then(function (data) {
        // add params
        const paramKeys = _.keys(req.params);
        var params = _.pick(req.params, paramKeys);
        return Q.ninvoke(_this, "assignFields", data, _.assign(req.body, params), req);
      })
      .then(function (doc) {
        data = _.omit(doc, ['_id']); //  exclude _id
        return Q.ninvoke(_this, 'createDocument', data, req, res);
      })
      .then(function (doc) {
        return Q.ninvoke(_this, 'saveDocument', doc, req, res);
      })
      .then(function (model) {
        if (_this.insertOptions.queryPipe) {
          return Q.nfcall(_.bind(_this.insertOptions.queryPipe, _this), model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        model = model.toObject();
        // run post precessing
        if (_this.insertOptions.post) {
          return Q.nfcall(_.bind(_this.insertOptions.post, _this), model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        if (_this.redisClient) {
          // publish event
          _this.redisClient.publish(_this.config.redisKeyPrefix + ".resourceChanged." + _this.path + ".inserted", JSON.stringify(model));
        }
        return model;
      })
      .then(function (model) {
        res.statusCode = HTTP_STATUSES.CREATED.code;
        setResData(res, _.pick(model, _this.modelFieldNames));
        next();
      })
      .catch(function (err) {
        _this.setResError(err, res);
        next();
      }
    );
  },
  update: function (req, res, next) {
    req.restifizer = {
      action: 'update',
      context: {}
    };
    var _this = this;
    Q
      .nfcall(_.bind(_this.updateOptions.pre, _this), req, res)
      .then(function () {
        return Q.ninvoke(_this, 'buildConditions', req);
      })
      .then(function (conditions) {
        return Q.ninvoke(_this.ModelClass, "findOne", conditions);
      })
      .then(function (model) {
        if (!model) {
          throw createHttpStatusError(HTTP_STATUSES.NOT_FOUND);
        }
        return Q.ninvoke(_this, "assignFields", model, req.body, req);
      })
      .then(function (doc) {
        return Q.ninvoke(_this, 'updateDocument', doc, req, res);
      })
      .then(function (doc) {
        return Q.ninvoke(_this, 'saveDocument', doc, req, res);
      })
      .then(function (model) {
        if (_this.updateOptions.queryPipe) {
          return Q.nfcall(_.bind(_this.updateOptions.queryPipe, _this), model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        model = model.toObject();
        if (_this.updateOptions.post) {
          return Q.nfcall(_.bind(_this.updateOptions.post, _this), model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        // publish event
        if (_this.redisClient) {
          // publish event
          _this.redisClient.publish(_this.config.redisKeyPrefix + ".resourceChanged." + _this.path + ".updated", JSON.stringify(model));
        }
        return model;
      })
      .then(function (model) {
        setResData(res, _.pick(model, _this.modelFieldNames));
        next();
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      });
  },
  partialUpdate: function (req, res, next) {
    req.restifizer = {
      action: 'partialUpdate',
      context: {}
    };
    var _this = this;
    Q
      .nfcall(_.bind(_this.partialUpdateOptions.pre, _this), req, res)
      .then(function () {
        return Q.ninvoke(_this, 'buildConditions', req);
      })
      .then(function (conditions) {
        return Q.ninvoke(_this.ModelClass, 'findOne', conditions);
      })
      .then(function (model) {
        if (!model) {
          throw createHttpStatusError(HTTP_STATUSES.NOT_FOUND);
        }
        return Q.ninvoke(_this, "assignFields", model, req.body, req);
      })
      .then(function (doc) {
        return Q.ninvoke(_this, 'updateDocument', doc, req, res);
      })
      .then(function (doc) {
        return Q.ninvoke(_this, 'saveDocument', doc, req, res);
      })
      .then(function (model) {
        if (_this.partialUpdateOptions.queryPipe) {
          return Q.nfcall(_.bind(_this.partialUpdateOptions.queryPipe, _this), model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        model = model.toObject();
        if (_this.partialUpdateOptions.post) {
          return Q.nfcall(_.bind(_this.partialUpdateOptions.post, _this), model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        // publish event
        if (_this.redisClient) {
          // publish event
          _this.redisClient.publish(_this.config.redisKeyPrefix + ".updated." + _this.path + ".inserted", JSON.stringify(model));
        }
        return model;
      })
      .then(function (model) {
        setResData(res, _.pick(model, _this.modelFieldNames));
        next();
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      });
  },
  delete: function (req, res, next) {
    req.restifizer = {
      action: 'delete',
      context: {}
    };
    var _this = this;
    Q
      .nfcall(_.bind(_this.deleteOptions.pre, _this), req, res)
      .then(function () {
        return Q.ninvoke(_this, 'buildConditions', req);
      })
      .then(function (conditions) {
        return Q.ninvoke(_this.ModelClass, 'findOne', conditions);
      })
      .then(function (model) {
        if (!model) {
          throw createHttpStatusError(HTTP_STATUSES.NOT_FOUND);
        } else {
          return Q.ninvoke(model, 'remove');
        }
      })
      .then(function (model) {
        model = model.toObject();
        if (_this.deleteOptions.post) {
          return Q.nfcall(_.bind(_this.deleteOptions.post, _this), model, req, res);
        } else {
          return model;
        }
      })
      .then(function (model) {
        // publish event
        if (_this.redisClient) {
          // publish event
          _this.redisClient.publish(_this.config.redisKeyPrefix + ".resourceChanged." + _this.path + ".deleted", JSON.stringify(model));
        }
        return model;
      })
      .then(function () {
        setResOk(res);
        next();
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      });
  },
  count: function (req, res, next) {
    req.restifizer = {
      action: 'count',
      context: {}
    };
    var _this = this;
    Q
      .nfcall(_.bind(_this.countOptions.pre, _this), req, res)
      .then(function () {
        // filter
        return Q.ninvoke(_this, 'getFilter', req);
      })
      .then(function(filter) {
        var query = _this.ModelClass.count(filter);
        return Q.ninvode(query, 'exec');
      })
      .then(function (count) {
        if (_this.countOptions.post) {
          return Q.nfcall(_.bind(_this.countOptions.post, _this), {count: count}, req, res);
        } else {
          return count;
        }
      })
      .then(function (count) {
        setResData(res, count);
        next();
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      }
    );
  },
  aggregate: function (req, res, next) {
    req.restifizer = {
      action: 'aggregate',
      context: {}
    };
    var _this = this;

    var limit;
    var page;
    Q
      .nfcall(_.bind(_this.aggregateOptions.pre, _this), req, res)
      .then(function () {
        // field list
        var project = {};
        _.forEach(_this.modelFieldNames, function (field) {
          project[field] = 1;
        });
        // filter
        return Q.ninvoke(_this, 'getFilter', req);
      })
      .then(function(filter) {
        // req agg conditions
        try {
          var reqAggConditions = _this.getAggConditions(req);
        } catch (e) {
          throw createHttpStatusError(HTTP_STATUSES.BAD_REQUEST);
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
        limit = _this.getLimit(req, _this.config.defaultPerPage, _this.config.maxPerPage);
        aggConditions.push({$limit: parseInt(limit)});

        // page
        page = getPage(req);
        if (page > 1) {
          aggConditions.push({$skip: (page - 1) * limit});
        }
        aggConditions.push(_this);
        _this.ModelClass.aggregate.apply(_this.ModelClass, aggConditions);
      })
      .then(function (collection) {
        // run collection post precessing
        if (_this.aggregateOptions.collectionPost) {
          return Q.nfcall(_.bind(_this.collectionPost.post, _this), collection, req, res);
        } else {
          return collection;
        }
      })
      .then(function (collection) {
        // run post precessing
        if (_this.aggregateOptions.post) {
          var promises = _.collect(collection, function(model) {
            return Q.nfcall(_.bind(_this.aggregateOptions.post, _this), model, req, res);
          });
          var deferred = Q.defer();
          Q.all(promises)
            .then(function () {
              deferred.resolve();
            })
            .catch(function (err) {
              deferred.reject(err);
            })
          ;
          return deferred.promise;
        } else {
          return collection;
        }
      })
      .then(function (collection) {
        _this.addLinkHeaders(req, res, page, limit, collection.length);
        setResData(res, collection);
        next();
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      }
    );
  },
  getModelFieldNames: function (ModelClass) {
    var paths = _.pluck(this.ModelClass.schema.paths, 'path');
    return _.filter(paths, function (fieldName) {
      return (fieldName == '_id' || fieldName.substr(0, 2) !== "__");
    })
  },
  getFieldList: function (req, modelFieldNames) {
    var fields;
    if (req.query.fields) {
      fields = req.query.fields.split(',');
      fields = _.intersection(fields, modelFieldNames)
      if (fields.length == 0) {
        fields.push("_id");
      }
    } else {
      fields = modelFieldNames;
    }
    return fields.join(' ');
  },
  getFilter: function (req, callback) {
    Q
      .try(function() {
        return Q.ninvoke(_this, 'buildConditions', req);
      })
      .then(function (conditions) {
        var filter = _.assign((req.query.filter ? JSON.parse(req.query.filter) : {}), conditions);
        _.forEach(_.keys(filter), function (key) {
          var path = _this.ModelClass.schema.paths[key];
          if (path) {
            if (path.options.type.name == "ObjectId") {
              filter[key] = ObjectID(filter[key]);
            }
            else if (path.options.type.name == "Date") {
              if (typeof(filter[key]) == "string") {
                filter[key] = new Date(filter[key]);
              }
              else if (typeof(filter[key]) == "object") {
                _.forOwn(filter[key], function (value, innerKey) {
                  if (typeof(value == "string")) {
                    filter[key][innerKey] = new Date(value);
                  }
                });
              }
            }
          }
        });
        callback(null, filter);
      })
      .catch(function (err) {
        callback(err);
      })
    ;
  },
  getOrderBy: function (req) {
    return req.query.orderBy ? JSON.parse(req.query.orderBy) : null;
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
      .replace('per_page=' + limit, "")
      .replace('page=' + page, "")
      .replace('&&', "&")
      .replace('&&', "&")
      .replace('?&', "?");

    var fullURL = req.protocol + "://" + req.get('host') + cleanedUrl;
    var links = {};
    // add prev
    if (page > 1) {
      var prevLink = fullURL + "&page=" + (page - 1) + "&per_page=" + limit;
      prevLink = prevLink
        .replace('&&', "&")
        .replace('?&', "?");
      links.prev = prevLink;
    }
    if (currentLength >= limit) {
      var nextLink = fullURL + "&page=" + (page + 1) + "&per_page=" + limit;
      nextLink = nextLink
        .replace('&&', "&")
        .replace('?&', "?");
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
    var _this = this;
    _.each(_.keys(source), function (fieldName) {
      if (_this.assignFilter(dest, source, fieldName, req)) {
        promises.push(Q.ninvoke(_this, "assignField", dest, source, fieldName, req));
      }
    });

    Q
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
    return _.contains(this.modelFieldNames, fieldName) &&
      fieldName != '_id' &&
      fieldName.substr(0, 2) !== "__" &&
      (req.restifizer.action !== 'partialUpdate' || source[fieldName] !== undefined);
  },

  addLinkField: function (req, model, fieldName, pathFormat, hideOriginal) {
    if (model[fieldName]) {
      model[fieldName + "_url"] = req.protocol + "://" + req.get('host') +
        util.format(pathFormat, model[fieldName]);
      if (model._doc) {
        model._doc[fieldName + "_url"] = model[fieldName + "_url"];
      }
      if (hideOriginal) {
        model[fieldName] = undefined;
      }
    }
  },

  /**
   * Locates document regarding req params, and returns it to callback
   * @param req
   * @param callback
   */
  locateModel: function (req, callback) {

    var _this = this;
    Q
      .try(function() {
        var fieldList = this.getFieldList(req, this.modelFieldNames);
      })
      .then(function (conditions) {
        return Q.ninvoke(_this.ModelClass, 'findOne', conditions, fileField);
      })
      .spread(function (model, fileField) {
        callback(null, model, fileField);
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
   * Prepare data to instantinate new document
   * @param req
   * @param res
   * @param callback
   */
  prepareData: function (req, res, callback) {
    callback(null, {});
  },
  /**
   * Create new document instance
   * @param data
   * @param req
   * @param res
   * @param callback
   */
  createDocument: function (data, req, res, callback) {
    callback(null, new this.ModelClass(data));
  },
  /**
   * Handler, called after assign all new values, but before save in update opreations.
   * @param doc
   * @param req
   * @param res
   * @param callback
   */
  updateDocument: function (doc, req, res, callback) {
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
  setResError: function (err, res) {
    setResError(err, res, this.log);
  },
  resolveProp: resolveProp,
  setProp: setProp
});

function RestfulFileField(options) {

  _.extend(this, options);

  this.options = options;

  var requiredOptions = ['ModelClass'];
  requireOptions(options, requiredOptions);

  this.modelFieldNames = this.fields || this.getModelFieldNames(this.ModelClass);

  this.initialize.apply(this, arguments);
}

_.extend(RestfulFileField.prototype, {

  initialize: function() {
  },

  selectOne: function (req, res, next) {
    req.restifizer = {
      action: 'selectOne',
      context: {}
    };
    var _this = this;
    //noinspection JSCheckFunctionSignatures
    Q
      .nfcall(_.bind(_this.selectOneOptions.pre, _this), req, res)
      .then(function () {
        return Q.ninvoke(_this, 'locateModel', req);
      })
      .spread(function (model, fileField) {
        if (!model) {
          throw createHttpStatusError(HTTP_STATUSES.NOT_FOUND);
        } else {
          return [model, fileField];
        }
      })
      .spread(function (model, fileField) {
        return Q.ninvoke(_this, 'getFileField', fileField, model);
      })
      .spread(function (file, contentType) {
        var deferred = Q.defer();
        try {
          if (_this.selectOneOptions.post) {
            _this.selectOneOptions.post(file, req, res, function() {
              deferred.resolve([file, contentType]);
            });
          } else {
            deferred.resolve([file, contentType]);
          }
        } catch (e) {
          deferred.reject(e);
        }
        return deferred.promise;
      })
      .spread(function (file, contentType) {
        if (file) {
          res.header("Content-Type", contentType);
          file.stream(true).pipe(res);
        } else {
          throw createHttpStatusError(HTTP_STATUSES.NOT_FOUND);
        }
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      }
    );
  },

  update: function (req, res, next) {
    req.restifizer = {
      action: 'update',
      context: {}
    };
    var _this = this;
    Q
      .nfcall(_.bind(_this.updateOptions.pre, _this), req, res)
      .then(function () {
        return Q.ninvoke(_this, 'locateModel', req);
      })
      .spread(function (model, fileField) {
        if (!model) {
          throw createHttpStatusError(HTTP_STATUSES.NOT_FOUND);
        } else {
          return Q.ninvoke(_this, 'setFileField', fileField, model, req, _this.converter);
        }
      })
      .then(function(model) {
        return Q.ninvoke(model, 'save');
      })
      .spread(function (model) {
        if (_this.updateOptions.post) {
          return Q.nfcall(_.bind(_this.updateOptions.post, _this), model, req, res);
        } else {
          return model;
        }
      })
      .then(function () {
        setResOk(res);
        next();
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      });
  },

  delete: function (req, res, next) {
    req.restifizer = {
      action: 'delete',
      context: {}
    };
    var _this = this;
    Q
      .nfcall(_.bind(_this.deleteOptions.pre, _this), req, res)
      .then(function () {
        return Q.ninvoke(_this, 'locateModel', req);
      })
      .spread(function (model, fileField) {
        if (!model) {
          throw createHttpStatusError(HTTP_STATUSES.NOT_FOUND);
        } else {
          return Q.ninvoke(_this, 'cleanFileField', fileField, model);
        }
      })
      .then(function(model) {
        return Q.ninvoke(model, 'save');
      })
      .spread(function (model) {
        if (_this.deleteOptions.post) {
          return Q.nfcall(_.bind(_this.deleteOptions.post, _this), model, req, res);
        } else {
          return model;
        }
      })
      .then(function () {
        setResOk(res);
        next();
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      });
  },

  getFileField: function (fieldName, model, callback) {
    var fileMeta = this.getFieldValue(model, fieldName);
    if (fileMeta) {
      if (typeof(fileMeta) === "object") {
        Q
          .try(function () {
            return Q.ninvoke(gridfs, 'getFile', fileMeta.fileId);
          })
          .then(function (file) {
            callback(null, file, fileMeta.contentType);
          })
          .catch(function (err) {
            callback(err);
          });
      } else {
        callback(new Error("Wrong fileMeta"));
      }
    } else {
      callback();
    }
  },

  setFileField: function (fieldName, model, req, converter, callback) {
    var _this = this;
    var file = req.files && req.files[fieldName];
    if (file) {
      Q
        .try(function () {
          var magic = new Magic(mmm.MAGIC_MIME_TYPE);
          return Q.ninvoke(magic, 'detectFile', file.path);
        })
        .then(function (mimeType) {
          var options = {mimeType: mimeType, path: file.path};
          if (converter) {
            return Q.ninvoke(_this, 'converter', options)
          } else {
            return options;
          }
        })
        .then(function (result) {
          var options = {content_type: result.mimeType};
          var fieldValue = _this.getFieldValue(model, fieldName);
          if (fieldValue) {
            return Q.ninvoke(gridfs, 'replaceFile', fieldValue.fileId, result.path, options);
          } else {
            return Q.ninvoke(gridfs, 'putFile', result.path, options);
          }
        })
        .then(function (result) {
          var fieldValue = _this.setFieldValue(model, fieldName, result);
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
    var _this = this;
    var fileMeta = this.getFieldValue(model, fieldName);
    if (fileMeta) {
      Q
        .try(function () {
          return Q.ninvoke(gridfs, 'deleteFile', fileMeta.fileId);
        })
        .then(function () {
          _this.setFieldValue(model, fieldName, undefined);
          callback(null, model);
        })
        .catch(function (err) {
          callback(err);
        })
      ;
    } else {
      callback(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
    }
  },

  getModelFieldNames: function (ModelClass) {
    var paths = _.pluck(this.ModelClass.schema.paths, 'path');
    return _.filter(paths, function (fieldName) {
      return (fieldName == '_id' || fieldName.substr(0, 2) !== "__");
    })
  },

  locateModel: function (req, callback) {
    var fileField;
    if (this.fileField.type === "function") {
      fileField = this.fileField();
    } else {
      fileField = this.fileField;
    }
    // fill params
    _.each(_.keys(req.params), function(key) {
      fileField = fileField.replace(':' + key, req.params[key]);
    });
    var _this = this;
    Q
      .try(function() {
        return Q.ninvoke(_this, 'buildConditions', req);
      })
      .then(function (conditions) {
        return Q.ninvoke(_this.ModelClass, 'findOne', conditions, fileField);
      })
      .spread(function (model, fileField) {
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

var Controller = Restful.extend({
  constructor: function(options) {
    Restful.apply(this, arguments)

    var requiredOptions = ['ModelClass', 'path'];
    requireOptions(this, requiredOptions);

    // init

    this.defaultMethodOptions = _.defaults(this.defaultMethodOptions || {} ,
      {
        enabled: true,
        auth: this.defaultAuthStrategy,
        pre: this._emptyPre
      });

    this.selectOptions        = _.defaults(this.selectOptions         || {}, this.defaultMethodOptions);
    this.selectOneOptions     = _.defaults(this.selectOneOptions      || this.selectOptions, this.defaultMethodOptions);
    this.insertOptions        = _.defaults(this.insertOptions         || {}, this.defaultMethodOptions);
    this.updateOptions        = _.defaults(this.updateOptions         || this.insertOptions, this.defaultMethodOptions);
    this.partialUpdateOptions = _.defaults(this.partialUpdateOptions  || this.updateOptions, this.defaultMethodOptions);
    this.deleteOptions        = _.defaults(this.deleteOptions         || this.updateOptions, this.defaultMethodOptions);
    this.countOptions         = _.defaults(this.countOptions          || this.selectOptions, this.defaultMethodOptions);
    this.aggregateOptions     = _.defaults(this.aggregateOptions      || this.selectOptions, this.defaultMethodOptions);

    this.initialize.apply(this, arguments);
  },
  defaultAuthStrategy: 'bearer',
  qFields: [],
  initialize: function() {
  },
  bind: function (app) {
    var _this = this;

    if (typeof(this.path) === 'string') {
      this.path = [this.path];
    }
    _.forEach(this.path, _.bind(function (path) {
      if (this.selectOptions.enabled) {
        app.get(path,
          passport.authenticate(this.selectOptions.auth, { session: false }),
          function (req, res, next) {
            _this.select.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.countOptions.enabled) {
        app.get(path + '/count',
          passport.authenticate(this.countOptions.auth, { session: false }),
          function (req, res, next) {
            _this.count.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.aggregateOptions.enabled) {
        app.get(path + '/aggregate',
          passport.authenticate(this.aggregateOptions.auth, { session: false }),
          function (req, res, next) {
            _this.aggregate.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.selectOneOptions.enabled) {
        app.get(path + '/:_id',
          passport.authenticate(this.selectOneOptions.auth, { session: false }),
          function (req, res, next) {
            _this.selectOne.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.insertOptions.enabled) {
        app.post(path,
          passport.authenticate(this.insertOptions.auth, { session: false }),
          function (req, res, next) {
            _this.insert.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.updateOptions.enabled) {
        app.put(path + '/:_id',
          passport.authenticate(this.updateOptions.auth, { session: false }),
          function (req, res, next) {
            _this.update.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.partialUpdateOptions.enabled) {
        app.patch(path + '/:_id',
          passport.authenticate(this.partialUpdateOptions.auth, { session: false }),
          function (req, res, next) {
            _this.partialUpdate.apply(_this, arguments);
          },
          this.resultSender
        );
      }
      if (this.deleteOptions.enabled) {
        app.delete(path + '/:_id',
          passport.authenticate(this.deleteOptions.auth, { session: false }),
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
  },
  _emptyPre: function(req, res, callback) {
    callback();
  }
});



function FileFieldController(options) {

  _.extend(this, options);

  var requiredOptions = ['ModelClass', 'path'];
  requireOptions(this, requiredOptions);

  // init

  this.defaultMethodOptions = {
    enabled: true,
    auth: this.defaultAuthStrategy,
    pre: this._emptyPre
  };

  this.selectOneOptions = _.defaults(this.selectOneOptions  || {}, this.defaultMethodOptions);
  this.updateOptions    = _.defaults(this.updateOptions     || {}, this.defaultMethodOptions);
  this.deleteOptions    = _.defaults(this.deleteOptions     || {}, this.defaultMethodOptions);

  this.initialize.apply(this, arguments);

  var ExendedRestfulFileField = RestfulFileField.extend(this);
  _.extend(ExendedRestfulFileField.prototype, this.__proto__);
  this.service = new ExendedRestfulFileField(this);
};

_.extend(FileFieldController.prototype, {
  defaultAuthStrategy: 'bearer',
  initialize: function() {
  },
  bind: function (app) {
    var _this = this;
    if (typeof(this.path) === 'string') {
      this.path = [this.path];
    }
    _.forEach(this.path, _.bind(function (path) {
      if (this.selectOneOptions.enabled) {
        app.get(path,
          passport.authenticate(_this.selectOneOptions.auth, { session: false }),
          function (req, res, next) {
            _this.service.selectOne.apply(_this.service, arguments);
          },
          _this.resultSender
        );
      }
      if (this.updateOptions.enabled) {
        app.put(path,
          passport.authenticate(_this.updateOptions.auth, { session: false }),
          function (req, res, next) {
            _this.service.update.apply(_this.service, arguments);
          },
          _this.resultSender
        );
      }
      if (this.updateOptions.enabled) {
        app.delete(path,
          passport.authenticate(_this.updateOptions.auth, { session: false }),
          function (req, res, next) {
            _this.service.delete.apply(_this.service, arguments);
          },
          _this.resultSender
        );
      }
    }, this));
  },
  resultSender: function(req, res) {
    res.send(res.restfulResult);
  },
  _emptyPre: function(req, res, callback) {
    callback();
  }
});

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
  var errorStatus;
  var errorMessage;
  var errorDetails;
  if (!err) {
    err = new HttpError(HTTP_STATUSES.INTERNAL_ERROR);
  }
  else if (!(err instanceof Error)) {
    err = new HttpError(err, err.message, err.details);
  }

  if (err instanceof HttpError) {
    errorStatus = err.httpStatus;
    errorMessage = err.message;
    errorDetails = err.errorDetails;
  }
  else {
    if (!err.httpStatus) {
      if (err.name == 'ValidationError') {
        errorStatus = HTTP_STATUSES.BAD_REQUEST;
        errorDetails = err.errors;
      }
      else if (err.name == 'MongoError' && err.code == 11000) { // E11000 duplicate key error index
        errorStatus = HTTP_STATUSES.BAD_REQUEST;
        errorDetails = err.err;
      }
      else {
        errorStatus = HTTP_STATUSES.INTERNAL_ERROR;
      }
    }
    else {
      errorStatus = err.httpStatus;
    }

    errorStatus = errorStatus || HTTP_STATUSES.INTERNAL_ERROR;
    errorMessage = errorMessage || err.message;
    errorDetails = errorDetails || err.errorDetails;
  }

  res.statusCode = errorStatus.code;
  setResData(res, {error: errorStatus.message, message: errorMessage, details: errorDetails});
  log.error('Error(%d): %s: %s', errorStatus.code, errorMessage, errorDetails ? errorDetails : "");

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
    log.error("Error in error handler!");
    data.raw = err.stack;
  }

  log.error(data);
}

function requireOptions(options, requireOptionKeys) {
  for (var i = 0; i < requireOptionKeys.length; i++) {
    var key = requireOptionKeys[i];
    if (_.isUndefined(options[key])) {
      throw new TypeError("'" + key  + "' is required");
    }
  }
}

function setResOk(res) {
  res.statusCode = HTTP_STATUSES.OK.code;
}

function createHttpStatusError(httpStatus) {
  return new HttpError(httpStatus);
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

module.exports.Controller = Controller;
module.exports.FileFieldController = FileFieldController;
module.exports.HTTP_STATUSES = HTTP_STATUSES;