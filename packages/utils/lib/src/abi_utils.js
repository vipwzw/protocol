"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.abiUtils = void 0;
var ethereum_types_1 = require("ethereum-types");
var _ = require("lodash");
var configured_bignumber_1 = require("./configured_bignumber");
// Note(albrow): This function is unexported in ethers.js. Copying it here for
// now.
// Source: https://github.com/ethers-io/ethers.js/blob/884593ab76004a808bf8097e9753fb5f8dcc3067/contracts/interface.js#L30
function parseEthersParams(params) {
    var names = [];
    var types = [];
    params.forEach(function (param) {
        if (param.components != null) {
            var suffix = '';
            var arrayBracket = param.type.indexOf('[');
            if (arrayBracket >= 0) {
                suffix = param.type.substring(arrayBracket);
            }
            var result = parseEthersParams(param.components);
            names.push({ name: param.name || null, names: result.names });
            types.push("tuple(".concat(result.types.join(','), ")").concat(suffix));
        }
        else {
            names.push(param.name || null);
            types.push(param.type);
        }
    });
    return {
        names: names,
        types: types,
    };
}
// returns true if x is equal to y and false otherwise. Performs some minimal
// type conversion and data massaging for x and y, depending on type. name and
// type should typically be derived from parseEthersParams.
function isAbiDataEqual(name, type, x, y) {
    if (x === undefined && y === undefined) {
        return true;
    }
    else if (x === undefined && y !== undefined) {
        return false;
    }
    else if (x !== undefined && y === undefined) {
        return false;
    }
    if (_.endsWith(type, '[]')) {
        // For array types, we iterate through the elements and check each one
        // individually. Strangely, name does not need to be changed in this
        // case.
        if (x.length !== y.length) {
            return false;
        }
        var newType = _.trimEnd(type, '[]');
        for (var i = 0; i < x.length; i++) {
            if (!isAbiDataEqual(name, newType, x[i], y[i])) {
                return false;
            }
        }
        return true;
    }
    if (_.startsWith(type, 'tuple(')) {
        if (_.isString(name)) {
            throw new Error('Internal error: type was tuple but names was a string');
        }
        else if (name === null) {
            throw new Error('Internal error: type was tuple but names was null');
        }
        // For tuples, we iterate through the underlying values and check each
        // one individually.
        var types = splitTupleTypes(type);
        if (types.length !== name.names.length) {
            throw new Error("Internal error: parameter types/names length mismatch (".concat(types.length, " != ").concat(name.names.length, ")"));
        }
        for (var i = 0; i < types.length; i++) {
            // For tuples, name is an object with a names property that is an
            // array. As an example, for orders, name looks like:
            //
            //  {
            //      name: 'orders',
            //      names: [
            //          'makerAddress',
            //          // ...
            //          'takerAssetData'
            //      ]
            //  }
            //
            var nestedName = _.isString(name.names[i])
                ? name.names[i]
                : name.names[i].name;
            if (!isAbiDataEqual(name.names[i], types[i], x[nestedName], y[nestedName])) {
                return false;
            }
        }
        return true;
    }
    else if (type === 'address' || type === 'bytes') {
        // HACK(albrow): ethers.js returns the checksummed address even when
        // initially passed in a non-checksummed address. To account for that,
        // we convert to lowercase before comparing.
        return _.isEqual(_.toLower(x), _.toLower(y));
    }
    else if (_.startsWith(type, 'uint') || _.startsWith(type, 'int')) {
        return new configured_bignumber_1.BigNumber(x).eq(new configured_bignumber_1.BigNumber(y));
    }
    return _.isEqual(x, y);
}
// splitTupleTypes splits a tuple type string (of the form `tuple(X)` where X is
// any other type or list of types) into its component types. It works with
// nested tuples, so, e.g., `tuple(tuple(uint256,address),bytes32)` will yield:
// `['tuple(uint256,address)', 'bytes32']`. It expects exactly one tuple type as
// an argument (not an array).
function splitTupleTypes(type) {
    if (_.endsWith(type, '[]')) {
        throw new Error('Internal error: array types are not supported');
    }
    else if (!_.startsWith(type, 'tuple(')) {
        throw new Error("Internal error: expected tuple type but got non-tuple type: ".concat(type));
    }
    // Trim the outtermost tuple().
    var trimmedType = type.substring('tuple('.length, type.length - 1);
    var types = [];
    var currToken = '';
    var parenCount = 0;
    // Tokenize the type string while keeping track of parentheses.
    for (var _i = 0, trimmedType_1 = trimmedType; _i < trimmedType_1.length; _i++) {
        var char = trimmedType_1[_i];
        switch (char) {
            case '(':
                parenCount += 1;
                currToken += char;
                break;
            case ')':
                parenCount -= 1;
                currToken += char;
                break;
            case ',':
                if (parenCount === 0) {
                    types.push(currToken);
                    currToken = '';
                    break;
                }
                else {
                    currToken += char;
                    break;
                }
            default:
                currToken += char;
                break;
        }
    }
    types.push(currToken);
    return types;
}
exports.abiUtils = {
    parseEthersParams: parseEthersParams,
    isAbiDataEqual: isAbiDataEqual,
    splitTupleTypes: splitTupleTypes,
    parseFunctionParam: function (param) {
        if (param.type === 'tuple') {
            // Parse out tuple types into {type_1, type_2, ..., type_N}
            var tupleComponents = param.components;
            var paramString = _.map(tupleComponents, function (component) { return exports.abiUtils.parseFunctionParam(component); });
            var tupleParamString = "{".concat(paramString, "}");
            return tupleParamString;
        }
        return param.type;
    },
    getFunctionSignature: function (methodAbi) {
        var functionName = methodAbi.name;
        var parameterTypeList = _.map(methodAbi.inputs, function (param) { return exports.abiUtils.parseFunctionParam(param); });
        var functionSignature = "".concat(functionName, "(").concat(parameterTypeList, ")");
        return functionSignature;
    },
    /**
     * Solidity supports function overloading whereas TypeScript does not.
     * See: https://solidity.readthedocs.io/en/v0.4.21/contracts.html?highlight=overload#function-overloading
     * In order to support overloaded functions, we suffix overloaded function names with an index.
     * This index should be deterministic, regardless of function ordering within the smart contract. To do so,
     * we assign indexes based on the alphabetical order of function signatures.
     *
     * E.g
     * ['f(uint)', 'f(uint,byte32)']
     * Should always be renamed to:
     * ['f1(uint)', 'f2(uint,byte32)']
     * Regardless of the order in which these these overloaded functions are declared within the contract ABI.
     */
    renameOverloadedMethods: function (inputContractAbi) {
        var contractAbi = _.cloneDeep(inputContractAbi);
        var methodAbis = contractAbi.filter(function (abi) { return abi.type === ethereum_types_1.AbiType.Function; });
        // Sort method Abis into alphabetical order, by function signature
        var methodAbisOrdered = _.sortBy(methodAbis, [
            function (methodAbi) {
                var functionSignature = exports.abiUtils.getFunctionSignature(methodAbi);
                return functionSignature;
            },
        ]);
        // Group method Abis by name (overloaded methods will be grouped together, in alphabetical order)
        var methodAbisByName = {};
        _.each(methodAbisOrdered, function (methodAbi) {
            (methodAbisByName[methodAbi.name] || (methodAbisByName[methodAbi.name] = [])).push(methodAbi);
        });
        // Rename overloaded methods to overloadedMethodName1, overloadedMethodName2, ...
        _.each(methodAbisByName, function (methodAbisWithSameName) {
            _.each(methodAbisWithSameName, function (methodAbi, i) {
                if (methodAbisWithSameName.length > 1) {
                    var overloadedMethodId = i + 1;
                    var sanitizedMethodName_1 = "".concat(methodAbi.name).concat(overloadedMethodId);
                    var indexOfExistingAbiWithSanitizedMethodNameIfExists = _.findIndex(methodAbis, function (currentMethodAbi) { return currentMethodAbi.name === sanitizedMethodName_1; });
                    if (indexOfExistingAbiWithSanitizedMethodNameIfExists >= 0) {
                        var methodName = methodAbi.name;
                        throw new Error("Failed to rename overloaded method '".concat(methodName, "' to '").concat(sanitizedMethodName_1, "'. A method with this name already exists."));
                    }
                    methodAbi.name = sanitizedMethodName_1;
                }
            });
        });
        return contractAbi;
    },
};
