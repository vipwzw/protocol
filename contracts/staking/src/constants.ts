import { constants as testConstants } from '@0x/contracts-test-utils';

const TEN_DAYS = 10 * 24 * 60 * 60;
const PPM = 10 ** 6;

// All constants using bigint for ethers v6 compatibility
const DUMMY_TOKEN_DECIMALS = testConstants.DUMMY_TOKEN_DECIMALS; // Already bigint from test-utils
const ZERO_AMOUNT = 0n;
const INITIAL_EPOCH = 1n;

export const constants = {
    TOKEN_MULTIPLIER: DUMMY_TOKEN_DECIMALS,
    INITIAL_POOL_ID: '0x0000000000000000000000000000000000000000000000000000000000000001',
    SECOND_POOL_ID: '0x0000000000000000000000000000000000000000000000000000000000000002',
    NIL_POOL_ID: '0x0000000000000000000000000000000000000000000000000000000000000000',
    NIL_ADDRESS: '0x0000000000000000000000000000000000000000',
    INITIAL_EPOCH: INITIAL_EPOCH,
    ZERO_AMOUNT: ZERO_AMOUNT,
    DEFAULT_PARAMS: {
        epochDurationInSeconds: BigInt(TEN_DAYS),
        rewardDelegatedStakeWeight: BigInt(PPM * 0.9),
        minimumPoolStake: 10n ** DUMMY_TOKEN_DECIMALS * 100n,
        cobbDouglasAlphaNumerator: 2n,
        cobbDouglasAlphaDenominator: 3n,
    },
    PPM,
    ONE_DAY_IN_SECONDS: 24 * 60 * 60,
};
