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

  Scenario: Get Count request to employees
    When I send get request to employees/count
    Then I should get success with code 200
    And I get "count" with value "2" in response

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

  Scenario: Update Employee (with using of arrayMethods)
    When I put "_id" from mongo.additionalTestEmployee to request
    And I put mongo.updateForEmployee as parameters to request
    And I send targeted patch request to employees
    Then I should get success with code 200
    And I get "name" with value equals to mongo.updateForEmployee.name in response
    And I get "emails.length" with value "2" in response
    And I get "phones.length" with value "" in response

  Scenario: Delete Employee
    When I put "_id" from mongo.additionalTestEmployee to request
    And I send targeted delete request to employees
    Then I should get success with code 204

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
    Then I should get success with code 204

  Scenario: Check 'defaultFields' parameter
    When I put "_id" from mongo.testEmployee to request
    And I send targeted get request to employeesInfo
    Then I should get success with code 200
    And I get not "emails" in response

  Scenario: Create Agent, check helper action utils and postprocessor of the controller
    When I put mongo.agent as parameters to request
    And I send post request to agents
    Then I should get success with code 201
    And I get "name" with value equals to mongo.agent.name in response
    And I get "actionsCheck.isSelect" with value "" in response
    And I get "actionsCheck.isChanging" with value "true" in response
    And I get "actionsCheck.isInsert" with value "true" in response
    And I get "actionsCheck.isUpdate" with value "" in response
    And I get "actionsCheck.isDelete" with value "" in response
    And I get "actionsCheck.isSelectOne" with value "" in response
    And I get "actionsCheck.isReplace" with value "" in response
    And I get "actionsCheck.isCount" with value "" in response
    And I get "_id" in response

  Scenario: Create Mission
    When I put mongo.mission as parameters to request
    And I send post request to missions
    Then I should get success with code 201
    And I get "description" with value equals to mongo.mission.description in response
    And I get "agent.name" with value equals to mongo.agent.name in response
    And I get "_id" in response

  Scenario: Get 404 in GET request
    When I put "_id" from mongo.absentMission to request
    And I send targeted get request to missions
    Then I should get fail with code 404

  Scenario: Get 404 in PUT request
    And I put mongo.mission as parameters to request
    When I put "_id" from mongo.absentMission to request
    And I send targeted put request to missions
    Then I should get fail with code 404

  Scenario: Get 404 in PATCH request
    And I put mongo.mission as parameters to request
    When I put "_id" from mongo.absentMission to request
    And I send targeted patch request to missions
    Then I should get fail with code 404

  Scenario: Get 404 in DELETE request
    When I put "_id" from mongo.absentMission to request
    And I send targeted delete request to missions
    Then I should get fail with code 404

  Scenario: Get Missions List
    When I send get request to missions
    Then I should get success with code 200
    And I get an array with length equals to 1 in response

  Scenario: Get Mission using targeted request
    When I put "_id" from mongo.mission to request
    And I send targeted get request to missions
    Then I should get success with code 200
    And I get "_id" with value equals to mongo.mission._id in response

  Scenario: Replace Mission
    When I put "_id" from mongo.mission to request
    And I put mongo.missionUpdates as parameters to request
    And I send targeted put request to missions
    Then I should get success with code 200
    And I get "description" with value equals to mongo.missionUpdates.description in response
    And I get "agent._id" with value equals to mongo.missionUpdates.agent in response