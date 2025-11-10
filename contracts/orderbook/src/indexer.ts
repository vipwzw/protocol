import { ethers } from 'ethers';
import { OrderBook } from './types';
import { Order, OrderType, OrderStatus } from './order_book_client';

/**
 * 数据库接口
 * 可以使用 PostgreSQL、MongoDB、MySQL 等任何数据库
 */
export interface IDatabase {
    // 订单操作
    createOrder(order: DatabaseOrder): Promise<void>;
    updateOrder(orderId: string, updates: Partial<DatabaseOrder>): Promise<void>;
    getOrder(orderId: string): Promise<DatabaseOrder | null>;
    getActiveOrders(token: string, orderType: OrderType, limit?: number): Promise<DatabaseOrder[]>;
    getAllActiveOrders(token: string): Promise<DatabaseOrder[]>;
    
    // 成交记录操作
    createFill(fill: DatabaseFill): Promise<void>;
    getFills(orderId: string): Promise<DatabaseFill[]>;
    
    // 同步状态
    getLastSyncedBlock(): Promise<number>;
    setLastSyncedBlock(blockNumber: number): Promise<void>;
    
    // 订单簿快照
    updateOrderBookSnapshot(token: string, orderType: OrderType, price: string, amount: string): Promise<void>;
    getOrderBookSnapshot(token: string, depth: number): Promise<OrderBookSnapshot>;
}

/**
 * 数据库订单结构
 */
export interface DatabaseOrder {
    orderId: string;
    maker: string;
    token: string;
    orderType: OrderType;
    price: string;
    amount: string;
    filledAmount: string;
    status: OrderStatus;
    timestamp: number;
    txHash?: string;
    blockNumber?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * 数据库成交记录结构
 */
export interface DatabaseFill {
    orderId: string;
    taker: string;
    fillAmount: string;
    timestamp: number;
    txHash: string;
    blockNumber: number;
}

/**
 * 订单簿快照
 */
export interface OrderBookSnapshot {
    token: string;
    bids: PriceLevel[];  // 买单（按价格降序）
    asks: PriceLevel[];  // 卖单（按价格升序）
    timestamp: number;
}

export interface PriceLevel {
    price: string;
    amount: string;
    orderCount: number;
}

/**
 * 事件处理器接口
 */
export interface EventHandler {
    onOrderCreated?: (order: DatabaseOrder) => void | Promise<void>;
    onOrderFilled?: (orderId: string, fillAmount: string, remainingAmount: string) => void | Promise<void>;
    onOrderFullyFilled?: (orderId: string) => void | Promise<void>;
    onOrderCancelled?: (orderId: string) => void | Promise<void>;
}

/**
 * OrderBook 索引器
 * 监听合约事件并同步到数据库
 */
export class OrderBookIndexer {
    private contract: OrderBook;
    private provider: ethers.Provider;
    private db: IDatabase;
    private eventHandlers: EventHandler[] = [];
    private isRunning: boolean = false;
    private syncInterval?: NodeJS.Timeout;

    constructor(
        contractAddress: string,
        provider: ethers.Provider,
        db: IDatabase
    ) {
        this.provider = provider;
        this.db = db;
        
        const abi = require('../artifacts/contracts/OrderBook.sol/OrderBook.json').abi;
        this.contract = new ethers.Contract(contractAddress, abi, provider) as any as OrderBook;
    }

    /**
     * 添加事件处理器
     */
    public addEventHandler(handler: EventHandler): void {
        this.eventHandlers.push(handler);
    }

    /**
     * 启动索引器
     */
    public async start(options: {
        fromBlock?: number;
        syncInterval?: number;  // 定期同步间隔（毫秒）
        tokens?: string[];      // 只监听特定代币
    } = {}): Promise<void> {
        if (this.isRunning) {
            console.log('索引器已在运行');
            return;
        }

        console.log('启动 OrderBook 索引器...');
        this.isRunning = true;

        // 1. 同步历史事件
        const fromBlock = options.fromBlock ?? await this.db.getLastSyncedBlock() + 1;
        if (fromBlock > 0) {
            await this.syncHistoricalEvents(fromBlock, options.tokens);
        }

        // 2. 监听新事件
        this.startEventListeners(options.tokens);

        // 3. 定期同步（防止事件丢失）
        if (options.syncInterval && options.syncInterval > 0) {
            this.syncInterval = setInterval(async () => {
                await this.syncMissingEvents(options.tokens);
            }, options.syncInterval);
        }

        console.log('索引器启动完成');
    }

    /**
     * 停止索引器
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        console.log('停止索引器...');
        this.isRunning = false;

        // 移除事件监听器
        this.contract.removeAllListeners();

        // 停止定期同步
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = undefined;
        }

        console.log('索引器已停止');
    }

    /**
     * 同步历史事件
     */
    private async syncHistoricalEvents(fromBlock: number, tokens?: string[]): Promise<void> {
        const currentBlock = await this.provider.getBlockNumber();
        console.log(`同步历史事件: 区块 ${fromBlock} -> ${currentBlock}`);

        // 分批查询（避免 RPC 限制）
        const batchSize = 10000;
        let processedEvents = 0;

        for (let start = fromBlock; start <= currentBlock; start += batchSize) {
            const end = Math.min(start + batchSize - 1, currentBlock);
            
            // 查询所有事件
            const filters = tokens 
                ? tokens.map(token => this.contract.filters.OrderCreated(undefined, undefined, token))
                : [this.contract.filters.OrderCreated()];

            for (const filter of filters) {
                const events = await this.contract.queryFilter(filter, start, end);
                
                for (const event of events) {
                    await this.processEvent(event as ethers.EventLog);
                    processedEvents++;
                }
            }

            // 更新同步进度
            await this.db.setLastSyncedBlock(end);
            console.log(`已同步区块 ${start} - ${end}，处理 ${processedEvents} 个事件`);
        }

        console.log(`历史事件同步完成，共处理 ${processedEvents} 个事件`);
    }

    /**
     * 同步丢失的事件
     */
    private async syncMissingEvents(tokens?: string[]): Promise<void> {
        const lastSyncedBlock = await this.db.getLastSyncedBlock();
        const currentBlock = await this.provider.getBlockNumber();

        if (currentBlock > lastSyncedBlock) {
            console.log(`检测到新区块，同步 ${lastSyncedBlock + 1} -> ${currentBlock}`);
            await this.syncHistoricalEvents(lastSyncedBlock + 1, tokens);
        }
    }

    /**
     * 启动事件监听器
     */
    private startEventListeners(tokens?: string[]): void {
        console.log('开始监听合约事件...');

        // 监听订单创建
        const createFilter = tokens
            ? tokens.map(token => this.contract.filters.OrderCreated(undefined, undefined, token))
            : [this.contract.filters.OrderCreated()];

        for (const filter of createFilter) {
            this.contract.on(filter, async (orderId, maker, token, orderType, price, amount, timestamp, event) => {
                await this.handleOrderCreated(orderId, maker, token, orderType, price, amount, timestamp, event);
            });
        }

        // 监听订单成交
        this.contract.on(this.contract.filters.OrderFilled(), async (orderId, taker, fillAmount, remainingAmount, timestamp, event) => {
            await this.handleOrderFilled(orderId, taker, fillAmount, remainingAmount, timestamp, event);
        });

        // 监听订单完全成交
        this.contract.on(this.contract.filters.OrderFullyFilled(), async (orderId, timestamp, event) => {
            await this.handleOrderFullyFilled(orderId, timestamp, event);
        });

        // 监听订单取消
        this.contract.on(this.contract.filters.OrderCancelled(), async (orderId, maker, refundedAmount, timestamp, event) => {
            await this.handleOrderCancelled(orderId, maker, refundedAmount, timestamp, event);
        });

        console.log('事件监听器已启动');
    }

    /**
     * 处理事件（通用）
     */
    private async processEvent(event: ethers.EventLog): Promise<void> {
        try {
            switch (event.eventName) {
                case 'OrderCreated': {
                    const [orderId, maker, token, orderType, price, amount, timestamp] = event.args;
                    await this.handleOrderCreated(orderId, maker, token, orderType, price, amount, timestamp, event);
                    break;
                }
                case 'OrderFilled': {
                    const [orderId, taker, fillAmount, remainingAmount, timestamp] = event.args;
                    await this.handleOrderFilled(orderId, taker, fillAmount, remainingAmount, timestamp, event);
                    break;
                }
                case 'OrderFullyFilled': {
                    const [orderId, timestamp] = event.args;
                    await this.handleOrderFullyFilled(orderId, timestamp, event);
                    break;
                }
                case 'OrderCancelled': {
                    const [orderId, maker, refundedAmount, timestamp] = event.args;
                    await this.handleOrderCancelled(orderId, maker, refundedAmount, timestamp, event);
                    break;
                }
            }
        } catch (error) {
            console.error(`处理事件失败:`, error);
            throw error;
        }
    }

    /**
     * 处理订单创建事件
     */
    private async handleOrderCreated(
        orderId: bigint,
        maker: string,
        token: string,
        orderType: number,
        price: bigint,
        amount: bigint,
        timestamp: bigint,
        event: ethers.EventLog
    ): Promise<void> {
        const order: DatabaseOrder = {
            orderId: orderId.toString(),
            maker,
            token,
            orderType: orderType as OrderType,
            price: price.toString(),
            amount: amount.toString(),
            filledAmount: '0',
            status: OrderStatus.ACTIVE,
            timestamp: Number(timestamp),
            txHash: event.transactionHash,
            blockNumber: event.blockNumber,
        };

        await this.db.createOrder(order);
        console.log(`订单创建: ${order.orderId}`);

        // 更新订单簿快照
        await this.db.updateOrderBookSnapshot(token, orderType as OrderType, price.toString(), amount.toString());

        // 触发事件处理器
        for (const handler of this.eventHandlers) {
            if (handler.onOrderCreated) {
                await handler.onOrderCreated(order);
            }
        }
    }

    /**
     * 处理订单成交事件
     */
    private async handleOrderFilled(
        orderId: bigint,
        taker: string,
        fillAmount: bigint,
        remainingAmount: bigint,
        timestamp: bigint,
        event: ethers.EventLog
    ): Promise<void> {
        const orderIdStr = orderId.toString();
        
        // 获取订单信息
        const order = await this.db.getOrder(orderIdStr);
        if (!order) {
            console.warn(`订单 ${orderIdStr} 不存在，跳过成交事件`);
            return;
        }

        // 更新订单的成交数量
        const newFilledAmount = (BigInt(order.amount) - remainingAmount).toString();
        await this.db.updateOrder(orderIdStr, {
            filledAmount: newFilledAmount,
        });

        // 记录成交历史
        const fill: DatabaseFill = {
            orderId: orderIdStr,
            taker,
            fillAmount: fillAmount.toString(),
            timestamp: Number(timestamp),
            txHash: event.transactionHash,
            blockNumber: event.blockNumber,
        };
        await this.db.createFill(fill);

        console.log(`订单成交: ${orderIdStr}, 成交量: ${fillAmount.toString()}, 剩余: ${remainingAmount.toString()}`);

        // 触发事件处理器
        for (const handler of this.eventHandlers) {
            if (handler.onOrderFilled) {
                await handler.onOrderFilled(orderIdStr, fillAmount.toString(), remainingAmount.toString());
            }
        }
    }

    /**
     * 处理订单完全成交事件
     */
    private async handleOrderFullyFilled(
        orderId: bigint,
        timestamp: bigint,
        event: ethers.EventLog
    ): Promise<void> {
        const orderIdStr = orderId.toString();
        
        await this.db.updateOrder(orderIdStr, {
            status: OrderStatus.FILLED,
        });

        console.log(`订单完全成交: ${orderIdStr}`);

        // 触发事件处理器
        for (const handler of this.eventHandlers) {
            if (handler.onOrderFullyFilled) {
                await handler.onOrderFullyFilled(orderIdStr);
            }
        }
    }

    /**
     * 处理订单取消事件
     */
    private async handleOrderCancelled(
        orderId: bigint,
        maker: string,
        refundedAmount: bigint,
        timestamp: bigint,
        event: ethers.EventLog
    ): Promise<void> {
        const orderIdStr = orderId.toString();
        
        await this.db.updateOrder(orderIdStr, {
            status: OrderStatus.CANCELLED,
        });

        console.log(`订单取消: ${orderIdStr}, 退款: ${refundedAmount.toString()}`);

        // 触发事件处理器
        for (const handler of this.eventHandlers) {
            if (handler.onOrderCancelled) {
                await handler.onOrderCancelled(orderIdStr);
            }
        }
    }

    /**
     * 验证订单数据一致性
     */
    public async verifyOrder(orderId: string): Promise<boolean> {
        const localOrder = await this.db.getOrder(orderId);
        if (!localOrder) {
            console.warn(`本地订单 ${orderId} 不存在`);
            return false;
        }

        const chainOrder = await this.contract.getOrder(BigInt(orderId));
        
        const isConsistent = 
            localOrder.maker.toLowerCase() === chainOrder.maker.toLowerCase() &&
            localOrder.token.toLowerCase() === chainOrder.token.toLowerCase() &&
            localOrder.price === chainOrder.price.toString() &&
            localOrder.amount === chainOrder.amount.toString() &&
            localOrder.filledAmount === chainOrder.filledAmount.toString() &&
            localOrder.status === Number(chainOrder.status);

        if (!isConsistent) {
            console.warn(`订单 ${orderId} 数据不一致`);
            console.log('本地订单:', localOrder);
            console.log('链上订单:', {
                maker: chainOrder.maker,
                token: chainOrder.token,
                price: chainOrder.price.toString(),
                amount: chainOrder.amount.toString(),
                filledAmount: chainOrder.filledAmount.toString(),
                status: Number(chainOrder.status),
            });
            
            // 从链上同步
            await this.syncOrderFromChain(orderId);
        }

        return isConsistent;
    }

    /**
     * 从链上同步单个订单
     */
    private async syncOrderFromChain(orderId: string): Promise<void> {
        const chainOrder = await this.contract.getOrder(BigInt(orderId));
        
        const order: DatabaseOrder = {
            orderId,
            maker: chainOrder.maker,
            token: chainOrder.token,
            orderType: Number(chainOrder.orderType) as OrderType,
            price: chainOrder.price.toString(),
            amount: chainOrder.amount.toString(),
            filledAmount: chainOrder.filledAmount.toString(),
            status: Number(chainOrder.status) as OrderStatus,
            timestamp: Number(chainOrder.timestamp),
        };

        await this.db.updateOrder(orderId, order);
        console.log(`订单 ${orderId} 已从链上同步`);
    }

    /**
     * 获取合约实例
     */
    public getContract(): OrderBook {
        return this.contract;
    }
}

