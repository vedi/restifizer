'use strict';

module.exports = {
  up(queryInterface, Sequelize) {
    queryInterface.createTable(
      'Contacts',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
        },
        username: Sequelize.STRING,
        name: Sequelize.STRING,
        lastname: Sequelize.STRING,
        updatedAt: Sequelize.DATE,
        createdAt: Sequelize.DATE,
      },
      {
        /* engine: 'InnoDB',
         charset: 'utf8'*/
      }
    );
  },
  down(queryInterface, Sequelize) {
    return queryInterface.dropAllTables();
  },
};
