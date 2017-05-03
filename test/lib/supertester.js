const request = require('supertest');
const app = require('./app/app');

module.exports = request(app);
