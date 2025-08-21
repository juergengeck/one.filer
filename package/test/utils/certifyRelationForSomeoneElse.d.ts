import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import '../../lib/recipes/Certificates/RelationCertificate.js';
export declare function certifyRelationForSomeoneElse(person1: SHA256IdHash<Person>, person2: SHA256IdHash<Person>, relation: string, app: string, issuer: SHA256IdHash<Person>, secretKey: Uint8Array): Promise<void>;
//# sourceMappingURL=certifyRelationForSomeoneElse.d.ts.map