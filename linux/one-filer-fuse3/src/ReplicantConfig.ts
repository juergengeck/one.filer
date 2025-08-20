/**
 * Replicant Configuration Types and Defaults
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import type {ConnectionsModelConfiguration} from '@refinio/one.models/lib/models/ConnectionsModel.js';
import type {FilerConfig} from './FilerConfig.js';
import {DefaultFilerConfig} from './FilerConfig.js';

export interface ReplicantConfig {
    directory: string;
    commServerUrl: string;
    createEveryoneGroup: boolean;
    useFiler: boolean;
    filerConfig: FilerConfig;
    connectionsConfig: ConnectionsModelConfiguration;
}

export const DefaultReplicantConfig: ReplicantConfig = {
    directory: 'data',
    commServerUrl: 'wss://comm.one.eu.replicant.refinio.one',
    createEveryoneGroup: false,
    useFiler: true,
    filerConfig: DefaultFilerConfig,
    connectionsConfig: {
        blacklist: [],
        whitelist: [],
        incomingConnectionLimit: 100,
        outgoingConnectionLimit: 100,
        acceptIncoming: true,
        establishOutgoing: true
    }
};

/**
 * Check and validate replicant configuration
 * 
 * @param config - Configuration object to validate
 * @returns Validated configuration
 */
export function checkReplicantConfig(config: any): Partial<ReplicantConfig> {
    const result: Partial<ReplicantConfig> = {};
    
    if (config.directory !== undefined) {
        result.directory = String(config.directory);
    }
    
    if (config.commServerUrl !== undefined) {
        result.commServerUrl = String(config.commServerUrl);
    }
    
    if (config.createEveryoneGroup !== undefined) {
        result.createEveryoneGroup = Boolean(config.createEveryoneGroup);
    }
    
    if (config.useFiler !== undefined) {
        result.useFiler = Boolean(config.useFiler);
    }
    
    if (config.filer !== undefined && typeof config.filer === 'object') {
        result.filerConfig = config.filer as FilerConfig;
    }
    
    if (config.connections !== undefined && typeof config.connections === 'object') {
        result.connectionsConfig = config.connections as ConnectionsModelConfiguration;
    }
    
    return result;
}