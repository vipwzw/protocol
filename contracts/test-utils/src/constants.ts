import { BigNumber } from '@0x/utils';
import { Web3Wrapper } from '@0x/web3-wrapper';
import * as ethUtil from 'ethereumjs-util';
import * as _ from 'lodash';

import { ExchangeFunctionName } from './types';

// The private keys are for the hardhat accounts, not ganache.
const HARDHAT_PRIVATE_KEYS_STRINGS = [
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
    '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
    '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
    '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
    '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
    '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
    '0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897',
    '0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82',
    '0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1',
    '0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd',
    '0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa',
    '0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61',
    '0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0',
    '0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd',
    '0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0',
    '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e',
];

export const NUM_TEST_ACCOUNTS = HARDHAT_PRIVATE_KEYS_STRINGS.length;
export { HARDHAT_PRIVATE_KEYS_STRINGS as TESTRPC_PRIVATE_KEYS_STRINGS };

const MAX_UINT256 = new BigNumber(2).pow(256).minus(1);

// Default gas price for tests
export const DEFAULT_GAS_PRICE = 2000000000; // 2 gwei for Hardhat network

export const constants = {
    BASE_16: 16,
    INVALID_OPCODE: 'invalid opcode',
    TESTRPC_CHAIN_ID: 1337,
    // Note(albrow): In practice V8 and most other engines limit the minimum
    // interval for setInterval to 10ms. We still set it to 0 here in order to
    // ensure we always use the minimum interval.
    AWAIT_TRANSACTION_MINED_MS: 0,
    MAX_ETHERTOKEN_WITHDRAW_GAS: 43000,
    MAX_EXECUTE_TRANSACTION_GAS: 1000000,
    MAX_TOKEN_TRANSFERFROM_GAS: 80000,
    MAX_TOKEN_APPROVE_GAS: 60000,
    MAX_TRANSFER_FROM_GAS: 150000,
    MAX_MATCH_ORDERS_GAS: 400000,
    DUMMY_TOKEN_NAME: '',
    DUMMY_TOKEN_SYMBOL: '',
    DUMMY_TOKEN_DECIMALS: new BigNumber(18),
    DUMMY_TOKEN_TOTAL_SUPPLY: new BigNumber(0),
    NULL_BYTES: '0x',
    NUM_DUMMY_ERC20_TO_DEPLOY: 4,
    NUM_DUMMY_ERC721_TO_DEPLOY: 2,
    NUM_ERC721_TOKENS_TO_MINT: 4,
    NUM_DUMMY_ERC1155_CONTRACTS_TO_DEPLOY: 2,
    NUM_ERC1155_FUNGIBLE_TOKENS_MINT: 4,
    NUM_ERC1155_NONFUNGIBLE_TOKENS_MINT: 4,
    NULL_BYTES4: '0x00000000',
    NULL_ADDRESS: '0x0000000000000000000000000000000000000000',
    NULL_BYTES32: '0x0000000000000000000000000000000000000000000000000000000000000000',
    UNLIMITED_ALLOWANCE_IN_BASE_UNITS: MAX_UINT256,
    MAX_UINT256,
    MAX_UINT32: new BigNumber(2).pow(32).minus(1),
    TESTRPC_PRIVATE_KEYS: _.map(HARDHAT_PRIVATE_KEYS_STRINGS, privateKeyString => ethUtil.toBuffer(privateKeyString)),
    INITIAL_ERC20_BALANCE: Web3Wrapper.toBaseUnitAmount(new BigNumber(10000), 18),
    INITIAL_ERC20_ALLOWANCE: Web3Wrapper.toBaseUnitAmount(new BigNumber(10000), 18),
    INITIAL_ERC1155_FUNGIBLE_BALANCE: Web3Wrapper.toBaseUnitAmount(new BigNumber(10000), 18),
    INITIAL_ERC1155_FUNGIBLE_ALLOWANCE: Web3Wrapper.toBaseUnitAmount(new BigNumber(10000), 18),
    STATIC_ORDER_PARAMS: {
        makerAssetAmount: Web3Wrapper.toBaseUnitAmount(new BigNumber(100), 18),
        takerAssetAmount: Web3Wrapper.toBaseUnitAmount(new BigNumber(200), 18),
        makerFee: Web3Wrapper.toBaseUnitAmount(new BigNumber(1), 18),
        takerFee: Web3Wrapper.toBaseUnitAmount(new BigNumber(1), 18),
    },
    WORD_LENGTH: 32,
    ADDRESS_LENGTH: 20,
    ZERO_AMOUNT: new BigNumber(0),
    PERCENTAGE_DENOMINATOR: new BigNumber(10).pow(18),
    TIME_BUFFER: new BigNumber(1000),
    KECCAK256_NULL: ethUtil.bufferToHex(ethUtil.keccak256(Buffer.alloc(0))),
    MAX_UINT256_ROOT: new BigNumber('340282366920938463463374607431768211456'),
    ONE_ETHER: new BigNumber(1e18),
    EIP712_DOMAIN_NAME: '0x Protocol',
    EIP712_DOMAIN_VERSION: '3.0.0',
    DEFAULT_GAS_PRICE: 2000000000, // 2 gwei for Hardhat network
    NUM_TEST_ACCOUNTS: 20,
    PPM_DENOMINATOR: 1e6,
    PPM_100_PERCENT: 1e6,
    MAX_CODE_SIZE: 24576,
    SINGLE_FILL_FN_NAMES: [ExchangeFunctionName.FillOrder, ExchangeFunctionName.FillOrKillOrder],
    BATCH_FILL_FN_NAMES: [
        ExchangeFunctionName.BatchFillOrders,
        ExchangeFunctionName.BatchFillOrKillOrders,
        ExchangeFunctionName.BatchFillOrdersNoThrow,
    ],
    MARKET_FILL_FN_NAMES: [
        ExchangeFunctionName.MarketBuyOrdersFillOrKill,
        ExchangeFunctionName.MarketSellOrdersFillOrKill,
        ExchangeFunctionName.MarketBuyOrdersNoThrow,
        ExchangeFunctionName.MarketSellOrdersNoThrow,
    ],
    MATCH_ORDER_FN_NAMES: [ExchangeFunctionName.MatchOrders, ExchangeFunctionName.MatchOrdersWithMaximalFill],
    BATCH_MATCH_ORDER_FN_NAMES: [
        ExchangeFunctionName.BatchMatchOrders,
        ExchangeFunctionName.BatchMatchOrdersWithMaximalFill,
    ],
    CANCEL_ORDER_FN_NAMES: [
        ExchangeFunctionName.CancelOrder,
        ExchangeFunctionName.BatchCancelOrders,
        ExchangeFunctionName.CancelOrdersUpTo,
    ],
};
