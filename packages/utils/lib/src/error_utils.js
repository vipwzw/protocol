"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorUtils = void 0;
exports.errorUtils = {
    spawnSwitchErr: function (name, value) {
        return new Error("Unexpected switch value: ".concat(value, " encountered for ").concat(name));
    },
};
