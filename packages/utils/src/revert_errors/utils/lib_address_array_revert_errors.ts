// BigNumber removed - using bigint
import { RevertError } from '../../revert_error';

export class MismanagedMemoryError extends RevertError {
    constructor(freeMemPtr?: bigint, addressArrayEndPtr?: bigint) {
        super('MismanagedMemoryError', 'MismanagedMemoryError(uint256 freeMemPtr, uint256 addressArrayEndPtr)', {
            freeMemPtr,
            addressArrayEndPtr,
        });
    }
}

// Register the MismanagedMemoryError type
RevertError.registerType(MismanagedMemoryError);
