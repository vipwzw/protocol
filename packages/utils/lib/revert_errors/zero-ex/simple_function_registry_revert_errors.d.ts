import { RevertError } from '../../revert_error';
export declare class NotInRollbackHistoryError extends RevertError {
    constructor(selector?: string, targetImpl?: string);
}
