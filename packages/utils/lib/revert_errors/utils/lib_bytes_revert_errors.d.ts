import { RevertError } from '../../revert_error';
export declare enum InvalidByteOperationErrorCodes {
    FromLessThanOrEqualsToRequired = 0,
    ToLessThanOrEqualsLengthRequired = 1,
    LengthGreaterThanZeroRequired = 2,
    LengthGreaterThanOrEqualsFourRequired = 3,
    LengthGreaterThanOrEqualsTwentyRequired = 4,
    LengthGreaterThanOrEqualsThirtyTwoRequired = 5,
    LengthGreaterThanOrEqualsNestedBytesLengthRequired = 6,
    DestinationLengthGreaterThanOrEqualSourceLengthRequired = 7
}
export declare class InvalidByteOperationError extends RevertError {
    constructor(error?: InvalidByteOperationErrorCodes, offset?: BigNumber, required?: BigNumber);
}
