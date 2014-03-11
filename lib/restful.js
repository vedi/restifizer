var util      = require('util');
var _         = require('lodash');
var Seq       = require('seq');
var passport  = require('passport');

var mongoose  = require("mongoose");

var mmm       = require('mmmagic'),
  Magic       = mmm.Magic;

var gridfs    = require('./gridfs');
var utils     = require('./utils');

var HTTP_STATUSES = utils.HTTP_STATUSES;
var ObjectID  = mongoose.mongo.BSONPure.ObjectID;



function restful(options, restifizerOptions) {

  var requiredOptions = ['ModelClass'];
  requireOptions(options, requiredOptions);

  var ModelClass = options.ModelClass;
  var modelFieldNames = options.fields || getModelFieldNames(ModelClass);

  function getFilter(req) {
    //noinspection JSUnresolvedFunction
    var params = _.pick(req.params, _.keys(req.params));
    //noinspection JSUnresolvedFunction
    var filter = _.assign((req.query.filter ? JSON.parse(req.query.filter) : {}), params);
    _.forEach(_.keys(filter), function(key) {
      var path = ModelClass.schema.paths[key];
      if (path) {
        if (path.options.type.name == "ObjectId") {
          filter[key] = ObjectID(filter[key]);
        }
        else if (path.options.type.name == "Date") {
          if (typeof(filter[key]) == "string") {
            filter[key] =  new Date(filter[key]);
          }
          else if (typeof(filter[key]) == "object") {
            _.forOwn(filter[key], function(value, innerKey) {
              if (typeof(value == "string")) {
                filter[key][innerKey] =  new Date(value);
              }
            });
          }
        }
      }
    });
    return filter;
  }

  return {
    select: function (req, res, next) {
      var limit;
      var page;
      //noinspection JSCheckFunctionSignatures
      Seq()
        .seq(function () {
          try {
            options.select.pre(req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          // field list
          var fieldList = getFieldList(req, modelFieldNames);
          // filter
          try {
            var filter = getFilter(req);
          } catch (e) {
            this(createHttpStatusError(HTTP_STATUSES.BAD_REQUEST));
          }
          try {
            // q can override filter params
            var q = req.query.q;
            if (q) {
              var qExpr = [];
              _.forEach(options.qFields, function(qField) {
                var obj = {};
                obj[qField] = {$regex: '.*' + q + ".*", $options: 'i'};
                qExpr.push(obj);
              });
              if (qExpr.length > 0) {
                filter.$or = qExpr;
              }
            }
          } catch (e) {
            this(createHttpStatusError(HTTP_STATUSES.BAD_REQUEST));
          }
          var query = ModelClass.find(filter, fieldList);
          // orderBy
          var orderBy = getOrderBy(req);
          if (orderBy) {
            query.sort(orderBy);
          }
          // limit
          limit = getLimit(req, restifizerOptions.config.defaultPerPage, restifizerOptions.config.maxPerPage);
          query.limit(limit);
          // page
          page = getPage(req);
          if (page > 1) {
            query.skip((page - 1) * limit);
          }
          query.exec(this);
        })
        .seq(function (collection) {
          try {
            options.select.post(collection, req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function (collection) {
          addLinkHeaders(req, res, page, limit, collection.length);
          setResData(res, collection);
          next();
        })
        .catch(function (err) {
          setResError(err, res, restifizerOptions.log);
          next();
        }
      );
    },
    selectOne: function (req, res, next) {
      //noinspection JSCheckFunctionSignatures
      Seq()
        .seq(function () {
          try {
            options.selectOne.pre(req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          var fieldList = getFieldList(req, modelFieldNames);
          ModelClass.findOne(_.pick(req.params, _.keys(req.params)), fieldList, this);
        })
        .seq(function (model) {
          try {
            options.selectOne.post(model, req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function (model) {
          if (!model) {
            this(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
          } else {
            setResData(res, model);
            next();
          }
        })
        .catch(function (err) {
          setResError(err, res, restifizerOptions.log);
          next();
        }
      );
    },
    insert: function (req, res, next) {
      Seq()
        .seq(function () {
          try {
            options.insert.pre(req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          var data = {};
          // add params
          const paramKeys = _.keys(req.params);
          var params = _.pick(req.params, paramKeys);
          assignAllFields(req, data, _.assign(req.body, params), options.assignFilter, _.union(paramKeys, modelFieldNames));
          data = _.omit(data, ['_id']); //  exclude _id
          var model = new ModelClass(data);
          this(null, model);
        })
        .seq(function (model) {
          model.save(this);
        })
        .seq(function (model) {
          try {
            options.insert.post(model, req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function (model) {
          if (restifizerOptions.redisClient) {
            // publish event
            restifizerOptions.redisClient.publish(restifizerOptions.config.redisKeyPrefix + ".resourceChanged." + options.path + ".inserted", JSON.stringify(model));
          }
          this(null, model);
        })
        .seq(function (model) {
          res.statusCode = HTTP_STATUSES.CREATED.code;
          setResData(res, _.pick(model, modelFieldNames));
          next();
        })
        .catch(function (err) {
          setResError(err, res, restifizerOptions.log);
          next();
        }
      );
    },
    update: function (req, res, next) {
      Seq()
        .seq(function () {
          try {
            options.update.pre(req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          ModelClass.findOne(_.pick(req.params, _.keys(req.params)), this);
        })
        .seq(function (model) {
          if (!model) {
            this(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
          } else {
            assignAllFields(req, model, req.body, options.assignFilter, modelFieldNames);
            this(null, model);
          }
        })
        .seq(function (model) {
          model.save(this);
        })
        .seq(function (model) {
          try {
            options.update.post(model, req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function (model) {
          // publish event
          if (restifizerOptions.redisClient) {
            // publish event
            restifizerOptions.redisClient.publish(restifizerOptions.config.redisKeyPrefix + ".resourceChanged." + options.path + ".updated", JSON.stringify(model));
          }
          this(null, model);
        })
        .seq(function (model) {
          setResData(res, _.pick(model, modelFieldNames));
          next();
        })
        .catch(function (err) {
          setResError(err, res, restifizerOptions.log);
          next();
        });
    },
    partialUpdate: function (req, res, next) {
      Seq()
        .seq(function () {
          try {
            options.partialUpdate.pre(req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          ModelClass.findOne(_.pick(req.params, _.keys(req.params)), this);
        })
        .seq(function (model) {
          if (!model) {
            this(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
          } else {
            assignExistingFields(req, model, req.body, options.assignFilter, modelFieldNames);
            this(null, model);
          }
        })
        .seq(function (model) {
          model.save(this);
        })
        .seq(function (model) {
          try {
            options.partialUpdate.post(model, req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function (model) {
          // publish event
          if (restifizerOptions.redisClient) {
            // publish event
            restifizerOptions.redisClient.publish(restifizerOptions.config.redisKeyPrefix + ".updated." + options.path + ".inserted", JSON.stringify(model));
          }
          this(null, model);
        })
        .seq(function (model) {
          setResData(res, _.pick(model, modelFieldNames));
          next();
        })
        .catch(function (err) {
          setResError(err, res, restifizerOptions.log);
          next();
        });
    },
    delete: function (req, res, next) {
      Seq()
        .seq(function () {
          try {
            options.delete.pre(req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          ModelClass.findOne(_.pick(req.params, _.keys(req.params)), this);
        })
        .seq(function (model) {
          if (!model) {
            this(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
          } else {
            model.remove(this);
          }
        })
        .seq(function (model) {
          try {
            options.delete.post(model, req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function (model) {
          // publish event
          if (restifizerOptions.redisClient) {
            // publish event
            restifizerOptions.redisClient.publish(restifizerOptions.config.redisKeyPrefix + ".resourceChanged." + options.path + ".deleted", JSON.stringify(model));
          }
          this(null, model);
        })
        .seq(function () {
          setResOk(res);
          next();
        })
        .catch(function (err) {
          setResError(err, res, restifizerOptions.log);
          next();
        });
    },
    count: function (req, res, next) {
      Seq()
        .seq(function () {
          try {
            options.count.pre(req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          // filter
          try {
            var filter = getFilter(req);
          } catch (e) {
            this(createHttpStatusError(HTTP_STATUSES.BAD_REQUEST));
          }
          var query = ModelClass.count(filter);
          query.exec(this);
        })
        .seq(function (count) {
          try {
            options.count.post({count: count}, req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function (count) {
          setResData(res, count);
          next();
        })
        .catch(function (err) {
          setResError(err, res, restifizerOptions.log);
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
            options.aggregate.pre(req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          // field list
          var project = {};
          _.forEach(modelFieldNames, function (field) {
            project[field] = 1;
          });
          // filter
          try {
            var filter = getFilter(req);
          } catch (e) {
            this(createHttpStatusError(HTTP_STATUSES.BAD_REQUEST));
          }
          // req agg conditions
          try {
            var reqAggConditions = getAggConditions(req);
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
          limit = getLimit(req, restifizerOptions.config.defaultPerPage, restifizerOptions.config.maxPerPage);
          aggConditions.push({$limit: parseInt(limit)});

          // page
          page = getPage(req);
          if (page > 1) {
            aggConditions.push({$skip: (page - 1) * limit});
          }
          aggConditions.push(this);
          ModelClass.aggregate.apply(ModelClass, aggConditions);
        })
        .seq(function (collection) {
          try {
            options.aggregate.post(collection, req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function (collection) {
          addLinkHeaders(req, res, page, limit, collection.length);
          setResData(res, collection);
          next();
        })
        .catch(function (err) {
          setResError(err, res, restifizerOptions.log);
          next();
        }
      );
    }
  };
}

function restfulFileField(options, restifizerOptions) {
  var requiredOptions = ['ModelClass'];
  requireOptions(options, requiredOptions);

  var ModelClass = options.ModelClass;

  var restfulFileField = {
    selectOne: function (req, res, next) {
      //noinspection JSCheckFunctionSignatures
      Seq()
        .seq(function () {
          try {
            options.selectOne.pre(req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          var fileField;
          if (options.fileField.type === "function") {
            fileField = options.fileField();
          } else {
            fileField = options.fileField;
          }
          ModelClass.findOne(_.pick(req.params, _.keys(req.params)), fileField, this);
        })
        .seq(function (model) {
          if (!model) {
            this(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
          } else {
            this(null, model);
          }
        })
        .seq(function (model) {
          getFileField(options.fileField, model, this);
        })
        .seq(function (file, contentType) {
          var that = this;
          try {
            options.selectOne.post(file, req, res, function() {
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
          setResError(err, res, restifizerOptions.log);
          next();
        }
      );
    },
    update: function (req, res, next) {
      Seq()
        .seq(function () {
          try {
            options.update.pre(req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          ModelClass.findOne(_.pick(req.params, _.keys(req.params)), options.fileField, this);
        })
        .seq(function (model) {
          if (!model) {
            this(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
          } else {
            setFileField(options.fileField, model, req, options.converter, this);
          }
        })
        .seq(function(model) {
          model.save(this);
        })
        .seq(function (model) {
          try {
            options.update.post(model, req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          setResOk(res);
          next();
        })
        .catch(function (err) {
          setResError(err, res, restifizerOptions.log);
          next();
        });
    },
    delete: function (req, res, next) {
      Seq()
        .seq(function () {
          try {
            options.delete.pre(req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          //noinspection JSUnresolvedFunction
          ModelClass.findOne(_.pick(req.params, _.keys(req.params)), options.fileField, this);
        })
        .seq(function (model) {
          if (!model) {
            this(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
          } else {
            cleanFileField(options.fileField, model, this);
          }
        })
        .seq(function(model) {
          model.save(this);
        })
        .seq(function (model) {
          try {
            options.delete.post(model, req, res, this);
          } catch (e) {
            this(e);
          }
        })
        .seq(function () {
          setResOk(res);
          next();
        })
        .catch(function (err) {
          setResError(err, res, restifizerOptions.log);
          next();
        });
    }
  };

  return restfulFileField;
}

function controller(options, restifizerOptions) {
  var requiredOptions = ['ModelClass', 'path'];
  requireOptions(options, requiredOptions);
  options = merge(options, getDefaultOptions());

  var ModelClass = options.ModelClass;
  var path = options.path;
  var resultSender = function(req, res) {
    res.send(res.restfulResult);
  };

  var restfulInst = restful(options, restifizerOptions);

  return {
    bind: function (app) {
      app.get(path,
        passport.authenticate(options.select.auth, { session: false }),
        restfulInst.select,
        resultSender
      );
      app.get(path + '/count',
        passport.authenticate(options.count.auth, { session: false }),
        restfulInst.count,
        resultSender
      );
      app.get(path + '/aggregate',
        passport.authenticate(options.aggregate.auth, { session: false }),
        restfulInst.aggregate,
        resultSender
      );
      app.get(path + '/:_id',
        passport.authenticate(options.selectOne.auth, { session: false }),
        restfulInst.selectOne,
        resultSender
      );
      app.post(path,
        passport.authenticate(options.insert.auth, { session: false }),
        restfulInst.insert,
        resultSender
      );
      app.put(path + '/:_id',
        passport.authenticate(options.update.auth, { session: false }),
        restfulInst.update,
        resultSender
      );
      app.patch(path + '/:_id',
        passport.authenticate(options.partialUpdate.auth, { session: false }),
        restfulInst.partialUpdate,
        resultSender
      );
      app.delete(path + '/:_id',
        passport.authenticate(options.delete.auth, { session: false }),
        restfulInst.delete,
        resultSender
      );
    },
    service: restfulInst
  };
}

function fileFieldController(options, restifizerOptions) {
  var requiredOptions = ['ModelClass', 'path'];
  requireOptions(options, requiredOptions);
  options = merge(options, getDefaultOptions());

  var ModelClass = options.ModelClass;
  var path = options.path;

  var resultSender = function(req, res) {
    res.send(res.restfulResult);
  };

  var restfulInst = restfulFileField(options);

  return {
    bind: function (app) {
      app.get(path,
        passport.authenticate(options.selectOne.auth, { session: false }),
        restfulInst.selectOne,
        resultSender
      );
      app.put(path,
        passport.authenticate(options.update.auth, { session: false }),
        restfulInst.update,
        resultSender
      );
      app.delete(path,
        passport.authenticate(options.delete.auth, { session: false }),
        restfulInst.delete,
        resultSender
      );
    },
    service: restfulInst
  };
}

function getModelFieldNames(ModelClass) {
  var paths = _.pluck(ModelClass.schema.paths, 'path');
  return _.filter(paths, function(fieldName) {
    return (fieldName == '_id' || fieldName.substr(0, 2) !== "__");
  });
}

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

function getDefaultOptions() {
  const defaultAuthStrategy = 'bearer';
  var emptyPre = function(req, res, callback) {callback();};
  var emptyPost = function(result, req, res, callback) {callback(null, result);};

  return {
    qFields: [],
    select: {
      auth: defaultAuthStrategy,
      pre: emptyPre,
      post: emptyPost
    },
    selectOne: {
      auth: defaultAuthStrategy,
      pre: emptyPre,
      post: emptyPost
    },
    insert: {
      auth: defaultAuthStrategy,
      pre: emptyPre,
      post: emptyPost
    },
    update: {
      auth: defaultAuthStrategy,
      pre: emptyPre,
      post: emptyPost
    },
    partialUpdate: {
      auth: defaultAuthStrategy,
      pre: emptyPre,
      post: emptyPost
    },
    delete: {
      auth: defaultAuthStrategy,
      pre: emptyPre,
      post: emptyPost
    },
    count: {
      auth: defaultAuthStrategy,
      pre: emptyPre,
      post: emptyPost
    },
    aggregate: {
      auth: defaultAuthStrategy,
      pre: emptyPre,
      post: emptyPost
    },
    assignFilter: undefined
  }
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

function getFieldList(req, modelFieldNames) {
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
}

function getOrderBy(req) {
  return req.query.orderBy ? JSON.parse(req.query.orderBy) : null;
}

function getLimit(req, defaultPerPage, maxPerPage) {
  if (!req.query.per_page) {
    return defaultPerPage;
  } else {
    return req.query.per_page > maxPerPage ? maxPerPage : req.query.per_page;
  }
}

function getPage(req) {
  return parseInt(req.query.page) || 1;
}

function getAggConditions(req) {
  return req.query.conditions ? JSON.parse(req.query.conditions) : [];
}

function addLinkHeaders(req, res, page, limit, currentLength) {
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
}

function assignAllFields(req, dest, source, assignFilter, modelFieldNames) {
  _.each(modelFieldNames, function (fieldName) {
    if (fieldName != '_id' && fieldName.substr(0, 2) !== "__" &&
      (!assignFilter || assignFilter(req, fieldName, source[fieldName]))) {
      dest[fieldName] = source[fieldName];
    }
  });
}

function assignExistingFields(req, dest, source, assignFilter, modelFieldNames) {
  _.each(modelFieldNames, function (fieldName) {
    if (fieldName != '_id' && fieldName.substr(0, 2) !== "__" &&
        source[fieldName] !== undefined &&
        (!assignFilter || assignFilter(req, fieldName, source[fieldName]))) {
      dest[fieldName] = source[fieldName];
    }
  });
}

function getFileField(fieldName, model, callback) {
  var fileMeta = model[fieldName];
  if (fileMeta) {
    if (typeof(fileMeta) === "object") {
      Seq()
        .seq(function() {
          gridfs.getFile(fileMeta.fileId, this);
        })
        .seq(function(file) {
          callback(null, file, fileMeta.contentType);
        });
    } else {
      callback(new Error("Wrong fileMeta"));
    }
  } else {
    callback();
  }
}

function setFileField(fieldName, model, req, converter, callback) {
  var file = req.files && req.files[fieldName];
  if (file) {
    Seq()
      .seq(function() {
        var magic = new Magic(mmm.MAGIC_MIME_TYPE);
        magic.detectFile(file.path, this);
      })
      .seq(function(mimeType) {
        var options = {mimeType: mimeType, path: file.path};
        if (converter) {
          converter(options, this)
        } else {
          this(null, options);
        }
      })
      .seq(function(result) {
        var options = {content_type: result.mimeType};
        if (model[fieldName]) {
          gridfs.replaceFile(model[fieldName].fileId, result.path, options, this);
        } else {
          gridfs.putFile(result.path, options, this);
        }
      })
      .seq(function(result) {
        model[fieldName] = result;
        callback(null, model);
      });
  } else {
    callback(null, model);
  }
}

function cleanFileField(fieldName, model, callback) {
  var fileMeta = model[fieldName];
  if (fileMeta) {
    Seq()
      .seq(function() {
        gridfs.deleteFile(fileMeta.fileId, this);
      })
      .seq(function() {
        model[fieldName] = undefined;
        callback(null, model);
      });
  } else {
    callback(createHttpStatusError(HTTP_STATUSES.NOT_FOUND));
  }
}

var addLinkField = function (req, model, fieldName, pathFormat, hideOriginal) {
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

module.exports.methods = restful;
module.exports.controller = controller;
module.exports.fileFieldController = fileFieldController;
module.exports.getModelFieldNames = getModelFieldNames;
module.exports.addLinkField = addLinkField;
module.exports.HTTP_STATUSES = HTTP_STATUSES;