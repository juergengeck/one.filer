import type {Person} from '@refinio/one.core/lib/recipes.js';
import type {SHA256IdHash} from '@refinio/one.core/lib/util/type-checks.js';
import { isIdAccessibleBy } from '@refinio/one.core/lib/accessManager.js';
import {
    getObject,
    type UnversionedObjectResult
} from '@refinio/one.core/lib/storage-unversioned-objects.js';
import {SET_ACCESS_MODE} from '@refinio/one.core/lib/storage-base-common.js';
import {createAccess} from '@refinio/one.core/lib/access.js';
import { createMessageBus } from '@refinio/one.core/lib/message-bus.js';
import { calculateHashOfObj, calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';

import type LeuteModel from '../Leute/LeuteModel.js';
import Role from './Role.js';
import { getPersonIdsForRole, getRoleGroup } from './utils.js';
import { objectEvents } from '../../misc/ObjectEventDispatcher.js';
import type { Signature } from '../../recipes/SignatureRecipes.js';
import ProfileModel from '../Leute/ProfileModel.js';
import type { AffirmationCertificate } from '../../recipes/Certificates/AffirmationCertificate.js';
import type { OneInstanceEndpoint } from '../../recipes/Leute/CommunicationEndpoints.js';
import type { CertificateData } from '../Leute/TrustedKeysManager.js';
import type GroupModel from '../Leute/GroupModel.js';

const MessageBus = createMessageBus('RoleModels');

/**
 * The config for the AffirmedProfileRoleModel.
 */
type Config = {
    propagateInstanceToEveryone: boolean;
    filterSharedWith: ((personId: SHA256IdHash<Person>) => boolean);
    trusted: boolean | ((personId: SHA256IdHash<Person>) => boolean);
    roleGroupName: string | undefined;
};

function parseInitialConfig(affirmedProfileRoleConfig: Partial<Config>): Config {
    return {
        propagateInstanceToEveryone: false,
        filterSharedWith: () => true,
        trusted: true,
        roleGroupName: undefined,
        ...affirmedProfileRoleConfig
    }
}

/**
 * A model that represents an affirmed role.
 *
 * Note: Depends on the reverse maps of the LeuteModel to be able to find the someone from the personId and objectEvents to listen for new instances/signatures.
 */
export default abstract class AffirmedProfileRoleModel extends Role {

    /*************** Abstracts ***************/

    public abstract canCreate(roleName: string): Promise<boolean> | boolean;
    public abstract setRolePerson(personId: SHA256IdHash<Person>, creatorId?: SHA256IdHash<Person>): Promise<void>;

    /*************** Semi-abstracts ***************/

    // implement differently to change the way the role is determined
    protected async additionalRoleCheck(personId: SHA256IdHash<Person>): Promise<boolean> {
        return Promise.resolve(true);
    }


    /*************** Non-abstracts ***************/

    protected issuers: Role[];
    protected affirmedRolePersonIds: SHA256IdHash<Person>[];
    protected affirmedRoleGroupPersonIds: GroupModel | undefined;
    protected affirmedProfileRoleConfig: Config;
    protected processNewRoleDisconnectListeners: Array<() => void>;
    protected roleDataSharingDisconnectListener: (() => void) | undefined;

    /**
     * Constructor for the AffirmedProfileRoleModel.
     * @param leuteModel - The leute model.
     * @param affirmationRole - The affirmation role.
     * @param config.filterSharedWith - The filterSharedWith config. Default is true.
     * @param config.trusted - The trusted config. Default is true.
     * @param config.roleGroupName - The role group name config. Default is undefined. Meaning that the role personIds is not saved in a group, but in memory.
     * @param config.propagateInstanceToEveryone - If true, the role will be shared with everyone, not only with role`s connected instances. Default is false.
     */
    constructor(
        leuteModel: LeuteModel,
        issuers: Role[],
        config: Partial<Config> = {}
    ) {
        super(leuteModel);
        this.affirmedProfileRoleConfig = parseInitialConfig(config);
        this.issuers = issuers;
        this.affirmedRolePersonIds = [];
        this.processNewRoleDisconnectListeners = [];

        for (const issuer of this.issuers) {
            issuer.onFound(async () => {
                MessageBus.send('debug', `AffirmedProfileRoleModel - ${this.getRoleName()} onFound issuers listener - start`);
                // sync role person ids with possible new persons ids
                await this.addAffirmedRolePersonIds(
                    await getPersonIdsForRole(this.leuteModel, async (rolePersonId: SHA256IdHash<Person>) => (await this.getAffirmedProfiles(rolePersonId)).length > 0 && await this.additionalRoleCheck(rolePersonId))
                );
            })
        }

        this.leuteModel.onNewOneInstanceEndpoint(async (i) => {
            const rolePersonIds = await this.getRolePersonIds();
            if (rolePersonIds.length === 0) {
                // no role person/s to share
                return;
            }

            MessageBus.send(
                'debug',
                `AffirmedProfileRoleModel - ${this.getRoleName()} - shareWithNewInstances listener - share with instance`,
                i.personId
            );

            await this.shareWithInstances([i.personId]);
        })

        this.onFound(this.shareWithInstances.bind(this));
    }

    /**
     * Initializes the AffirmedProfileRoleModel.
     */
    public async init(): Promise<void> {
        await super.init();
        this.processNewTrustedRolePersons();
    }

    /**
     * Shuts down the AffirmedProfileRoleModel.
     */
    public async shutdown(): Promise<void> {
        for (const processNewRoleDisconnectListener of this.processNewRoleDisconnectListeners) {
            processNewRoleDisconnectListener();
        }
        this.processNewRoleDisconnectListeners = [];

        if (this.roleDataSharingDisconnectListener !== undefined) {
            this.roleDataSharingDisconnectListener();
        }
        this.roleDataSharingDisconnectListener = undefined;
        await super.shutdown();
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
     * Returns the role person ids.
     * @returns The role person ids.
     */
    public async getRolePersonIds(): Promise<SHA256IdHash<Person>[]> {
        if (this.affirmedProfileRoleConfig.roleGroupName === undefined) {
            return this.affirmedRolePersonIds;
        }
        if (this.affirmedRoleGroupPersonIds === undefined) {
            this.affirmedRoleGroupPersonIds = await getRoleGroup(this.affirmedProfileRoleConfig.roleGroupName);
        }
        return this.affirmedRoleGroupPersonIds.persons;
    }

    /**
     * Shares the role data with the others.
     * @param shareWithPersonIds - The person ids to share with.
     * @param options.rolePersonId - The role person id. Default is the current person.
     * @param options.forcePropagate - Whether to force the propagation of options.rolePersonId. Default is false.
     */
    public async shareWith(shareWithPersonIds: SHA256IdHash<Person>[], options: {rolePersonId?: SHA256IdHash<Person>, forcePropagate?: boolean} = {}): Promise<void> {
        await this.shareAffirmedProfile(options.rolePersonId ?? (await this.leuteModel.myMainIdentity()), shareWithPersonIds);
    }

    /**
     * Get the issuer person ids from the role certificate
     * @param rolePersonId - The role person id
     * @returns The issuer person ids
     */
    public async getIssuerPersonIdsFromRoleCertificate(
        rolePersonId: SHA256IdHash<Person>
    ): Promise<SHA256IdHash<Person>[]> {

        const allCertificates = await this.leuteModel.trust.getCertificatesOfType(
            rolePersonId,
            'AffirmationCertificate'
        );

        const roleCertificateIssuerPersonIds: SHA256IdHash<Person>[] = [];
        for (const certificate of allCertificates) {
            const certData = await calculateHashOfObj(certificate.certificate);
            for (const issuer of this.issuers) {
                const issuerPersonIds = await issuer.getRolePersonIds();
                for (const issuerPersonId of issuerPersonIds) {
                    if (await this.leuteModel.trust.isSignedBy(certData, issuerPersonId)) {
                        roleCertificateIssuerPersonIds.push(issuerPersonId);
                    }
                }
            }
        }

        return roleCertificateIssuerPersonIds;
    }

    /**
     * Get the certificates for a person
     * @param personId - The person id
     * @returns The certificates
     */
    public async getCertificates(
        personId: SHA256IdHash<Person>
    ): Promise<CertificateData<AffirmationCertificate>[]> {
        const allCertificates = await this.leuteModel.trust.getCertificatesOfType(
            personId,
            'AffirmationCertificate'
        );

        const certificates: CertificateData<AffirmationCertificate>[] = [];
        for (const certificate of allCertificates) {
            for (const issuer of this.issuers) {
                if (await issuer.hasSigned(await calculateHashOfObj(certificate.certificate))) {
                    certificates.push(certificate);
                }
            }
        }

        return certificates;
    }

    /** ***** protected ***** **/

    /**
     * Processes new trusted role persons.
     * @returns The role person ids.
     */
    protected processNewTrustedRolePersons(): void {
        if (this.processNewRoleDisconnectListeners.length > 0) {
            return;
        }
        MessageBus.send('debug', `AffirmedProfileRoleModel - ${this.getRoleName()} - processNewTrustedRolePersons - start`);

        // check new AffirmationCertificate objects
        this.processNewRoleDisconnectListeners.push(
            objectEvents.onUnversionedObject(
                this.checkForSignature.bind(this),
                `AffirmedProfileRoleModel - ${this.getRoleName()} - process new trusted role persons`,
                'Signature'
            )
        );

        this.processNewRoleDisconnectListeners.push(
            this.leuteModel.onNewOneInstanceEndpoint(async (endpoint: OneInstanceEndpoint) => {
                if ((await this.getAffirmedProfiles(endpoint.personId)).length === 0 || !await this.additionalRoleCheck(endpoint.personId)) {
                    return;
                }

                await this.addAffirmedRolePersonIds([endpoint.personId]);
            })
        );
    }

    /**
     * Adds the person ids to the role person ids or group.
     * @param personIds - The person ids to add.
     * @returns True if new person ids were added, false otherwise.
     */
    protected async addAffirmedRolePersonIds(personIds: Array<SHA256IdHash<Person>>): Promise<boolean> {
        if (personIds.length === 0) {
            MessageBus.send(
                'debug',
                `AffirmedProfileRoleModel - ${this.getRoleName()} - addAffirmedRolePersonIds - no person ids to add`
            );
            return false;
        }
        MessageBus.send(
            'debug',
            `AffirmedProfileRoleModel - ${this.getRoleName()} - addAffirmedRolePersonIds`,
            personIds
        );
        if (this.affirmedProfileRoleConfig.roleGroupName === undefined) {
            return this.addToRolePersonIds(personIds);
        }
        return this.addToGroup(personIds);
    }

    /**
     * Adds the person ids to the role person ids.
     * @throws Error if role group name is defined. use this.addAffirmedRolePersonIds to avoid this.
     * @param personIds - The person ids to add.
     * @returns True if new person ids were added, false otherwise.
     */
    protected async addToRolePersonIds(personIds: Array<SHA256IdHash<Person>>): Promise<boolean> {
        if (this.affirmedProfileRoleConfig.roleGroupName !== undefined) {
            throw new Error('Role group name is defined, use addToGroup instead');
        }

        const me = await this.leuteModel.me();
        const myIndentitis = me.identities();
        let addedNew = false;
        let addedNewTrust = false;

        for (const personId of personIds) {
            if (this.affirmedRolePersonIds.includes(personId)) {
                continue;
            }

            if (!myIndentitis.includes(personId) && (this.affirmedProfileRoleConfig.trusted === true || typeof this.affirmedProfileRoleConfig.trusted === 'function' && this.affirmedProfileRoleConfig.trusted(personId))) {
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

            MessageBus.send('debug', `AffirmedProfileRoleModel - ${this.getRoleName()} - addToRolePersonIds`, personId);
            this.affirmedRolePersonIds.push(personId);
            addedNew = true;
        }

        if (addedNewTrust) {
            // Just a hack until we have a better way of refresh
            await this.leuteModel.trust.refreshCaches();
        }

        if (addedNew) {
            MessageBus.send('debug', `AffirmedProfileRoleModel - ${this.getRoleName()} - addToRolePersonIds - emit`);
            this.onFound.emit();
        }

        return addedNew;
    }

    /**
     * Adds the person ids to the group.
     * @throws Error if role group name is undefined. use this.addAffirmedRolePersonIds to avoid this.
     * @param personIds - The person ids to add.
     * @returns True if new person ids were added, false otherwise.
     */
    protected async addToGroup(personIds: Array<SHA256IdHash<Person>>): Promise<boolean> {
        if (this.affirmedProfileRoleConfig.roleGroupName === undefined) {
            throw new Error('Role group name is undefined, use addToRolePersonIds instead');
        }

        const Group = await getRoleGroup(this.affirmedProfileRoleConfig.roleGroupName);
        const me = await this.leuteModel.me();
        const myIndentitis = me.identities();
        let addedNew = false;
        let addedNewTrust = false;

        for (const personId of personIds) {
            if (Group.persons.includes(personId)) {
                continue;
            }

            if (!myIndentitis.includes(personId) && (this.affirmedProfileRoleConfig.trusted === true || typeof this.affirmedProfileRoleConfig.trusted === 'function' && this.affirmedProfileRoleConfig.trusted(personId))) {
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

            MessageBus.send('debug', `AffirmedProfileRoleModel - ${this.getRoleName()} - addToGroup`, personId);
            Group.persons.push(personId);
            addedNew = true;
        }

        if (addedNewTrust) {
            // Just a hack until we have a better way of refreshing the trust caches
            // so we only do it if we actually have to, as it has a performance impact
            await this.leuteModel.trust.refreshCaches();
        }

        if (addedNew) {
            MessageBus.send('debug', `AffirmedProfileRoleModel - ${this.getRoleName()} - addToGroup - emit`);
            await Group.saveAndLoad();
            this.onFound.emit();
        }

        return addedNew;
    }

    /**
     * Checks for a signature.
     * @param signatureResult - The signature result.
     */
    protected async checkForSignature(
        signatureResult: UnversionedObjectResult<Signature>
    ): Promise<void> {
        const affirmationCertificate = await getObject(signatureResult.obj.data);

        if (affirmationCertificate.$type$ !== 'AffirmationCertificate') {
            MessageBus.send(
                'debug',
                `AffirmedProfileRoleModel - ${this.getRoleName()} - processNew - signature listener - not affirmation cert`,
                affirmationCertificate
            );
            return;
        }

        const certHash = await calculateHashOfObj(affirmationCertificate);
        let isSigned = false;
        for (const issuer of this.issuers) {
            if (await issuer.hasSigned(certHash)) {
                isSigned = true;
                break;
            }
        }

        if (isSigned) {
            try {
                const data = await getObject(affirmationCertificate.data);

                if (data.$type$ === 'Profile') {
                    const profileModel = await ProfileModel.constructFromLatestVersion(await calculateIdHashOfObj(data));
                    await this.addAffirmedRolePersonIds([profileModel.personId]);
                }
            } catch (_e) {
                // catches cases where we have not received role person profile
                // see other processNewRolePersonDisconnectListeners
                // that handle the new profile case
                MessageBus.send(
                    'debug',
                    `AffirmedProfileRoleModel - ${this.getRoleName()} - checkForignature - no role person someone (yet?)`,
                    affirmationCertificate
                );
            }
        }
    }

    /**
     * Checks if the person has an affirmed profile.
     * @param personId - The person id to check.
     * @returns True if the person has an affirmed profile, false otherwise.
     */
    protected async getAffirmedProfiles(personId: SHA256IdHash<Person>): Promise<ProfileModel[]> {
        const someone = await this.leuteModel.getSomeone(personId);

        if (someone === undefined) {
            // typescript lint avoidance, should not happen
            // if this happens, than the reverse maps are not working correctly
            // and leuteModel.getSomeone can not find the someone from the personId
            throw new Error(
                `AffirmedProfileRoleModel - getAffirmedProfiles - someone not found in Leute Model ${personId}`
            );
        }

        const affirmedProfiles: ProfileModel[] = [];
        for (const profile of await someone.profiles()) {
            if (profile.loadedVersion === undefined) {
                // typescript lint avoidance, should not happen
                throw new Error(
                    `Profile id does not have a loaded version ${profile.idHash}`
                );
            }

            for (const issuer of this.issuers) {
                if (await issuer.hasAffirmed(profile.loadedVersion)) {
                    affirmedProfiles.push(profile);
                    break;
                }
            }
        }

        return affirmedProfiles;
    }

    /**
     * Shares the role data with the current instances.
     * @param shareWith - The person ids to share with. Default is undefined.
     */
    protected async shareWithInstances(shareWith: SHA256IdHash<Person>[] | undefined = undefined): Promise<void> {
        const myIndentity = await this.leuteModel.myMainIdentity();
        const allRolePersonIds = await this.getRolePersonIds();
        const rolePersonIds = this.affirmedProfileRoleConfig.propagateInstanceToEveryone ? allRolePersonIds : allRolePersonIds.includes(myIndentity) ? [myIndentity] : [];

        if (rolePersonIds.length === 0) {
            // no role person/s to share
            return;
        }

        const allOthers = await getPersonIdsForRole(this.leuteModel, this.notRolePersonOrAffirmationRolePerson.bind(this));
        const others = allOthers.filter(id => this.affirmedProfileRoleConfig.filterSharedWith(id) && (shareWith === undefined || shareWith.includes(id)));


        if (others.length === 0) {
            // no one to share with
            return;
        }

        MessageBus.send(
            'debug',
            `AffirmedProfileRoleModel - ${this.getRoleName()} - shareAffirmedProfile`
        );

        for (const rolePersonId of rolePersonIds) {
            await this.shareAffirmedProfile(rolePersonId, others);
        }
    }

    /**
     * Shares the affirmed profile with the others.
     * @param rolePersonId - The role person id.
     * @param others - The others to share with.
     * @param forcePropagate - Whether to force the propagation. Default is false.
     */
    protected async shareAffirmedProfile(rolePersonId: SHA256IdHash<Person>, others: SHA256IdHash<Person>[]): Promise<void> {
        if (others.length === 0) {
            // no one to share with
            return;
        }

        const someone = await this.leuteModel.getSomeone(rolePersonId);
        if (someone === undefined) {
            // typescript lint avoidance, should not happen
            // if this happens, than the reverse maps are not working correctly
            // and leuteModel.getSomeone can not find the someone from the personId
            throw new Error(`Could not find someone with personId ${rolePersonId}`);
        }

        for (const profile of await someone.profiles()) {
            if (profile.loadedVersion === undefined) {
                // typescript lint avoidance, should not happen
                throw new Error(
                    `Profile of person id ${rolePersonId} profile id ${profile.idHash} has no loaded version`
                );
            }

            const affirmationCertificates =
                await this.leuteModel.trust.getCertificatesOfType(
                    profile.loadedVersion,
                    'AffirmationCertificate'
                );

            const sharedCerts: CertificateData<AffirmationCertificate>[] = [];

            for (const affirmationCertificate of affirmationCertificates) {
                for (const issuer of this.issuers) {
                    if (await issuer.hasSigned(affirmationCertificate.certificateHash)) {
                        sharedCerts.push(affirmationCertificate);
                    }
                }
            }

            if (sharedCerts.length === 0) {
                // Profile of Role Person does not contain an affirmation certificate
                continue;
            }

            // share profile
            await createAccess([
                {
                    id: profile.idHash,
                    person: others,
                    group: [],
                    mode: SET_ACCESS_MODE.ADD
                }
            ]);

            for (const sharedCert of sharedCerts) {
                // share signature
                await createAccess([
                    {
                        object: sharedCert.signatureHash,
                        person: others,
                        group: [],
                        mode: SET_ACCESS_MODE.ADD
                    }
                ]);
            }
        }

        await this.filteredShareIssues(rolePersonId, others.filter(p => p !== rolePersonId));
    }

    /**
     * Filters the others.
     * @param personId - The person id to filter.
     * @param others - The others to filter.
     */
    protected async filteredShareIssues(personId: SHA256IdHash<Person>, others: SHA256IdHash<Person>[]): Promise<void> {
        const filteredOthers = [];
        for (const p of others) {
            if (!await isIdAccessibleBy(p, personId)) {
                filteredOthers.push(p);
            }
        }
        if (filteredOthers.length > 0) {
            await this.shareIssuers(personId, filteredOthers);
        }
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
        for (const certificateIssuerId of await this.getIssuerPersonIdsFromRoleCertificate(rolePersonId)) {
            for (const issuer of this.issuers) {
                if (await issuer.isRolePerson(certificateIssuerId)) {
                    await issuer.shareWith(shareWithPersonIds, {rolePersonId: certificateIssuerId, forcePropagate: true});
                }
            }
        }
    }

    /**
     * Filters the others.
     * @param personId - The person id to filter.
     * @returns True if the person should be shared with, false otherwise.
     */
    protected async notRolePersonOrAffirmationRolePerson(personId: SHA256IdHash<Person>): Promise<boolean> {
        if ((await this.getRolePersonIds()).includes(personId)) {
            // do not share with the role person itself
            return false;
        } else {
            for (const issuer of this.issuers) {
                if ((await issuer.getRolePersonIds()).includes(personId)) {
                    // do not share with the affirmation role persons
                    return false;
                }
            }
        }
        // see if the filterSharedWith function returns true
        return this.affirmedProfileRoleConfig.filterSharedWith(personId);
    }
}
