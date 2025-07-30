import { AbiDecoder } from '@0x/utils';
import { ethers } from 'ethers';
import {
    AbiDefinition,
    ContractArtifact,
    DecodedLogArgs,
    LogEntry,
    LogWithDecodedArgs,
    RawLog,
    TransactionReceipt,
    TransactionReceiptWithDecodedLogs,
} from 'ethereum-types';
import * as _ from 'lodash';

export class LogDecoder {
    private readonly _provider: ethers.Provider;
    private readonly _abiDecoder: AbiDecoder;
    public static wrapLogBigNumbers(log: any): any {
        const argNames = _.keys(log.args);
        for (const argName of argNames) {
            const isWeb3BigNumber = _.startsWith(log.args[argName].constructor.toString(), 'function BigNumber(');
            if (isWeb3BigNumber) {
                // Convert Web3 BigNumber to bigint for ethers v6 compatibility
                log.args[argName] = BigInt(log.args[argName].toString());
            }
        }
    }
    constructor(provider: ethers.Provider, artifacts: { [contractName: string]: ContractArtifact }) {
        this._provider = provider;
        const abiArrays: AbiDefinition[][] = [];
        _.forEach(artifacts, (artifact: ContractArtifact) => {
            const compilerOutput = artifact.compilerOutput;
            abiArrays.push(compilerOutput.abi);
        });
        this._abiDecoder = new AbiDecoder(abiArrays);
    }
    public decodeLogOrThrow<ArgsType extends DecodedLogArgs>(log: LogEntry): LogWithDecodedArgs<ArgsType> | RawLog {
        const logWithDecodedArgsOrLog = this._abiDecoder.tryToDecodeLogOrNoop(log);
        // tslint:disable-next-line:no-unnecessary-type-assertion
        if (_.isUndefined((logWithDecodedArgsOrLog as LogWithDecodedArgs<ArgsType>).args)) {
            throw new Error(`Unable to decode log: ${JSON.stringify(log)}`);
        }
        LogDecoder.wrapLogBigNumbers(logWithDecodedArgsOrLog);
        return logWithDecodedArgsOrLog;
    }
    public async getTxWithDecodedLogsAsync(txHash: string): Promise<TransactionReceiptWithDecodedLogs> {
        const receipt = await this._provider.getTransactionReceipt(txHash);
        if (!receipt) {
            throw new Error(`Transaction receipt not found for hash: ${txHash}`);
        }
        // Convert ethers TransactionReceipt to ethereum-types format
        const convertedReceipt = receipt as any as TransactionReceipt;
        return this.decodeReceiptLogs(convertedReceipt);
    }
    public decodeReceiptLogs(receipt: TransactionReceipt): TransactionReceiptWithDecodedLogs {
        const decodedLogs = (receipt.logs as LogEntry[]).map(log => this.decodeLogOrThrow(log));
        return _.merge({}, receipt, { logs: decodedLogs });
    }
}
