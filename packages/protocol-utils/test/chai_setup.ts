import * as chai from 'chai';
// @ts-ignore - no types available for dirty-chai
import * as dirtyChai from 'dirty-chai';
// @ts-ignore - no types available for chai-bignumber  
import ChaiBigNumber = require('chai-bignumber');

// Setup chai
export const chaiSetup = {
    configure(): void {
        chai.config.includeStack = true;
    }
};

chaiSetup.configure();
export const expect = chai.expect; 