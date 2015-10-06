'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.createTable(
      'Contacts',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true
        },
        username: Sequelize.STRING,
        name: Sequelize.STRING,
        lastname: Sequelize.STRING,
        updatedAt: Sequelize.DATE,
        createdAt: Sequelize.DATE
      },
      {
        /*engine: 'InnoDB',
        charset: 'utf8'*/
      }
      );
  },
  down: function (queryInterface, Sequelize) {
    return queryInterface.dropAllTables();
  }
};