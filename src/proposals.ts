const ONE_YEAR_IN_SECONDS = BigInt(31536000);
const PROPOSAL_2_ZRX_AMOUNT = BigInt('485392999999999970448000');
const PROPOSAL_2_MATIC_AMOUNT = BigInt('378035999999999992944000');
const PROPOSAL_2_STREAM_START_TIME = BigInt(1635188400);
const PROPOSAL_2_RECIPIENT = '0x976378445d31d81b15576811450a7b9797206807';

export const proposals: Proposal[] = [
    {
        actions: [
            {
                target: zrxToken,
                data: zrx
                    .transfer('0xf9347f751a6a1467Abc722eC7d80bA2698dd9d6c', BigInt(400000) * (BigInt(10) ** BigInt(18)))
                    .getABIEncodedTransactionData(),
                value: BigInt(0),
            }, 