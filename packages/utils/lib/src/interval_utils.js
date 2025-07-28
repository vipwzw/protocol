"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intervalUtils = void 0;
exports.intervalUtils = {
    setAsyncExcludingInterval(fn, intervalMs, onError) {
        let isLocked = false;
        const intervalId = setInterval(async () => {
            if (isLocked) {
                return;
            }
            else {
                isLocked = true;
                try {
                    await fn();
                }
                catch (err) {
                    onError(err instanceof Error ? err : new Error(String(err)));
                }
                isLocked = false;
            }
        }, intervalMs);
        return intervalId;
    },
    clearAsyncExcludingInterval(intervalId) {
        clearInterval(intervalId);
    },
    setInterval(fn, intervalMs, onError) {
        const intervalId = setInterval(() => {
            try {
                fn();
            }
            catch (err) {
                onError(err instanceof Error ? err : new Error(String(err)));
            }
        }, intervalMs);
        return intervalId;
    },
    clearInterval(intervalId) {
        clearInterval(intervalId);
    },
};
