import * as chai from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';

export const chaiSetup = {
    configure(): void {
        chai.config.includeStack = true;
        // 现代化的 chai 设置，移除旧的插件
        // chai-bignumber、dirty-chai、chai-as-promised 已被移除
        // 使用现代 chai 断言和原生 bigint
        // 使用 @nomicfoundation/hardhat-chai-matchers 提供的现代断言
    },
};
