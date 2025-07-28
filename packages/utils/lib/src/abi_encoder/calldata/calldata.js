"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Calldata = void 0;
var ethUtil = require("ethereumjs-util");
var _ = require("lodash");
var constants_1 = require("../utils/constants");
var pointer_1 = require("./blocks/pointer");
var set_1 = require("./blocks/set");
var iterator_1 = require("./iterator");
var Calldata = /** @class */ (function () {
    function Calldata(rules) {
        this._rules = rules;
        this._selector = '';
        this._root = undefined;
    }
    /**
     * Sets the root calldata block. This block usually corresponds to a Method.
     */
    Calldata.prototype.setRoot = function (block) {
        this._root = block;
    };
    /**
     * Sets the selector to be prepended onto the calldata.
     * If the root block was created by a Method then a selector will likely be set.
     */
    Calldata.prototype.setSelector = function (selector) {
        if (!_.startsWith(selector, '0x')) {
            throw new Error("Expected selector to be hex. Missing prefix '0x'");
        }
        else if (selector.length !== constants_1.constants.HEX_SELECTOR_LENGTH_IN_CHARS) {
            throw new Error("Invalid selector '".concat(selector, "'"));
        }
        this._selector = selector;
    };
    /**
     * Iterates through the calldata blocks, starting from the root block, to construct calldata as a hex string.
     * If the `optimize` flag is set then this calldata will be condensed, to save gas.
     * If the `annotate` flag is set then this will return human-readable calldata.
     * If the `annotate` flag is *not* set then this will return EVM-compatible calldata.
     */
    Calldata.prototype.toString = function () {
        // Sanity check: root block must be set
        if (this._root === undefined) {
            throw new Error('expected root');
        }
        // Optimize, if flag set
        if (this._rules.shouldOptimize) {
            this._optimize();
        }
        // Set offsets
        var iterator = new iterator_1.CalldataIterator(this._root);
        var offset = 0;
        for (var _i = 0, iterator_2 = iterator; _i < iterator_2.length; _i++) {
            var block = iterator_2[_i];
            block.setOffset(offset);
            offset += block.getSizeInBytes();
        }
        // Generate hex string
        var hexString = this._rules.shouldAnnotate
            ? this._toHumanReadableCallData()
            : this._toEvmCompatibeCallDataHex();
        return hexString;
    };
    /**
     * There are three types of calldata blocks: Blob, Set and Pointer.
     * Scenarios arise where distinct pointers resolve to identical values.
     * We optimize by keeping only one such instance of the identical value, and redirecting all pointers here.
     * We keep the last such duplicate value because pointers can only be positive (they cannot point backwards).
     *
     * Example #1:
     *  function f(string[], string[])
     *  f(["foo", "bar", "blitz"], ["foo", "bar", "blitz"])
     *  The array ["foo", "bar", "blitz"] will only be included in the calldata once.
     *
     * Example #2:
     *  function f(string[], string)
     *  f(["foo", "bar", "blitz"], "foo")
     *  The string "foo" will only be included in the calldata once.
     *
     * Example #3:
     *  function f((string, uint, bytes), string, uint, bytes)
     *  f(("foo", 5, "0x05"), "foo", 5, "0x05")
     *  The string "foo" and bytes "0x05" will only be included in the calldata once.
     *  The duplicate `uint 5` values cannot be optimized out because they are static values (no pointer points to them).
     *
     * @TODO #1:
     *   This optimization strategy handles blocks that are exact duplicates of one another.
     *   But what if some block is a combination of two other blocks? Or a subset of another block?
     *   This optimization problem is not much different from the current implemetation.
     *   Instead of tracking "observed" hashes, at each node we would simply do pattern-matching on the calldata.
     *   This strategy would be applied after assigning offsets to the tree, rather than before (as in this strategy).
     *   Note that one consequence of this strategy is pointers may resolve to offsets that are not word-aligned.
     *   This shouldn't be a problem but further investigation should be done.
     *
     * @TODO #2:
     *   To be done as a follow-up to @TODO #1.
     *   Since we optimize from the bottom-up, we could be affecting the outcome of a later potential optimization.
     *   For example, what if by removing one duplicate value we miss out on optimizing another block higher in the tree.
     *   To handle this case, at each node we can store a candidate optimization in a priority queue (sorted by calldata size).
     *   At the end of traversing the tree, the candidate at the front of the queue will be the most optimal output.
     *
     */
    Calldata.prototype._optimize = function () {
        // Step 1/1 Create a reverse iterator (starts from the end of the calldata to the beginning)
        if (this._root === undefined) {
            throw new Error('expected root');
        }
        var iterator = new iterator_1.ReverseCalldataIterator(this._root);
        // Step 2/2 Iterate over each block, keeping track of which blocks have been seen and pruning redundant blocks.
        var blocksByHash = {};
        for (var _i = 0, iterator_3 = iterator; _i < iterator_3.length; _i++) {
            var block = iterator_3[_i];
            // If a block is a pointer and its value has already been observed, then update
            // the pointer to resolve to the existing value.
            if (block instanceof pointer_1.PointerCalldataBlock) {
                var dependencyBlockHashBuf = block.getDependency().computeHash();
                var dependencyBlockHash = ethUtil.bufferToHex(dependencyBlockHashBuf);
                if (dependencyBlockHash in blocksByHash) {
                    var blockWithSameHash = blocksByHash[dependencyBlockHash];
                    if (blockWithSameHash !== block.getDependency()) {
                        block.setAlias(blockWithSameHash);
                    }
                }
                continue;
            }
            // This block has not been seen. Record its hash.
            var blockHashBuf = block.computeHash();
            var blockHash = ethUtil.bufferToHex(blockHashBuf);
            if (!(blockHash in blocksByHash)) {
                blocksByHash[blockHash] = block;
            }
        }
    };
    Calldata.prototype._toEvmCompatibeCallDataHex = function () {
        // Sanity check: must have a root block.
        if (this._root === undefined) {
            throw new Error('expected root');
        }
        // Construct an array of buffers (one buffer for each block).
        var selectorBuffer = ethUtil.toBuffer(this._selector || '0x');
        var valueBufs = [selectorBuffer];
        var iterator = new iterator_1.CalldataIterator(this._root);
        for (var _i = 0, iterator_4 = iterator; _i < iterator_4.length; _i++) {
            var block = iterator_4[_i];
            valueBufs.push(block.toBuffer());
        }
        // Create hex from buffer array.
        var combinedBuffers = Buffer.concat(valueBufs);
        var hexValue = ethUtil.bufferToHex(combinedBuffers);
        return hexValue;
    };
    /**
     * Returns human-readable calldata.
     *
     * Example:
     *   simpleFunction(string[], string[])
     *   strings = ["Hello", "World"]
     *   simpleFunction(strings, strings)
     *
     * Output:
     *   0xbb4f12e3
     *                                                                                      ### simpleFunction
     *   0x0       0000000000000000000000000000000000000000000000000000000000000040              ptr<array1> (alias for array2)
     *   0x20      0000000000000000000000000000000000000000000000000000000000000040              ptr<array2>
     *
     *   0x40      0000000000000000000000000000000000000000000000000000000000000002          ### array2
     *   0x60      0000000000000000000000000000000000000000000000000000000000000040              ptr<array2[0]>
     *   0x80      0000000000000000000000000000000000000000000000000000000000000080              ptr<array2[1]>
     *   0xa0      0000000000000000000000000000000000000000000000000000000000000005              array2[0]
     *   0xc0      48656c6c6f000000000000000000000000000000000000000000000000000000
     *   0xe0      0000000000000000000000000000000000000000000000000000000000000005              array2[1]
     *   0x100     576f726c64000000000000000000000000000000000000000000000000000000
     */
    Calldata.prototype._toHumanReadableCallData = function () {
        // Sanity check: must have a root block.
        if (this._root === undefined) {
            throw new Error('expected root');
        }
        // Constants for constructing annotated string
        var offsetPadding = 10;
        var valuePadding = 74;
        var namePadding = 80;
        var evmWordStartIndex = 0;
        var emptySize = 0;
        // Construct annotated calldata
        var hexValue = "".concat(this._selector);
        var offset = 0;
        var functionName = this._root.getName();
        var iterator = new iterator_1.CalldataIterator(this._root);
        for (var _i = 0, iterator_5 = iterator; _i < iterator_5.length; _i++) {
            var block = iterator_5[_i];
            // Process each block 1 word at a time
            var size = block.getSizeInBytes();
            var name_1 = block.getName();
            var parentName = block.getParentName();
            var prettyName = name_1.replace("".concat(parentName, "."), '').replace("".concat(functionName, "."), '');
            // Resulting line will be <offsetStr><valueStr><nameStr>
            var offsetStr = '';
            var valueStr = '';
            var nameStr = '';
            var lineStr = '';
            if (size === emptySize) {
                // This is a Set block with no header.
                // For example, a tuple or an array with a defined length.
                offsetStr = ' '.repeat(offsetPadding);
                valueStr = ' '.repeat(valuePadding);
                nameStr = "### ".concat(prettyName.padEnd(namePadding));
                lineStr = "\n".concat(offsetStr).concat(valueStr).concat(nameStr);
            }
            else {
                // This block has at least one word of value.
                offsetStr = "0x".concat(offset.toString(constants_1.constants.HEX_BASE)).padEnd(offsetPadding);
                valueStr = ethUtil
                    .stripHexPrefix(ethUtil.bufferToHex(block.toBuffer().slice(evmWordStartIndex, constants_1.constants.EVM_WORD_WIDTH_IN_BYTES)))
                    .padEnd(valuePadding);
                if (block instanceof set_1.SetCalldataBlock) {
                    nameStr = "### ".concat(prettyName.padEnd(namePadding));
                    lineStr = "\n".concat(offsetStr).concat(valueStr).concat(nameStr);
                }
                else {
                    nameStr = "    ".concat(prettyName.padEnd(namePadding));
                    lineStr = "".concat(offsetStr).concat(valueStr).concat(nameStr);
                }
            }
            // This block has a value that is more than 1 word.
            for (var j = constants_1.constants.EVM_WORD_WIDTH_IN_BYTES; j < size; j += constants_1.constants.EVM_WORD_WIDTH_IN_BYTES) {
                offsetStr = "0x".concat((offset + j).toString(constants_1.constants.HEX_BASE)).padEnd(offsetPadding);
                valueStr = ethUtil
                    .stripHexPrefix(ethUtil.bufferToHex(block.toBuffer().slice(j, j + constants_1.constants.EVM_WORD_WIDTH_IN_BYTES)))
                    .padEnd(valuePadding);
                nameStr = ' '.repeat(namePadding);
                lineStr = "".concat(lineStr, "\n").concat(offsetStr).concat(valueStr).concat(nameStr);
            }
            // Append to hex value
            hexValue = "".concat(hexValue, "\n").concat(lineStr);
            offset += size;
        }
        return hexValue;
    };
    return Calldata;
}());
exports.Calldata = Calldata;
