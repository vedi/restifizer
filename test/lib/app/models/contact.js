var Sequelize = require('sequelize');
var config = require('../config').mysql;
var sequelize = new Sequelize(config.connectionString, config.username, config.password);

var Contact = sequelize.define('Contact', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true
  },
  username: Sequelize.STRING,
  name: Sequelize.STRING,
  lastName: Sequelize.STRING
});

module.exports = Contact;