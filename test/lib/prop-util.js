/**
 * Created by vedi on 23/04/15.
 */
module.exports = {
  resolveProp: function resolveProp(obj, stringPath) {
    stringPath = stringPath.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    stringPath = stringPath.replace(/^\./, '');           // strip a leading dot
    var pathArray = stringPath.split('.');
    while (pathArray.length) {
      var pathItem = pathArray.shift();
      if (pathItem in obj) {
        obj = obj[pathItem];
      } else {
        return;
      }
    }
    return obj;
  },
  setProp: function setProp(obj, stringPath, value) {
    stringPath = stringPath.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    stringPath = stringPath.replace(/^\./, '');           // strip a leading dot
    var pathArray = stringPath.split('.');
    while (pathArray.length - 1) {
      var pathItem = pathArray.shift();
      if (pathItem in obj) {
        obj = obj[pathItem];
      } else {
        return;
      }
    }
    return obj[pathArray.length ? pathArray[0] : stringPath] = value;
  }
};
