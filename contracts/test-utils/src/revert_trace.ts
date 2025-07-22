import { RevertTraceSubprovider, SolCompilerArtifactAdapter } from '@0x/sol-trace';

// Constants that were previously imported from devConstants
const TESTRPC_FIRST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

let revertTraceSubprovider: RevertTraceSubprovider;

export const revertTrace = {
    getRevertTraceSubproviderSingleton(): RevertTraceSubprovider {
        if (revertTraceSubprovider === undefined) {
            revertTraceSubprovider = revertTrace._getRevertTraceSubprovider();
        }
        return revertTraceSubprovider;
    },
    _getRevertTraceSubprovider(): RevertTraceSubprovider {
        const defaultFromAddress = TESTRPC_FIRST_ADDRESS;
        const solCompilerArtifactAdapter = new SolCompilerArtifactAdapter();
        const isVerbose = true;
        const subprovider = new RevertTraceSubprovider(solCompilerArtifactAdapter, defaultFromAddress, isVerbose);
        return subprovider;
    },
};
