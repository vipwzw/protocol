import { ethers } from 'ethers';
import { ERC1155Order, ERC721Order } from '@0x/protocol-utils';

// Constants
const MAX_UINT256 = 2n ** 256n - 1n;

// Utility functions
function getRandomInteger(min: bigint | string | number, max: bigint | string | number): bigint {
    // Convert to BigInt, handling scientific notation
    const minBig = typeof min === 'bigint' ? min : BigInt(Math.floor(Number(min)));
    const maxBig = typeof max === 'bigint' ? max : BigInt(Math.floor(Number(max)));
    const range = maxBig - minBig;
    const randomBytes = ethers.randomBytes(32);
    const randomBig = BigInt('0x' + Buffer.from(randomBytes).toString('hex'));
    return minBig + (randomBig % (range + 1n));
}

function randomAddress(): string {
    return ethers.Wallet.createRandom().address;
}

// Counters to ensure unique nonces and token IDs
let nonceCounter = BigInt(Date.now()) * 1000000n;
let tokenIdCounter = BigInt(Date.now()) * 1000n;

/**
 * Generate a random ERC721 Order
 */
export function getRandomERC721Order(fields: Partial<ERC721Order> = {}): ERC721Order {
    return new ERC721Order({
        erc20Token: randomAddress(),
        erc20TokenAmount: getRandomInteger('1e18', '10e18'),
        erc721Token: randomAddress(),
        erc721TokenId: ++tokenIdCounter,
        maker: randomAddress(),
        taker: randomAddress(),
        erc721TokenProperties: [],
        fees: [],
        nonce: ++nonceCounter,
        expiry: BigInt(Math.floor(Date.now() / 1000 + 3600)), // 1小时过期时间
        ...fields,
    });
}
/**
 * Generate a random ERC1155 Order
 */
export function getRandomERC1155Order(fields: Partial<ERC1155Order> = {}): ERC1155Order {
    return new ERC1155Order({
        erc20Token: randomAddress(),
        erc20TokenAmount: getRandomInteger('1e18', '10e18'),
        erc1155Token: randomAddress(),
        erc1155TokenId: ++tokenIdCounter,
        erc1155TokenAmount: getRandomInteger(1, '10e18'),
        maker: randomAddress(),
        taker: randomAddress(),
        erc1155TokenProperties: [],
        fees: [],
        nonce: ++nonceCounter,
        expiry: BigInt(Math.floor(Date.now() / 1000 + 3600)), // 1小时过期时间
        ...fields,
    });
}
