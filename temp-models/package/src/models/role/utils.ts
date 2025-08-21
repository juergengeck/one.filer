import type {Group, Person} from '@refinio/one.core/lib/recipes.js';
import type {SHA256IdHash} from '@refinio/one.core/lib/util/type-checks.js';
import {calculateIdHashOfObj} from '@refinio/one.core/lib/util/object.js';
import {exists} from '@refinio/one.core/lib/system/storage-base.js';
import type LeuteModel from '../Leute/LeuteModel.js';
import GroupModel from '../Leute/GroupModel.js';

/**
 * Get the group hash id
 * @param groupName - The name of the group
 * @returns The group hash id
 */
async function getGroupHashId(groupName: string): Promise<SHA256IdHash<Group> | undefined> {
    const groupHash = await calculateIdHashOfObj({$type$: 'Group', name: groupName});

    if (await exists(groupHash)) {
        return groupHash;
    }

    return undefined;
}

/**
 * Get the role group
 * @param name - The name of the role
 * @returns The role group
 */
export async function getRoleGroup(name: string): Promise<GroupModel> {
    const groupIdHash = await getGroupHashId(name);

    if (groupIdHash === undefined) {
        return GroupModel.constructWithNewGroup(name);
    } else {
        return GroupModel.constructFromLatestProfileVersion(groupIdHash);
    }
}

/**
 * Get the person ids for a role
 * @param leuteModel - The leute model
 * @param isRole - The is role function
 * @param exclude - The exclude array
 * @returns The person ids
 */
export async function getPersonIdsForRole(
    leuteModel: LeuteModel,
    isRole: (personId: SHA256IdHash<Person>) => Promise<boolean>,
    exclude?: Array<SHA256IdHash<Person>>
): Promise<Array<SHA256IdHash<Person>>> {
    const someones = [...(await leuteModel.others()), await leuteModel.me()];

    const role: Set<SHA256IdHash<Person>> = new Set();

    for (const someone of someones) {
        for (const identity of someone.identities()) {
            if (exclude === undefined || !exclude.includes(identity) || !role.has(identity)) {
                if (await isRole(identity)) {
                    role.add(identity);
                }
            }
        }
    }

    return Array.from(role);
}
