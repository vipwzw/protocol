import { ZeroExTransaction } from '@0x/types';
import { hexUtils, signTypedDataUtils } from "./utils";;

import { eip712Utils } from './eip712_utils';

export const transactionHashUtils = {
    getTransactionHash: (tx: ZeroExTransaction): string => {
        return hexUtils.toHex(
            signTypedDataUtils.generateTypedDataHash(eip712Utils.createZeroExTransactionTypedData(tx)),
        );
    },
};
