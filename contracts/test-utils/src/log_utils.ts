import { DecodedLogArgs, LogEntry, LogWithDecodedArgs, TransactionReceiptWithDecodedLogs } from 'ethereum-types';

import { expect } from './chai_setup';

/**
 * Filter logs by event name/type.
 */
export function filterLogs<TEventArgs extends DecodedLogArgs>(
    logs: LogEntry[],
    event: string,
): Array<LogWithDecodedArgs<TEventArgs>> {
    return (logs as Array<LogWithDecodedArgs<any>>).filter(log => log.event === event);
}

/**
 * Filter logs by event name/type and convert to arguments.
 */
export function filterLogsToArguments<TEventArgs extends DecodedLogArgs>(
    logs: LogEntry[],
    event: string,
): TEventArgs[] {
    return filterLogs<TEventArgs>(logs, event).map(log => log.args);
}

/**
 * Verifies that a transaction emitted the expected events of a particular type.
 */
export function verifyEvents<TEventArgs extends DecodedLogArgs>(
    txReceipt: TransactionReceiptWithDecodedLogs,
    expectedEvents: TEventArgs[],
    eventName: string,
): void {
    return verifyEventsFromLogs(txReceipt.logs, expectedEvents, eventName);
}

/**
 * Given a collection of logs, verifies that matching events are identical.
 */
export function verifyEventsFromLogs<TEventArgs extends DecodedLogArgs>(
    logs: LogEntry[],
    expectedEvents: TEventArgs[],
    eventName: string,
): void {
    const _logs = filterLogsToArguments<TEventArgs>(logs, eventName);
    expect(_logs.length, `Number of ${eventName} events emitted`).to.eq(expectedEvents.length);
    _logs.forEach((log, index) => {
        expect(log, `${eventName} event ${index}`).to.deep.equal({ ...log, ...expectedEvents[index] });
    });
}
