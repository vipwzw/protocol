/// <reference types="node" />
/// <reference types="mocha" />
export declare const intervalUtils: {
    setAsyncExcludingInterval(fn: () => Promise<void>, intervalMs: number, onError: (err: Error) => void): NodeJS.Timeout;
    clearAsyncExcludingInterval(intervalId: NodeJS.Timeout): void;
    setInterval(fn: () => void, intervalMs: number, onError: (err: Error) => void): NodeJS.Timeout;
    clearInterval(intervalId: NodeJS.Timeout): void;
};
