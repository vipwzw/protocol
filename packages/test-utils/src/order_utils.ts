import { generatePseudoRandomSalt } from '@0x/order-utils';
import { Order, SignedOrder } from '@0x/utils';
import { hexUtils } from '@0x/utils';

import { constants } from './constants';
import { BatchMatchOrder, CancelOrder, MatchOrder } from './types';

// Helper function to convert BigNumber to bigint
function toBigInt(value: any): bigint {
    if (typeof value === 'bigint') {
        return value;
    }
    if (value && typeof value.toString === 'function') {
        return BigInt(value.toString());
    }
    return BigInt(value);
}

export const orderUtils = {
    getPartialAmountFloor(numerator: bigint, denominator: bigint, target: bigint): bigint {
        const partialAmount = (numerator * target) / denominator;
        return partialAmount;
    },
    createFill: (signedOrder: SignedOrder, takerAssetFillAmount?: bigint) => {
        const fill = {
            order: signedOrder,
            takerAssetFillAmount: takerAssetFillAmount || toBigInt(signedOrder.takerAssetAmount),
            signature: signedOrder.signature,
        };
        return fill;
    },
    createCancel(signedOrder: SignedOrder, takerAssetCancelAmount?: bigint): CancelOrder {
        const cancel = {
            order: signedOrder,
            takerAssetCancelAmount: takerAssetCancelAmount || toBigInt(signedOrder.takerAssetAmount),
        };
        return cancel;
    },
    createOrderWithoutSignature(signedOrder: SignedOrder): Order {
        const { signature: _signature, ...order } = signedOrder;
        return order;
    },
    createBatchMatchOrders(signedOrdersLeft: SignedOrder[], signedOrdersRight: SignedOrder[]): BatchMatchOrder {
        return {
            leftOrders: signedOrdersLeft.map(order => orderUtils.createOrderWithoutSignature(order)),
            rightOrders: signedOrdersRight.map(order => {
                const right = orderUtils.createOrderWithoutSignature(order);
                right.makerAssetData = constants.NULL_BYTES;
                right.takerAssetData = constants.NULL_BYTES;
                return right;
            }),
            leftSignatures: signedOrdersLeft.map(order => order.signature),
            rightSignatures: signedOrdersRight.map(order => order.signature),
        };
    },
    createMatchOrders(signedOrderLeft: SignedOrder, signedOrderRight: SignedOrder): MatchOrder {
        const fill = {
            left: orderUtils.createOrderWithoutSignature(signedOrderLeft),
            right: orderUtils.createOrderWithoutSignature(signedOrderRight),
            leftSignature: signedOrderLeft.signature,
            rightSignature: signedOrderRight.signature,
        };
        fill.right.makerAssetData = constants.NULL_BYTES;
        fill.right.takerAssetData = constants.NULL_BYTES;
        return fill;
    },
    generatePseudoRandomOrderHash(): string {
        const randomBigNum = generatePseudoRandomSalt();
        const randomHash = hexUtils.hash(randomBigNum.toString());
        return randomHash;
    },
};
