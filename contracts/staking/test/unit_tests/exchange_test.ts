import { expect } from 'chai';
import { ethers } from 'hardhat';

// AuthorizableRevertErrors replacement
export class AuthorizableRevertErrors {
    static SenderNotAuthorizedError(): Error {
        return new Error('Authorizable: sender not authorized');
    }
}

// StakingRevertErrors replacement
export class StakingRevertErrors {
    static ExchangeManagerError(): Error {
        return new Error('Staking: exchange manager error');
    }

    static OnlyCallableByExchangeError(): Error {
        return new Error('Staking: only callable by exchange');
    }
}
import { artifacts } from '../artifacts';
import { filterLogsToArguments } from '../test_constants';
import { TestExchangeManagerContract } from '../wrappers';

describe('Exchange Unit Tests', () => {
    // Addresses
    let owner: string;
    let nonExchange: string;
    let exchange: string;
    let nonAuthority: string;
    let authority: string;

    // Exchange Manager
    let exchangeManager: TestExchangeManagerContract;

    before(async () => {
        // Set up addresses for testing.
        [, owner, nonExchange, exchange, nonAuthority, authority] = await ethers
            .getSigners()
            .then(signers => signers.map(s => s.address));

        // Deploy the Exchange Manager contract.
        exchangeManager = await TestExchangeManagerContract.deployFrom0xArtifactAsync(
            artifacts.TestExchangeManager,
            await ethers.getSigners().then(signers => signers[0]),
            {
                ...{},
                from: owner,
            },
            artifacts,
        );

        // Register the exchange.
        const tx1 = await exchangeManager.setValidExchange(exchange);
        await tx1.wait();

        // Register an authority.
        const tx2 = await exchangeManager.addAuthorizedAddress(authority);
        await tx2.wait();
    });

    describe('onlyExchange', () => {
        it('should revert if called by an unregistered exchange', async () => {
            const tx = exchangeManager.connect(await ethers.getSigner(nonExchange)).onlyExchangeFunction();
            return expect(tx).to.be.reverted;
        });

        it('should succeed if called by a registered exchange', async () => {
            const didSucceed = await exchangeManager.connect(await ethers.getSigner(exchange)).onlyExchangeFunction();
            expect(didSucceed).to.be.true;
        });
    });

    enum ExchangeManagerEventType {
        ExchangeAdded,
        ExchangeRemoved,
    }

    // Verify the logs emitted by `addExchangeAddress` and `removeExchangeAddress`
    function verifyExchangeManagerEvent(
        eventType: ExchangeManagerEventType,
        exchangeAddress: string,
        receipt: any,
    ): void {
        const eventName = eventType === ExchangeManagerEventType.ExchangeAdded ? 'ExchangeAdded' : 'ExchangeRemoved';
        const events = filterLogsToArguments(receipt.logs, eventName);
        expect(events.length).to.eq(1);
        expect(events[0].exchangeAddress).to.eq(exchangeAddress);
    }

    describe('addExchangeAddress', () => {
        it('should revert if called by an unauthorized address', async () => {
            const tx = exchangeManager.connect(await ethers.getSigner(nonAuthority)).addExchangeAddress(nonExchange);
            return expect(tx).to.be.reverted;
        });

        it('should revert when adding an exchange if called by the (non-authorized) owner', async () => {
            const tx = exchangeManager.connect(await ethers.getSigner(owner)).addExchangeAddress(nonExchange);
            return expect(tx).to.be.reverted;
        });

        it('should successfully add an exchange if called by an authorized address', async () => {
            // Register a new exchange.
            const tx = await exchangeManager.connect(await ethers.getSigner(authority)).addExchangeAddress(nonExchange);
            const receipt = await tx.wait();

            // Ensure that the logged event was correct.
            verifyExchangeManagerEvent(ExchangeManagerEventType.ExchangeAdded, nonExchange, receipt);

            // Ensure that the exchange was successfully registered.
            const isValidExchange = await exchangeManager.validExchanges(nonExchange);
            expect(isValidExchange).to.be.true;
        });

        it('should fail to add an exchange redundantly', async () => {
            const tx = exchangeManager.connect(await ethers.getSigner(authority)).addExchangeAddress(exchange);
            return expect(tx).to.be.reverted;
        });
    });

    describe('removeExchangeAddress', () => {
        it('should revert if called by an unauthorized address', async () => {
            const tx = exchangeManager.connect(await ethers.getSigner(nonAuthority)).removeExchangeAddress(exchange);
            return expect(tx).to.be.reverted;
        });

        it('should revert when removing an exchange if called by the (non-authorized) owner', async () => {
            const tx = exchangeManager.connect(await ethers.getSigner(owner)).removeExchangeAddress(exchange);
            return expect(tx).to.be.reverted;
        });

        it('should successfully remove a registered exchange if called by an authorized address', async () => {
            // Remove the registered exchange.
            const tx = await exchangeManager.connect(await ethers.getSigner(authority)).removeExchangeAddress(exchange);
            const receipt = await tx.wait();

            // Ensure that the logged event was correct.
            verifyExchangeManagerEvent(ExchangeManagerEventType.ExchangeRemoved, exchange, receipt);

            // Ensure that the exchange was removed.
            const isValidExchange = await exchangeManager.validExchanges(exchange);
            expect(isValidExchange).to.be.false;
        });

        it('should fail to remove an exchange redundantly', async () => {
            const tx = exchangeManager.connect(await ethers.getSigner(authority)).removeExchangeAddress(exchange);
            return expect(tx).to.be.reverted;
        });
    });
});
