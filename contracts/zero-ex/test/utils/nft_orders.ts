import { constants, getRandomInteger, randomAddress } from '@0x/test-utils';
import { ERC1155Order, ERC721Order } from '@0x/protocol-utils';

/**
 * Generate a random ERC721 Order
 */
export function getRandomERC721Order(fields: Partial<ERC721Order> = {}): ERC721Order {
    return new ERC721Order({
        erc20Token: randomAddress(),
        erc20TokenAmount: BigInt(getRandomInteger('1e18', '10e18').toString()),
        erc721Token: randomAddress(),
        erc721TokenId: BigInt(getRandomInteger(0, constants.MAX_UINT256).toString()),
        maker: randomAddress(),
        taker: randomAddress(),
        erc721TokenProperties: [],
        fees: [],
        nonce: BigInt(getRandomInteger(0, constants.MAX_UINT256).toString()),
        expiry: BigInt(Math.floor(Date.now() / 1000 + 60)),
        ...fields,
    });
}

/**
 * Generate a random ERC1155 Order
 */
export function getRandomERC1155Order(fields: Partial<ERC1155Order> = {}): ERC1155Order {
    return new ERC1155Order({
        erc20Token: randomAddress(),
        erc20TokenAmount: BigInt(getRandomInteger('1e18', '10e18').toString()),
        erc1155Token: randomAddress(),
        erc1155TokenId: BigInt(getRandomInteger(0, constants.MAX_UINT256).toString()),
        erc1155TokenAmount: BigInt(getRandomInteger(1, 100).toString()),
        maker: randomAddress(),
        taker: randomAddress(),
        erc1155TokenProperties: [],
        fees: [],
        nonce: BigInt(getRandomInteger(0, constants.MAX_UINT256).toString()),
        expiry: BigInt(Math.floor(Date.now() / 1000 + 60)),
        ...fields,
    });
}
