"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatABIDataItem = formatABIDataItem;
exports.methodAbiToFunctionSignature = methodAbiToFunctionSignature;
exports.linkLibrariesInBytecode = linkLibrariesInBytecode;
var utils_1 = require("@0x/utils");
// tslint:disable-next-line:completed-docs
function formatABIDataItem(abi, value, formatter) {
    var trailingArrayRegex = /\[\d*\]$/;
    if (abi.type.match(trailingArrayRegex)) {
        var arrayItemType_1 = abi.type.replace(trailingArrayRegex, '');
        return value.map(function (val) {
            var arrayItemAbi = __assign(__assign({}, abi), { type: arrayItemType_1 });
            return formatABIDataItem(arrayItemAbi, val, formatter);
        });
    }
    else if (abi.type === 'tuple') {
        var formattedTuple_1 = {};
        if (abi.components) {
            abi.components.forEach(function (componentABI) {
                formattedTuple_1[componentABI.name] = formatABIDataItem(componentABI, value[componentABI.name], formatter);
            });
        }
        return formattedTuple_1;
    }
    else {
        return formatter(abi.type, value);
    }
}
/**
 * Takes a MethodAbi and returns a function signature for ABI encoding/decoding
 * @return a function signature as a string, e.g. 'functionName(uint256, bytes[])'
 */
function methodAbiToFunctionSignature(methodAbi) {
    var method = utils_1.AbiEncoder.createMethod(methodAbi.name, methodAbi.inputs);
    return method.getSignature();
}
/**
 * Replaces unliked library references in the bytecode of a contract artifact
 * with real addresses and returns the bytecode.
 */
function linkLibrariesInBytecode(artifact, libraryAddresses) {
    var bytecodeArtifact = artifact.compilerOutput.evm.bytecode;
    var bytecode = bytecodeArtifact.object.substr(2);
    for (var _i = 0, _a = Object.values(bytecodeArtifact.linkReferences || {}); _i < _a.length; _i++) {
        var link = _a[_i];
        for (var _b = 0, _c = Object.entries(link); _b < _c.length; _b++) {
            var _d = _c[_b], libraryName = _d[0], libraryRefs = _d[1];
            var libraryAddress = libraryAddresses[libraryName];
            if (!libraryAddress) {
                throw new Error("".concat(artifact.contractName, " has an unlinked reference library ").concat(libraryName, " but no addresses was provided'."));
            }
            for (var _e = 0, libraryRefs_1 = libraryRefs; _e < libraryRefs_1.length; _e++) {
                var ref = libraryRefs_1[_e];
                bytecode = [
                    bytecode.substring(0, ref.start * 2),
                    libraryAddress.toLowerCase().substr(2),
                    // tslint:disable-next-line:restrict-plus-operands
                    bytecode.substring((ref.start + ref.length) * 2),
                ].join('');
            }
        }
    }
    return "0x".concat(bytecode);
}
