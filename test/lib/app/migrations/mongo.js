/**
 * Created by igor on 09.10.15.
 */
var Promise = require('bluebird');
var mongoose = Promise.promisifyAll(require('mongoose'));
var config = require('../config').mongoose;
var Snapshot = Promise.promisifyAll(require('../models/snapshot'));
var Photo = Promise.promisifyAll(require('../models/photo'));
var dataToMigrate = require('../../dal').files;

mongoose.connectAsync(config.connectionString)
    .then((new Snapshot(dataToMigrate.testFile.snapshot)).save)
    .then(function () { console.log('Test snapshot loaded to MongoDB') })
    .then((new Photo(dataToMigrate.testFileLocal.photo)).save)
    .then(function () { console.log('Test photo loaded to MongoDB') })
    .catch(function (err) {
        console.log('MongoDB migration error: ', err);
    });