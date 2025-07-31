import { RevertError } from '@0x/utils';
import * as chai from 'chai';

import { revertErrorHelper } from './chai_revert_error';

declare global {
    namespace Chai {
        export interface Assertion {
            revertWith: (expected: string | RevertError) => Promise<void>;
        }
    }
}

export const chaiSetup = {
    configure(): void {
        chai.config.includeStack = true;
        // Use modern Hardhat chai matchers and local revert error helper
        chai.use(revertErrorHelper);
    },
};
