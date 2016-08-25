'use strict';
/**
 * Created by vedi on 01/12/14.
 */

let _ = require('lodash');

var ACTIONS = {
  SELECT: 'select',
  SELECT_ONE: 'selectOne',
  INSERT: 'insert',
  REPLACE: 'replace',
  UPDATE: 'update',
  DELETE: 'delete',
  COUNT: 'count'
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
}

RestifizerScope.ACTIONS = ACTIONS;

module.exports = RestifizerScope;
