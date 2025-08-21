import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import '../../lib/recipes/Certificates/AffirmationCertificate.js';
export declare function affirmForSomeoneElse(data: SHA256Hash, issuer: SHA256IdHash<Person>, secretKey: Uint8Array): Promise<void>;
//# sourceMappingURL=affirmForSomeoneElse.d.ts.map