import { ethers } from 'ethers';
import { OrderBook as OrderBookContract } from './types';

/**
 * OrderBook 合约包装器
 * 提供类型安全的合约交互接口
 */
export class OrderBookWrapper {
    public contract: OrderBookContract;
    public abi: any;

    constructor(address: string, provider: ethers.Provider | ethers.Signer) {
        const abi = require('../artifacts/contracts/OrderBook.sol/OrderBook.json').abi;
        this.abi = abi;
        this.contract = new ethers.Contract(address, abi, provider) as any as OrderBookContract;
    }

    /**
     * 获取合约实例
     */
    public getContract(): OrderBookContract {
        return this.contract;
    }

    /**
     * 连接签名者
     */
    public connect(signer: ethers.Signer): OrderBookWrapper {
        const wrapper = new OrderBookWrapper(
            this.contract.target as string,
            signer
        );
        return wrapper;
    }
}

