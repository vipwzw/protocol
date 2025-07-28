import 'isomorphic-fetch';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
export declare const fetchAsync: (endpoint: string, options?: any, timeoutMs?: number) => Promise<Response>;
