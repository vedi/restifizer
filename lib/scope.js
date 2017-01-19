'use strict';
/**
 * Created by vedi on 01/12/14.
 */

const _ = require('lodash');

const ACTIONS = {
  SELECT: 'select',
  DISTINCT: 'distinct',
  SELECT_ONE: 'selectOne',
  INSERT: 'insert',
  REPLACE: 'replace',
  UPDATE: 'update',
  DELETE: 'delete',
  COUNT: 'count'
};

class RestifizerScope {

  constructor(action, transport, contextFactory) {
    this.action = action;
    if (contextFactory) {
      this.context = contextFactory();
    } else {
      this.context = {};
    }
  }

  getActionName() {
    return this.action.name;
  }

  checkActionName() {
    for (let i = 0, j = arguments.length; i < j; i++) {
      if (this.action.name === arguments[i]) {
        return true;
      }
    }

    return false;
  }

  isSelect() {
    return this.checkActionName(ACTIONS.SELECT, ACTIONS.SELECT_ONE, ACTIONS.COUNT);
  }

  isSelectDistinct() {
    return this.checkActionName(ACTIONS.DISTINCT);
  }

  isChanging() {
    return this.isInsert() || this.isUpdate() || this.isDelete();
  }

  isInsert() {
    return this.checkActionName(ACTIONS.INSERT);
  }

  isUpdate() {
    return this.checkActionName(ACTIONS.UPDATE, ACTIONS.REPLACE);
  }

  isDelete() {
    return this.checkActionName(ACTIONS.DELETE);
  }

  isSelectOne() {
    return this.checkActionName(ACTIONS.SELECT_ONE);
  }

  isReplace() {
    return this.checkActionName(ACTIONS.REPLACE);
  }

  isCount() {
    return this.checkActionName(ACTIONS.COUNT);
  }

  getTransportData() {
    return transportData;
  }

  getQ() {
    return this.transport.getQ(this);
  }

  getBody() {
    return this.transport.getBody(this);
  }

  getParams() {
    return this.transport.getParams(this);
  }

  getFields() {
    return this.transport.getFields(this);
  }

  getFilter() {
    return this.transport.getFilter(this);
  }

  getOrderBy() {
    return this.transport.getOrderBy(this);
  }

  getPagination() {
    return this.transport.getPagination(this);
  }

}

RestifizerScope.ACTIONS = ACTIONS;

module.exports = RestifizerScope;
