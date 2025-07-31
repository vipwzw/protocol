import * as chai from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';

// 配置 Chai
export const chaiSetup = {
    configure(): void {
        // Hardhat chai matchers 会自动配置，这里保持接口兼容
        chai.should();
    }
};

// 导出 expect，保持向后兼容
export const expect = chai.expect;

// 确保自动配置
chaiSetup.configure();