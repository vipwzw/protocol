import * as chai from 'chai';
import * as dirtyChai from 'dirty-chai';
import ChaiBigNumber = require('chai-bignumber');

// Setup chai
export const chaiSetup = {
    configure(): void {
        chai.config.includeStack = true;
    }
};

chaiSetup.configure();
export const expect = chai.expect; 