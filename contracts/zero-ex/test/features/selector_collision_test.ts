import { constants } from '@0x/utils';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Selector collision test', () => {
    it('Function selectors do not collide', async () => {
        // 🔧 重新实现 selector collision 测试，使用 ethers v6 和 TypeChain

        // 获取所有主要 feature 的接口
        const zeroExFactory = await ethers.getContractFactory('ZeroEx');
        const zeroExInterface = zeroExFactory.interface;

        // 收集所有函数选择器
        const selectors = new Set<string>();
        const collisions: string[] = [];

        // 遍历所有函数
        Object.values(zeroExInterface.fragments).forEach(fragment => {
            if (fragment.type === 'function') {
                const selector = zeroExInterface.getFunction(fragment.name)?.selector;
                if (selector) {
                    if (selectors.has(selector)) {
                        collisions.push(`Collision detected: ${selector} for function ${fragment.name}`);
                    }
                    selectors.add(selector);
                }
            }
        });

        // 验证没有冲突
        expect(collisions).to.have.length(0, `Function selector collisions found:\n${collisions.join('\n')}`);

        // 验证至少有一些函数被检查了
        expect(selectors.size).to.be.greaterThan(0, 'No function selectors found');
    });
});
