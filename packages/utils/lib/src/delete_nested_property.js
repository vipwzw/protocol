"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNestedProperty = void 0;
/* Deletes deeply nested properties from an object. MUTATES the object
 * @param obj the object to be operated on
 * @param propPath the full dot-separated path to the property to delete, e.g. 'animals.mammals.dog.name'
 * returns void
 */
var deleteNestedProperty = function (obj, propPath) {
    if (!obj || !propPath) {
        return;
    }
    var propPathParts = propPath.split('.');
    var _obj = obj;
    for (var i = 0; i < propPathParts.length - 1; i++) {
        _obj = _obj[propPathParts[i]];
        if (typeof _obj === 'undefined') {
            return;
        }
    }
    while (propPathParts.length > 0) {
        delete _obj[propPathParts.pop()];
    }
};
exports.deleteNestedProperty = deleteNestedProperty;
