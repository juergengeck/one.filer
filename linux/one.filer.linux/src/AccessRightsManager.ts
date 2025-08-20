/**
 * Access Rights Manager for Filer
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import type {ChannelManager} from '@refinio/one.models/lib/models/index.js';
import {calculateIdHashOfObj} from '@refinio/one.core/lib/util/object.js';
import type {LeuteModel} from '@refinio/one.models/lib/models/index.js';
import type {Group, Instance, Person} from '@refinio/one.core/lib/recipes.js';
import {serializeWithType} from '@refinio/one.core/lib/util/promise.js';
import type {ConnectionsModel} from '@refinio/one.models/lib/models/index.js';
import {getAllEntries} from '@refinio/one.core/lib/reverse-map-query.js';
import {sign} from '@refinio/one.models/lib/misc/Signature.js';
import type {VersionedObjectResult} from '@refinio/one.core/lib/storage-versioned-objects.js';
import {getObjectByIdHash, onVersionedObj} from '@refinio/one.core/lib/storage-versioned-objects.js';
import {createAccess} from '@refinio/one.core/lib/access.js';

/**
 * Manages access rights for the Filer filesystem
 */
export default class AccessRightsManager {
    private readonly connections: ConnectionsModel;
    private readonly channelManager: ChannelManager;
    private readonly leuteModel: LeuteModel;
    private shutdownFunctions: Array<() => void> = [];

    constructor(
        connections: ConnectionsModel,
        channelManager: ChannelManager,
        leuteModel: LeuteModel
    ) {
        this.connections = connections;
        this.channelManager = channelManager;
        this.leuteModel = leuteModel;
    }

    /**
     * Initialize the access rights manager
     */
    async init(): Promise<void> {
        // Set up listeners for new persons and groups
        const unsubscribePerson = this.leuteModel.onNewPerson(async (person: Person) => {
            await this.handleNewPerson(person);
        });

        const unsubscribeGroup = this.leuteModel.onNewGroup(async (group: Group) => {
            await this.handleNewGroup(group);
        });

        this.shutdownFunctions.push(unsubscribePerson, unsubscribeGroup);

        // Process existing persons and groups
        const persons = await this.leuteModel.getAllPersons();
        for (const person of persons) {
            await this.handleNewPerson(person);
        }

        const groups = await this.leuteModel.getAllGroups();
        for (const group of groups) {
            await this.handleNewGroup(group);
        }
    }

    /**
     * Shutdown the access rights manager
     */
    async shutdown(): Promise<void> {
        for (const fn of this.shutdownFunctions) {
            fn();
        }
        this.shutdownFunctions = [];
    }

    /**
     * Handle new person
     */
    private async handleNewPerson(person: Person): Promise<void> {
        try {
            // Grant access to person's data
            const personIdHash = await calculateIdHashOfObj(person);
            await this.grantAccess(personIdHash, person);
        } catch (err) {
            console.error('Error handling new person:', err);
        }
    }

    /**
     * Handle new group
     */
    private async handleNewGroup(group: Group): Promise<void> {
        try {
            // Grant access to group's data
            const groupIdHash = await calculateIdHashOfObj(group);
            await this.grantAccess(groupIdHash, group);
        } catch (err) {
            console.error('Error handling new group:', err);
        }
    }

    /**
     * Grant access to an object
     */
    private async grantAccess(idHash: string, obj: any): Promise<void> {
        try {
            // Create access object
            const access = await createAccess(obj);
            
            // Sign the access
            const signedAccess = await sign(access);
            
            // Store in appropriate channel
            const channel = await this.channelManager.getDefaultChannel();
            if (channel) {
                await channel.addObject(signedAccess);
            }
        } catch (err) {
            console.error('Error granting access:', err);
        }
    }

    /**
     * Check if access is granted for an object
     */
    async hasAccess(idHash: string): Promise<boolean> {
        try {
            const obj = await getObjectByIdHash(idHash);
            return obj !== undefined;
        } catch {
            return false;
        }
    }

    /**
     * Revoke access to an object
     */
    async revokeAccess(idHash: string): Promise<void> {
        // Implementation would depend on your access control model
        console.log(`Revoking access to ${idHash}`);
    }
}