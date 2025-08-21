import { storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { storeVersionObjectAsChange } from '@refinio/one.core/lib/storage-versioned-objects.js';
export const DummyObjectUnversionedRecipe = {
    $type$: 'Recipe',
    name: 'DummyObjectUnversioned',
    rule: [
        {
            itemprop: 'data'
        }
    ]
};
export const DummyObjectVersionedRecipe = {
    $type$: 'Recipe',
    name: 'DummyObjectVersioned',
    rule: [
        {
            itemprop: 'id',
            isId: true
        },
        {
            itemprop: 'data'
        }
    ]
};
export async function createDummyObjectUnversioned(data) {
    return storeUnversionedObject({
        $type$: 'DummyObjectUnversioned',
        data
    });
}
export async function createDummyObjectVersioned(id, data) {
    return storeVersionObjectAsChange({
        $type$: 'DummyObjectVersioned',
        id,
        data
    });
}
export const DummyObjectRecipes = [
    DummyObjectUnversionedRecipe,
    DummyObjectVersionedRecipe
];
//# sourceMappingURL=createDummyObject.js.map