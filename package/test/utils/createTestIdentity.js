import tweetnacl from 'tweetnacl';
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { uint8arrayToHexString } from '@refinio/one.core/lib/util/arraybuffer-to-and-from-hex-string.js';
export async function createTestIdentity(email) {
    const keyPair = tweetnacl.box.keyPair();
    const signKeyPair = tweetnacl.sign.keyPair();
    const personResult = await storeVersionedObject({
        $type$: 'Person',
        email
    });
    if (personResult.status !== 'new') {
        throw new Error('The person with the specified ID already exists.');
    }
    const keys = (await storeUnversionedObject({
        $type$: 'Keys',
        owner: personResult.idHash,
        publicKey: uint8arrayToHexString(keyPair.publicKey),
        publicSignKey: uint8arrayToHexString(signKeyPair.publicKey)
    })).hash;
    return {
        keyPair,
        signKeyPair,
        person: personResult.idHash,
        keys
    };
}
//# sourceMappingURL=createTestIdentity.js.map