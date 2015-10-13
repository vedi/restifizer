'use strict';

var mysqlConf = require('./config').development;

module.exports = {
	express: {
		port: 1337
	},
	mongoose: {
		connectionString: 'mongodb://localhost/restifizerTest'
	},
	mysql: {
		connectionString: mysqlConf.database,
		username: mysqlConf.username,
    	password: mysqlConf.password
	}
};