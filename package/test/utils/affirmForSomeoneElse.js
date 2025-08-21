import { storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { getLicenseForCertificate } from '../../lib/misc/Certificates/LicenseRegistry.js';
import { signForSomeoneElse } from './signForSomeoneElse.js';
import '../../lib/recipes/Certificates/AffirmationCertificate.js';
export async function affirmForSomeoneElse(data, issuer, secretKey) {
    const licenseResult = await storeUnversionedObject(getLicenseForCertificate('AffirmationCertificate'));
    const result = await storeUnversionedObject({
        $type$: 'AffirmationCertificate',
        data: data,
        license: licenseResult.hash
    });
    await signForSomeoneElse(result.hash, issuer, secretKey);
}
//# sourceMappingURL=affirmForSomeoneElse.js.map