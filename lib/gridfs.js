/**
 * Created by vedi on 11/21/13.
 */
var
  Promise = require('bluebird'),
  mongoose  = require('mongoose'),
  GridStore = Promise.promisifyAll(mongoose.mongo.GridStore),
  ObjectID  = mongoose.mongo.BSONPure.ObjectID;

module.exports = {
  getFileAsync: function (db, id) {
    var store = new GridStore(db, new ObjectID(id.toString()), 'r', {root: 'fs'});
    Promise.promisifyAll(store);
    return store.openAsync();
  },
  putFileAsync: function (db, path, options) {
    var gridStore = Promise.promisifyAll(new GridStore(db, new ObjectID(), 'w', options));

    return Promise
      .try(function () {
        return gridStore.openAsync();
      })
      .then(function () {
        return gridStore.writeFileAsync(path);
      })
      .then(function (doc) {
        return {
          contentType: doc.contentType,
          fileName: doc.filename,
          fileId: doc.fileId,
          root: doc.root,
          uploadDate: doc.uploadDate
        };
      })
      ;
  },
  replaceFileAsync: function (db, id, path, options) {
    return Promise
      .try(function () {
        options = options || {};
        options.root = 'fs';
        var store = Promise.promisifyAll(new GridStore(db, id, 'w', options));
        return store.openAsync();
      })
      .then(function (store) {
        return store.rewindAsync();
      })
      .then(function (gridStore) {
        return gridStore.writeFileAsync(path);
      })
      .then(function(doc) {
        return {
          contentType:  doc.contentType,
          fileName:     doc.filename,
          fileId:       doc.fileId,
          root:         doc.root,
          uploadDate:   doc.uploadDate
        };
      })
      ;
  },
  deleteFileAsync: function (db, id) {
    return GridStore.unlinkAsync(db, id);
  }
};
