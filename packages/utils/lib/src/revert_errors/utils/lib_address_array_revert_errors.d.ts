import { RevertError } from '../../revert_error';
export declare class MismanagedMemoryError extends RevertError {
    constructor(freeMemPtr?: BigNumber, addressArrayEndPtr?: BigNumber);
}
