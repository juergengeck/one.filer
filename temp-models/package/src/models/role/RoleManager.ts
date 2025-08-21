import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

import type LeuteModel from '../Leute/LeuteModel.js';
import type Role from './Role.js';
import { OEvent } from '../../misc/OEvent.js';
import { createMessageBus } from '@refinio/one.core/lib/message-bus.js';
import type { StaticRoleModel } from './Role.js';

const MessageBus = createMessageBus('RoleModels');

/**
 * The RoleManager class is responsible for managing the roles of the current main identity.
 */
export default class RoleManager {

    public onCurrentPersonRoleChange: OEvent<(roles: Role[]) => void>;
    public onRoleFound: OEvent<() => void>;

    private readonly roles: Role[];
    private readonly leuteModel: LeuteModel;
    private myMainIdentity: SHA256IdHash<Person> | undefined;
    private disconnectListeners: (() => void)[];
    // undefined if the roles are not loaded yet
    private currentPersonRoles: Role[] | undefined;
    private creatableRoleIndexes: Set<number>;

    /**
     * Constructor for the RoleManager class.
     * @param leuteModel - The LeuteModel instance.
     * @param roles - The roles to be managed.
     */
    constructor(leuteModel: LeuteModel, roles: Role[]) {
        this.leuteModel = leuteModel;
        this.roles = roles;
        this.disconnectListeners = [];
        this.currentPersonRoles = undefined;
        this.onCurrentPersonRoleChange = new OEvent<(roles: Role[]) => void>();
        this.onRoleFound = new OEvent<() => void>();
        // Create a list of roles that can be created from other roles.
        this.creatableRoleIndexes = new Set<number>();
        for (const role of this.roles) {
            for (const role2 of this.roles) {
                if (role.canCreate(role2.getRoleName())) {
                    this.creatableRoleIndexes.add(this.roles.indexOf(role2));
                }
            }
        }
        this.leuteModel.onMeIdentitiesChange(this.loadCurrentPersonDataChange.bind(this));
        for (const role of this.roles) {
            role.onFound(async () => {
                const oldCurrentRoleNames = this.currentPersonRoles?.map(r => r.getRoleName());
                const currentRoles = await this.updateCurrentPersonRoles();
                if (currentRoles !== undefined && (oldCurrentRoleNames === undefined || JSON.stringify(oldCurrentRoleNames.sort()) !== JSON.stringify(currentRoles.map(r => r.getRoleName()).sort()))) {
                    this.onCurrentPersonRoleChange.emit(currentRoles);
                }
                this.onRoleFound.emit();
            });
            role.onInitialised(async () => {
                await this.loadCurrentPersonDataChange();
            });
        }
    }

    /**
     * Initializes the role manager.
     * @returns A promise that resolves when the role manager is initialised.
     */
    public async init(): Promise<void> {
        await this.loadCurrentPersonDataChange();
    }

    /**
     * Shuts down the role manager.
     */
    public async shutdown(): Promise<void> {
        for (const listener of this.disconnectListeners) {
            listener();
        }
        this.disconnectListeners = [];
    }

    /**
     * Returns true if the current main identity has the role.
     * @param role - The role, role name or array of those to check.
     * @returns True if the current main identity has the role, false otherwise.
     */
    public isCurrentPersonRole(role: Role | string | (Role | string)[]): boolean {
        if (this.currentPersonRoles === undefined) {
            return false;
        }

        if (Array.isArray(role)) {
            return role.some(r => this.isCurrentPersonRole(r));
        } else if (typeof role === 'string') {
            return this.currentPersonRoles.some(r => r.getRoleName() === role);
        } else {
            return this.currentPersonRoles.includes(role);
        }
    }

    /**
     * Returns
     *  - The roles that are currently available for the current main identity.
     *  - Undefined if the roles are not initialised yet.
     * @returns
     */
    public getCurrentPersonRoles(): Role[] | undefined {
        if (this.roles.find(r => !r.isInitialised())) {
            return undefined;
        }
        return this.currentPersonRoles;
    }

    /**
     * Returns the role names that are currently available for the current main identity.
     * @returns The role names that are currently available for the current main identity.
     */
    public getCurrentPersonRoleNames(): string[] {
        if (this.currentPersonRoles === undefined) {
            return [];
        }
        return this.currentPersonRoles.map(r => r.getRoleName());
    }

    /**
     * Returns the creatable roles for the current main identity.
     * @returns The creatable roles for the current main identity.
     */
    public getCurrentPersonCreatableRoles(): Role[] {
        if (this.currentPersonRoles === undefined) {
            return [];
        }

        const creatableRoles: Role[] = [];
        const addedRoleNames = new Set<string>();

        for (const cRole of this.currentPersonRoles) {
            for (const creatableRoleIndex of this.creatableRoleIndexes) {
                if (cRole.canCreate(this.roles[creatableRoleIndex].getRoleName()) && !addedRoleNames.has(this.roles[creatableRoleIndex].getRoleName())) {
                    creatableRoles.push(this.roles[creatableRoleIndex]);
                    addedRoleNames.add(this.roles[creatableRoleIndex].getRoleName());
                }
            }
        }

        return creatableRoles;
    }

    /**
     * Returns true if the current main identity can create the given role.
     * @param role - The role to check.
     * @returns True if the current main identity can create the given role, false otherwise.
     */
    public isCurrentPersonCreatableRole(role: Role | string | (Role | string)[]): boolean {
        if (Array.isArray(role)) {
            return role.every(r => this.isCurrentPersonCreatableRole(r));
        }

        const currentPersonCreatableRoles = this.getCurrentPersonCreatableRoles();
        if (typeof role === 'string') {
            return currentPersonCreatableRoles.some(r => r.getRoleName() === role);
        }

        return currentPersonCreatableRoles.some(r => r.getRoleName() === role.getRoleName());
    }

    /**
     * Returns the roles that are available.
     * @returns The roles that are available.
     */
    public getAllRoles(): Role[] {
        return this.roles;
    }

    /**
     * Returns the role that is available.
     * @param role - The role name or class constructor to get.
     * @returns The role that is available.
     */
    public getRole<T extends Role>(role: string | StaticRoleModel<T>): T | undefined {
        const roleName = typeof role === 'string' ? role : role.roleName;
        return this.roles.find(r => r.getRoleName() === roleName) as T | undefined;
    }

    /**
     * Returns the roles that are available.
     * @param roles - The roles to get.
     * @returns The roles that are available.
     */
    public getRoles(roles: string[]): Role[] {
        return this.roles.filter(r => roles.includes(r.getRoleName()));
    }

    /**
     * Returns the role names that are available.
     * @returns The role names that are available.
     */
    public getAllRoleNames(): string[] {
        return this.roles.map(r => r.getRoleName());
    }

    /**
     * Returns the roles that can be created.
     * @returns The roles that can be created.
     */
    public getCreatableRoles(): Role[] {
        return this.roles.filter((_r, i) => this.creatableRoleIndexes.has(i));
    }

    /**
     * Returns true if the given role can be created.
     * @param role - The role to check.
     * @returns True if the given role can be created, false otherwise.
     */
    public isCreatableRole(role: Role | string | (Role | string)[]): boolean {
        if (Array.isArray(role)) {
            return role.every(r => this.isCreatableRole(r));
        } else if (typeof role === 'string') {
            return this.creatableRoleIndexes.has(this.roles.findIndex(r => r.getRoleName() === role));
        }
        return this.creatableRoleIndexes.has(this.roles.findIndex(r => r.getRoleName() === role.getRoleName()));
    }

    /**
     * Returns the roles that can be created for the given person.
     * @param person - The person to check.
     * @returns The roles that can be created for the given person.
     */
    public async getPersonCreatableRoles(person: SHA256IdHash<Person>): Promise<Role[]> {
        const personCreatableRoles: Role[] = [];
        for (const role of this.roles) {
            if (await role.isRolePerson(person) && await role.canCreate(person)) {
                personCreatableRoles.push(role);
            }
        }
        return personCreatableRoles;
    }

    /**
     * Returns true if the given person can create the given role.
     * @param person - The person to check.
     * @param role - The role to check.
     * @returns True if the given person can create the given role, false otherwise.
     */
    public async isPersonCreatableRole(person: SHA256IdHash<Person>, role: Role | string | (Role | string)[]): Promise<boolean> {
        if (Array.isArray(role)) {
            return role.every(r => this.isPersonCreatableRole(person, r));
        }

        const personCreatableRoles = await this.getPersonCreatableRoles(person);
        if (typeof role === 'string') {
            for (const r of personCreatableRoles) {
                if (await r.canCreate(role)) {
                    return true;
                }
            }
            return false;
        }

        return personCreatableRoles.some(r => r.getRoleName() === role.getRoleName());
    }

    /**
     * Returns the roles that are available for the given person.
     * @param person - The person to check.
     * @returns The roles that are available for the given person.
     */
    public async getPersonRoles(person: SHA256IdHash<Person>): Promise<Role[]> {
        const roles: Role[] = [];
        for (const role of this.roles) {
            if (await role.isRolePerson(person)) {
                roles.push(role);
            }
        }
        return roles;
    }

    /**
     * Returns the role names that are available for the given person.
     * @param person - The person to check.
     * @returns The role names that are available for the given person.
     */
    public async getPersonRoleNames(person: SHA256IdHash<Person>): Promise<string[]> {
        const roles: Role[] = [];
        for (const role of this.roles) {
            if (await role.isRolePerson(person)) {
                roles.push(role);
            }
        }
        return roles.map(r => r.getRoleName());
    }

    /**
     * Returns true if the given person has the given role.
     * @param person - The person to check.
     * @param role - The role to check.
     * @returns True if the given person has the given role, false otherwise.
     */
    public async isPersonRole(person: SHA256IdHash<Person>, role: Role | string | (Role | string)[]): Promise<boolean> {
        if (Array.isArray(role)) {
            return role.every(r => this.isPersonRole(person, r));
        }

        for (const cRole of this.roles) {
            if (typeof role === 'string') {
                if (cRole.getRoleName() === role && await cRole.isRolePerson(person)) {
                    return true;
                }
            } else if (cRole.getRoleName() === role.getRoleName() && await cRole.isRolePerson(person)) {
                return true;
            }
        }

        return false;
    }

    /*************** Private Methods ***************/

    /**
     * Returns the roles that are currently available for the current main identity or
     * undefined if the roles can not be loaded yet (Models are not initialised yet).
     * @returns
     */
    private async updateCurrentPersonRoles(): Promise<Role[] | undefined> {
        if (this.leuteModel.state.currentState !== 'Initialised' || this.myMainIdentity === undefined) {
            MessageBus.send(
                'debug',
                'RoleManager - getChangedCurrentPersonRoles - leuteModel not initialised');
            return undefined;
        } else if (this.roles.find(r => !r.isInitialised())) {
            MessageBus.send(
                'debug',
                `RoleManager - getChangedCurrentPersonRoles - Uninitialised roles: ${this.roles.filter(r => !r.isInitialised()).map(r => r.getRoleName()).join(', ')}`);
            return undefined;
        } else {
            const currentPersonRoles: Role[] = [];

            for (const role of this.roles) {
                if (await role.isRolePerson(this.myMainIdentity)) {
                    currentPersonRoles.push(role);
                }
            }

            this.currentPersonRoles = currentPersonRoles;
            return this.currentPersonRoles;
        }
    }

    /**
     * Loads the data for the current main identity.
     * @returns A promise that resolves when the data is loaded.
     */
    private async loadCurrentPersonDataChange(): Promise<void> {
        this.myMainIdentity = await this.leuteModel.myMainIdentity();
        const oldCurrentRoleNames = this.currentPersonRoles?.map(r => r.getRoleName());
        const currentRoles = await this.updateCurrentPersonRoles();
        if (currentRoles !== undefined && (oldCurrentRoleNames === undefined || JSON.stringify(oldCurrentRoleNames.sort()) !== JSON.stringify(currentRoles.map(r => r.getRoleName()).sort()))) {
            MessageBus.send(
                'debug',
                'RoleManager - loadCurrentPersonDataChange - current person roles change emit');
            this.onCurrentPersonRoleChange.emit(currentRoles);
        }
    }

}
