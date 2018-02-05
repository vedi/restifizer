'use strict';

/**
 * Created by vedi on 01/12/14.
 */

const ACTIONS = {
  SELECT: 'select',
  DISTINCT: 'distinct',
  SELECT_ONE: 'selectOne',
  INSERT: 'insert',
  REPLACE: 'replace',
  UPDATE: 'update',
  DELETE: 'delete',
  COUNT: 'count',
};

class RestifizerScope {
  constructor(action, contextFactory) {
    this.action = action;
    if (contextFactory) {
      this.context = contextFactory();
    } else {
      this.context = {};
    }
  }

  /**
   * @deprecated
   */
  getActionName() {
    return this.action.name;
  }

  get actionName() {
    return this.action.name;
  }

  checkActionName(...names) {
    return names.includes(this.action.name);
  }

  isSelect() {
    return this.checkActionName(ACTIONS.SELECT, ACTIONS.SELECT_ONE, ACTIONS.COUNT, ACTIONS.DISTINCT);
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
    return this.transportData;
  }

  /**
   * @deprecated
   */
  getQ() {
    return this.transport.getQ(this);
  }

  /**
   * @deprecated
   */
  getBody() {
    return this.transport.getBody(this);
  }

  /**
   * @deprecated
   */
  getParams() {
    return this.transport.getParams(this);
  }

  /**
   * @deprecated
   */
  getQuery() {
    return this.transport.getQuery(this);
  }

  /**
   * @deprecated
   */
  getFields() {
    return this.transport.getFields(this);
  }

  /**
   * @deprecated
   */
  getFilter() {
    return this.transport.getFilter(this);
  }

  /**
   * @deprecated
   */
  getOrderBy() {
    return this.transport.getOrderBy(this);
  }

  /**
   * @deprecated
   */
  getPagination() {
    return this.transport.getPagination(this);
  }

  get q() {
    return this.transport.getQ(this);
  }

  get body() {
    return this.transport.getBody(this);
  }

  get params() {
    return this.transport.getParams(this);
  }

  get query() {
    return this.transport.getQuery(this);
  }

  get fields() {
    return this.transport.getFields(this);
  }

  get filter() {
    return this.transport.getFilter(this);
  }

  get orderBy() {
    return this.transport.getOrderBy(this);
  }

  get pagination() {
    return this.transport.getPagination(this);
  }
}

RestifizerScope.ACTIONS = ACTIONS;

module.exports = RestifizerScope;
