import { ProfilerSubprovider, SolCompilerArtifactAdapter } from '@0x/sol-profiler';

// Constants that were previously imported from devConstants
const TESTRPC_FIRST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

let profilerSubprovider: ProfilerSubprovider;

export const profiler = {
    start(): void {
        profiler._getProfilerSubprovider().start();
    },
    stop(): void {
        profiler._getProfilerSubprovider().stop();
    },
    _getProfilerSubprovider(): ProfilerSubprovider {
        const defaultFromAddress = TESTRPC_FIRST_ADDRESS;
        const solCompilerArtifactAdapter = new SolCompilerArtifactAdapter();
        const isVerbose = true;
        profilerSubprovider = new ProfilerSubprovider(solCompilerArtifactAdapter, defaultFromAddress, isVerbose);
        return profilerSubprovider;
    },
};
