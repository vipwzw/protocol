"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOrderFillableOptsSchema = void 0;
exports.validateOrderFillableOptsSchema = {
    id: '/ValidateOrderFillableOpts',
    properties: {
        expectedFillTakerTokenAmount: { $ref: '/wholeNumberSchema' },
    },
    type: 'object',
};
