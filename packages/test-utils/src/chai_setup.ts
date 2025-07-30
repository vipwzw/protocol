import * as chai from 'chai';

const chaiBigNumber = require('chai-bignumber');
const dirtyChai = require('dirty-chai');

export const chaiSetup = {
    configure(): void {
        chai.config.includeStack = true;
        chai.use(dirtyChai);
        chai.use(chaiBigNumber());
        // chai-as-promised functionality is provided by @nomicfoundation/hardhat-chai-matchers
    },
};

export const { expect } = chai;
