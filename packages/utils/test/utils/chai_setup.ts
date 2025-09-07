import * as chai from 'chai';

export const chaiSetup = {
    configure(): void {
        chai.config.includeStack = true;
        // 现代化的 chai 设置，移除旧的插件
        // chai-bignumber、dirty-chai、chai-as-promised 已被移除
        // 使用现代 chai 断言和原生 bigint
    },
};
