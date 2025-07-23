import * as chai from 'chai';

const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber');
const dirtyChai = require('dirty-chai');

export const chaiSetup = {
    configure(): void {
        chai.config.includeStack = true;
        chai.use(dirtyChai);
        chai.use(chaiBigNumber());
        chai.use(chaiAsPromised);
    },
};

export const { expect } = chai;
