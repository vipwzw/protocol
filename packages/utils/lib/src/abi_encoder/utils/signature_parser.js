"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDataItemFromSignature = generateDataItemFromSignature;
const _ = __importStar(require("lodash"));
function parseNode(node) {
    const components = [];
    _.each(node.children, (child) => {
        const component = parseNode(child);
        components.push(component);
    });
    const dataItem = {
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
        throw new Error(`Cannot parse data item from empty signature, ''`);
    }
    // Create a parse tree for data item
    let node = {
        name: '',
        value: '',
        children: [],
    };
    for (const char of signature) {
        switch (char) {
            case '(':
                const child = {
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
                const sibling = {
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
    const dataItem = parseNode(node);
    return dataItem;
}
