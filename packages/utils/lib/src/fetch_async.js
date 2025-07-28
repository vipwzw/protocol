"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAsync = void 0;
const isNode = require('detect-node');
require("isomorphic-fetch");
// WARNING: This needs to be imported after isomorphic-fetch: https://github.com/mo/abortcontroller-polyfill#using-it-on-browsers-without-fetch
// tslint:disable-next-line:ordered-imports
require("abortcontroller-polyfill/dist/abortcontroller-polyfill-only");
const fetchAsync = async (endpoint, options = {}, timeoutMs = 20000) => {
    if (options.signal || options.timeout) {
        throw new Error('Cannot call fetchAsync with options.signal or options.timeout. To set a timeout, please use the supplied "timeoutMs" parameter.');
    }
    let optionsWithAbortParam;
    if (!isNode) {
        const controller = new AbortController();
        const signal = controller.signal;
        setTimeout(() => {
            controller.abort();
        }, timeoutMs);
        optionsWithAbortParam = {
            signal,
            ...options,
        };
    }
    else {
        // HACK: the `timeout` param only exists in `node-fetch`, and not on the `isomorphic-fetch`
        // `RequestInit` type. Since `isomorphic-fetch` conditionally wraps `node-fetch` when the
        // execution environment is `Node.js`, we need to cast it to `any` in that scenario.
        optionsWithAbortParam = {
            timeout: timeoutMs,
            ...options,
        };
    }
    const response = await fetch(endpoint, optionsWithAbortParam);
    return response;
};
exports.fetchAsync = fetchAsync;
