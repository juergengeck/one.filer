import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
export declare function signForSomeoneElse(data: SHA256Hash, issuer: SHA256IdHash<Person>, secretKey: Uint8Array): Promise<void>;
//# sourceMappingURL=signForSomeoneElse.d.ts.map