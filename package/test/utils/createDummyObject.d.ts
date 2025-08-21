import type { UnversionedObjectResult } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import type { Recipe } from '@refinio/one.core/lib/recipes.js';
import type { VersionedObjectResult } from '@refinio/one.core/lib/storage-versioned-objects.js';
declare module '@OneObjectInterfaces' {
    interface OneUnversionedObjectInterfaces {
        DummyObjectUnversioned: DummyObjectUnversioned;
    }
    interface OneVersionedObjectInterfaces {
        DummyObjectVersioned: DummyObjectVersioned;
    }
    interface OneIdObjectInterfaces {
        DummyObjectVersioned: Pick<DummyObjectVersioned, '$type$' | 'id'>;
    }
}
export interface DummyObjectUnversioned {
    $type$: 'DummyObjectUnversioned';
    data: string;
}
export interface DummyObjectVersioned {
    $type$: 'DummyObjectVersioned';
    id: string;
    data: string;
}
export declare const DummyObjectUnversionedRecipe: Recipe;
export declare const DummyObjectVersionedRecipe: Recipe;
export declare function createDummyObjectUnversioned(data: string): Promise<UnversionedObjectResult<DummyObjectUnversioned>>;
export declare function createDummyObjectVersioned(id: string, data: string): Promise<VersionedObjectResult<DummyObjectVersioned>>;
export declare const DummyObjectRecipes: Recipe[];
//# sourceMappingURL=createDummyObject.d.ts.map