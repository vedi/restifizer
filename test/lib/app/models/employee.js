'use strict';

const mongoose = require('mongoose');

const PHONE_TYPES = 'home mobile work'.split(' ');

const EmployeeSchema = new mongoose.Schema({
  _id: {
    type: String,
  },
  name: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  phones: [{
    phoneType: {
      type: String,
      enum: PHONE_TYPES,
    },
    phoneNumber: {
      type: String,
    },
  }],
  emails: [{
    type: String,
    match: [/.+\@.+\..+/, 'Please fill a valid email address'],
  }],
  hiredAt: {
    type: Date,
    default: Date.now,
  },
  firedAt: {
    type: Date,
  },
});

EmployeeSchema.statics.PHONE_TYPES = PHONE_TYPES;

module.exports = mongoose.model('Employee', EmployeeSchema);
