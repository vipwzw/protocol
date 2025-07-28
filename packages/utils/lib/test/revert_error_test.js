"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var _ = require("lodash");
var revert_error_1 = require("../src/revert_error");
var chai_setup_1 = require("./utils/chai_setup");
chai_setup_1.chaiSetup.configure();
var expect = chai.expect;
// tslint:disable: max-classes-per-file
var DescendantRevertError = /** @class */ (function (_super) {
    __extends(DescendantRevertError, _super);
    function DescendantRevertError(message) {
        return _super.call(this, message) || this;
    }
    return DescendantRevertError;
}(revert_error_1.StringRevertError));
var CustomRevertError = /** @class */ (function (_super) {
    __extends(CustomRevertError, _super);
    function CustomRevertError(message) {
        return _super.call(this, 'CustomRevertError', 'CustomRevertError(string message)', { message: message }) || this;
    }
    return CustomRevertError;
}(revert_error_1.RevertError));
var ArrayRevertError = /** @class */ (function (_super) {
    __extends(ArrayRevertError, _super);
    function ArrayRevertError(strings) {
        return _super.call(this, 'ArrayRevertError', 'ArrayRevertError(string[] strings)', { strings: strings }) || this;
    }
    return ArrayRevertError;
}(revert_error_1.RevertError));
var FixedSizeArrayRevertError = /** @class */ (function (_super) {
    __extends(FixedSizeArrayRevertError, _super);
    function FixedSizeArrayRevertError(strings) {
        return _super.call(this, 'FixedArrayRevertError', 'FixedArrayRevertError(string[2] strings)', { strings: strings }) || this;
    }
    return FixedSizeArrayRevertError;
}(revert_error_1.RevertError));
var ParentRevertError = /** @class */ (function (_super) {
    __extends(ParentRevertError, _super);
    function ParentRevertError(nestedError) {
        return _super.call(this, 'ParentRevertError', 'ParentRevertError(bytes nestedError)', { nestedError: nestedError }) || this;
    }
    return ParentRevertError;
}(revert_error_1.RevertError));
revert_error_1.RevertError.registerType(CustomRevertError);
revert_error_1.RevertError.registerType(ParentRevertError);
describe('RevertError', function () {
    describe('equality', function () {
        var message = 'foo';
        it('should equate two identical RevertErrors', function () {
            var revert1 = new revert_error_1.StringRevertError(message);
            var revert2 = new revert_error_1.StringRevertError(message);
            expect(revert1.equals(revert2)).to.be.true();
        });
        it('should equate two RevertErrors with missing fields', function () {
            var revert1 = new revert_error_1.StringRevertError(message);
            var revert2 = new revert_error_1.StringRevertError();
            expect(revert1.equals(revert2)).to.be.true();
        });
        it('should equate AnyRevertError with a real RevertError', function () {
            var revert1 = new revert_error_1.StringRevertError(message);
            var revert2 = new revert_error_1.AnyRevertError();
            expect(revert1.equals(revert2)).to.be.true();
        });
        it('should equate two revert errors with identical array fields', function () {
            var strings = ['foo', 'bar'];
            var revert1 = new ArrayRevertError(strings);
            var revert2 = new ArrayRevertError(strings);
            expect(revert1.equals(revert2)).to.be.true();
        });
        it('should not equate two revert errors with different sized array fields', function () {
            var strings = ['foo', 'bar'];
            var revert1 = new ArrayRevertError(strings);
            var revert2 = new ArrayRevertError(strings.slice(0, 1));
            expect(revert1.equals(revert2)).to.be.false();
        });
        it('should not equate two revert errors with different array field values', function () {
            var strings1 = ['foo', 'bar'];
            var strings2 = ['foo', 'baz'];
            var revert1 = new ArrayRevertError(strings1);
            var revert2 = new ArrayRevertError(strings2);
            expect(revert1.equals(revert2)).to.be.false();
        });
        it('should equate two revert errors with identical fixed-size array fields', function () {
            var strings = ['foo', 'bar'];
            var revert1 = new FixedSizeArrayRevertError(strings);
            var revert2 = new FixedSizeArrayRevertError(strings);
            expect(revert1.equals(revert2)).to.be.true();
        });
        it('should not equate two revert errors with different sized fixed-size array fields', function () {
            var strings = ['foo', 'bar'];
            var revert1 = new FixedSizeArrayRevertError(strings);
            var revert2 = new FixedSizeArrayRevertError(strings.slice(0, 1));
            expect(revert1.equals(revert2)).to.be.false();
        });
        it('should not equate two revert errors with the wrong sized fixed-size array fields', function () {
            var strings = ['foo', 'bar', 'baz'];
            var revert1 = new FixedSizeArrayRevertError(strings);
            var revert2 = new FixedSizeArrayRevertError(strings);
            expect(revert1.equals(revert2)).to.be.false();
        });
        it('should not equate two revert errors with different fixed-size array field values', function () {
            var strings1 = ['foo', 'bar'];
            var strings2 = ['foo', 'baz'];
            var revert1 = new FixedSizeArrayRevertError(strings1);
            var revert2 = new FixedSizeArrayRevertError(strings2);
            expect(revert1.equals(revert2)).to.be.false();
        });
        it('should not equate a the same RevertError type with different values', function () {
            var revert1 = new revert_error_1.StringRevertError(message);
            var revert2 = new revert_error_1.StringRevertError("".concat(message, "1"));
            expect(revert1.equals(revert2)).to.be.false();
        });
        it('should not equate different RevertError types', function () {
            var revert1 = new revert_error_1.StringRevertError(message);
            var revert2 = new DescendantRevertError(message);
            expect(revert1.equals(revert2)).to.be.false();
        });
        it('should equate two `RawRevertError` types with the same raw data', function () {
            var revert1 = new revert_error_1.RawRevertError('0x0123456789');
            var revert2 = new revert_error_1.RawRevertError(revert1.encode());
            expect(revert1.equals(revert2)).to.be.true();
        });
        it('should not equate two `RawRevertError` types with the different raw data', function () {
            var revert1 = new revert_error_1.RawRevertError('0x0123456789');
            var revert2 = new revert_error_1.RawRevertError("".concat(revert1.encode(), "00"));
            expect(revert1.equals(revert2)).to.be.false();
        });
    });
    describe('registering', function () {
        it('should throw when registering an already registered signature', function () {
            var CustomRevertError2 = /** @class */ (function (_super) {
                __extends(CustomRevertError2, _super);
                function CustomRevertError2() {
                    return _super.call(this, 'CustomRevertError2', new CustomRevertError().signature, {}) || this;
                }
                return CustomRevertError2;
            }(revert_error_1.RevertError));
            expect(function () { return revert_error_1.RevertError.registerType(CustomRevertError2); }).to.throw();
        });
    });
    describe('decoding', function () {
        // tslint:disable: prefer-template custom-no-magic-numbers
        var message = 'foobar';
        var encoded = '0x08c379a0' +
            '0000000000000000000000000000000000000000000000000000000000000020' +
            '0000000000000000000000000000000000000000000000000000000000000006' +
            Buffer.from(message).toString('hex') +
            _.repeat('00', 32 - 6);
        it('should decode an ABI encoded revert error', function () {
            var expected = new revert_error_1.StringRevertError(message);
            var decoded = revert_error_1.RevertError.decode(encoded);
            expect(decoded.equals(expected)).to.be.true();
        });
        it('should decode an unknown selector as a `RawRevertError`', function () {
            var _encoded = encoded.substr(0, 2) + '00' + encoded.substr(4);
            var decoded = revert_error_1.RevertError.decode(_encoded, true);
            expect(decoded).is.instanceof(revert_error_1.RawRevertError);
        });
        it('should fail to decode a malformed ABI encoded revert error', function () {
            var _encoded = encoded.substr(0, encoded.length - 1);
            var decode = function () { return revert_error_1.RevertError.decode(_encoded); };
            expect(decode).to.throw();
        });
        it('should decode a nested revert error', function () {
            var nested = new revert_error_1.StringRevertError(message);
            var parent = new ParentRevertError(nested.encode());
            var decoded = revert_error_1.RevertError.decode(parent.encode());
            expect(decoded.encode()).to.equal(new ParentRevertError(nested.encode()).encode());
        });
    });
    describe('getThrownErrorRevertErrorBytes', function () {
        it('should decode Parity revert errors', function () {
            var revertAbi = '0x1234';
            var parityError = { code: 1234, message: 'VM execution error.', data: "Reverted ".concat(revertAbi), name: '' };
            var revertError = (0, revert_error_1.getThrownErrorRevertErrorBytes)(parityError);
            expect(revertError).to.be.eq(revertAbi);
        });
    });
    describe('encoding', function () {
        var message = 'foobar';
        it('should be able to encode', function () {
            var expected = '0x08c379a0' +
                '0000000000000000000000000000000000000000000000000000000000000020' +
                '0000000000000000000000000000000000000000000000000000000000000006' +
                Buffer.from(message).toString('hex') +
                _.repeat('00', 32 - 6);
            var revert = new revert_error_1.StringRevertError(message);
            expect(revert.encode()).to.equal(expected);
        });
        it('should throw if missing parameter values', function () {
            var revert = new revert_error_1.StringRevertError();
            expect(function () { return revert.encode(); }).to.throw();
        });
    });
});
