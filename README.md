[![NPM](https://nodei.co/npm/restifizer.png?compact=true)](https://npmjs.org/package/restifizer)

> We are working hard to create and improve documentation. Some sections still are blank. But if you have exact questions or ideas how we can improve documentation, create a ticket with it here: https://github.com/vedi/restifizer/issues

> Simple example project is available at https://github.com/vedi/restifizer-example.

> Full functional seed-project based on MEAN.JS (http://meanjs.org/) is available at https://github.com/vedi/restifizer-mean.js.

> If you are looking for Restifizer SDK for Unity3d, you can find it here: https://github.com/vedi/restifizer-unity3d

> FileController was extracted to a separate module: https://github.com/vedi/restifizer-files

> Any feedback is appreciated.

Restifizer
==========

Restifizer - it's a way to significantly simplify creation of full-functional RESTful services. Access to the data is carried out via plug-in data sources: [restifizer-mongoose-ds](https://github.com/vedi/restifizer-mongoose-ds) and [restifizer-sequelize-ds](https://github.com/vedi/restifizer-sequelize-ds).
The data source modules are designed on top of the [Mongoose](http://mongoosejs.com/) and the [Sequelize](http://docs.sequelizejs.com/en/latest/) respectively, which allows us to use such databases as the [MongoDB](www.mongodb.org), [MSSQL](http://www.microsoft.com/en-us/server-cloud/products/sql-server/), [MySQL](www.mysql.com), [MariaDB](mariadb.org), [PostgreSQL](http://www.postgresql.org/) and [SQLite](www.sqlite.org).

The key feature of the `restifizer` - it's very coupled to Mongoose and Sequelize ORM-s as result it allows to make prototyping of the services as soon as it's possible. 
Wide list of the features of this ORM-s (and we working hard to extend it) becomes available in your server out of the box.
There is a list of some of these features:
 * querying engine - it literally means you can define MongoDB/Sequelize queries in your http-requests,
 * aggregation - you can use rich aggregation abilities of MongoDB in your http-requests,
 * nested objects and arrays - since resources are just MongoDB docs, you can easily use any nested structures supported,
 * data population - you can easily define what the additional data should fetched and populated (JOIN) in your resource.

> Such features on one hand allow your service to be developed extremely fast, but on other hand you always should remember, 
you need to solve all possible performance impacts before coming production.
For example you should allow filtering by indexed fields only. By default it's allowed for each ones.

## Resources

It's a core of RESTful services. Resources are available at a specific path on the server. For example: `"/api/users"`.

## Supported HTTP methods

In the best traditions of REST-genre the most of the actions with resource can be "expresed" with http-methods. 
`restifizer` supports following methods:
 * GET - selects a set of resources or a resource if a key is specified,
 * HEAD - retrieve all resources or a resource if a key is specified in a collection (header only),
 * POST - saves new instance of resource on the server,
 * PUT - replaces existing instance of resource with data provided in request,
 * PATCH - updates fields of existing instance of resource with values provided in request,
 * DELETE - removes existing instance of resource from the server. 

> I use `httpie` (https://github.com/jakubroztocil/httpie) as a command line tool to test the servers. You can use any, but all the examples were created with syntax of `httpie`. Anyway it's recognizable.

### GET (select, selectOne)

Get collection (select) - retrieve all resources in a collection 
```
http GET <serverURL>/api/<collection>
```
Get resource (selectOne) - retrieve a single resource with specified <id>
```
http GET <serverURL>/api/<collection>/<id>
```

`restifizer` allows to get the list of resources according provided criteria. If no criteria provided, it return the first page of `maxPageSize` with all available fields.

Example:
```
http GET localhost:3000/api/users?filter={"username": "test"}&fields=username,createdAt&orderBy={"username": -1}
```

#### Supported parameters

The set of supported parameters is determined by the data source.

#### restifizer-mongoose-ds params:

###### filter

It's json value containing any valid MongoDB query. See [docs](http://docs.mongodb.org/manual/reference/glossary/#term-query) for details. 

Example:
```
http GET localhost:3000/api/users?filter={"sex": "M", "age": { "$gt": 18 }}
```
You can use regex values in filter. As we pass JSON in this param it's not possible to use regular expression objects (/pattern/).
You should replace it with `$regex` operator. See [docs](http://docs.mongodb.org/manual/reference/operator/query/regex/) for details.

###### fields

Comma separated list of field names.

Example:
```
http GET localhost:3000/api/users?fields=sex,age
```

###### orderBy

It's json value built according MongoDB rules. Use 1 for an ascending sorting, and -1 for a descending sorting. See [docs](http://docs.mongodb.org/manual/reference/method/cursor.sort/#cursor.sort) for details.

Example:
```
http GET localhost:3000/api/users?orderBy={"username": 1, "age": -1}
```

###### per_page

The maximum number of records in the response. `defaultPerPage` is used by default, and maximum is limited with `maxPerPage`. See [docs](http://docs.mongodb.org/manual/reference/method/cursor.limit/#cursor.limit) for details.

Example:
```
http GET localhost:3000/api/users?per_page=10
```

###### page

A number of page to return, `1` if a value is not provided. We skip `(page - 1) * per_page` records in the query to achieve that. See [docs](http://docs.mongodb.org/manual/reference/method/cursor.skip/#cursor.skip) for details.

###### q

Parameter for q-searches. It can be any string value. 
`restifizer` will use it to build the following condition for every value in your `qFields`:
```
{$regex: '.*' + q + ".*", $options: 'i'}
```
Example:
```
http GET localhost:3000/api/users?q=John
```

See `q-search` section for details.


#### restifizer-sequelize-ds params:

###### fields

Comma separated list of field names.

###### filter

In order to filter records to fetch from the server you can specify `filter` param in URL of your request. It's json value containing any valid [sequelize.js](http://docs.sequelizejs.com/en/latest/docs/querying/) query. Besides simple filtering by values it supports additional operators, which allow to build more complex query to the server. See [docs](http://docs.sequelizejs.com/en/latest/docs/querying/) for more details. 

Example:
```
http GET localhost:3000/api/users?filter={"gender": "M", "age": { "$gt": 18}, "name": {"$like": "Ro%"}}
```

###### perPage

Every fetching request returns only one page of data. You can change default page size providing `perPage` param in URL. Default value of the page is 25, and the maximum page size limited by 100.

###### page

The `page` param allows you to specify page number to fetch. The page numeration begins from 1.

###### orderBy

For ordering the records you should use `orderBy` param in URL. It should be a valid JSON, containing field names as keys, and 1 or -1 as values depending on a way to sort (ASC or DESC).


### POST (insert)

```
http POST localhost:3000/api/users username=test password=pass
```

It allows to add new resources to the server. You can provide field values in body with json, or as form params. 


### PUT (replace)

```
http PUT localhost:3000/api/users/<id> username=test password=pass
```

It completely replaces resource with provided `id` with new one specifided in the request. You can provide field values in body with json, or as form params. 
Be careful if no value for a field provided, it will be set to undefined. 

### PATCH (update)

```
http PATCH localhost:3000/api/users/<id> password=pass
```

It partially update resource with provided `id` with data from the request. You can provide field values in body with json, or as form params.

If a resource returns an array of associated entity, it’s possible to perform special kind of `PATCH` request with special array methods. 
The server supports the following methods:
`$push` - add new associated items, 
`$pull` - remove existing associated items.
The body of the method can be different among the resources. Please, refer to resource documentation: [mongo](http://docs.mongodb.org/manual/reference/operator/update-array/).

Example:
Add tag to the message tags
```
http PATCH <serverURL>/api/messages/<messageId> Authorization:'Bearer <access_token>'
{
  $push: {
    tags: {
        tagId: 15
    }
  }
}
```

### DELETE 

```
http DELETE 'localhost:3000/api/users/<id>'
```

It removes the record by `id`.

## Aggregation

As an extension to standard rest-kit restifizer supports some built-in MongoDB aggregations.

### count

```
http GET localhost:3000/api/users/count?filter={age: { $gt: 18 } }}
```

It allows do get count of records of specified resource. See [docs](http://docs.mongodb.org/manual/reference/method/db.collection.count/) for details.

#### Supported params

##### filter

It's json value containing any valid MongoDB query. See [docs](http://docs.mongodb.org/manual/reference/glossary/#term-query) for details. 

Example:
```
{"sex": "M", age: { $gt: 18 } }}
```

### aggregate

```
http GET localhost:3000/api/users/aggregate?filter={age: { $gt: 18 } }}
```

It performs aggregation of the resource records. See [docs](http://docs.mongodb.org/manual/aggregation/) for details.


## Response status

* 200 OK - after any successful request except POST.
* 201 Created - after successful POST.
* 404 Not Found - related resource has not been found for GET (by id), PUT, PATCH, DELETE.
* 400 Bad Request - request params cannot be parsed, or validation failed, or unique checking failed.
* 409 Conflict - mongoose VersionError happened.

## Paging

It relates to getting the list of resources. Every such response is limited with paging rules:
* an user specifies `per_page` and `page` params in URL,
* if params are not provided default rules are applied (see `restifizerOptions.defaultPerPage`),
* if `per_page` greater then `restifizerOptions.maxPerPage`, value of `maxPerPage` is used. 

## Controllers

Controllers are the way to provide needed configuration for your resource and to customize its behaviour.
 
### Properties

#### dataSource

This param is a way to specify, what data source will be used. Today available [restifizer-mongoose-ds](https://github.com/vedi/restifizer-mongoose-ds) and [restifizer-sequelize-ds](https://github.com/vedi/restifizer-sequelize-ds) modules.
Any resource is bound to mongoose/sequelize model, and this param is a way to specify, what the model your resource uses.

Example (mongoose):
```
var Restifizer = require('restifizer');
var MongooseDataSource = require('restifizer-mongoose-ds');
var User = require('MongooseUserModel');

var UserController = Restifizer.Controller.extend({
  dataSource: new MongooseDataSource(User),
  path: '/api/users',
  ...
});
```

Example (sequelize):
```
var Restifizer = require('restifizer');
var SequelizeDataSource = require('restifizer-sequelize-ds');
var User = require('SequelizeUserModel');

var UserController = Restifizer.Controller.extend({
  dataSource: new SequelizeDataSource(User),
  path: '/api/users',
  ...
});

```

#### path

With this option you specify the paths, where resource will be available at. There are 2 important points:
   * it can be a string, or an array if resource is available at several paths,
   * you can provide params in paths, and they will be automatically bound to params of requests.

For instance, you can write:
```
path: ['/api/appData', '/api/users/:owner/appData']
```
and in the case if an user requests data at `/api/users/543d2605e21f85d73b060979/appData`, appData will be filtered by provided value of `owner`.

#### fields

By default all the fields you defined in your model schema (without fields with name starting from "__") are available in your resource.
Providing this params are you able exclude some fields from the resource, or add new calculated fields.

#### idField

Name of id field. By default: '_id'. This value is used in route params for selectOne, replace, update, delete.

#### defaultFilter

With this param you can specify default `filter` value for your controller.

#### orderBy

With this param you can specify default `orderBy` value for your controller.
For example:
`orderBy: {date: -1}`

#### q-search

Q-search allows to search data without specifying exact fields of search. Just specify in your controller searchable fields:
 
```
qFields: ["login", "firstName", "lastName"]
```

and set `q` param of your GET request (see `q` for details).

### arrayMethods

>Available only for restifizer-mongoose-ds data source.

Supported methods with arrays. Default value: ['$addToSet', '$pop', '$push', '$pull'].
It's relevant to update (PATCH) only. You can specify such methods in order to manipulate array fields of your resource.

The params and implementations of these methods relate to the same methods in MongoDB:
* `$addToSet` - [docs](http://docs.mongodb.org/manual/reference/operator/update/addToSet/#up._S_addToSet),
* `$pop` - [docs](http://docs.mongodb.org/manual/reference/operator/update/pop/#up._S_pop),
* `$push` - [docs](http://docs.mongodb.org/manual/reference/operator/update/push/#up._S_push),
* `$pull` - [docs](http://docs.mongodb.org/manual/reference/operator/update/pull/#up._S_pull).


### Action Options

#### Option inheritance

You are able to customize the behaviour of your controllers very much. And we did all our best to make this process as simple as it's posible.
That's why you're able to specify option in one of the methods, and `restifizer` will apply inheritence rules to the  of other methods.
  
There are following rules:
```
default ->
    select ->
        selectOne
    insert ->
        update ->
            replace
            delete
    count
```

> TODO: Change example

For example if you want to define `pre` processor for insert, update, partialUpdate, delete that's enough to define it in your `insert`:
```
var YourController = Restifizer.Controller.extend({
  ...
  insert: {
    pre: function (req, res, next) {
      ...
    }
  }
```

### Handlers

#### pre

`pre: function (req, res, callback)`

`pre` is a preprocessor that is executed at the beginning before any other logic runs. It's a good point to check
preconditions of your request. For example check if the request is executed by Admin:
```
  pre: function (req, res, callback) {
    // not admin
    if (!this.isAdmin(req)) {
      return callback(HTTP_STATUSES.FORBIDDEN.createError());
    }
    callback();
  }
```

#### collectionPost

`collectionPost: function (collection, req, res, callback)`

When `select` returns any collection from db, this collection is passed through this postprocessor.
It's a good point if you want to manipulate with the set of items of the collection, but not with items by themselves.

#### post

`post: function (resource, req, res, callback)`

`post` is postprocessor. It runs immediately before a resource is sent to an user.
At this point you can change the resource by itself. For instance, you can fill calculated fields here:
```
  post: function (resource, req, res, callback) {
    if (resource.icon) {
      resource.icon_url =
        req.protocol + "://" + req.get('host') + '/api/resource/' + resource._id + '/icon';
    }
    callback(null, resource);
  }
```

#### queryPipe

`queryPipe: function (query, req, res, callback)`

You can use `queryPipe` if you need to call additional methods at `mongoose` `query` ([docs](http://mongoosejs.com/docs/queries.html)).
This method is called after all `restifizer` calls are done, but immediately before `exec`.

Draw your attention, this method is called in 2 different semantics:
* in selects - in this case we expect you call `callback`,
* in IUD-methods - in this case we expect you directly return `query`.
In order to make your method workable in both semantics use the way from example bellow (return and call `callback` at the same line).

So, in this example we put `populate` to our query pipe:
```
  queryPipe: function (query, req, res, callback) {
    return query.populate("fieldToPopulate", callback);
  }
```

#### prepareData

`prepareData: function (req, res, callback)`

Prepares data to create new document.
It's a point you can specify defaults for your resource when `restifizer` creates it. `Callback` reseives 2 params:
 * err - error, or null if there is no error happened,
 * data - object containing default values of resource fields.

If you do not specify the handler, `restifizer` uses `{}` to init the object.


#### beforeAssignFields

`beforeAssignFields: function (dest, source, req, callback)`

If it's defined, it runs immediately before `assignFields`, and has the same params.
You can use it to define what the params will be set.

#### beforeSave

`beforeSave: function (doc, req, res, callback)`

Handler, called when you create new resource or change existing instance of your resource after all assignments are already done, but immediately before saving it to your database

#### afterSave

`afterSave: function (doc, req, res, callback)`

If it's defined, it runs immediately after `saveDocument`, and has the same params.

#### afterChange

`afterChange: function (doc, req, res, callback)`

Very similar to `afterSave`, it calls immediately after it in inserts and updates, but it runs after deletes as well.
It can be a good point to integrate your kind of `triggerEngine`. For instance, you can define something like that in
a base controller class of your application:
```
  afterChange: function (doc, req, res, callback) {
    redisClient.publish(this.ModelClass.modelName + '.' + doc.id, req.restifizer.action);
    return callback(null, doc);
  }
```
After that you will be able to subscribe to those events and handle them in flexible and scalable way.

#### beforeDelete

`beforeDelete: function (doc, req, callback)`

If it's defined, it runs immediately before removing the document.

#### beforeArrayMethod

`beforeArrayMethod(dest, methodBody, methodName, fieldName, req)`

If it's defined, it runs immediately before proceeding of array methods.

#### contextFactory

It's used to create context, if it's defined. Otherwise, `{}` used.

#### parseError

Here you can specify a way, how exceptions will be converted to response.

### Methods

#### getContext

`getContext: function (req)`

Returns context of the current request. Context os a place, when you can save any your variable with request's lifecycle.

#### assignFields

`assignFields: function (dest, source, req, callback)`

Assigns all fields from `source` to `dest` according `modelFieldNames`.
You can fetch any additional data at this point, or completely change the way fields are assigned.

Default implemenation iterates through all the fields, passing them through `assignFilter`, and calling `assignField`. 

#### assignField

`assignField: function (dest, source, fieldName, req, callback)`

Assigns single field with name `fieldName` from `source` to `dest`.
At this point you have enough data to deny assigning of exact values to exact fields for instance:
```
var YourController = Restifizer.Controller.extend({
  assignField: function (dest, source, fieldName, req, callback) {
    if (fieldName == 'status' && source[fieldName] == STATUSES.RESTRICTED_STATUS) {
        return callback(HTTP_STATUSES.FORBIDDEN.createError("It's not allowable to set restricted status"));
    }
    YourController.__super__.assignField.apply(this, arguments); // do not forget to call supper method
  },
});
```

#### assignFilter

`assignFilter: function (dest, source, fieldName, req)`

Filters assigning field with name `fieldName`.
In this method you can synchronously return `true` / `false`, allowing / denying to assign exact fields.
For example you can silently skip of changing of exact fields for non-admin users:
```
var YourController = Restifizer.Controller.extend({
  assignFilter: function (dest, source, fieldName, req) {
    if (fieldName == 'adminOnlyField') {
      return this.isAdmin(req);
    }
    YourController.__super__.assignField.apply(this, arguments);
  },
});
```

#### createDocument

`createDocument: function (data, req, res, callback)`

Creates document. It's called when you create new instance of your resource after all assignments are already done,
but immediately before saving it to your database.

#### saveDocument

`saveDocument: function (doc, req, res, callback)`

Saves document to db, called in inserts and updates, after `createDocument` or `updateDocument`.

### restifizerOptions

`restifizerOptions` allows you to define common options for all the controllers of your app.

#### defaultPerPage

This value is used in all `select` requests if no `per_page`/`perPage` has been provided. Default value is `25`.

#### maxPerPage

This value restricts maximum value of `per_page`/`perPage` supported with your app. Default value is `100`.

### Testing

Run MongoDB server on the local machine on port 27017 or change connection string for test application (path '`<restifizerDir>/test/lib/app/config/index.js`'). 
Create `restifizerTest` database at MySQL server and change settings for `sequelize` migration (path `'<restifizerDir>/test/lib/app/config/config.json'`).

Then run
```bash
$ npm test
```