import tweetnacl from 'tweetnacl';
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Keys, Person } from '@refinio/one.core/lib/recipes.js';
export declare function createTestIdentity(email: string): Promise<{
    keyPair: tweetnacl.BoxKeyPair;
    signKeyPair: tweetnacl.SignKeyPair;
    person: SHA256IdHash<Person>;
    keys: SHA256Hash<Keys>;
}>;
//# sourceMappingURL=createTestIdentity.d.ts.map