/await web3Wrapper\.awaitTransactionSuccessAsync/,/);/{
    /await web3Wrapper\.awaitTransactionSuccessAsync/{
        s/.*await web3Wrapper\.awaitTransactionSuccessAsync(/                const tx = await authorizedSigner.sendTransaction({/
        N
        N
        N
        N
        N
        N
        s/from: authorized,\n.*);/});/
        a\                await tx.wait();
    }
}
