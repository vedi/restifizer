var MongooseDataSource = require('restifizer-mongoose-ds');
module.exports = function(options) {
  return new MongooseDataSource(options.model);
};