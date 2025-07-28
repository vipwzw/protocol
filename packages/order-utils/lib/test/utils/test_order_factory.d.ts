import { SignedOrder } from '@0x/types';
export declare const testOrderFactory: {
    generateTestSignedOrder(partialOrder: Partial<SignedOrder>): SignedOrder;
    generateTestSignedOrders(partialOrder: Partial<SignedOrder>, numOrders: number): SignedOrder[];
};
