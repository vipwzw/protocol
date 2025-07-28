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
//# sourceMappingURL=validate_order_fillable_opts_schema.js.map