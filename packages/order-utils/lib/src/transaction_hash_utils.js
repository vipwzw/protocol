"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionHashUtils = void 0;
const utils_1 = require("@0x/utils");
const eip712_utils_1 = require("./eip712_utils");
exports.transactionHashUtils = {
    getTransactionHash: (tx) => {
        return utils_1.hexUtils.toHex(utils_1.signTypedDataUtils.generateTypedDataHash(eip712_utils_1.eip712Utils.createZeroExTransactionTypedData(tx)));
    },
};
//# sourceMappingURL=transaction_hash_utils.js.map