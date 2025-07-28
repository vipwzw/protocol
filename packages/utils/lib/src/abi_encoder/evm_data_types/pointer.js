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
exports.PointerDataType = void 0;
var pointer_1 = require("../abstract_data_types/types/pointer");
var PointerDataType = /** @class */ (function (_super) {
    __extends(PointerDataType, _super);
    function PointerDataType(destDataType, parentDataType, dataTypeFactory) {
        var destDataItem = destDataType.getDataItem();
        var dataItem = { name: "ptr<".concat(destDataItem.name, ">"), type: "ptr<".concat(destDataItem.type, ">") };
        return _super.call(this, dataItem, dataTypeFactory, destDataType, parentDataType) || this;
    }
    PointerDataType.prototype.getSignatureType = function () {
        return this._destination.getSignature(false);
    };
    PointerDataType.prototype.getSignature = function (isDetailed) {
        return this._destination.getSignature(isDetailed);
    };
    PointerDataType.prototype.getDefaultValue = function () {
        var defaultValue = this._destination.getDefaultValue();
        return defaultValue;
    };
    return PointerDataType;
}(pointer_1.AbstractPointerDataType));
exports.PointerDataType = PointerDataType;
