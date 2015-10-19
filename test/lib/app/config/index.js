'use strict';

var mysqlConf = require('./config').development;
module.exports = {
    mongoose: {
        connectionString: 'mongodb://localhost/restifizerTest'
    },
    mysql: {
        connectionString: mysqlConf.database,
        username: mysqlConf.username,
        password: mysqlConf.password
    }
};