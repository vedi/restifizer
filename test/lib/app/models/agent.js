/**
 * Created by igor on 20.10.15.
 */
'use strict';

var mongoose = require('mongoose');

var PHONE_TYPES = 'home mobile work'.split(' ');

var AgentSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  phones: [{
    phoneType: {
      type: String,
      enum: PHONE_TYPES
    },
    phoneNumber: {
      type: String
    }
  }],
  emails: [{
    type: String,
    match: [/.+\@.+\..+/, 'Please fill a valid email address']
  }]
});

AgentSchema.statics.PHONE_TYPES = PHONE_TYPES;

module.exports = mongoose.model('Agent', AgentSchema);