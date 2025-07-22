import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as dirtyChai from 'dirty-chai';
import ChaiBigNumber = require('chai-bignumber');

// Setup chai
export const chaiSetup = {
    configure(): void {
        chai.config.includeStack = true;
        chai.use(ChaiBigNumber());
        chai.use(dirtyChai);
        chai.use(chaiAsPromised);
    }
};

chaiSetup.configure();
export const expect = chai.expect; 