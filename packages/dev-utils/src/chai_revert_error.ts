import { coerceThrownErrorAsRevertError, RevertError, StringRevertError } from '@0x/utils';

// Simplified chai helper for revert errors
export const revertErrorHelper = (chai: any, utils: any) => {
    chai.Assertion.addMethod('revertWith', function (this: any, expected: string | RevertError) {
        const obj = this._obj;
        
        // Handle promise-based assertions (for contract calls)
        if (obj && typeof obj.then === 'function') {
            return obj.then(
                () => {
                    this.assert(false, 'Expected transaction to revert', 'Expected transaction not to revert');
                },
                (error: any) => {
                    const revertError = coerceThrownErrorAsRevertError(error);
                    const expectedMessage = typeof expected === 'string' ? expected : expected.message;
                    const actualMessage = revertError.message || '';
                    
                    this.assert(
                        actualMessage.includes(expectedMessage),
                        `Expected revert with message "${expectedMessage}", but got "${actualMessage}"`,
                        `Expected not to revert with message "${expectedMessage}"`
                    );
                }
            );
        } else {
            // Handle direct error objects
            const revertError = coerceThrownErrorAsRevertError(obj);
            const expectedMessage = typeof expected === 'string' ? expected : expected.message;
            const actualMessage = revertError.message || '';
            
            this.assert(
                actualMessage.includes(expectedMessage),
                `Expected revert with message "${expectedMessage}", but got "${actualMessage}"`,
                `Expected not to revert with message "${expectedMessage}"`
            );
        }
    });
};