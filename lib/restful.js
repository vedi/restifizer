var util      = require('util');
var _         = require('lodash');
var Q         = require('q');
var Seq       = require('seq');
var passport  = require('passport');

var mongoose  = require("mongoose");

var mmm       = require('mmmagic'),
  Magic       = mmm.Magic;

var gridfs    = require('./gridfs');
var utils     = require('./utils');

var HTTP_STATUSES = utils.HTTP_STATUSES;
var ObjectID  = mongoose.mongo.BSONPure.ObjectID;

function Restful(options) {

  _.extend(this, options);

  this.options = options;

  var requiredOptions = ['ModelClass'];
  requireOptions(options, requiredOptions);

  this.modelFieldNames = this.fields || this.getModelFieldNames(this.ModelClass);

  this.initialize.apply(this, arguments);
};

_.extend(Restful.prototype, {
  initialize: function() {
  },
  select: function (req, res, next) {
    var limit;
    var page;
    _this = this;
    Q
      .nfcall(_.bind(_this.selectOptions.pre, _this), req, res)
      .then(function () {
        // field list
        var fieldList = _this.getFieldList(req, _this.modelFieldNames);
        // filter
        try {
          var filter = _this.getFilter(req);
        } catch (e) {
          throw createHttpStatusError(HTTP_STATUSES.BAD_REQUEST);
        }
        try {
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
        } catch (e) {
          throw createHttpStatusError(HTTP_STATUSES.BAD_REQUEST);
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
        return _this.selectOptions.queryPipe ? _this.selectOptions.queryPipe.apply(_this, [query]) : query;
      })
      .then(function (query) {
        return Q.ninvoke(query, 'exec');
      })
      .then(function (collection) {
        return Q.nfcall(_.bind(_this.selectOptions.post, _this), collection, req, res);
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
    var _this = this;
    //noinspection JSCheckFunctionSignatures
    Q
      .nfcall(_.bind(_this.selectOneOptions.pre, _this), req, res)
      .then(function () {
        var fieldList = _this.getFieldList(req, _this.modelFieldNames);
        return _this.ModelClass.findOne(_.pick(req.params, _.keys(req.params)), fieldList);
      })
      .then(function (query) {
        return _this.selectOptions.queryPipe ? _this.selectOptions.queryPipe.apply(_this, [query]) : query;
      })
      .then(function (query) {
        return Q.ninvoke(query, 'exec');
      })
      .then(function (model) {
        return Q.nfcall(_.bind(_this.selectOneOptions.post, _this), model, req, res);
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
    var _this = this;
    Q
      .nfcall(_.bind(_this.insertOptions.pre, _this), req, res)
      .then(function () {
        var data = {};
        // add params
        const paramKeys = _.keys(req.params);
        var params = _.pick(req.params, paramKeys);
        _this.assignAllFields(req, data, _.assign(req.body, params), _this.assignFilter, _.union(paramKeys, _this.modelFieldNames));
        data = _.omit(data, ['_id']); //  exclude _id
        var model = new _this.ModelClass(data);
        return model;
      })
      .then(function (model) {
        return Q.ninvoke(model, "save");
      })
      .then(function (model) {
        return Q.nfcall(_.bind(_this.insertOptions.post, _this), model, req, res);
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
        setResError(err, res, _this.log);
        next();
      }
    );
  },
  update: function (req, res, next) {
    var _this = this;
    Q
      .nfcall(_.bind(_this.updateOptions.pre, _this), req, res)
      .then(function () {
        return Q.ninvoke(_this.ModelClass, "findOne", _.pick(req.params, _.keys(req.params)));
      })
      .then(function (model) {
        if (!model) {
          throw createHttpStatusError(HTTP_STATUSES.NOT_FOUND);
        } else {
          _this.assignAllFields(req, model, req.body, _this.assignFilter, _this.modelFieldNames);
          return model;
        }
      })
      .then(function (model) {
        return Q.ninvoke(model, 'save');
      })
      .then(function (result) {
        var model = result[0];
        return Q.nfcall(_.bind(_this.updateOptions.post, _this), model, req, res);
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
    var _this = this;
    Q
      .nfcall(_.bind(_this.partialUpdateOptions.pre, _this), req, res)
      .then(function () {
        return Q.ninvoke(_this.ModelClass, 'findOne', _.pick(req.params, _.keys(req.params)));
      })
      .then(function (model) {
        if (!model) {
          throw createHttpStatusError(HTTP_STATUSES.NOT_FOUND);
        } else {
          _this.assignExistingFields(req, model, req.body, _this.assignFilter, _this.modelFieldNames);
          return model;
        }
      })
      .then(function (model) {
        return Q.ninvoke(model, 'save');
      })
      .then(function (result) {
        var model = result[0];
        return Q.nfcall(_.bind(_this.partialUpdateOptions.post, _this), model, req, res);
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
    Q
      .nfcall(_.bind(_this.deleteOptions.pre, _this), req, res)
      .then(function () {
        return Q.ninvoke(_this.ModelClass, 'findOne', _.pick(req.params, _.keys(req.params)));
      })
      .then(function (model) {
        if (!model) {
          throw createHttpStatusError(HTTP_STATUSES.NOT_FOUND);
        } else {
          return Q.ninvoke(model, 'remove');
        }
      })
      .then(function (model) {
        return Q.nfcall(_.bind(_this.deleteOptions.post, _this), model, req, res);
      })
      .seq(function (model) {
        // publish event
        if (_this.redisClient) {
          // publish event
          _this.redisClient.publish(_this.config.redisKeyPrefix + ".resourceChanged." + _this.path + ".deleted", JSON.stringify(model));
        }
        return model;
      })
      .seq(function () {
        setResOk(res);
        next();
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      });
  },
  count: function (req, res, next) {
    Seq()
      .seq(function () {
        try {
          _this.countOptions.pre(req, res, this);
        } catch (e) {
          this(e);
        }
      })
      .seq(function () {
        // filter
        try {
          var filter = this.getFilter(req);
        } catch (e) {
          this(createHttpStatusError(HTTP_STATUSES.BAD_REQUEST));
        }
        var query = _this.ModelClass.count(filter);
        query.exec(this);
      })
      .seq(function (count) {
        try {
          _this.countOptions.post({count: count}, req, res, this);
        } catch (e) {
          this(e);
        }
      })
      .seq(function (count) {
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
    var limit;
    var page;
    Seq()
      .seq(function () {
        try {
          _this.aggregateOptions.pre(req, res, this);
        } catch (e) {
          this(e);
        }
      })
      .seq(function () {
        // field list
        var project = {};
        _.forEach(_this.modelFieldNames, function (field) {
          project[field] = 1;
        });
        // filter
        try {
          var filter = this.getFilter(req);
        } catch (e) {
          this(createHttpStatusError(HTTP_STATUSES.BAD_REQUEST));
        }
        // req agg conditions
        try {
          var reqAggConditions = _this.getAggConditions(req);
        } catch (e) {
          this(createHttpStatusError(HTTP_STATUSES.BAD_REQUEST));
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
        aggConditions.push(this);
        _this.ModelClass.aggregate.apply(_this.ModelClass, aggConditions);
      })
      .seq(function (collection) {
        try {
          _this.aggregateOptions.post(collection, req, res, this);
        } catch (e) {
          this(e);
        }
      })
      .seq(function (collection) {
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
  getFilter: function (req) {
    //noinspection JSUnresolvedFunction
    var params = _.pick(req.params, _.keys(req.params));
    //noinspection JSUnresolvedFunction
    var filter = _.assign((req.query.filter ? JSON.parse(req.query.filter) : {}), params);
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
    return filter;
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
  assignAllFields: function (req, dest, source, assignFilter, modelFieldNames) {
    _.each(modelFieldNames, function (fieldName) {
      if (fieldName != '_id' && fieldName.substr(0, 2) !== "__" &&
        (!assignFilter || assignFilter(req, fieldName, source[fieldName]))) {
        dest[fieldName] = source[fieldName];
      }
    });
  },
  assignExistingFields: function (req, dest, source, assignFilter, modelFieldNames) {
    _.each(modelFieldNames, function (fieldName) {
      if (fieldName != '_id' && fieldName.substr(0, 2) !== "__" &&
        source[fieldName] !== undefined &&
        (!assignFilter || assignFilter(req, fieldName, source[fieldName]))) {
        dest[fieldName] = source[fieldName];
      }
    });
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
  }
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
    var _this = this;
    //noinspection JSCheckFunctionSignatures
    Seq()
      .seq(function () {
        try {
          _this.selectOneOptions.pre(req, res, this);
        } catch (e) {
          this(e);
        }
      })
      .seq(function () {
        _this.locateModel.apply(_this, [req, this]);
      })
      .seq(function (model, fileField) {
        if (!model) {
          this(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
        } else {
          this(null, model, fileField);
        }
      })
      .seq(function (model, fileField) {
        _this.getFileField(fileField, model, this);
      })
      .seq(function (file, contentType) {
        var that = this;
        try {
          _this.selectOneOptions.post(file, req, res, function() {
            that(null, file, contentType);
          });
        } catch (e) {
          this(e);
        }
      })
      .seq(function (file, contentType) {
        if (file) {
          res.header("Content-Type", contentType);
          file.stream(true).pipe(res);
        } else {
          this(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
        }
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      }
    );
  },
  update: function (req, res, next) {
    var _this = this;
    Seq()
      .seq(function () {
        try {
          _this.updateOptions.pre(req, res, this);
        } catch (e) {
          this(e);
        }
      })
      .seq(function () {
        _this.locateModel.apply(_this, [req, this]);
      })
      .seq(function (model, fileField) {
        if (!model) {
          this(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
        } else {
          _this.setFileField(fileField, model, req, _this.converter, this);
        }
      })
      .seq(function(model) {
        model.save(this);
      })
      .seq(function (model) {
        try {
          _this.updateOptions.post(model, req, res, this);
        } catch (e) {
          this(e);
        }
      })
      .seq(function () {
        setResOk(res);
        next();
      })
      .catch(function (err) {
        setResError(err, res, _this.log);
        next();
      });
  },
  delete: function (req, res, next) {
    var _this = this;
    Seq()
      .seq(function () {
        try {
          _this.deleteOptions.pre(req, res, this);
        } catch (e) {
          this(e);
        }
      })
      .seq(function () {
        _this.locateModel.apply(_this, [req, this]);
      })
      .seq(function (model, fileField) {
        if (!model) {
          this(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
        } else {
          _this.cleanFileField(fileField, model, this);
        }
      })
      .seq(function(model) {
        model.save(this);
      })
      .seq(function (model) {
        try {
          _this.deleteOptions.post(model, req, res, this);
        } catch (e) {
          this(e);
        }
      })
      .seq(function () {
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
        Seq()
          .seq(function () {
            gridfs.getFile(fileMeta.fileId, this);
          })
          .seq(function (file) {
            callback(null, file, fileMeta.contentType);
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
      Seq()
        .seq(function () {
          var magic = new Magic(mmm.MAGIC_MIME_TYPE);
          magic.detectFile(file.path, this);
        })
        .seq(function (mimeType) {
          var options = {mimeType: mimeType, path: file.path};
          if (converter) {
            converter(options, this)
          } else {
            this(null, options);
          }
        })
        .seq(function (result) {
          var options = {content_type: result.mimeType};
          var fieldValue = _this.getFieldValue(model, fieldName);
          if (fieldValue) {
            gridfs.replaceFile(fieldValue.fileId, result.path, options, this);
          } else {
            gridfs.putFile(result.path, options, this);
          }
        })
        .seq(function (result) {
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
      Seq()
        .seq(function () {
          gridfs.deleteFile(fileMeta.fileId, this);
        })
        .seq(function () {
          _this.setFieldValue(model, fieldName, undefined);
          callback(null, model);
        });
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
    this.ModelClass.findOne(_.pick(req.params, _.keys(req.params)), fileField, function (err, model) {
      callback(err, model, fileField)
    });
  },
  getFieldValue: function(model, fieldName) {
    return model.get(fieldName);
  },
  setFieldValue: function(model, fieldName, value) {
    model.set(fieldName, value);
  }
});

function Controller(options) {

  _.extend(this, options);

  var requiredOptions = ['ModelClass', 'path'];
  requireOptions(this, requiredOptions);

  // init

  this.defaultMethodOptions = _.defaults(this.defaultMethodOptions || {} ,
    {
      auth: this.defaultAuthStrategy,
      pre: this._emptyPre,
      post: this._emptyPost
    });

  this.selectOptions        = _.defaults(this.selectOptions         || {}, this.defaultMethodOptions);
  this.selectOneOptions     = _.defaults(this.selectOneOptions      || {}, this.defaultMethodOptions);
  this.insertOptions        = _.defaults(this.insertOptions         || {}, this.defaultMethodOptions);
  this.updateOptions        = _.defaults(this.updateOptions         || this.insertOptions || {}, this.defaultMethodOptions);
  this.partialUpdateOptions = _.defaults(this.partialUpdateOptions  || this.updateOptions || {}, this.defaultMethodOptions);
  this.deleteOptions        = _.defaults(this.deleteOptions         || this.updateOptions || {}, this.defaultMethodOptions);
  this.countOptions         = _.defaults(this.countOptions          || this.selectOptions || {}, this.defaultMethodOptions);
  this.aggregateOptions     = _.defaults(this.aggregateOptions      || this.selectOptions || {}, this.defaultMethodOptions);

  this.initialize.apply(this, arguments);

  var ExendedRestful = Restful.extend(this);
  _.extend(ExendedRestful.prototype, this.__proto__);
  this.service = new ExendedRestful(this);
};

_.extend(Controller.prototype, {
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
      app.get(path,
        passport.authenticate(this.selectOptions.auth, { session: false }),
        function (req, res, next) {
          _this.service.select.apply(_this.service, arguments);
        },
        this.resultSender
      );
      app.get(path + '/count',
        passport.authenticate(this.countOptions.auth, { session: false }),
        function (req, res, next) {
          _this.service.count.apply(_this.service, arguments);
        },
        this.resultSender
      );
      app.get(path + '/aggregate',
        passport.authenticate(this.aggregateOptions.auth, { session: false }),
        function (req, res, next) {
          _this.service.aggregate.apply(_this.service, arguments);
        },
        this.resultSender
      );
      app.get(path + '/:_id',
        passport.authenticate(this.selectOneOptions.auth, { session: false }),
        function (req, res, next) {
          _this.service.selectOne.apply(_this.service, arguments);
        },
        this.resultSender
      );
      app.post(path,
        passport.authenticate(this.insertOptions.auth, { session: false }),
        function (req, res, next) {
          _this.service.insert.apply(_this.service, arguments);
        },
        this.resultSender
      );
      app.put(path + '/:_id',
        passport.authenticate(this.updateOptions.auth, { session: false }),
        function (req, res, next) {
          _this.service.update.apply(_this.service, arguments);
        },
        this.resultSender
      );
      app.patch(path + '/:_id',
        passport.authenticate(this.partialUpdateOptions.auth, { session: false }),
        function (req, res, next) {
          _this.service.partialUpdate.apply(_this.service, arguments);
        },
        this.resultSender
      );
      app.delete(path + '/:_id',
        passport.authenticate(this.deleteOptions.auth, { session: false }),
        function (req, res, next) {
          _this.service.delete.apply(_this.service, arguments);
        },
        this.resultSender
      );
    }, this));
  },
  resultSender: function(req, res) {
    res.send(res.restfulResult);
  },
  _emptyPre: function(req, res, callback) {
    callback();
  },
  _emptyPost: function(result, req, res, callback) {
    callback(null, result);
  }
});


function FileFieldController(options) {

  _.extend(this, options);

  var requiredOptions = ['ModelClass', 'path'];
  requireOptions(this, requiredOptions);

  // init

  this.defaultMethodOptions = {
    auth: this.defaultAuthStrategy,
    pre: this._emptyPre,
    post: this._emptyPost
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
      app.get(path,
        passport.authenticate(_this.selectOneOptions.auth, { session: false }),
        function (req, res, next) {
          _this.service.selectOne.apply(_this.service, arguments);
        },
        _this.resultSender
      );
      app.put(path,
        passport.authenticate(_this.updateOptions.auth, { session: false }),
        function (req, res, next) {
          _this.service.update.apply(_this.service, arguments);
        },
        _this.resultSender
      );
      app.delete(path,
        passport.authenticate(_this.deleteOptions.auth, { session: false }),
        function (req, res, next) {
          _this.service.delete.apply(_this.service, arguments);
        },
        _this.resultSender
      );
    }, this));
  },
  resultSender: function(req, res) {
    res.send(res.restfulResult);
  },
  _emptyPre: function(req, res, callback) {
    callback();
  },
  _emptyPost: function(result, req, res, callback) {
    callback(null, result);
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
  var errorMessage = err.message;
  var errorDetails;
  if (!err) {
    errorStatus = HTTP_STATUSES.INTERNAL_ERROR;
  }
  else if (!err.httpStatus) {
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

  res.statusCode = errorStatus.code;
  setResData(res, {error: errorStatus.message, message: errorMessage, details: errorDetails});
  log.error('Error(%d): %s: %s', errorStatus.code, errorMessage, errorDetails ? errorDetails : "");
  log.error(error);
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
  return {httpStatus: httpStatus}
}

// Helpers
// -------

// Helper function to correctly set up the prototype chain, for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
var extend = function(protoProps, staticProps) {
  var parent = this;
  var child;

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent's constructor.
  if (protoProps && _.has(protoProps, 'constructor')) {
    child = protoProps.constructor;
  } else {
    child = function(){ return parent.apply(this, arguments); };
  }

  // Add static properties to the constructor function, if supplied.
  _.extend(child, parent, staticProps);

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function.
  var Surrogate = function(){ this.constructor = child; };
  Surrogate.prototype = parent.prototype;
  child.prototype = new Surrogate;

  // Add prototype properties (instance properties) to the subclass,
  // if supplied.
  if (protoProps) _.extend(child.prototype, protoProps);

  // Set a convenience property in case the parent's prototype is needed
  // later.
  child.__super__ = parent.prototype;

  return child;
};

Restful.extend = RestfulFileField.extend = Controller.extend = FileFieldController.extend = extend;

module.exports.Controller = Controller;
module.exports.FileFieldController = FileFieldController;
module.exports.HTTP_STATUSES = HTTP_STATUSES;