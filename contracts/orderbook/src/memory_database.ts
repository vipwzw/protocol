import {
    IDatabase,
    DatabaseOrder,
    DatabaseFill,
    OrderBookSnapshot,
    PriceLevel,
} from './indexer';
import { OrderType, OrderStatus } from './order_book_client';

/**
 * 内存数据库实现
 * 用于测试和演示，生产环境请使用 PostgreSQL、MongoDB 等
 */
export class MemoryDatabase implements IDatabase {
    private orders: Map<string, DatabaseOrder> = new Map();
    private fills: Map<string, DatabaseFill[]> = new Map();
    private lastSyncedBlock: number = 0;
    private orderBookSnapshots: Map<string, Map<string, PriceLevel>> = new Map();

    /**
     * 创建订单
     */
    async createOrder(order: DatabaseOrder): Promise<void> {
        this.orders.set(order.orderId, {
            ...order,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    /**
     * 更新订单
     */
    async updateOrder(orderId: string, updates: Partial<DatabaseOrder>): Promise<void> {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error(`订单 ${orderId} 不存在`);
        }

        this.orders.set(orderId, {
            ...order,
            ...updates,
            updatedAt: new Date(),
        });
    }

    /**
     * 获取订单
     */
    async getOrder(orderId: string): Promise<DatabaseOrder | null> {
        return this.orders.get(orderId) || null;
    }

    /**
     * 获取活跃订单
     */
    async getActiveOrders(
        token: string,
        orderType: OrderType,
        limit: number = 50
    ): Promise<DatabaseOrder[]> {
        const orders = Array.from(this.orders.values())
            .filter(
                order =>
                    order.token.toLowerCase() === token.toLowerCase() &&
                    order.orderType === orderType &&
                    order.status === OrderStatus.ACTIVE
            )
            .sort((a, b) => {
                // 买单按价格降序，卖单按价格升序
                const priceA = BigInt(a.price);
                const priceB = BigInt(b.price);
                if (orderType === OrderType.BUY) {
                    return priceB > priceA ? 1 : priceB < priceA ? -1 : 0;
                } else {
                    return priceA > priceB ? 1 : priceA < priceB ? -1 : 0;
                }
            })
            .slice(0, limit);

        return orders;
    }

    /**
     * 获取所有活跃订单
     */
    async getAllActiveOrders(token: string): Promise<DatabaseOrder[]> {
        return Array.from(this.orders.values()).filter(
            order =>
                order.token.toLowerCase() === token.toLowerCase() &&
                order.status === OrderStatus.ACTIVE
        );
    }

    /**
     * 创建成交记录
     */
    async createFill(fill: DatabaseFill): Promise<void> {
        const fills = this.fills.get(fill.orderId) || [];
        fills.push(fill);
        this.fills.set(fill.orderId, fills);
    }

    /**
     * 获取成交记录
     */
    async getFills(orderId: string): Promise<DatabaseFill[]> {
        return this.fills.get(orderId) || [];
    }

    /**
     * 获取最后同步的区块
     */
    async getLastSyncedBlock(): Promise<number> {
        return this.lastSyncedBlock;
    }

    /**
     * 设置最后同步的区块
     */
    async setLastSyncedBlock(blockNumber: number): Promise<void> {
        this.lastSyncedBlock = blockNumber;
    }

    /**
     * 更新订单簿快照
     */
    async updateOrderBookSnapshot(
        token: string,
        orderType: OrderType,
        price: string,
        amount: string
    ): Promise<void> {
        const key = `${token.toLowerCase()}_${orderType}`;
        const snapshot = this.orderBookSnapshots.get(key) || new Map();

        const existing = snapshot.get(price);
        if (existing) {
            const newAmount = BigInt(existing.amount) + BigInt(amount);
            snapshot.set(price, {
                price,
                amount: newAmount.toString(),
                orderCount: existing.orderCount + 1,
            });
        } else {
            snapshot.set(price, {
                price,
                amount,
                orderCount: 1,
            });
        }

        this.orderBookSnapshots.set(key, snapshot);
    }

    /**
     * 获取订单簿快照
     */
    async getOrderBookSnapshot(token: string, depth: number = 10): Promise<OrderBookSnapshot> {
        const buyKey = `${token.toLowerCase()}_${OrderType.BUY}`;
        const sellKey = `${token.toLowerCase()}_${OrderType.SELL}`;

        const buySnapshot = this.orderBookSnapshots.get(buyKey) || new Map();
        const sellSnapshot = this.orderBookSnapshots.get(sellKey) || new Map();

        // 买单按价格降序
        const bids = Array.from(buySnapshot.values())
            .sort((a, b) => {
                const priceA = BigInt(a.price);
                const priceB = BigInt(b.price);
                return priceB > priceA ? 1 : priceB < priceA ? -1 : 0;
            })
            .slice(0, depth);

        // 卖单按价格升序
        const asks = Array.from(sellSnapshot.values())
            .sort((a, b) => {
                const priceA = BigInt(a.price);
                const priceB = BigInt(b.price);
                return priceA > priceB ? 1 : priceA < priceB ? -1 : 0;
            })
            .slice(0, depth);

        return {
            token,
            bids,
            asks,
            timestamp: Date.now(),
        };
    }

    /**
     * 清空数据库
     */
    async clear(): Promise<void> {
        this.orders.clear();
        this.fills.clear();
        this.lastSyncedBlock = 0;
        this.orderBookSnapshots.clear();
    }

    /**
     * 获取统计信息
     */
    async getStats(): Promise<{
        totalOrders: number;
        activeOrders: number;
        filledOrders: number;
        cancelledOrders: number;
        totalFills: number;
    }> {
        const orders = Array.from(this.orders.values());
        const totalFills = Array.from(this.fills.values()).reduce(
            (sum, fills) => sum + fills.length,
            0
        );

        return {
            totalOrders: orders.length,
            activeOrders: orders.filter(o => o.status === OrderStatus.ACTIVE).length,
            filledOrders: orders.filter(o => o.status === OrderStatus.FILLED).length,
            cancelledOrders: orders.filter(o => o.status === OrderStatus.CANCELLED).length,
            totalFills,
        };
    }

    /**
     * 获取用户订单
     */
    async getUserOrders(maker: string): Promise<DatabaseOrder[]> {
        return Array.from(this.orders.values())
            .filter(order => order.maker.toLowerCase() === maker.toLowerCase())
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * 获取代币的所有订单
     */
    async getTokenOrders(token: string): Promise<DatabaseOrder[]> {
        return Array.from(this.orders.values())
            .filter(order => order.token.toLowerCase() === token.toLowerCase())
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * 搜索订单
     */
    async searchOrders(filters: {
        token?: string;
        maker?: string;
        orderType?: OrderType;
        status?: OrderStatus;
        minPrice?: string;
        maxPrice?: string;
        limit?: number;
    }): Promise<DatabaseOrder[]> {
        let orders = Array.from(this.orders.values());

        if (filters.token) {
            orders = orders.filter(
                o => o.token.toLowerCase() === filters.token!.toLowerCase()
            );
        }

        if (filters.maker) {
            orders = orders.filter(
                o => o.maker.toLowerCase() === filters.maker!.toLowerCase()
            );
        }

        if (filters.orderType !== undefined) {
            orders = orders.filter(o => o.orderType === filters.orderType);
        }

        if (filters.status !== undefined) {
            orders = orders.filter(o => o.status === filters.status);
        }

        if (filters.minPrice) {
            const minPrice = BigInt(filters.minPrice);
            orders = orders.filter(o => BigInt(o.price) >= minPrice);
        }

        if (filters.maxPrice) {
            const maxPrice = BigInt(filters.maxPrice);
            orders = orders.filter(o => BigInt(o.price) <= maxPrice);
        }

        // 按时间戳降序排序
        orders.sort((a, b) => b.timestamp - a.timestamp);

        if (filters.limit) {
            orders = orders.slice(0, filters.limit);
        }

        return orders;
    }
}

