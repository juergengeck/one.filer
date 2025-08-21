import {createAccess} from '@refinio/one.core/lib/access.js';
import {createMessageBus} from '@refinio/one.core/lib/message-bus.js';
import type {Person} from '@refinio/one.core/lib/recipes.js';
import {SET_ACCESS_MODE} from '@refinio/one.core/lib/storage-base-common.js';
import type {HexString} from '@refinio/one.core/lib/util/arraybuffer-to-and-from-hex-string.js';
import type {SHA256IdHash} from '@refinio/one.core/lib/util/type-checks.js';

import type LeuteModel from '../Leute/LeuteModel.js';
import type ProfileModel from '../Leute/ProfileModel.js';
import type { OneInstanceEndpoint } from '../../recipes/Leute/CommunicationEndpoints.js';
import Role, { type RoleConfig } from './Role.js';
import { getRoleGroup } from './utils.js';
import type GroupModel from '../Leute/GroupModel.js';
import { serializeWithType } from '@refinio/one.core/lib/util/promise.js';

const MessageBus = createMessageBus('RoleModels');

/**
 * The config for the AffirmedRoleModel.
 */
type SignKeyRoleConfig = {
    sharedWith?: boolean | ((personId: SHA256IdHash<Person>) => boolean);
    trusted?: boolean | ((personId: SHA256IdHash<Person>) => boolean);
    roleGroupName?: string;
    propagateInstanceToEveryone?: boolean;
} & RoleConfig;

/**
 * Parses the initial config for the SignKeyRoleModel.
 * @param config - The config to parse.
 * @returns The parsed config.
 */
function parseInitialConfig(signKeyRoleConfig: SignKeyRoleConfig): SignKeyRoleConfig {
    return {
        sharedWith: true,
        trusted: true,
        roleGroupName: undefined,
        propagateInstanceToEveryone: false,
        ...signKeyRoleConfig
    };
}

/**
 * A model that represents a sign key role.
 *
 * Note: Depends on the reverse maps of the LeuteModel to be able to find the someone from the personId.
 */
export default abstract class SignKeyRoleModel extends Role {

    /*************** Not allowed ***************/

    public setRolePerson(personId: SHA256IdHash<Person>, creatorId?: SHA256IdHash<Person>): Promise<void> {
        throw new Error('Not possible for SignKeyRoleModel');
    }

    /*************** Non-abstracts ***************/

    protected roleSignKeys: HexString[];
    protected rolePersonIds: Set<SHA256IdHash<Person>>;
    protected roleGroupPersonIds: GroupModel | undefined;
    protected signKeyRoleConfig: SignKeyRoleConfig;
    protected checkInstanceDisconnectListener: (() => void) | undefined;
    protected sharingDisconnectListener: (() => void) | undefined;

    /**
     * Constructs a new SignKeyRoleModel.
     * @param leuteModel - The LeuteModel instance.
     * @param roleSignKeys - The public sign keys of the role.
     * @param config - The config for the SignKeyRoleModel.
     */
    constructor(leuteModel: LeuteModel, roleSignKeys: HexString[], config: SignKeyRoleConfig = {}) {
        super(leuteModel, config);
        this.roleSignKeys = roleSignKeys;
        this.rolePersonIds = new Set();
        this.signKeyRoleConfig = parseInitialConfig(config);
    }

    /**
     * Initializes the SignKeyRoleModel.
     */
    public async init(): Promise<void> {
        await super.init();
        MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - init`);
        this.checkInstanceDisconnectListener = this.leuteModel.onNewOneInstanceEndpoint(
            this.checkInstance.bind(this)
        );
        // check current leute model for sign keys role person Ids
        const rolePersonIds = await this.findRolePersonIds();

        if (rolePersonIds.length > 0) {
            this.checkInstanceDisconnectListener();
            this.checkInstanceDisconnectListener = undefined;
            MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - init - found personIds, try to trust and share`);
            await this.trustAndShare();
            this.onFound.emit();
        }
    }

    /**
     * Shuts down the SignKeyRoleModel.
     */
    public async shutdown(): Promise<void> {
        if (this.checkInstanceDisconnectListener !== undefined) {
            this.checkInstanceDisconnectListener();
        }
        this.checkInstanceDisconnectListener = undefined;

        if (this.sharingDisconnectListener !== undefined) {
            this.sharingDisconnectListener();
        }
        this.sharingDisconnectListener = undefined;
        await super.shutdown();
    }

    /**
     * Checks if the person is the sign key role person.
     * @param personId - The personId to check. Default is the current person.
     * @returns True if the person is the sign key role person, false otherwise.
     */
    public async isRolePerson(personId?: SHA256IdHash<Person>): Promise<boolean> {
        const targetPersonId = personId ?? (await this.leuteModel.myMainIdentity());
        return (await this.getRolePersonIds()).includes(targetPersonId);
    }

    /**
     * Gets the personIds of the sign key role.
     * @returns The personIds of the sign key role in an one indexed array or an empty array if not found.
     */
    public async getRolePersonIds(): Promise<SHA256IdHash<Person>[]> {
        if (this.signKeyRoleConfig.roleGroupName === undefined) {
            return Array.from(this.rolePersonIds);
        }
        if (this.roleGroupPersonIds === undefined) {
            this.roleGroupPersonIds = await getRoleGroup(this.signKeyRoleConfig.roleGroupName);
        }
        return this.roleGroupPersonIds.persons;
    }

    /**
     * Shares the sign key role with the given person.
     * @param withPersonIds - The personIds to share the sign key role with.
     * @param rolePersonIdToShare - The role personId to share the sign key role with. Default is undefined. Meaning that the data is shared with all role personIds.
     */
    public async shareWith(withPersonIds: SHA256IdHash<Person>[], options: {rolePersonId?: SHA256IdHash<Person>, forcePropagate?: boolean} = {}): Promise<void> {
        if (this.signKeyRoleConfig.sharedWith === false) {
            // no sharing allowed
            MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - shareWith - no sharing allowed`, {withPersonIds, options});
            return;
        }

        const allRolePersonIds = await this.getRolePersonIds();
        const rolePersonIds = options.rolePersonId ? allRolePersonIds.filter(id => id === options.rolePersonId) : allRolePersonIds;
        if (rolePersonIds.length === 0) {
            // no sign key role personIds found yet
            MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - shareWith - no sign key role personIds found yet`, {withPersonIds, options});
            return;
        }

        const myMainIdentity = await this.leuteModel.myMainIdentity();
        const myRolePersonId = rolePersonIds.find(id => id === myMainIdentity);
        if (myRolePersonId === undefined && !this.signKeyRoleConfig.propagateInstanceToEveryone && !options.forcePropagate) {
            // current instance is not a sign key role person and we do not propagate the role instances to everyone
            MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - shareWith - current instance is not a sign key role person and we do not propagate the role instances to everyone`, {withPersonIds, options});
            return;
        }

        const filteredWithPersonIds: SHA256IdHash<Person>[] = [];
        for (const personId of withPersonIds) {
            if (typeof this.signKeyRoleConfig.sharedWith === 'function' && !this.signKeyRoleConfig.sharedWith(personId)) {
                // no sharing allowed for this person
                MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - shareWith - no sharing allowed for this person`, {personId, withPersonIds, options});
                continue;
            }
            if (personId === myMainIdentity) {
                // do not share with myself
                continue;
            }
            if (personId === options.rolePersonId) {
                // do not share with the role person itself
                continue;
            }
            filteredWithPersonIds.push(personId);
        }

        if (filteredWithPersonIds.length === 0) {
            // no persons to share with
            MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - shareWith - no persons to share with`, {withPersonIds, options});
            return;
        }

        if (myRolePersonId !== undefined && !this.signKeyRoleConfig.propagateInstanceToEveryone && !options.forcePropagate) {
            const persons = filteredWithPersonIds.filter(p => p !== myRolePersonId);
            if (persons.length === 0) {
                MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - shareWith filteredWithPersonIds contain only myRolePersonId`, {withPersonIds, myRolePersonId, options})
                return;
            }
            MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - shareWith - current instance is a sign key role person and we do not propagate all role instances to everyone, only the sharing the current one`, {withPersonIds, options});
            const profile = await this.leuteModel.getMainProfile(myRolePersonId);
            await createAccess([
                {
                    id: profile.idHash,
                    person: filteredWithPersonIds,
                    group: [],
                    mode: SET_ACCESS_MODE.ADD
                }
            ]);
            return;
        }

        MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - shareWith - sharing with`, {rolePersonIds, filteredWithPersonIds, options});
        for (const rolePersonId of rolePersonIds) {
            const profile = await this.leuteModel.getMainProfile(rolePersonId);
            await createAccess([
                {
                    id: profile.idHash,
                    person: filteredWithPersonIds,
                    group: [],
                    mode: SET_ACCESS_MODE.ADD
                }
            ]);
        }
    }

    /*************** Protected ***************/

    /**
     * Finds the personIds of the sign key role.
     * @returns The personIds of the sign key role or an empty array if not found.
     */
    protected async findRolePersonIds(): Promise<SHA256IdHash<Person>[]> {
        // check everyone
        const everyone = [...(await this.leuteModel.others()), await this.leuteModel.me()];
        const rolePersonIds: SHA256IdHash<Person>[] = [];

        for (const someone of everyone) {
            for (const profile of await someone.profiles()) {
                if (this.profileContainsRoleSignKey(profile)) {
                    MessageBus.send(
                        'debug',
                        `SignKeyRoleModel - ${this.getRoleName()} - findRolePersonIds - found personId`,
                        profile.personId
                    );
                    rolePersonIds.push(profile.personId);
                }
            }
        }
        await this.addRolePersonIds(rolePersonIds);
        return this.getRolePersonIds();
    }

    /**
     * Checks if the profile contains the role sign key.
     * @param profile - The profile to check.
     * @returns True if the profile contains the role sign key, false otherwise.
     */
    protected profileContainsRoleSignKey(profile: ProfileModel): boolean {
        return profile
            .descriptionsOfType('SignKey')
            .some(signKey => this.roleSignKeys.includes(signKey.key));
    }

    /**
     * Starts sharing the sign key role with others.
     */
    protected async startSharing(): Promise<void> {
        if (this.sharingDisconnectListener !== undefined) {
            // already sharing
            return;
        }

        if (this.signKeyRoleConfig.sharedWith === false) {
            // no sharing allowed
            return;
        }

        // initial sharing
        const others = await this.leuteModel.others();

        for (const other of others) {
            for (const identity of other.identities()) {
                await this.shareWith([identity]);
            }
        }

        // listen for new endpoints to share with
        this.sharingDisconnectListener = this.leuteModel.onNewOneInstanceEndpoint(i =>
            this.shareWith([i.personId])
        );
    }

    /**
     * Ensures that the current person is trusting the sign key role person.
     */
    protected async ensureTrust(): Promise<void> {
        const me = await this.leuteModel.me();
        const rolePersonIds = await this.getRolePersonIds();

        let newTrust = false;

        for (const rolePersonId of rolePersonIds) {
            if (me.identities().includes(rolePersonId)) {
                // no need to trust our own identity or undefined
                return;
            }

            if (this.signKeyRoleConfig.trusted === false || (typeof this.signKeyRoleConfig.trusted === 'function' && !this.signKeyRoleConfig.trusted(rolePersonId))) {
                // no trust allowed
                return;
            }

            const someone = await this.leuteModel.getSomeone(rolePersonId);

            if (someone === undefined) {
                // typescript lint avoidance, should not happen
                // if this happens, than the reverse maps are not working correctly
                // and leuteModel.getSomeone can not find the someone from the personId
                throw new Error(
                    `SignKey personId received, but someone is not found in Leute Model ${rolePersonId}`
                );
            }

            for (const profileModel of await someone.profiles()) {
                if (
                    profileModel
                        .descriptionsOfType('SignKey')
                        .some(k => this.roleSignKeys.includes(k.key))
                ) {
                    if (profileModel.loadedVersion === undefined) {
                        // typescript lint avoidance, should not happen
                        throw new Error(
                            `Profile id does not have a loaded version ${profileModel.idHash}`
                        );
                    }

                    newTrust = true;
                    await this.leuteModel.trust.certify('TrustKeysCertificate', {
                        profile: profileModel.loadedVersion
                    });
                }
            }
        }

        if (newTrust) {
            // Just a hack until we have a better way of refreshing the trust caches
            // so we only do it if we actually have to, as it has a performance impact
            await this.leuteModel.trust.refreshCaches();
        }
    }

    /**
     * Trusts and shares the sign key role depending on the config.
     */
    protected async trustAndShare(): Promise<void> {
        const rolePersonIds = await this.getRolePersonIds();
        if (rolePersonIds.length === 0) {
            // no sign key role personId found yet
            return;
        }

        await this.ensureTrust();
        await this.startSharing();
    }

    /**
     * Checks if the instance is from the sign key role.
     * @param endpoint - The endpoint to check.
     */
    protected async checkInstance(endpoint: OneInstanceEndpoint): Promise<void> {
        const someone = await this.leuteModel.getSomeone(endpoint.personId);

        if (someone === undefined) {
            // typescript lint avoidance, should not happen
            // if this happens, than the reverse maps are not working correctly
            // and leuteModel.getSomeone can not find the someone from the personId
            return;
        }

        for (const profile of await someone.profiles()) {
            if (this.profileContainsRoleSignKey(profile)) {
                // remember the sign key role personId
                await this.addToRolePersonIds([endpoint.personId]);
                break;
            }
        }

        const rolePersonIds = await this.getRolePersonIds();
        if (rolePersonIds.length === 0) {
            return;
        }

        await this.trustAndShare();
        this.onFound.emit();
    }

    /**
     * Adds the person ids to the role person ids or group.
     * @param personIds - The person ids to add.
     * @returns True if new person ids were added, false otherwise.
     */
    protected async addRolePersonIds(personIds: Array<SHA256IdHash<Person>>): Promise<boolean> {
        if (this.signKeyRoleConfig.roleGroupName === undefined) {
            return this.addToRolePersonIds(personIds);
        }
        return this.addToGroup(personIds);
    }

    /**
     * Adds the person ids to the role person ids.
     * @throws Error if role group name is defined. use this.addRolePersonIds to avoid this.
     * @param personIds - The person ids to add.
     * @returns True if new person ids were added, false otherwise.
     */
    protected async addToRolePersonIds(personIds: Array<SHA256IdHash<Person>>): Promise<boolean> {
        let addedNew = false;
        let addedNewTrust = false;

        await serializeWithType(`addToRolePersonIds - ${this.getRoleName()}`, async () => {
            if (this.signKeyRoleConfig.roleGroupName !== undefined) {
                throw new Error('Role group name is defined, use addToGroup instead');
            }

            const me = await this.leuteModel.me();
            const myIndentitis = me.identities();

            for (const personId of personIds) {
                if (this.rolePersonIds.has(personId)) {
                    continue;
                }

                if (!myIndentitis.includes(personId) && (this.signKeyRoleConfig.trusted === true || typeof this.signKeyRoleConfig.trusted === 'function' && this.signKeyRoleConfig.trusted(personId))) {
                    const someone = await this.leuteModel.getSomeone(personId);

                    if (someone === undefined) {
                        throw new Error(`Could not find someone with personId ${personId}`);
                    }

                    for (const profile of await someone.profiles()) {
                        if (profile.loadedVersion === undefined) {
                            // typescript lint avoidance, should not be here
                            throw new Error(
                                `Profile id does not have a loaded version ${profile.idHash}`
                            );
                        }

                        addedNewTrust = true;
                        await this.leuteModel.trust.certify('TrustKeysCertificate', {
                            profile: profile.loadedVersion
                        });
                    }
                }

                MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - addToRolePersonIds`, personId);
                this.rolePersonIds.add(personId);
                addedNew = true;
            }

            if (addedNewTrust) {
                await this.leuteModel.trust.refreshCaches(); // Just a hack until we have a better way of refresh
            }

            if (addedNew) {
                MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - addToRolePersonIds - emit`);
                this.onFound.emit();
            }
        });

        return addedNew;
    }

    /**
     * Adds the role person ids to the role person ids.
     * @throws Error if role group name is undefined. use this.addRolePersonIds to avoid this.
     * @param personIds - The person ids to add.
     * @param emitChangeNonEmptyGroup - Whether to emit a change if the group is not empty. Default is false.
     * @returns True if the role person ids were added, false otherwise.
     */
    protected async addToGroup(
        personIds: Array<SHA256IdHash<Person>>
    ): Promise<boolean> {
        let addedNew = false;
        let addedNewTrust = false;

        await serializeWithType(`addToGroup - ${this.getRoleName()}`, async () => {
            if (this.signKeyRoleConfig.roleGroupName === undefined) {
                throw new Error('Role group name is not set');
            }

            const roleGroup = await getRoleGroup(this.signKeyRoleConfig.roleGroupName);
            const me = await this.leuteModel.me();
            const myIndentitis = me.identities();
            const personsIds = new Set(roleGroup.persons);

            for (const personId of personIds) {
                if (personsIds.has(personId)) {
                    continue;
                }

                if (!myIndentitis.includes(personId) && (this.signKeyRoleConfig.trusted === true || typeof this.signKeyRoleConfig.trusted === 'function' && this.signKeyRoleConfig.trusted(personId))) {
                    const someone = await this.leuteModel.getSomeone(personId);

                    if (someone === undefined) {
                        throw new Error(`Could not find someone with personId ${personId}`);
                    }

                    for (const profile of await someone.profiles()) {
                        if (profile.loadedVersion === undefined) {
                            // typescript lint avoidance, should not be here
                            throw new Error(
                                `Profile id does not have a loaded version ${profile.idHash}`
                            );
                        }

                        addedNewTrust = true;
                        await this.leuteModel.trust.certify('TrustKeysCertificate', {
                            profile: profile.loadedVersion
                        });
                    }
                }

                addedNew = true;
                MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - addToGroup`, personId);
                personsIds.add(personId);
            }

            if (addedNewTrust) {
                // Just a hack until we have a better way of refreshing the trust caches
                // so we only do it if we actually have to, as it has a performance impact
                await this.leuteModel.trust.refreshCaches();
            }

            if (addedNew) {
                roleGroup.persons = Array.from(personsIds);
                await roleGroup.saveAndLoad();
                MessageBus.send('debug', `SignKeyRoleModel - ${this.getRoleName()} - addToGroup - has new person ids`);
                this.onFound.emit();
            }
        });

        return addedNew;
    }
}
