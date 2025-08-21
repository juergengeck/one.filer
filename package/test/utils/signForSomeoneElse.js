import tweetnacl from 'tweetnacl';
import { storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { uint8arrayToHexString } from '@refinio/one.core/lib/util/arraybuffer-to-and-from-hex-string.js';
export async function signForSomeoneElse(data, issuer, secretKey) {
    const signatureBinary = tweetnacl.sign.detached(new TextEncoder().encode(data), secretKey);
    const signatureString = uint8arrayToHexString(signatureBinary);
    await storeUnversionedObject({
        $type$: 'Signature',
        issuer,
        data,
        signature: signatureString
    });
}
//# sourceMappingURL=signForSomeoneElse.js.map