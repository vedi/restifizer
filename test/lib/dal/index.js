'use strict';

module.exports = {
	mongo: {
		testEmployee: {
			'_id': 'ivan.ivanov',
			'name': 'Ivan',
			'lastName': 'Ivanov',
			'phones': [
				{ 'phoneType': 'home', 'phoneNumber': '+38062 111 1111' },
				{ 'phoneType': 'work', 'phoneNumber': '+38062 111 2222' },
				{ 'phoneType': 'mobile', 'phoneNumber': '+38093 111 1111' }
			],
			'emails': ['ivansquared@mail.com']
		},
		additionalTestEmployee: {
			'_id': 'john.doe',
			'name': 'John',
			'lastName': 'Doe',
			'phones': [
				{ 'phoneType': 'mobile', 'phoneNumber': '+xxxxx xxx xxxx' }
			],
			'emails': ['john@doe.com']
		},
		cases: {
			filter: 'filter={"name": "John"}',
			orderBy: 'orderBy={"name": -1}',
			per_page: 'per_page=1',
			page: 'page=2&per_page=1',
			q: 'q=Doe'
		},
		replaceEmployee: {
			'name': 'Vanyok',
			'lastName': 'Ivanoff'
		},
		updateForEmployee: {
			'name': 'Jane'
		}
	}
};