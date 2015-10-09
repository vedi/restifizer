/**
 * Created by igor on 07.10.15.
 */
'use strict';

var mongoose = require('mongoose');

var SnapshotSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    tags: {
        type: [String]
    },
    geo: {},
    picture: {
        type: mongoose.Schema.Types.Mixed
    }
});

module.exports = mongoose.model('Snapshot', SnapshotSchema);