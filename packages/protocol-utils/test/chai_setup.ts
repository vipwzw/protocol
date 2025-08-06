import * as chai from 'chai';
// @ts-ignore - no types available for dirty-chai
import * as dirtyChai from 'dirty-chai';
// chai-bignumber 已移除，使用原生 bigint 比较

// Setup chai
export const chaiSetup = {
    configure(): void {
        chai.config.includeStack = true;
    }
};

chaiSetup.configure();
export const expect = chai.expect; 