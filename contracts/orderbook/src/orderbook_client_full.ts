import { ethers } from 'ethers';
import { OrderBookClient, OrderType, OrderStatus } from './order_book_client';
import { OrderBookIndexer, IDatabase, DatabaseOrder, EventHandler } from './indexer';
import { MemoryDatabase } from './memory_database';

/**
 * 完整的 OrderBook 客户端
 * 集成了合约交互、事件监听和数据库管理
 */
export class OrderBookClientFull {
    private client: OrderBookClient;
    private indexer: OrderBookIndexer;
    private db: IDatabase;
    private updateCallbacks: Set<(orders: DatabaseOrder[]) => void> = new Set();

    constructor(
        contractAddress: string,
        provider: ethers.Provider,
        db?: IDatabase
    ) {
        // 使用提供的数据库或默认的内存数据库
        this.db = db || new MemoryDatabase();
        
        // 创建客户端和索引器
        this.client = new OrderBookClient(contractAddress, provider);
        this.indexer = new OrderBookIndexer(contractAddress, provider, this.db);

        // 注册事件处理器
        this.setupEventHandlers();
    }

    /**
     * 设置事件处理器
     */
    private setupEventHandlers(): void {
        const handler: EventHandler = {
            onOrderCreated: async (order) => {
                console.log(`[事件] 订单创建: ${order.orderId}`);
                await this.notifyUpdate(order.token);
            },
            onOrderFilled: async (orderId, fillAmount, remainingAmount) => {
                console.log(`[事件] 订单成交: ${orderId}, 成交量: ${fillAmount}`);
                const order = await this.db.getOrder(orderId);
                if (order) {
                    await this.notifyUpdate(order.token);
                }
            },
            onOrderFullyFilled: async (orderId) => {
                console.log(`[事件] 订单完全成交: ${orderId}`);
                const order = await this.db.getOrder(orderId);
                if (order) {
                    await this.notifyUpdate(order.token);
                }
            },
            onOrderCancelled: async (orderId) => {
                console.log(`[事件] 订单取消: ${orderId}`);
                const order = await this.db.getOrder(orderId);
                if (order) {
                    await this.notifyUpdate(order.token);
                }
            },
        };

        this.indexer.addEventHandler(handler);
    }

    /**
     * 通知订单更新
     */
    private async notifyUpdate(token: string): Promise<void> {
        const orders = await this.db.getAllActiveOrders(token);
        for (const callback of this.updateCallbacks) {
            callback(orders);
        }
    }

    /**
     * 启动客户端
     */
    public async start(options: {
        fromBlock?: number;
        syncInterval?: number;
        tokens?: string[];
    } = {}): Promise<void> {
        await this.indexer.start(options);
    }

    /**
     * 停止客户端
     */
    public async stop(): Promise<void> {
        await this.indexer.stop();
    }

    /**
     * 连接签名者
     */
    public connect(signer: ethers.Signer): OrderBookClientFull {
        const newClient = new OrderBookClientFull(
            this.client.getContract().target as string,
            signer.provider || this.client.getContract().runner!.provider!,
            this.db
        );
        newClient.client = this.client.connect(signer);
        return newClient;
    }

    // ==================== 合约交互方法 ====================

    /**
     * 创建买单
     */
    public async createBuyOrder(
        token: string,
        price: bigint,
        amount: bigint
    ): Promise<ethers.ContractTransactionResponse> {
        const requiredETH = (price * amount) / ethers.parseEther('1');
        return this.client.createBuyOrder(token, price, amount, requiredETH);
    }

    /**
     * 创建卖单
     */
    public async createSellOrder(
        token: string,
        price: bigint,
        amount: bigint
    ): Promise<ethers.ContractTransactionResponse> {
        return this.client.createSellOrder(token, price, amount);
    }

    /**
     * 撮合交易
     */
    public async fillOrder(
        orderId: bigint,
        fillAmount: bigint,
        value?: bigint
    ): Promise<ethers.ContractTransactionResponse> {
        return this.client.fillOrder(orderId, fillAmount, value);
    }

    /**
     * 取消订单
     */
    public async cancelOrder(orderId: bigint): Promise<ethers.ContractTransactionResponse> {
        return this.client.cancelOrder(orderId);
    }

    // ==================== 数据库查询方法 ====================

    /**
     * 获取活跃买单
     */
    public async getActiveBuyOrders(token: string, limit: number = 50): Promise<DatabaseOrder[]> {
        return this.db.getActiveOrders(token, OrderType.BUY, limit);
    }

    /**
     * 获取活跃卖单
     */
    public async getActiveSellOrders(token: string, limit: number = 50): Promise<DatabaseOrder[]> {
        return this.db.getActiveOrders(token, OrderType.SELL, limit);
    }

    /**
     * 获取订单簿快照
     */
    public async getOrderBookSnapshot(token: string, depth: number = 10) {
        return this.db.getOrderBookSnapshot(token, depth);
    }

    /**
     * 获取订单详情
     */
    public async getOrder(orderId: string): Promise<DatabaseOrder | null> {
        return this.db.getOrder(orderId);
    }

    /**
     * 获取用户订单
     */
    public async getUserOrders(maker: string): Promise<DatabaseOrder[]> {
        if (this.db instanceof MemoryDatabase) {
            return this.db.getUserOrders(maker);
        }
        throw new Error('getUserOrders 需要 MemoryDatabase 或自定义实现');
    }

    /**
     * 搜索订单
     */
    public async searchOrders(filters: {
        token?: string;
        maker?: string;
        orderType?: OrderType;
        status?: OrderStatus;
        minPrice?: string;
        maxPrice?: string;
        limit?: number;
    }): Promise<DatabaseOrder[]> {
        if (this.db instanceof MemoryDatabase) {
            return this.db.searchOrders(filters);
        }
        throw new Error('searchOrders 需要 MemoryDatabase 或自定义实现');
    }

    /**
     * 获取统计信息
     */
    public async getStats() {
        if (this.db instanceof MemoryDatabase) {
            return this.db.getStats();
        }
        throw new Error('getStats 需要 MemoryDatabase 或自定义实现');
    }

    // ==================== 订阅和通知 ====================

    /**
     * 订阅订单更新
     */
    public onOrderUpdate(callback: (orders: DatabaseOrder[]) => void): () => void {
        this.updateCallbacks.add(callback);
        
        // 返回取消订阅函数
        return () => {
            this.updateCallbacks.delete(callback);
        };
    }

    /**
     * 验证订单一致性
     */
    public async verifyOrder(orderId: string): Promise<boolean> {
        return this.indexer.verifyOrder(orderId);
    }

    /**
     * 获取数据库实例
     */
    public getDatabase(): IDatabase {
        return this.db;
    }

    /**
     * 获取索引器实例
     */
    public getIndexer(): OrderBookIndexer {
        return this.indexer;
    }

    /**
     * 获取客户端实例
     */
    public getClient(): OrderBookClient {
        return this.client;
    }
}

/**
 * 订单簿管理器
 * 提供实时订单簿数据和便捷的查询方法
 */
export class OrderBookManager {
    private client: OrderBookClientFull;
    private token: string;
    private activeOrders: {
        bids: DatabaseOrder[];
        asks: DatabaseOrder[];
    } = { bids: [], asks: [] };
    private updateInterval?: NodeJS.Timeout;

    constructor(client: OrderBookClientFull, token: string) {
        this.client = client;
        this.token = token;
    }

    /**
     * 启动订单簿管理器
     */
    public async start(updateInterval: number = 1000): Promise<void> {
        // 初始加载
        await this.refresh();

        // 订阅更新
        this.client.onOrderUpdate(async (orders) => {
            // 只处理当前代币的订单
            if (orders.length > 0 && orders[0].token.toLowerCase() === this.token.toLowerCase()) {
                await this.refresh();
            }
        });

        // 定期刷新（可选）
        if (updateInterval > 0) {
            this.updateInterval = setInterval(async () => {
                await this.refresh();
            }, updateInterval);
        }
    }

    /**
     * 停止订单簿管理器
     */
    public stop(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = undefined;
        }
    }

    /**
     * 刷新订单簿数据
     */
    public async refresh(): Promise<void> {
        const [bids, asks] = await Promise.all([
            this.client.getActiveBuyOrders(this.token),
            this.client.getActiveSellOrders(this.token),
        ]);

        this.activeOrders = { bids, asks };
    }

    /**
     * 获取买单列表（按价格降序）
     */
    public getBids(): DatabaseOrder[] {
        return this.activeOrders.bids;
    }

    /**
     * 获取卖单列表（按价格升序）
     */
    public getAsks(): DatabaseOrder[] {
        return this.activeOrders.asks;
    }

    /**
     * 获取最佳买价
     */
    public getBestBid(): DatabaseOrder | null {
        return this.activeOrders.bids[0] || null;
    }

    /**
     * 获取最佳卖价
     */
    public getBestAsk(): DatabaseOrder | null {
        return this.activeOrders.asks[0] || null;
    }

    /**
     * 获取买卖价差
     */
    public getSpread(): bigint | null {
        const bestBid = this.getBestBid();
        const bestAsk = this.getBestAsk();

        if (!bestBid || !bestAsk) {
            return null;
        }

        return BigInt(bestAsk.price) - BigInt(bestBid.price);
    }

    /**
     * 获取中间价
     */
    public getMidPrice(): bigint | null {
        const bestBid = this.getBestBid();
        const bestAsk = this.getBestAsk();

        if (!bestBid || !bestAsk) {
            return null;
        }

        return (BigInt(bestBid.price) + BigInt(bestAsk.price)) / 2n;
    }

    /**
     * 获取订单簿深度
     */
    public getDepth(levels: number = 10): {
        bids: Array<{ price: string; amount: string; total: string }>;
        asks: Array<{ price: string; amount: string; total: string }>;
    } {
        const formatOrders = (orders: DatabaseOrder[]) => {
            let total = 0n;
            return orders.slice(0, levels).map(order => {
                const remaining = BigInt(order.amount) - BigInt(order.filledAmount);
                total += remaining;
                return {
                    price: order.price,
                    amount: remaining.toString(),
                    total: total.toString(),
                };
            });
        };

        return {
            bids: formatOrders(this.activeOrders.bids),
            asks: formatOrders(this.activeOrders.asks),
        };
    }

    /**
     * 估算市价单成本
     */
    public estimateMarketOrder(
        orderType: OrderType,
        amount: bigint
    ): {
        totalCost: bigint;
        averagePrice: bigint;
        orders: Array<{ orderId: string; amount: bigint; price: bigint }>;
    } | null {
        const orders = orderType === OrderType.BUY ? this.activeOrders.asks : this.activeOrders.bids;

        let remainingAmount = amount;
        let totalCost = 0n;
        const filledOrders: Array<{ orderId: string; amount: bigint; price: bigint }> = [];

        for (const order of orders) {
            if (remainingAmount === 0n) {
                break;
            }

            const available = BigInt(order.amount) - BigInt(order.filledAmount);
            const fillAmount = remainingAmount > available ? available : remainingAmount;
            const price = BigInt(order.price);

            totalCost += (fillAmount * price) / ethers.parseEther('1');
            filledOrders.push({
                orderId: order.orderId,
                amount: fillAmount,
                price,
            });

            remainingAmount -= fillAmount;
        }

        if (remainingAmount > 0n) {
            // 流动性不足
            return null;
        }

        const averagePrice = (totalCost * ethers.parseEther('1')) / amount;

        return {
            totalCost,
            averagePrice,
            orders: filledOrders,
        };
    }
}

