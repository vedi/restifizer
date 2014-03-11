/**
 * Created by vedi on 11/21/13.
 */
var Seq       = require('seq');
var mongoose = require("mongoose");

var GridStore = mongoose.mongo.GridStore;
var Grid      = mongoose.mongo.Grid;
var ObjectID = mongoose.mongo.BSONPure.ObjectID;

var putFile = function (path, options, callback) {
  var db = mongoose.connection.db;
  var gridStore = new GridStore(db, new ObjectID(), "w", options);
  Seq()
    .seq(function () {
      gridStore.open(this);
    })
    .seq(function (gridStore) {
      gridStore.writeFile(path, function(err, doc) {
        var meta = {
          contentType:  doc.contentType,
          fileName:     doc.filename,
          fileId:       doc.fileId,
          root:         doc.root,
          uploadDate:   doc.uploadDate
        };
        callback(err, meta);
      });
    })
    .catch(callback);
};

var replaceFile = function (id, path, options, callback) {
  Seq()
    .seq(function () {
      var db = mongoose.connection.db;
      var store = new GridStore(db, id, "w", {root: "fs"});
      store.open(this);
    })
    .seq(function (store) {
      store.rewind(this);
    })
    .seq(function (gridStore) {
      gridStore.writeFile(path, function(err, doc) {
        var meta = {
          contentType:  doc.contentType,
          fileName:     doc.filename,
          fileId:       doc.fileId,
          root:         doc.root,
          uploadDate:   doc.uploadDate
        };
        callback(err, meta);
      });
    })
    .catch(callback);
};

var getFile = function (id, callback) {
  var db = mongoose.connection.db;
  var store = new GridStore(db, id, "r", {root: "fs"});
  store.open(callback);
};

var deleteFile = function (id, callback) {
  GridStore.unlink(mongoose.connection.db, id, callback);
};

exports.getFile = getFile;
exports.putFile = putFile;
exports.replaceFile = replaceFile;
exports.deleteFile = deleteFile;
