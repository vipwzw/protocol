"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDataItemFromSignature = generateDataItemFromSignature;
var _ = require("lodash");
function parseNode(node) {
    var components = [];
    _.each(node.children, function (child) {
        var component = parseNode(child);
        components.push(component);
    });
    var dataItem = {
        name: node.name,
        type: node.value,
    };
    if (!_.isEmpty(components)) {
        dataItem.components = components;
    }
    return dataItem;
}
/**
 * Returns a DataItem corresponding to the input signature.
 * A signature can be in two forms: `type` or `(type_1,type_2,...,type_n)`
 * An example of the first form would be 'address' or 'uint256[]' or 'bytes[5][]'
 * An example of the second form would be '(address,uint256)' or '(address,uint256)[]'
 * @param signature of input DataItem.
 * @return DataItem derived from input signature.
 */
function generateDataItemFromSignature(signature) {
    // No data item corresponds to an empty signature
    if (_.isEmpty(signature)) {
        throw new Error("Cannot parse data item from empty signature, ''");
    }
    // Create a parse tree for data item
    var node = {
        name: '',
        value: '',
        children: [],
    };
    for (var _i = 0, signature_1 = signature; _i < signature_1.length; _i++) {
        var char = signature_1[_i];
        switch (char) {
            case '(':
                var child = {
                    name: '',
                    value: '',
                    children: [],
                    parent: node,
                };
                node.value = 'tuple';
                node.children.push(child);
                node = child;
                break;
            case ')':
                node = node.parent;
                break;
            case ',':
                var sibling = {
                    name: '',
                    value: '',
                    children: [],
                    parent: node.parent,
                };
                node.parent.children.push(sibling);
                node = sibling;
                break;
            case ' ':
                node.name = node.value;
                node.value = '';
                break;
            default:
                node.value += char;
                break;
        }
    }
    // Interpret data item from parse tree
    var dataItem = parseNode(node);
    return dataItem;
}
