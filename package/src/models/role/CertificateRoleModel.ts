import {type SHA256Hash, type SHA256IdHash} from '@refinio/one.core/lib/util/type-checks.js';
import type {OneObjectTypes, Person} from '@refinio/one.core/lib/recipes.js';
import {
    getObject,
    type UnversionedObjectResult
} from '@refinio/one.core/lib/storage-unversioned-objects.js';
import {createMessageBus} from '@refinio/one.core/lib/message-bus.js';
import { createAccess } from '@refinio/one.core/lib/access.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';

import {getRoleGroup, getPersonIdsForRole} from './utils.js';
import Role, { type RoleConfig } from './Role.js';
import type LeuteModel from '../Leute/LeuteModel.js';
import { objectEvents } from '../../misc/ObjectEventDispatcher.js';
import type { OneInstanceEndpoint } from '../../recipes/Leute/CommunicationEndpoints.js';
import type { Signature } from '../../recipes/SignatureRecipes.js';
import type GroupModel from '../Leute/GroupModel.js';
import type { CertificateData } from '../Leute/TrustedKeysManager.js';
import type { License } from '../../recipes/Certificates/License.js';
import { serializeWithType } from '@refinio/one.core/lib/util/promise.js';

const MessageBus = createMessageBus('RoleModels');

/**
 * The config for the CertificateRoleModel.
 */
export type CertificateRoleConfig = {
    propagateInstanceToEveryone?: boolean;
    filterSharedWith?: ((personId: SHA256IdHash<Person>) => boolean);
    trusted?: boolean | ((personId: SHA256IdHash<Person>) => boolean);
    roleGroupName?: string;
} & RoleConfig;

function parseInitialConfig(certificateRoleConfig: CertificateRoleConfig): CertificateRoleConfig {
    return {
        propagateInstanceToEveryone: false,
        filterSharedWith: () => true,
        trusted: true,
        roleGroupName: undefined,
        ...certificateRoleConfig
    };
}

/**
 * A model that represents an affirmed role.
 *
 * Note: Depends on the reverse maps of the LeuteModel to be able to find the someone from the personId and objectEvents to listen for new instances/signatures.
 */
export default abstract class CertificateRoleModel extends Role {

    /*************** Abstracts ***************/

    public abstract getPersonIdFromRoleCertificate(
        data: OneObjectTypes
    ): Promise<SHA256IdHash<Person> | undefined>;
    public abstract getIssuerPersonIdsFromRoleCertificate(
        rolePersonId: SHA256IdHash<Person>
    ): Promise<SHA256IdHash<Person>[]>;
    public abstract getCertificates(
        personId: SHA256IdHash<Person>
    ): Promise<CertificateData[]>;
    public abstract createCertificate(
        personId: SHA256IdHash<Person>,
        issuerPersonId?: SHA256IdHash<Person>
    ): Promise<{
        license: UnversionedObjectResult<License>;
        certificate: UnversionedObjectResult;
        signature: UnversionedObjectResult<Signature>;
    }>;

    /*************** Non-abstracts ***************/

    protected certificateRoleConfig: CertificateRoleConfig;
    protected issuers: Role[];
    protected certificatedRolePersonIds: Set<SHA256IdHash<Person>>;
    protected certificatedRoleGroupPersonIds: GroupModel | undefined;
    protected waitForRoleDisconnectListeners: Array<() => void>;
    protected roleDataSharingDisconnectListener: (() => void) | undefined;

    /**
     * Constructor for the CertificateRoleModel.
     * @param leuteModel - The leute model.
     * @param config.sharedWith - Whether the role is shared with others. Default is true.
     * @param config.trusted - Whether the role is trusted. Default is true.
     * @param config.roleGroupName - The role group name config. Default is undefined. Meaning that the role personIds is not saved in a group, but in memory.
     */
    constructor(leuteModel: LeuteModel, issuers: Role[], config: CertificateRoleConfig = {}) {
        super(leuteModel, config);
        this.issuers = issuers;
        this.certificateRoleConfig = parseInitialConfig(config);
        this.waitForRoleDisconnectListeners = [];
        this.certificatedRolePersonIds = new Set();
        this.onFound(this.sharePersons.bind(this));
        // if there are issuers set, than we need to check for role persons each time an issuer is found
        // as we might find new role persons that we missed before, as they did not have a certificate with valid issuers yet
        for (const issuer of this.issuers) {
            issuer.onFound(this.resyncRolePersonIds.bind(this));
        }
    }

    /**
     * Initializes the CertificateRoleModel.
     */
    public async init(): Promise<void> {
        await super.init();
        this.shareWithNewInstances();
        this.waitForNewRolePerson();
        await this.resyncRolePersonIds();
    }

    /**
     * Shuts down the CertificateRoleModel.
     */
    public async shutdown(): Promise<void> {
        for (const waitForRoleDisconnectListener of this.waitForRoleDisconnectListeners) {
            waitForRoleDisconnectListener();
        }
        this.waitForRoleDisconnectListeners = [];
        if (this.roleDataSharingDisconnectListener !== undefined) {
            this.roleDataSharingDisconnectListener();
            this.roleDataSharingDisconnectListener = undefined;
        }
        await super.shutdown();
    }

    /**
     * Returns the role person ids.
     * @returns The role person ids.
     */
    public async getRolePersonIds(): Promise<SHA256IdHash<Person>[]> {
        if (this.certificateRoleConfig.roleGroupName === undefined) {
            return Array.from(this.certificatedRolePersonIds);
        }
        if (this.certificatedRoleGroupPersonIds === undefined) {
            this.certificatedRoleGroupPersonIds = await getRoleGroup(this.certificateRoleConfig.roleGroupName);
        }
        return this.certificatedRoleGroupPersonIds.persons;
    }

    /**
     * Checks if the person is a role person.
     * @param personId - The personId to check. Default is the current person.
     * @returns True if the person is a role person, false otherwise.
     */
    public async isRolePerson(personId?: SHA256IdHash<Person>): Promise<boolean> {
        return (await this.getRolePersonIds()).includes(personId ?? (await this.leuteModel.myMainIdentity()));
    }

    /**
     * Shares the role with the given person ids.
     * @param shareWithPersonIds - The person ids to share with.
     * @param options.rolePersonId - The role person id. Default is the current person.
     * @param options.forcePropagate - Whether to force the role person id from options.rolePersonId to propagate. Default is false.
     */
    public async shareWith(shareWithPersonIds: SHA256IdHash<Person>[], options: {rolePersonId?: SHA256IdHash<Person>, forcePropagate?: boolean} = {}): Promise<void> {
        const rolePersonIds = await this.getRolePersonIds();
        if (options.rolePersonId === undefined) {
            const myIndentity = await this.leuteModel.myMainIdentity();
            if (!rolePersonIds.includes(myIndentity)) {
                throw new Error('Role person id is undefined and the current person is not a role person');
            }
            return await this.sharePersons({
                filterRolePersonIds: [myIndentity],
                shareWith: shareWithPersonIds
            });
        } else if (!rolePersonIds.includes(options.rolePersonId)) {
            MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - shareWith - role person id is not a role person`, {rolePersonIds, options});
            console.error('Role person id is not a role person', {rolePersonIds, roleName: this.getRoleName(), options});
            return;
        }
        await this.sharePersons({
            filterRolePersonIds: options.rolePersonId !== undefined ? [options.rolePersonId] : undefined,
            shareWith: shareWithPersonIds,
            forceFilteredRolePersonIdsPropagate: options.forcePropagate
        });
    }

    /**
     * Check if the person is an issuer
     * @param personId - The person id
     * @returns True if the person is an issuer or no issuers are set, false otherwise
     */
    public async isIssuer(personId: SHA256IdHash<Person>): Promise<boolean> {
        if (this.issuers.length === 0) {
            return true;
        }

        for (const issuer of this.issuers) {
            if (await issuer.isRolePerson(personId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Share the issuers with the person ids
     * @param rolePersonId - The role person id
     * @param shareWithPersonIds - The person ids to share with
     */
    public async shareIssuers(
        rolePersonId: SHA256IdHash<Person>,
        shareWithPersonIds: SHA256IdHash<Person>[]
    ): Promise<void> {
        if (shareWithPersonIds.length === 0) {
            return;
        }

        for (const certificateIssuerId of await this.getIssuerPersonIdsFromRoleCertificate(rolePersonId)) {
            for (const issuer of this.issuers) {
                if (await issuer.isRolePerson(certificateIssuerId)) {
                    await issuer.shareWith(shareWithPersonIds, {rolePersonId: certificateIssuerId, forcePropagate: true});
                }
            }
        }
    }

    /**
     * Get the signature hash for a person
     * @param personId - The person id
     * @returns The signature hash
     */
    public async getSignatureHashes(personId: SHA256IdHash<Person>): Promise<SHA256Hash[] | undefined> {
        const certificates = await this.getCertificates(personId);
        if (certificates.length > 0) {
            return certificates.map(certificate => certificate.signatureHash);
        }
        return undefined;
    }

    /**
     * Check if the person has a certificate
     * @param personId - The person id
     * @returns True if the person has a certificate, false otherwise
     */
    public async hasCertificate(personId: SHA256IdHash<Person>): Promise<boolean> {
        return (await this.getCertificates(personId)).length > 0;
    }

    /**
     * Check if the person has multiple certificates
     * @param personId - The person id
     * @returns True if the person has multiple certificates, false otherwise
     */
    public async hasMultipleCertificates(personId: SHA256IdHash<Person>): Promise<boolean> {
        return (await this.getCertificates(personId)).length > 1;
    }

    /**
     * Set the role person
     * @param personId - The person id
     * @param issuerPersonId - The issuer person id
     */
    public async setRolePerson(
        personId: SHA256IdHash<Person>,
        issuerPersonId?: SHA256IdHash<Person>
    ): Promise<void> {
        const data = await this.createCertificate(
            personId,
            issuerPersonId ?? (await this.leuteModel.myMainIdentity())
        );
        await createAccess([
            {
                object: data.signature.hash,
                person: [personId],
                group: [],
                mode: SET_ACCESS_MODE.ADD
            }
        ]);
    }

    /** ***** protected ***** **/

    /**
     * Resyncs the role person ids.
     */
    protected async resyncRolePersonIds(): Promise<void> {
        // sync certificated people
        await this.addCertificatedRolePersonIds(await getPersonIdsForRole(this.leuteModel, this.hasCertificate.bind(this)), {emitOnNotEmpty: true});
    }

    /**
     * Waits for a new role person.
     */
    protected waitForNewRolePerson(): void {
        if (this.waitForRoleDisconnectListeners.length > 0) {
            return;
        }

        MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - emitOnNewRolePerson - listeners init`);
        this.waitForRoleDisconnectListeners.push(
            objectEvents.onUnversionedObject(
                async (
                    signatureResult: UnversionedObjectResult<Signature>
                ) => {
                    const personId = await this.getPersonIdFromRoleCertificate(await getObject(signatureResult.obj.data));
                    if (personId === undefined) {
                        return;
                    }
                    MessageBus.send(
                        'debug',
                        `CertificateRoleModel - ${this.getRoleName()} - new signature listener - found role person`,
                        personId
                    );
                    if ((await this.getRolePersonIds()).includes(personId) && await this.hasMultipleCertificates(personId)) {
                        // in case we get a new certificate for an existing role person, we need to emit onFound to simulate a new role person
                        this.onFound.emit();
                        return;
                    }
                    // also emits on new role person
                    await this.addCertificatedRolePersonIds([personId]);
                },
                `CertificateRoleModel - ${this.getRoleName()} - wait for sharing`,
                'Signature'
            )
        );

        this.waitForRoleDisconnectListeners.push(
            this.leuteModel.onNewOneInstanceEndpoint(async (endpoint: OneInstanceEndpoint) => {
                // if not role person than is either
                // that the person is not a role person or
                // we have not received his certificate
                // see other waitForRoleDisconnectListeners
                // that handle those cases
                if (!(await this.hasCertificate(endpoint.personId))) {
                    return;
                }
                MessageBus.send(
                    'debug',
                    `CertificateRoleModel - ${this.getRoleName()} - new instance listener - found role person`,
                    endpoint
                );
                // also emits on new role person
                await this.addCertificatedRolePersonIds([endpoint.personId]);
                // in case we get a new certificate, we need to emit onFound to simulate a new role person
                if (await this.hasMultipleCertificates(endpoint.personId)) {
                    this.onFound.emit();
                }
            })
        );
    }

    /**
     * Adds the person ids to the role person ids or group.
     * @param personIds - The person ids to add.
     * @returns True if new person ids were added, false otherwise.
     */
    protected async addCertificatedRolePersonIds(personIds: Array<SHA256IdHash<Person>>, options: {emitOnNotEmpty?: boolean} = {}): Promise<boolean> {
        if (this.certificateRoleConfig.roleGroupName === undefined) {
            return this.addToRolePersonIds(personIds, options);
        }
        return this.addToGroup(personIds, options);
    }

    /**
     * Adds the person ids to the role person ids.
     * @throws Error if role group name is defined. use this.addAffirmedRolePersonIds to avoid this.
     * @param personIds - The person ids to add.
     * @returns True if new person ids were added, false otherwise.
     */
    protected async addToRolePersonIds(personIds: Array<SHA256IdHash<Person>>, options: {emitOnNotEmpty?: boolean} = {}): Promise<boolean> {
        if (personIds.length === 0) {
            return false;
        }

        if (this.certificateRoleConfig.roleGroupName !== undefined) {
            throw new Error('Role group name is defined, use addToGroup instead');
        }

        let addedNew = false;
        let addedNewTrust = false;

        await serializeWithType(`addToRolePersonIds - ${this.getRoleName()}`, async () => {
            const me = await this.leuteModel.me();
            const myIndentitis = me.identities();

            for (const personId of personIds) {
                if (this.certificatedRolePersonIds.has(personId)) {
                    continue;
                }

                if (!myIndentitis.includes(personId) && (this.certificateRoleConfig.trusted === true || (typeof this.certificateRoleConfig.trusted === 'function' && this.certificateRoleConfig.trusted(personId)))) {
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

                MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - addToRolePersonIds`, personId);
                this.certificatedRolePersonIds.add(personId);
                addedNew = true;
            }

            if (addedNewTrust) {
                await this.leuteModel.trust.refreshCaches(); // Just a hack until we have a better way of refresh
            }

            if (addedNew) {
                MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - addToRolePersonIds - emit`);
                this.onFound.emit();
            } else if (options.emitOnNotEmpty && this.certificatedRolePersonIds.size > 0) {
                MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - addToRolePersonIds - emit on not empty`);
                this.onFound.emit();
            }
        });

        return addedNew;
    }

    /**
     * Adds the role person ids to the role person ids.
     * @throws Error if role group name is undefined. use this.addCertificatedRolePersonIds to avoid this.
     * @param personIds - The person ids to add.
     * @param emitChangeNonEmptyGroup - Whether to emit a change if the group is not empty. Default is false.
     * @returns True if the role person ids were added, false otherwise.
     */
    protected async addToGroup(
        personIds: Array<SHA256IdHash<Person>>,
        options: {emitOnNotEmpty?: boolean} = {}
    ): Promise<boolean> {
        if (personIds.length === 0) {
            return false;
        }

        let addedNew = false;
        let addedNewTrust = false;

        await serializeWithType(`addToGroup - ${this.getRoleName()}`, async () => {
            if (this.certificateRoleConfig.roleGroupName === undefined) {
                throw new Error('Role group name is not set');
            }

            const roleGroup = await getRoleGroup(this.certificateRoleConfig.roleGroupName);
            const me = await this.leuteModel.me();
            const myIndentitis = me.identities();
            const personsIds = new Set(roleGroup.persons);

            for (const personId of personIds) {
                if (personsIds.has(personId)) {
                    continue;
                }

                if (!myIndentitis.includes(personId) && (this.certificateRoleConfig.trusted === true || (typeof this.certificateRoleConfig.trusted === 'function' && this.certificateRoleConfig.trusted(personId)))) {
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
                MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - addToGroup`, personId);
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
                MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - addToGroup - has new person ids`);
                this.onFound.emit();
            } else if (options.emitOnNotEmpty && personsIds.size > 0) {
                MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - addToGroup - emit on not empty`);
                this.onFound.emit();
            }
        });

        return addedNew;
    }

    /**
     * Filters the person ids to share with.
     * @param shareOnlyWith - The person ids to share with. Default is undefined. Meaning that the data is shared with all persons that are not a role person.
     * @returns The filtered person ids.
     */
    protected async filterPersonIdsToShareWith(shareOnlyWith: SHA256IdHash<Person>[] | undefined = undefined): Promise<SHA256IdHash<Person>[]> {
        const allOthers = await getPersonIdsForRole(this.leuteModel, this.notRolePersonOrDisabledPersonId.bind(this));
        const others: SHA256IdHash<Person>[] = [];

        for (const other of allOthers) {
            if (shareOnlyWith !== undefined && !shareOnlyWith.includes(other)) {
                continue;
            }
            if (this.certificateRoleConfig.filterSharedWith !== undefined && !this.certificateRoleConfig.filterSharedWith(other)) {
                continue;
            }
            others.push(other);
        }

        return others;
    }

    /**
     * Filters the role person ids to share with.
     * @param filterRolePersonIds - The role person ids to filter. Default is undefined. Meaning that all role person ids are used.
     * @returns The filtered role person ids.
     */
    protected async filterRolePersonIdsToShare(filterRolePersonIds: SHA256IdHash<Person>[] | undefined, forceFilteredRolePersonIdsPropagate: boolean = false): Promise<SHA256IdHash<Person>[]> {
        const myIndentity = await this.leuteModel.myMainIdentity();
        const allRolePersonIds = await this.getRolePersonIds();
        const rolePersonIds = this.certificateRoleConfig.propagateInstanceToEveryone ? allRolePersonIds : allRolePersonIds.includes(myIndentity) ? [myIndentity] : [];
        if (filterRolePersonIds === undefined) {
            return rolePersonIds;
        }

        if (forceFilteredRolePersonIdsPropagate) {
            return allRolePersonIds.filter((id) => filterRolePersonIds.includes(id));
        }
        return rolePersonIds.filter((id) => filterRolePersonIds.includes(id));
    }

    /**
     * Shares the role data with new instances.
     */
    protected shareWithNewInstances(): void {
        if (this.roleDataSharingDisconnectListener !== undefined) {
            // do not share with new instances if already listening
            return;
        }

        MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - shareWithNewInstances - start listening`);
        this.roleDataSharingDisconnectListener = this.leuteModel.onNewOneInstanceEndpoint(async (i) => {
            const rolePersonIds = await this.getRolePersonIds();
            if (rolePersonIds.length === 0) {
                // no role person/s to share
                return;
            }

            MessageBus.send(
                'debug',
                `CertificateRoleModel - ${this.getRoleName()} - shareWithNewInstances - share with instance`,
                i
            );

            await this.sharePersons({
                shareWith: [i.personId]
            });
        });
    }

    /**
     * Shares the persons with the others.
     * @param options.filterRolePersonIds - The role person ids to filter. Default is undefined. Meaning that all role person ids are used.
     * @param options.shareWith - The others to share with. Default is undefined. Meaning that the data is shared with all persons that are not a role person.
     * @param options.forceFilteredRolePersonIdsPropagate - Whether to force the filtered role person ids to propagate. Default is false.
    */
    protected async sharePersons(options: {filterRolePersonIds?: SHA256IdHash<Person>[], shareWith?: SHA256IdHash<Person>[], forceFilteredRolePersonIdsPropagate?: boolean} = {}): Promise<void> {
        const rolePersonIds = await this.filterRolePersonIdsToShare(options.filterRolePersonIds, options.forceFilteredRolePersonIdsPropagate);
        if (rolePersonIds.length === 0) {
            // no role person/s to share
            MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - sharePersons - no role person/s to share`, {options});
            return;
        }

        const others = await this.filterPersonIdsToShareWith(options.shareWith);
        if (others.length === 0) {
            // no one to share with
            MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - sharePersons - no one to share with`, {rolePersonIds, options});
            return;
        }

        MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - sharePersons`, {rolePersonIds, others});

        for (const personId of rolePersonIds) {
            // share person
            const profile = await this.leuteModel.getMainProfile(personId);
            await createAccess([
                {
                    id: profile.idHash,
                    person: others,
                    group: [],
                    mode: SET_ACCESS_MODE.ADD
                }
            ]);

            const signatureHashes = await this.getSignatureHashes(personId);
            MessageBus.send('debug', `CertificateRoleModel - ${this.getRoleName()} - sharePersons - share signature hashes`, {personId, others, signatureHashes});
            if (signatureHashes !== undefined) {
                for (const signatureHash of signatureHashes) {
                    await createAccess([
                        {
                            object: signatureHash,
                            person: others,
                            group: [],
                            mode: SET_ACCESS_MODE.ADD
                        }
                    ]);
                }
            }
            await this.shareIssuers(personId, others.filter(p => p !== personId));
        }
    }

    /**
     * Filters the others.
     * @param personId - The person id to filter.
     * @returns True if the person should be shared with, false otherwise.
     */
    protected async notRolePersonOrDisabledPersonId(personId: SHA256IdHash<Person>): Promise<boolean> {
        if ((await this.getRolePersonIds()).includes(personId)) {
            // do not share with the role person itself
            return false;
        }
        return (this.certificateRoleConfig.filterSharedWith ?? (() => true))(personId);
    }
}
