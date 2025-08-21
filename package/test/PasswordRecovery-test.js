import { expect } from 'chai';
import tweetnacl from 'tweetnacl';
import { createRecoveryInformation, recoverSecretAsString, unpackRecoveryInformation } from '../lib/misc/PasswordRecoveryService/PasswordRecovery.js';
import { initOneCorePlatform } from './_helpers.js';
describe('Password recovery test', () => {
    beforeEach(async () => {
        await initOneCorePlatform();
    });
    afterEach(async () => { });
    it('Standard workflow', async () => {
        const secret = 'abfuqlwkeu';
        const identity = 'test@me.invalid';
        const recoveryServerKeys = tweetnacl.box.keyPair();
        const info = createRecoveryInformation(recoveryServerKeys.publicKey, secret, identity);
        const decodedRecoveryInformation = unpackRecoveryInformation(recoveryServerKeys.secretKey, info.bundledEncryptedRecoveryInformation);
        expect(decodedRecoveryInformation.identity).to.be.equal(identity);
        const recoveredSecret = recoverSecretAsString(info.encryptedSecret, decodedRecoveryInformation.symmetricKey);
        expect(recoveredSecret).to.be.deep.equal(secret);
    });
});
//# sourceMappingURL=PasswordRecovery-test.js.map