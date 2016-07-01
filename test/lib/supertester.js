var request = require('supertest');
var app = require('./app/app');

module.exports = request(app);