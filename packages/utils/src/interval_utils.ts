export const intervalUtils = {
    setAsyncExcludingInterval(
        fn: () => Promise<void>,
        intervalMs: number,
        onError: (err: Error) => void,
    ): NodeJS.Timeout {
        let isLocked = false;
        const intervalId = setInterval(async () => {
            if (isLocked) {
                return;
            } else {
                isLocked = true;
                try {
                    await fn();
                } catch (err) {
                    onError(err instanceof Error ? err : new Error(String(err)));
                }
                isLocked = false;
            }
        }, intervalMs);
        return intervalId;
    },
    clearAsyncExcludingInterval(intervalId: NodeJS.Timeout): void {
        clearInterval(intervalId);
    },
    setInterval(fn: () => void, intervalMs: number, onError: (err: Error) => void): NodeJS.Timeout {
        const intervalId = setInterval(() => {
            try {
                fn();
            } catch (err) {
                onError(err instanceof Error ? err : new Error(String(err)));
            }
        }, intervalMs);
        return intervalId;
    },
    clearInterval(intervalId: NodeJS.Timeout): void {
        clearInterval(intervalId);
    },
};
