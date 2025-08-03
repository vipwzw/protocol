// BigNumber removed - using bigint
import { RevertError } from '../../revert_error';

// tslint:disable:max-classes-per-file

export class UnregisteredAssetProxyError extends RevertError {
    constructor() {
        super('UnregisteredAssetProxyError', 'UnregisteredAssetProxyError()', {});
    }
}

export class InsufficientEthForFeeError extends RevertError {
    constructor(ethFeeRequired?: bigint | number | string, ethAvailable?: bigint | number | string) {
        super(
            'InsufficientEthForFeeError',
            'InsufficientEthForFeeError(uint256 ethFeeRequired, uint256 ethAvailable)',
            { ethFeeRequired, ethAvailable },
        );
    }
}

export class DefaultFunctionWethContractOnlyError extends RevertError {
    constructor(senderAddress?: string) {
        super('DefaultFunctionWethContractOnlyError', 'DefaultFunctionWethContractOnlyError(address senderAddress)', {
            senderAddress,
        });
    }
}

export class EthFeeLengthMismatchError extends RevertError {
    constructor(ethFeesLength?: bigint | number | string, feeRecipientsLength?: bigint | number | string) {
        super(
            'EthFeeLengthMismatchError',
            'EthFeeLengthMismatchError(uint256 ethFeesLength, uint256 feeRecipientsLength)',
            {
                ethFeesLength,
                feeRecipientsLength,
            },
        );
    }
}

const types = [InsufficientEthForFeeError, DefaultFunctionWethContractOnlyError, EthFeeLengthMismatchError];

// Register the types we've defined.
for (const type of types) {
    RevertError.registerType(type);
}
