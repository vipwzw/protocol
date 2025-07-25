// 临时修复：提供空的 profiler 实现以避免编译错误
// 原始依赖 @0x/sol-profiler 可能已被弃用

// 空的实现类
class MockProfilerSubprovider {
    start(): void {
        // 空实现
    }
    stop(): void {
        // 空实现
    }
}

class MockSolCompilerArtifactAdapter {
    // 空实现
}

// Constants that were previously imported from devConstants
const TESTRPC_FIRST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

let profilerSubprovider: MockProfilerSubprovider;

export const profiler = {
    start(): void {
        profiler._getProfilerSubprovider().start();
    },
    stop(): void {
        profiler._getProfilerSubprovider().stop();
    },
    _getProfilerSubprovider(): MockProfilerSubprovider {
        const defaultFromAddress = TESTRPC_FIRST_ADDRESS;
        const solCompilerArtifactAdapter = new MockSolCompilerArtifactAdapter();
        const isVerbose = true;
        profilerSubprovider = new MockProfilerSubprovider();
        return profilerSubprovider;
    },
};
