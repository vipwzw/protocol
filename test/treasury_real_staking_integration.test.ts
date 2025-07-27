import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { artifacts } from './artifacts';
import { 
    DummyERC20Token,
    TreasuryStaking
} from './typechain-types';
import { 
    DummyERC20Token,
    DummyERC20Token__factory,
    ZrxTreasury,
    ZrxTreasury__factory,
    DefaultPoolOperator,
    DefaultPoolOperator__factory,
    TreasuryStaking,
    TreasuryStaking__factory
} from './typechain-types';
import { 
    DummyERC20Token,
    DummyERC20Token__factory,
    ZrxTreasury,
    ZrxTreasury__factory,
    DefaultPoolOperator,
    DefaultPoolOperator__factory,
    TreasuryStaking,
    TreasuryStaking__factory
} from './typechain-types';
import { 
    DummyERC20Token,
    DummyERC20Token__factory,
    ZrxTreasury,
    ZrxTreasury__factory,
    DefaultPoolOperator,
    DefaultPoolOperator__factory,
    TreasuryStaking,
    TreasuryStaking__factory
} from './typechain-types';

describe('Treasury Governance with Real Staking Integration', function() {
    // Extended timeout for complex staking operations
    this.timeout(180000);
    
    let admin: any;
    let poolOperator: any;
    let delegator: any;
    let relayer: any;
    
    // Real contracts with TypeChain types
    let zrx: DummyERC20Token;
    let weth: DummyERC20Token;
    let stakingContract: TreasuryStaking; // 使用 TypeChain 类型
    let treasury: ZrxTreasury;
    let defaultPoolOperator: DefaultPoolOperator; 