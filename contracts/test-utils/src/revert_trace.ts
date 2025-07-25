// 临时修复：提供空的 revert trace 实现以避免编译错误
// 原始依赖 @0x/sol-trace 可能已被弃用

// 空的实现类
class MockRevertTraceSubprovider {
    // 空实现
}

class MockSolCompilerArtifactAdapter {
    // 空实现
}

// Constants that were previously imported from devConstants
const TESTRPC_FIRST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

let revertTraceSubprovider: MockRevertTraceSubprovider;

export const revertTrace = {
    getRevertTraceSubproviderSingleton(): MockRevertTraceSubprovider {
        if (revertTraceSubprovider === undefined) {
            revertTraceSubprovider = revertTrace._getRevertTraceSubprovider();
        }
        return revertTraceSubprovider;
    },
    _getRevertTraceSubprovider(): MockRevertTraceSubprovider {
        const defaultFromAddress = TESTRPC_FIRST_ADDRESS;
        const solCompilerArtifactAdapter = new MockSolCompilerArtifactAdapter();
        const isVerbose = true;
        const subprovider = new MockRevertTraceSubprovider();
        return subprovider;
    },
};
