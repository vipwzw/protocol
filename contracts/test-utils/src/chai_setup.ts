import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as dirtyChai from 'dirty-chai';
import ChaiBigNumber = require('chai-bignumber');

// Set up chai with all plugins
export const chaiSetup = {
    configure(): void {
        chai.config.includeStack = true;
        // Order matters with chai-as-promised
        chai.use(ChaiBigNumber());
        chai.use(dirtyChai);
        chai.use(chaiAsPromised);
    },
};

chaiSetup.configure();
export const expect = chai.expect;
