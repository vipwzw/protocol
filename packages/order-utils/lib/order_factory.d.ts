import { Order, SignedOrder } from '@0x/types';
import { CreateOrderOpts } from './types';
export declare const orderFactory: {
    createOrderFromPartial(partialOrder: Partial<Order>): Order;
    createSignedOrderFromPartial(partialSignedOrder: Partial<SignedOrder>): SignedOrder;
    createOrder(makerAddress: string, makerAssetAmount: bigint, makerAssetData: string, takerAssetAmount: bigint, takerAssetData: string, exchangeAddress: string, chainId: number, createOrderOpts?: CreateOrderOpts): Order;
    createSignedOrderAsync(supportedProvider: any, makerAddress: string, makerAssetAmount: bigint, makerAssetData: string, takerAssetAmount: bigint, takerAssetData: string, exchangeAddress: string, createOrderOpts?: CreateOrderOpts): Promise<SignedOrder>;
};
