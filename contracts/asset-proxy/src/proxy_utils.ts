import { ethers } from 'ethers';
import { expect } from 'chai';

/**
 * Helper function to call getProxyId on contracts using fallback pattern
 * @param contractAddress The address of the proxy contract
 * @param provider The ethers provider or ZeroExProvider
 * @returns The proxy ID as a hex string
 */
export async function getProxyId(contractAddress: string, provider: any): Promise<string> {
    // Encode the function selector for getProxyId()
    const getProxyIdSelector = '0xae25532e'; // bytes4(keccak256("getProxyId()"))

    // Handle both ethers.Provider and ZeroExProvider
    const actualProvider = provider?.provider || provider;

    // Make the call using ethers provider
    let result: string;
    if (actualProvider && typeof actualProvider.call === 'function') {
        result = await actualProvider.call({
            to: contractAddress,
            data: getProxyIdSelector,
        });
    } else {
        // Fallback to ethers provider
        const hre = await import('hardhat');
        result = await (hre as any).ethers.provider.call({
            to: contractAddress,
            data: getProxyIdSelector,
        });
    }

    // The result should be 32 bytes with the proxy ID in the first 4 bytes
    if (result.length < 66) {
        // 0x + 64 chars
        throw new Error('Invalid response from getProxyId');
    }

    // Extract the first 4 bytes (8 hex chars after 0x)
    return '0x' + result.slice(2, 10);
}

/**
 * Helper function to encode transferFrom call data
 * @param assetData The asset data bytes
 * @param from The address to transfer from
 * @param to The address to transfer to
 * @param amount The amount to transfer
 * @returns The encoded call data
 */
export function encodeTransferFrom(assetData: string, from: string, to: string, amount: bigint | string): string {
    const iface = new ethers.Interface([
        'function transferFrom(bytes assetData, address from, address to, uint256 amount)',
    ]);

    return iface.encodeFunctionData('transferFrom', [assetData, from, to, amount]);
}

/**
 * Helper to make transferFrom calls via fallback
 * @param proxyAddress The proxy contract address
 * @param assetData The asset data
 * @param from From address
 * @param to To address
 * @param amount Amount to transfer
 * @param signer The signer to send the transaction
 */
export async function transferFromViaFallback(
    proxyAddress: string,
    assetData: string,
    from: string,
    to: string,
    amount: bigint | string,
    signer: ethers.Signer,
): Promise<ethers.TransactionResponse> {
    const callData = encodeTransferFrom(assetData, from, to, amount);

    return await signer.sendTransaction({
        to: proxyAddress,
        data: callData,
    });
}

/**
 * Assert that a proxy has the expected ID
 * @param proxyAddress The proxy contract address
 * @param expectedId The expected proxy ID
 * @param provider The ethers provider or ZeroExProvider
 */
export async function assertProxyId(proxyAddress: string, expectedId: string, provider: any): Promise<void> {
    const actualId = await getProxyId(proxyAddress, provider);
    expect(actualId).to.equal(expectedId);
}
