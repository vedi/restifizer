/**
 * Created by vedi on 01/12/14.
 */
'use strict';

var ACTIONS = {
  SELECT: 'select',
  SELECT_ONE: 'selectOne',
  INSERT: 'insert',
  UPDATE: 'update',
  PARTIAL_UPDATE: 'partialUpdate',
  DELETE: 'delete',
  COUNT: 'count',
  AGGREGATE: 'aggregate',
};

function RestifizerScope(action) {
  this.action = action;
  this.context = {};
};

RestifizerScope.prototype.isSelect = function isSelect() {
  return this.action === ACTIONS.SELECT || this.action === ACTIONS.SELECT_ONE;
};

RestifizerScope.prototype.isChanging = function isChanging() {
  return this.isInsert() || this.isUpdate() || this.isDelete();
};

RestifizerScope.prototype.isInsert = function isSelect() {
  return this.action === ACTIONS.INSERT;
};

RestifizerScope.prototype.isUpdate = function isUpdate() {
  return this.action === ACTIONS.UPDATE || this.action === ACTIONS.PARTIAL_UPDATE;
};

RestifizerScope.prototype.isDelete = function isDelete() {
  return this.action === ACTIONS.DELETE;
};

RestifizerScope.prototype.isSelectOne = function isSelectOne() {
  return this.action === ACTIONS.SELECT_ONE;
};

RestifizerScope.prototype.isPartialUpdate = function isPartialUpdate() {
  return this.action === ACTIONS.PARTIAL_UPDATE;
};

RestifizerScope.prototype.isCount = function isCount() {
  return this.action === ACTIONS.COUNT;
};

RestifizerScope.prototype.isAggregate = function isAggregate() {
  return this.action === ACTIONS.AGGREGATE;
};

RestifizerScope.ACTIONS = ACTIONS;

module.exports = RestifizerScope;
