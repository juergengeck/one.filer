import type { Person, OneObjectTypes } from '@refinio/one.core/lib/recipes.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import { createMessageBus } from '@refinio/one.core/lib/message-bus.js';
import type { UnversionedObjectResult } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import type { OneCertificateInterfaces } from '@OneObjectInterfaces';

import type { LeuteModel } from '../index.js';
import CertificateRoleModel from './CertificateRoleModel.js';
import type { CertificateRoleConfig } from './CertificateRoleModel.js';
import type Role from './Role.js';
import type { RelationCertificate } from '../../recipes/Certificates/RelationCertificate.js';
import type { CertificateData } from '../Leute/TrustedKeysManager.js';
import type { License } from '../../recipes/Certificates/License.js';
import type { Signature } from '../../recipes/SignatureRecipes.js';

const MessageBus = createMessageBus('RoleModels');

/**
 * Config for the RelationRoleModel
 * missing issuers meen we do not validate the issuer of the certificate
 */
export type RelationRoleConfig = {
    issuers?: Role[];
    issuerPersonKey?: 'person1' | 'person2';
    rolePersonKey?: 'person1' | 'person2';
}
export const DEFAULT_ISSUER_PERSON_KEY = 'person2';
export const DEFAULT_ROLE_PERSON_KEY = 'person1';

/**
 * Application of CertificateRoleModel for relation certificates.
 */
export default abstract class RelationRoleModel extends CertificateRoleModel {
    protected issuerPersonKey: 'person1' | 'person2';
    protected rolePersonKey: 'person1' | 'person2';
    protected roleApp: string;
    protected roleRelation: string;

    /**
     * Constructor for the RelationRoleModel
     * @param leuteModel - The leute model
     * @param roleApp - The app of the role
     * @param roleRelation - The relation of the role
     * @param config - The config of the role
     */
    constructor(leuteModel: LeuteModel, roleApp: string, roleRelation: string, config?: CertificateRoleConfig & RelationRoleConfig) {
        super(leuteModel, config?.issuers ?? [], config);
        this.issuerPersonKey = config?.issuerPersonKey ?? DEFAULT_ISSUER_PERSON_KEY;
        this.rolePersonKey = config?.rolePersonKey ?? DEFAULT_ROLE_PERSON_KEY;
        this.roleApp = roleApp;
        this.roleRelation = roleRelation;
    }

    /**
     * Get the person id from the role certificate
     * @param data - The role certificate
     * @returns The person id
     */
    public async getPersonIdFromRoleCertificate(
        data: OneObjectTypes
    ): Promise<SHA256IdHash<Person> | undefined> {
        /**
         * NOTE: This could be called to get the personId from the role certificate, so that he can become the role person.
         *       Do not use methods/code to check if the personId is a role person from the group or role personIds array, most likely he is not, at this point.
         */
        if (
            data.$type$ === 'RelationCertificate' &&
            data.relation === this.roleRelation &&
            data.app === this.roleApp &&
            (await this.isIssuer(data[this.issuerPersonKey]))
        ) {
            return data[this.rolePersonKey];
        }

        return undefined;
    }

    /**
     * Get the issuer person ids from the role certificate
     * @param rolePersonId - The role person id
     * @returns The issuer person ids
     */
    public async getIssuerPersonIdsFromRoleCertificate(
        rolePersonId: SHA256IdHash<Person>
    ): Promise<SHA256IdHash<Person>[]> {
        const certificates = await this.getCertificates(rolePersonId);
        const issuers: SHA256IdHash<Person>[] = certificates.map(
            certificate => certificate.certificate[this.issuerPersonKey]
        );
        return issuers;
    }

    /**
     * Get the certificates for a person
     * @param personId - The person id
     * @returns The certificates
     */
    public async getCertificates(
        personId: SHA256IdHash<Person>
    ): Promise<CertificateData<RelationCertificate>[]> {
        const allCertificates = await this.leuteModel.trust.getCertificatesOfType(
            personId,
            'RelationCertificate'
        );

        const certificates: CertificateData<RelationCertificate>[] = [];
        for (const certificate of allCertificates) {
            if (await this.isRoleCertificate(certificate.certificate, personId)) {
                certificates.push(certificate);
            }
        }
        return certificates;
    }

    /**
     * Check if the certificate is a role relation certificate
     * @param data - The certificate
     * @param rolePersonId - The role person id
     * @returns True if the certificate is a role relation certificate, false otherwise
     */
    public async isRoleCertificate(
        data: OneObjectTypes,
        rolePersonId?: SHA256IdHash<Person>
    ): Promise<boolean> {
        if (data.$type$ !== 'RelationCertificate') {
            return false;
        }

        if (data.app !== this.roleApp) {
            return false;
        }

        if (data.relation !== this.roleRelation) {
            return false;
        }

        let correctIssuer = false;
        for (const issuer of this.issuers) {
            if (await issuer.isRolePerson(data[this.issuerPersonKey])) {
                correctIssuer = true;
            }
        }

        if (!correctIssuer) {
            return false;
        }

        if (rolePersonId !== undefined) {
            return data[this.rolePersonKey] === rolePersonId;
        }

        const personIds = await this.getRolePersonIds();

        return personIds.includes(data[this.rolePersonKey]);
    }

    /**
     * Create a certificate
     * @param personId - The person Id
     * @param issuerId - The issuer id
     * @returns The certificate
     */
    public async createCertificate(
        personId: SHA256IdHash<Person>,
        issuerId?: SHA256IdHash<Person>
    ): Promise<{
        license: UnversionedObjectResult<License>;
        certificate: UnversionedObjectResult<OneCertificateInterfaces['RelationCertificate']>;
        signature: UnversionedObjectResult<Signature>;
    }> {
        MessageBus.send('debug', `RelationRoleModel - ${this.getRoleName()} - createRelationCertificate - start`);

        if (issuerId === undefined) {
            MessageBus.send('debug', `RelationRoleModel - ${this.getRoleName()} - createRelationCertificate - no issuer id set, using myMainIdentity as issuer`);
            issuerId = await this.leuteModel.myMainIdentity();
        }

        let correctIssuer = false;
        for (const issuer of this.issuers) {
            if (await issuer.isRolePerson(issuerId)) {
                correctIssuer = true;
                // to keep the certificate chain, the issuer must be propagated to the personId
                await issuer.shareWith([personId], {rolePersonId: issuerId, forcePropagate: true});
                MessageBus.send('debug', `RelationRoleModel - ${this.getRoleName()} - createRelationCertificate - shared issuer ${issuerId} with ${personId}`);
            }
        }

        if (this.issuers.length > 0 && !correctIssuer) {
            MessageBus.send('debug', `RelationRoleModel - ${this.getRoleName()} - createRelationCertificate - issuer of certificates is not a valid role person`);
            throw new Error('Issuer of certificates is not a valid role person');
        }

        if (this.issuers.length === 0) {
            MessageBus.send('debug', `RelationRoleModel - ${this.getRoleName()} - createRelationCertificate - no issuers set, so no checks and sharing will be done`);
        }

        return await this.leuteModel.trust.certify(
            'RelationCertificate',
            {
                [this.issuerPersonKey]: issuerId,
                [this.rolePersonKey]: personId,
                app: this.roleApp,
                relation: this.roleRelation
            } as Omit<RelationCertificate, 'license' | '$type$'>, // needed because of the dynamic cast of attributes for issuer and rolePerson
            issuerId
        );
    }

    /**
     * Get the issuer person id from the role certificate
     * @param data - The role certificate
     * @returns The issuer person id
     */
    public async getIssuerPersonIdFromRoleCertificate(
        data: OneObjectTypes
    ): Promise<SHA256IdHash<Person> | undefined> {
        if (data.$type$ === 'RelationCertificate' && await this.isRoleCertificate(data)) {
            return data[this.issuerPersonKey];
        }

        return undefined;
    }

}
