const Sequelize = require('sequelize');
const config = require('../config').mysql;
const sequelize = new Sequelize(config.connectionString, config.username, config.password);

const Contact = sequelize.define('Contact', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
  },
  username: Sequelize.STRING,
  name: Sequelize.STRING,
  lastName: Sequelize.STRING,
});

module.exports = Contact;
