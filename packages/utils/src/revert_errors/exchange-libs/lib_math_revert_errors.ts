import * as _ from 'lodash';

// BigNumber removed - using bigint
import { RevertError } from '../../revert_error';

// tslint:disable:max-classes-per-file

export class DivisionByZeroError extends RevertError {
    constructor() {
        super('DivisionByZeroError', 'DivisionByZeroError()', {});
    }
}

export class RoundingError extends RevertError {
    constructor(
        numerator?: bigint | number | string,
        denominator?: bigint | number | string,
        target?: bigint | number | string,
    ) {
        super('RoundingError', 'RoundingError(uint256 numerator, uint256 denominator, uint256 target)', {
            numerator,
            denominator,
            target,
        });
    }
}

const types = [DivisionByZeroError, RoundingError];

// Register the types we've defined.
for (const type of types) {
    RevertError.registerType(type);
}
