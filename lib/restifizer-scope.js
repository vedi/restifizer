'use strict';
/**
 * Created by vedi on 01/12/14.
 */

var ACTIONS = {
  SELECT: 'select',
  SELECT_ONE: 'selectOne',
  INSERT: 'insert',
  REPLACE: 'replace',
  UPDATE: 'update',
  DELETE: 'delete',
  COUNT: 'count'
};

function RestifizerScope(action, contextFactory) {
  this.action = action;
  if (contextFactory) {
    this.context = contextFactory();
  } else {
    this.context = {};
  }
}

RestifizerScope.prototype.isSelect = function isSelect() {
  return this.action === ACTIONS.SELECT || this.action === ACTIONS.SELECT_ONE || this.action === ACTIONS.COUNT;
};

RestifizerScope.prototype.isChanging = function isChanging() {
  return this.isInsert() || this.isUpdate() || this.isDelete();
};

RestifizerScope.prototype.isInsert = function isInsert() {
  return this.action === ACTIONS.INSERT;
};

RestifizerScope.prototype.isUpdate = function isUpdate() {
  return this.action === ACTIONS.UPDATE || this.action === ACTIONS.REPLACE;
};

RestifizerScope.prototype.isDelete = function isDelete() {
  return this.action === ACTIONS.DELETE;
};

RestifizerScope.prototype.isSelectOne = function isSelectOne() {
  return this.action === ACTIONS.SELECT_ONE;
};

RestifizerScope.prototype.isReplace = function isReplace() {
  return this.action === ACTIONS.REPLACE;
};

RestifizerScope.prototype.isCount = function isCount() {
  return this.action === ACTIONS.COUNT;
};

RestifizerScope.ACTIONS = ACTIONS;

module.exports = RestifizerScope;
