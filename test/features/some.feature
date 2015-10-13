Feature: Example feature
	As a user of Restifizer
	I want to have ability to create full-functional RESTful services
	
	Scenario: Create Employee (Ivan Ivanov)
		When I put mongo.testEmployee as parameters to request
		And I send post request to employees
		Then I should get success with code 201
		And I get "name" with value equals to mongo.testEmployee.name in response
		And I get "_id" in response
		
	Scenario: Create Additional Employee (John Doe)
		When I put mongo.additionalTestEmployee as parameters to request
		And I send post request to employees
		Then I should get success with code 201
		And I get "name" with value equals to mongo.additionalTestEmployee.name in response
		And I get "_id" in response
	
	Scenario: Get Employees List
		When I send get request to employees
		Then I should get success with code 200
		And I get an array with length equals to 2 in response
		
	Scenario: Get Employee using targeted request
		When I put "_id" from mongo.testEmployee to request
		And I send targeted get request to employees
		Then I should get success with code 200
		And I get "_id" with value equals to mongo.testEmployee._id in response
		
	Scenario: Get Employee With Filtering
		When I put "filter" from mongo.cases to the query string of request
		And I send get request to employees
		Then I should get success with code 200
		And I get an array with length equals to 1 in response
		And I get "name" in the 0 element with value equals to value of mongo.additionalTestEmployee.name in response

	Scenario: Get Employees List With Per-Page Limits
		When I put "per_page" from mongo.cases to the query string of request
		And I send get request to employees
		Then I should get success with code 200
		And I get an array with length equals to 1 in response
		
	Scenario: Get Employees List With Ordering
		When I put "orderBy" from mongo.cases to the query string of request
		And I send get request to employees
		Then I should get success with code 200
		And I get "name" in the 0 element with value equals to value of mongo.additionalTestEmployee.name in response
		
	Scenario: Get Employees List With Paging
		When I put "page" from mongo.cases to the query string of request
		And I send get request to employees
		Then I should get success with code 200
		And I get an array with length equals to 1 in response
		
	Scenario: Get Employees List Using Q-Search
		When I put "q" from mongo.cases to the query string of request
		And I send get request to employees
		Then I should get success with code 200
		And I get "name" in the 0 element with value equals to value of mongo.additionalTestEmployee.name in response

	Scenario: Replace Employee
		When I put "_id" from mongo.testEmployee to request
		And I put mongo.replaceEmployee as parameters to request
		And I send targeted put request to employees
		Then I should get success with code 200
		And I get "name" with value equals to mongo.replaceEmployee.name in response
		And I get "lastName" with value equals to mongo.replaceEmployee.lastName in response
	
	Scenario: Update Employee
		When I put "_id" from mongo.additionalTestEmployee to request
		And I put mongo.updateForEmployee as parameters to request
		And I send targeted patch request to employees
		Then I should get success with code 200
		And I get "name" with value equals to mongo.updateForEmployee.name in response
	
	Scenario: Delete Employee
		When I put "_id" from mongo.additionalTestEmployee to request
		And I send targeted delete request to employees
		Then I should get success with code 200
		
	Scenario: Create Contact (Ivan Ivanov)
		When I put mysql.testContact as parameters to request
		And I send post request to contacts
		Then I should get success with code 201
		And I get "name" with value equals to mysql.testContact.name in response
		And I get "id" in response
		
	Scenario: Create Additional Contact (John Doe)
		When I put mysql.additionalTestContact as parameters to request
		And I send post request to contacts
		Then I should get success with code 201
		And I get "name" with value equals to mysql.additionalTestContact.name in response
		And I get "id" in response
	
	Scenario: Get Contacts List
		When I send get request to contacts
		Then I should get success with code 200
		And I get an array with length equals to 2 in response
		
	Scenario: Get Contacts using targeted request
		When I put "id" from mysql.testContact to request
		And I send targeted get request to contacts
		Then I should get success with code 200
		And I get "id" with value equals to mysql.testContact.id in response
		
	Scenario: Get Contacts With Fields Parameter
		When I put "fields" from mysql.cases to the query string of request
		And I put "id" from mysql.testContact to request
		And I send targeted get request to contacts
		Then I should get success with code 200
		And I get not "username" in response
	
	Scenario: Get Contacts With Filtering
		When I put "filter" from mysql.cases to the query string of request
		And I send get request to contacts
		Then I should get success with code 200
		And I get an array with length equals to 1 in response
		And I get "name" in the 0 element with value equals to value of mysql.additionalTestContact.name in response

	Scenario: Get Contacts List With Per-Page Limits
		When I put "per_page" from mysql.cases to the query string of request
		And I send get request to contacts
		Then I should get success with code 200
		And I get an array with length equals to 1 in response
		
	Scenario: Get Contacts List With Ordering
		When I put "orderBy" from mysql.cases to the query string of request
		And I send get request to contacts
		Then I should get success with code 200
		And I get "name" in the 0 element with value equals to value of mysql.additionalTestContact.name in response
		
	Scenario: Get Contacts List With Paging
		When I put "page" from mysql.cases to the query string of request
		And I send get request to contacts
		Then I should get success with code 200
		And I get an array with length equals to 1 in response
		
	Scenario: Get Contacts List Using Q-Search
		When I put "q" from mysql.cases to the query string of request
		And I send get request to contacts
		Then I should get success with code 200
		And I get "name" in the 0 element with value equals to value of mysql.additionalTestContact.name in response

	Scenario: Replace Contact
		When I put "id" from mysql.testContact to request
		And I put mysql.replaceContact as parameters to request
		And I send targeted put request to contacts
		Then I should get success with code 200
		And I get "name" with value equals to mysql.replaceContact.name in response
		And I get "lastName" with value equals to mysql.replaceContact.lastName in response
	
	Scenario: Update Contact
		When I put "id" from mysql.additionalTestContact to request
		And I put mysql.updateForContact as parameters to request
		And I send targeted patch request to contacts
		Then I should get success with code 200
		And I get "name" with value equals to mysql.updateForContact.name in response
	
	Scenario: Delete Contact
		When I put "id" from mysql.additionalTestContact to request
		And I send targeted delete request to contacts
		Then I should get success with code 200

	Scenario: Check 'defaultFields' parameter
        When I put "_id" from mongo.testEmployee to request
        And I send targeted get request to employeesInfo
        Then I should get success with code 200
        And I get not "emails" in response