"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signTypedDataUtils = void 0;
var ethUtil = require("ethereumjs-util");
var ethers = require("ethers");
var configured_bignumber_1 = require("./configured_bignumber");
exports.signTypedDataUtils = {
    /**
     * Generates the EIP712 Typed Data hash for signing
     * @param   typedData An object that conforms to the EIP712TypedData interface
     * @return  A Buffer containing the hash of the typed data.
     */
    generateTypedDataHash: function (typedData) {
        return ethUtil.keccak256(Buffer.concat([
            Buffer.from('1901', 'hex'),
            exports.signTypedDataUtils._structHash('EIP712Domain', typedData.domain, typedData.types),
            exports.signTypedDataUtils._structHash(typedData.primaryType, typedData.message, typedData.types),
        ]));
    },
    /**
     * Generates the EIP712 Typed Data hash for a typed data object without using the domain field. This
     * makes hashing easier for non-EIP712 data.
     * @param   typedData An object that conforms to the EIP712TypedData interface
     * @return  A Buffer containing the hash of the typed data.
     */
    generateTypedDataHashWithoutDomain: function (typedData) {
        return exports.signTypedDataUtils._structHash(typedData.primaryType, typedData.message, typedData.types);
    },
    /**
     * Generates the hash of a EIP712 Domain with the default schema
     * @param  domain An EIP712 domain with the default schema containing a name, version, chain id,
     *                and verifying address.
     * @return A buffer that contains the hash of the domain.
     */
    generateDomainHash: function (domain) {
        return exports.signTypedDataUtils._structHash('EIP712Domain', domain, 
        // HACK(jalextowle): When we consolidate our testing packages into test-utils, we can use a constant
        // to eliminate code duplication. At the moment, there isn't a good way to do that because of cyclic-dependencies.
        {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ],
        });
    },
    _findDependencies: function (primaryType, types, found) {
        if (found === void 0) { found = []; }
        if (found.includes(primaryType) || types[primaryType] === undefined) {
            return found;
        }
        found.push(primaryType);
        for (var _i = 0, _a = types[primaryType]; _i < _a.length; _i++) {
            var field = _a[_i];
            for (var _b = 0, _c = exports.signTypedDataUtils._findDependencies(field.type, types, found); _b < _c.length; _b++) {
                var dep = _c[_b];
                if (!found.includes(dep)) {
                    found.push(dep);
                }
            }
        }
        return found;
    },
    _encodeType: function (primaryType, types) {
        var deps = exports.signTypedDataUtils._findDependencies(primaryType, types);
        deps = deps.filter(function (d) { return d !== primaryType; });
        deps = [primaryType].concat(deps.sort());
        var result = '';
        for (var _i = 0, deps_1 = deps; _i < deps_1.length; _i++) {
            var dep = deps_1[_i];
            result += "".concat(dep, "(").concat(types[dep].map(function (_a) {
                var name = _a.name, type = _a.type;
                return "".concat(type, " ").concat(name);
            }).join(','), ")");
        }
        return result;
    },
    _encodeData: function (primaryType, data, types) {
        var encodedTypes = ['bytes32'];
        var encodedValues = [exports.signTypedDataUtils._typeHash(primaryType, types)];
        for (var _i = 0, _a = types[primaryType]; _i < _a.length; _i++) {
            var field = _a[_i];
            var value = data[field.name];
            if (field.type === 'string') {
                var hashValue = ethUtil.keccak256(Buffer.from(value));
                encodedTypes.push('bytes32');
                encodedValues.push(hashValue);
            }
            else if (field.type === 'bytes') {
                var hashValue = ethUtil.keccak256(ethUtil.toBuffer(value));
                encodedTypes.push('bytes32');
                encodedValues.push(hashValue);
            }
            else if (types[field.type] !== undefined) {
                encodedTypes.push('bytes32');
                var hashValue = ethUtil.keccak256(
                // tslint:disable-next-line:no-unnecessary-type-assertion
                ethUtil.toBuffer(exports.signTypedDataUtils._encodeData(field.type, value, types)));
                encodedValues.push(hashValue);
            }
            else if (field.type.lastIndexOf(']') === field.type.length - 1) {
                throw new Error('Arrays currently unimplemented in encodeData');
            }
            else {
                encodedTypes.push(field.type);
                var normalizedValue = exports.signTypedDataUtils._normalizeValue(field.type, value);
                encodedValues.push(normalizedValue);
            }
        }
        return ethers.utils.defaultAbiCoder.encode(encodedTypes, encodedValues);
    },
    _normalizeValue: function (type, value) {
        var STRING_BASE = 10;
        if (type === 'uint256') {
            if (configured_bignumber_1.BigNumber.isBigNumber(value)) {
                return value.toString(STRING_BASE);
            }
            return new configured_bignumber_1.BigNumber(value).toString(STRING_BASE);
        }
        return value;
    },
    _typeHash: function (primaryType, types) {
        return ethUtil.keccak256(Buffer.from(exports.signTypedDataUtils._encodeType(primaryType, types)));
    },
    _structHash: function (primaryType, data, types) {
        return ethUtil.keccak256(ethUtil.toBuffer(exports.signTypedDataUtils._encodeData(primaryType, data, types)));
    },
};
