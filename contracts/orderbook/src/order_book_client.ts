import { ethers } from 'ethers';
import { OrderBook } from './types';

/**
 * 订单类型
 */
export enum OrderType {
    BUY = 0,
    SELL = 1,
}

/**
 * 订单状态
 */
export enum OrderStatus {
    ACTIVE = 0,
    FILLED = 1,
    CANCELLED = 2,
    EXPIRED = 3,
}

/**
 * 订单信息
 */
export interface Order {
    orderId: bigint;
    maker: string;
    token: string;
    orderType: OrderType;
    price: bigint;
    amount: bigint;
    filledAmount: bigint;
    timestamp: bigint;
    status: OrderStatus;
}

/**
 * 订单簿事件
 */
export interface OrderCreatedEvent {
    orderId: bigint;
    maker: string;
    token: string;
    orderType: OrderType;
    price: bigint;
    amount: bigint;
    timestamp: bigint;
}

export interface OrderFilledEvent {
    orderId: bigint;
    taker: string;
    fillAmount: bigint;
    remainingAmount: bigint;
    timestamp: bigint;
}

export interface OrderFullyFilledEvent {
    orderId: bigint;
    timestamp: bigint;
}

export interface OrderCancelledEvent {
    orderId: bigint;
    maker: string;
    refundedAmount: bigint;
    timestamp: bigint;
}

/**
 * OrderBook 客户端
 * 提供便捷的订单簿操作和事件监听
 */
export class OrderBookClient {
    private contract: OrderBook;
    private provider: ethers.Provider;

    constructor(contractAddress: string, provider: ethers.Provider) {
        this.provider = provider;
        const abi = require('../artifacts/contracts/OrderBook.sol/OrderBook.json').abi;
        this.contract = new ethers.Contract(contractAddress, abi, provider) as any as OrderBook;
    }

    /**
     * 连接签名者
     */
    public connect(signer: ethers.Signer): OrderBookClient {
        const newClient = new OrderBookClient(
            this.contract.target as string,
            signer.provider || this.provider
        );
        newClient.contract = this.contract.connect(signer) as OrderBook;
        return newClient;
    }

    /**
     * 创建买单
     */
    public async createBuyOrder(
        token: string,
        price: bigint,
        amount: bigint,
        value: bigint
    ): Promise<ethers.ContractTransactionResponse> {
        return this.contract.createBuyOrder(token, price, amount, { value });
    }

    /**
     * 创建卖单
     */
    public async createSellOrder(
        token: string,
        price: bigint,
        amount: bigint
    ): Promise<ethers.ContractTransactionResponse> {
        return this.contract.createSellOrder(token, price, amount);
    }

    /**
     * 撮合交易
     */
    public async fillOrder(
        orderId: bigint,
        fillAmount: bigint,
        value?: bigint
    ): Promise<ethers.ContractTransactionResponse> {
        return this.contract.fillOrder(orderId, fillAmount, { value: value || 0n });
    }

    /**
     * 取消订单
     */
    public async cancelOrder(orderId: bigint): Promise<ethers.ContractTransactionResponse> {
        return this.contract.cancelOrder(orderId);
    }

    /**
     * 获取订单信息
     */
    public async getOrder(orderId: bigint): Promise<Order> {
        const order = await this.contract.getOrder(orderId);
        return {
            orderId: order.orderId,
            maker: order.maker,
            token: order.token,
            orderType: Number(order.orderType) as OrderType,
            price: order.price,
            amount: order.amount,
            filledAmount: order.filledAmount,
            timestamp: order.timestamp,
            status: Number(order.status) as OrderStatus,
        };
    }

    /**
     * 批量获取订单信息
     */
    public async getOrders(orderIds: bigint[]): Promise<Order[]> {
        const orders = await this.contract.getOrders(orderIds);
        return orders.map(order => ({
            orderId: order.orderId,
            maker: order.maker,
            token: order.token,
            orderType: Number(order.orderType) as OrderType,
            price: order.price,
            amount: order.amount,
            filledAmount: order.filledAmount,
            timestamp: order.timestamp,
            status: Number(order.status) as OrderStatus,
        }));
    }

    /**
     * 计算成交所需资产
     */
    public async calculateFillCost(orderId: bigint, fillAmount: bigint): Promise<bigint> {
        return this.contract.calculateFillCost(orderId, fillAmount);
    }

    /**
     * 获取订单剩余数量
     */
    public async getRemainingAmount(orderId: bigint): Promise<bigint> {
        return this.contract.getRemainingAmount(orderId);
    }

    /**
     * 监听订单创建事件
     */
    public onOrderCreated(
        callback: (event: OrderCreatedEvent) => void,
        filter?: { maker?: string; token?: string }
    ): void {
        this.contract.on(
            this.contract.filters.OrderCreated(undefined, filter?.maker, filter?.token),
            (orderId, maker, token, orderType, price, amount, timestamp) => {
                callback({
                    orderId,
                    maker,
                    token,
                    orderType: Number(orderType) as OrderType,
                    price,
                    amount,
                    timestamp,
                });
            }
        );
    }

    /**
     * 监听订单成交事件
     */
    public onOrderFilled(
        callback: (event: OrderFilledEvent) => void,
        filter?: { orderId?: bigint; taker?: string }
    ): void {
        this.contract.on(
            this.contract.filters.OrderFilled(filter?.orderId, filter?.taker),
            (orderId, taker, fillAmount, remainingAmount, timestamp) => {
                callback({
                    orderId,
                    taker,
                    fillAmount,
                    remainingAmount,
                    timestamp,
                });
            }
        );
    }

    /**
     * 监听订单完全成交事件
     */
    public onOrderFullyFilled(
        callback: (event: OrderFullyFilledEvent) => void,
        filter?: { orderId?: bigint }
    ): void {
        this.contract.on(
            this.contract.filters.OrderFullyFilled(filter?.orderId),
            (orderId, timestamp) => {
                callback({
                    orderId,
                    timestamp,
                });
            }
        );
    }

    /**
     * 监听订单取消事件
     */
    public onOrderCancelled(
        callback: (event: OrderCancelledEvent) => void,
        filter?: { orderId?: bigint; maker?: string }
    ): void {
        this.contract.on(
            this.contract.filters.OrderCancelled(filter?.orderId, filter?.maker),
            (orderId, maker, refundedAmount, timestamp) => {
                callback({
                    orderId,
                    maker,
                    refundedAmount,
                    timestamp,
                });
            }
        );
    }

    /**
     * 移除所有事件监听器
     */
    public removeAllListeners(): void {
        this.contract.removeAllListeners();
    }

    /**
     * 获取原始合约实例
     */
    public getContract(): OrderBook {
        return this.contract;
    }
}

/**
 * 本地订单簿管理器
 * 通过监听事件构建和维护本地订单簿
 */
export class LocalOrderBook {
    private client: OrderBookClient;
    private buyOrders: Map<string, Map<string, Order>> = new Map(); // token -> orderId -> Order
    private sellOrders: Map<string, Map<string, Order>> = new Map(); // token -> orderId -> Order
    private initialized: boolean = false;

    constructor(client: OrderBookClient) {
        this.client = client;
    }

    /**
     * 初始化订单簿
     * 获取历史事件并开始监听新事件
     */
    public async initialize(token: string, fromBlock: number = 0): Promise<void> {
        if (this.initialized) {
            return;
        }

        // 获取历史订单创建事件
        const contract = this.client.getContract();
        const filter = contract.filters.OrderCreated(undefined, undefined, token);
        const events = await contract.queryFilter(filter, fromBlock);

        // 处理历史事件
        for (const event of events) {
            await this.handleOrderCreated(event as any);
        }

        // 监听新事件
        this.client.onOrderCreated(
            event => this.handleOrderCreated(event),
            { token }
        );

        this.client.onOrderFilled(event => this.handleOrderFilled(event));
        this.client.onOrderFullyFilled(event => this.handleOrderFullyFilled(event));
        this.client.onOrderCancelled(event => this.handleOrderCancelled(event));

        this.initialized = true;
    }

    /**
     * 获取买单列表（按价格从高到低排序）
     */
    public getBuyOrders(token: string): Order[] {
        const orders = this.buyOrders.get(token);
        if (!orders) {
            return [];
        }

        return Array.from(orders.values())
            .filter(order => order.status === OrderStatus.ACTIVE)
            .sort((a, b) => (b.price > a.price ? 1 : -1));
    }

    /**
     * 获取卖单列表（按价格从低到高排序）
     */
    public getSellOrders(token: string): Order[] {
        const orders = this.sellOrders.get(token);
        if (!orders) {
            return [];
        }

        return Array.from(orders.values())
            .filter(order => order.status === OrderStatus.ACTIVE)
            .sort((a, b) => (a.price > b.price ? 1 : -1));
    }

    /**
     * 获取订单
     */
    public getOrder(orderId: string, token: string): Order | undefined {
        const buyOrder = this.buyOrders.get(token)?.get(orderId);
        if (buyOrder) {
            return buyOrder;
        }
        return this.sellOrders.get(token)?.get(orderId);
    }

    /**
     * 处理订单创建事件
     */
    private async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
        const order: Order = {
            orderId: event.orderId,
            maker: event.maker,
            token: event.token,
            orderType: event.orderType,
            price: event.price,
            amount: event.amount,
            filledAmount: 0n,
            timestamp: event.timestamp,
            status: OrderStatus.ACTIVE,
        };

        const orderMap = order.orderType === OrderType.BUY ? this.buyOrders : this.sellOrders;

        if (!orderMap.has(order.token)) {
            orderMap.set(order.token, new Map());
        }

        orderMap.get(order.token)!.set(order.orderId.toString(), order);
    }

    /**
     * 处理订单成交事件
     */
    private async handleOrderFilled(event: OrderFilledEvent): Promise<void> {
        const orderId = event.orderId.toString();

        // 尝试从买单中查找
        for (const [token, orders] of this.buyOrders) {
            const order = orders.get(orderId);
            if (order) {
                order.filledAmount += event.fillAmount;
                return;
            }
        }

        // 尝试从卖单中查找
        for (const [token, orders] of this.sellOrders) {
            const order = orders.get(orderId);
            if (order) {
                order.filledAmount += event.fillAmount;
                return;
            }
        }
    }

    /**
     * 处理订单完全成交事件
     */
    private async handleOrderFullyFilled(event: OrderFullyFilledEvent): Promise<void> {
        const orderId = event.orderId.toString();

        // 尝试从买单中查找
        for (const [token, orders] of this.buyOrders) {
            const order = orders.get(orderId);
            if (order) {
                order.status = OrderStatus.FILLED;
                return;
            }
        }

        // 尝试从卖单中查找
        for (const [token, orders] of this.sellOrders) {
            const order = orders.get(orderId);
            if (order) {
                order.status = OrderStatus.FILLED;
                return;
            }
        }
    }

    /**
     * 处理订单取消事件
     */
    private async handleOrderCancelled(event: OrderCancelledEvent): Promise<void> {
        const orderId = event.orderId.toString();

        // 尝试从买单中查找
        for (const [token, orders] of this.buyOrders) {
            const order = orders.get(orderId);
            if (order) {
                order.status = OrderStatus.CANCELLED;
                return;
            }
        }

        // 尝试从卖单中查找
        for (const [token, orders] of this.sellOrders) {
            const order = orders.get(orderId);
            if (order) {
                order.status = OrderStatus.CANCELLED;
                return;
            }
        }
    }

    /**
     * 清理订单簿
     */
    public clear(): void {
        this.buyOrders.clear();
        this.sellOrders.clear();
        this.client.removeAllListeners();
        this.initialized = false;
    }
}

