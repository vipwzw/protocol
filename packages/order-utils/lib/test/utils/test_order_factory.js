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
exports.testOrderFactory = void 0;
const _ = __importStar(require("lodash"));
const constants_1 = require("../../src/constants");
const order_factory_1 = require("../../src/order_factory");
const CHAIN_ID = 1337;
const BASE_TEST_ORDER = order_factory_1.orderFactory.createOrder(constants_1.constants.NULL_ADDRESS, constants_1.constants.ZERO_AMOUNT, constants_1.constants.NULL_ERC20_ASSET_DATA, constants_1.constants.ZERO_AMOUNT, constants_1.constants.NULL_ERC20_ASSET_DATA, constants_1.constants.NULL_ADDRESS, CHAIN_ID);
const BASE_TEST_SIGNED_ORDER = {
    ...BASE_TEST_ORDER,
    signature: constants_1.constants.NULL_BYTES,
};
exports.testOrderFactory = {
    generateTestSignedOrder(partialOrder) {
        return transformObject(BASE_TEST_SIGNED_ORDER, partialOrder);
    },
    generateTestSignedOrders(partialOrder, numOrders) {
        const baseTestOrders = _.map(_.range(numOrders), () => BASE_TEST_SIGNED_ORDER);
        return _.map(baseTestOrders, order => transformObject(order, partialOrder));
    },
};
function transformObject(input, transformation) {
    const copy = _.cloneDeep(input);
    return _.assign(copy, transformation);
}
