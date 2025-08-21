import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

import { OEvent } from '../../misc/OEvent.js';
import { StateMachine } from '../../misc/StateMachine.js';
import type LeuteModel from '../Leute/LeuteModel.js';

/**
 * Used in util functions to get the role name from a role class.
 */
export type StaticRoleModel<T extends Role = Role> = { new(...args: any[]): T, roleName: string }

/**
 * The config for the Role.
 */
export type RoleConfig = {
    canCreate?: (string | StaticRoleModel)[]
}

/**
 * Base class for all roles.
 *
 * This class is used to create a role.
 * Note: Each concrete role class must set the static roleName property.
 */
export default abstract class Role {
    public static roleName: string;

    public abstract isRolePerson(personId?: SHA256IdHash<Person>): Promise<boolean>;
    public abstract getRolePersonIds(): Promise<SHA256IdHash<Person>[]>;
    public abstract setRolePerson(personId: SHA256IdHash<Person>, creatorId?: SHA256IdHash<Person>): Promise<void>;
    public abstract shareWith(
        shareWithPersonIds: SHA256IdHash<Person>[],
        options: { rolePersonId?: SHA256IdHash<Person>, forcePropagate?: boolean }
    ): Promise<void>;

    public state: StateMachine<'Uninitialised' | 'Initialised', 'shutdown' | 'init'>;
    public onInitialised = new OEvent<() => void | Promise<void>>();

    /*************** Semi-abstracts ***************/

    // may not be implemented by all roles
    public async getIssuers(): Promise<Role[]> {
        return [];
    }

    // may not be implemented by all roles
    public async shareIssuers(rolePersonId: SHA256IdHash<Person>, shareWithPersonIds: SHA256IdHash<Person>[]): Promise<void> {
        return;
    }

    /*************** Non-abstracts ***************/

    protected leuteModel: LeuteModel;
    protected roleName: string;
    protected config: RoleConfig;

    public onFound = new OEvent<() => void | Promise<void>>();

    /**
     * Constructor for the CertificateRoleModel.
     * @param leuteModel - The leute model.
     * @param config.sharedWith - Whether the role is shared with others. Default is true.
     * @param config.trusted - Whether the role is trusted. Default is true.
     * @param config.roleGroupName - The role group name config. Default is undefined. Meaning that the role personIds is not saved in a group, but in memory.
     */
    constructor(leuteModel: LeuteModel, config: RoleConfig = {}) {
        const constructor = this.constructor as typeof Role;
        if (!constructor.roleName) {
            throw new Error(`${constructor.name} must set a static roleName property`);
        }
        this.config = config;
        this.roleName = constructor.roleName;
        this.leuteModel = leuteModel;
        this.state = new StateMachine<'Uninitialised' | 'Initialised', 'shutdown' | 'init'>();
        this.state.addState('Initialised');
        this.state.addState('Uninitialised');
        this.state.addEvent('init');
        this.state.addEvent('shutdown');
        this.state.addTransition('shutdown', 'Initialised', 'Uninitialised');
        this.state.addTransition('init', 'Uninitialised', 'Initialised');
        this.state.setInitialState('Uninitialised');
    }

    /**
     * Initializes the role model.
     * @returns A promise that resolves when the role model is initialised.
     */
    public async init(): Promise<void> {
        this.state.assertCurrentState('Uninitialised');
        this.state.triggerEvent('init');
        this.onInitialised.emit();
        return Promise.resolve();
    }

    /**
     * Shuts down the role model.
     * @returns A promise that resolves when the role model is shut down.
     */
    public async shutdown(): Promise<void> {
        this.state.assertCurrentState('Initialised');
        this.state.triggerEvent('shutdown');
        return Promise.resolve();
    }

    /**
     * Returns true if the role is initialised.
     * @returns True if the role is initialised, false otherwise.
     */
    public isInitialised(): boolean {
        return this.state.currentState === 'Initialised';
    }

    /**
     * Returns the name of the role.
     * @returns The name of the role.
     */
    public getRoleName(): string {
        return this.roleName;
    }

    /**
     * Checks if the data is affirmed by the role person ids.
     * @param data - The data to check.
     * @param byPersonId - The personId that should be trusting the data.
     * @returns True if the data is affirmed, false otherwise.
     */
    public async hasAffirmed(
        data: SHA256Hash | SHA256IdHash,
        byPersonId?: SHA256IdHash<Person>
    ): Promise<boolean> {
        const personIds = await this.getRolePersonIds();

        if (byPersonId !== undefined && !personIds.includes(byPersonId)) {
            // no such person in the affirmed role
            return false;
        }

        const certs = await this.leuteModel.trust.getCertificatesOfType(
            data,
            'AffirmationCertificate'
        );

        for (const cert of certs) {
            if (await this.hasSigned(cert.certificateHash, byPersonId)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checks if the data is signed by the role person ids.
     * @param data - The data to check.
     * @param byPersonId - The personId that should be signing the data.
     * @returns True if the data is signed, false otherwise.
     */
    public async hasSigned(data: SHA256Hash, byPersonId?: SHA256IdHash<Person>): Promise<boolean> {
        const personIds = await this.getRolePersonIds();

        if (personIds.length === 0) {
            // no role person ids found yet
            return false;
        }

        if (byPersonId !== undefined && !personIds.includes(byPersonId)) {
            // not the role person with the given personId
           return false;
        }

        for (const personId of personIds) {
            if (await this.leuteModel.trust.isSignedBy(data, personId)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checks if the role can be created.
     * @param role - The role name or static role class to check.
     * @returns True if the role can be created, false otherwise.
     */
    public canCreate(role: string | StaticRoleModel): Promise<boolean> | boolean {
        if (this.config.canCreate === undefined) {
            return false;
        }
        const roleName = typeof role === 'string' ? role : role.roleName;
        return this.config.canCreate.some(r => {
            if (typeof r === 'string') {
                return r === roleName;
            }
            return r.roleName === roleName;
        });
    }
}

