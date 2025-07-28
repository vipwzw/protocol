"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReverseCalldataIterator = exports.CalldataIterator = void 0;
/* tslint:disable max-classes-per-file */
// @ts-ignore
const _ = __importStar(require("lodash"));
const queue_1 = require("../utils/queue");
const blob_1 = require("./blocks/blob");
const pointer_1 = require("./blocks/pointer");
const set_1 = require("./blocks/set");
/**
 * Iterator class for Calldata Blocks. Blocks follows the order
 * they should be put into calldata that is passed to he EVM.
 *
 * Example #1:
 * Let root = Set {
 *                  Blob{} A,
 *                  Pointer {
 *                      Blob{} a
 *                  } B,
 *                  Blob{} C
 *            }
 * It will iterate as follows: [A, B, C, B.a]
 *
 * Example #2:
 * Let root = Set {
 *                  Blob{} A,
 *                  Pointer {
 *                      Blob{} a
 *                      Pointer {
 *                          Blob{} b
 *                      }
 *                  } B,
 *                  Pointer {
 *                      Blob{} c
 *                  } C
 *            }
 * It will iterate as follows: [A, B, C, B.a, B.b, C.c]
 */
class BaseIterator {
    constructor(root) {
        this._root = root;
        this._queue = BaseIterator._createQueue(root);
    }
    static _createQueue(block) {
        const queue = new queue_1.Queue();
        // Base case
        if (!(block instanceof set_1.SetCalldataBlock)) {
            queue.pushBack(block);
            return queue;
        }
        // This is a set; add members
        const set = block;
        _.eachRight(set.getMembers(), (member) => {
            queue.mergeFront(BaseIterator._createQueue(member));
        });
        // Add children
        _.each(set.getMembers(), (member) => {
            // Traverse child if it is a unique pointer.
            // A pointer that is an alias for another pointer is ignored.
            if (member instanceof pointer_1.PointerCalldataBlock && member.getAlias() === undefined) {
                const dependency = member.getDependency();
                queue.mergeBack(BaseIterator._createQueue(dependency));
            }
        });
        // Put set block at the front of the queue
        queue.pushFront(set);
        return queue;
    }
    [Symbol.iterator]() {
        return {
            next: () => {
                const nextBlock = this.nextBlock();
                if (nextBlock !== undefined) {
                    return {
                        value: nextBlock,
                        done: false,
                    };
                }
                return {
                    done: true,
                    value: new blob_1.BlobCalldataBlock('', '', '', Buffer.from('')),
                };
            },
        };
    }
}
class CalldataIterator extends BaseIterator {
    constructor(root) {
        super(root);
    }
    nextBlock() {
        return this._queue.popFront();
    }
}
exports.CalldataIterator = CalldataIterator;
class ReverseCalldataIterator extends BaseIterator {
    constructor(root) {
        super(root);
    }
    nextBlock() {
        return this._queue.popBack();
    }
}
exports.ReverseCalldataIterator = ReverseCalldataIterator;
