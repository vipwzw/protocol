// BigNumber removed - using bigint
import { RevertError } from '../../revert_error';

// tslint:disable:max-classes-per-file

export class UnsupportedAssetProxyError extends RevertError {
    constructor(proxyId?: string) {
        super('UnsupportedAssetProxyError', 'UnsupportedAssetProxyError(bytes4 proxyId)', { proxyId });
    }
}

export class Erc721AmountMustEqualOneError extends RevertError {
    constructor(amount?: bigint | number | string) {
        super('Erc721AmountMustEqualOneError', 'Erc721AmountMustEqualOneError(uint256 amount)', {
            amount,
        });
    }
}

const types = [UnsupportedAssetProxyError, Erc721AmountMustEqualOneError];

// Register the types we've defined.
for (const type of types) {
    RevertError.registerType(type);
}
