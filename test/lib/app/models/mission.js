/**
 * Created by igor on 20.10.15.
 */

'use strict';

const mongoose = require('mongoose');

const MissionSchema = new mongoose.Schema({
  _id: {
    type: String,
  },
  description: {
    type: String,
    required: true,
  },
  agent: {
    type: String,
    required: true,
    ref: 'Agent',
  },
});

module.exports = mongoose.model('Mission', MissionSchema);
