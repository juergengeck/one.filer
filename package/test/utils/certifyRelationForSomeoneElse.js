import { storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { getLicenseForCertificate } from '../../lib/misc/Certificates/LicenseRegistry.js';
import { signForSomeoneElse } from './signForSomeoneElse.js';
import '../../lib/recipes/Certificates/RelationCertificate.js';
export async function certifyRelationForSomeoneElse(person1, person2, relation, app, issuer, secretKey) {
    const licenseResult = await storeUnversionedObject(getLicenseForCertificate('RelationCertificate'));
    const result = await storeUnversionedObject({
        $type$: 'RelationCertificate',
        person1,
        person2,
        relation,
        app,
        license: licenseResult.hash
    });
    await signForSomeoneElse(result.hash, issuer, secretKey);
}
//# sourceMappingURL=certifyRelationForSomeoneElse.js.map