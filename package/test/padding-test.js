import { expect } from 'chai';
import { addPadding, removePadding, addPaddingWithExtraFlags, removePaddingWithExtraFlags } from '../lib/misc/PasswordRecoveryService/padding.js';
function* generateIndex() {
    yield 40;
}
describe('Padding test', () => {
    beforeEach(async () => { });
    afterEach(async () => { });
    it('Add and remove padding.', async () => {
        const testData = new Uint8Array([50, 51, 52, 53, 54, 55, 56]);
        for (const i of generateIndex()) {
            const paddedValue = addPadding(testData, testData.length + i);
            const original = removePadding(paddedValue);
            expect(paddedValue.length).to.be.equal(testData.length + i);
            expect(original).to.be.deep.equal(testData);
        }
    }).timeout(10000);
    it('Add and remove padding with flags.', async () => {
        const testData = new Uint8Array([50, 51, 52, 53, 54, 55, 56]);
        for (const i of generateIndex()) {
            const paddedValue = addPaddingWithExtraFlags(testData, testData.length + i, i % 16);
            const original = removePaddingWithExtraFlags(paddedValue);
            expect(paddedValue.length).to.be.equal(testData.length + i);
            expect(original.value).to.be.deep.equal(testData);
            expect(original.flags).to.be.deep.equal(i % 16);
        }
    }).timeout(10000);
    it('too large flag exception', async () => {
        const testData = new Uint8Array([50, 51, 52, 53, 54, 55, 56]);
        expect(() => addPaddingWithExtraFlags(testData, testData.length + 5, 0x10)).to.throw;
    });
    it('Test zero length', async () => {
        const testData = new Uint8Array(0);
        for (const i of generateIndex()) {
            const paddedValue = addPadding(testData, testData.length + i);
            const original = removePadding(paddedValue);
            expect(paddedValue.length).to.be.equal(testData.length + i);
            expect(original).to.be.deep.equal(testData);
        }
    }).timeout(10000);
});
//# sourceMappingURL=padding-test.js.map