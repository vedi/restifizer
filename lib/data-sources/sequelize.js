var SequelizeDataSource = require('restifizer-sequelize-ds');
module.exports = function(options) {
  return new SequelizeDataSource(options.model);
};