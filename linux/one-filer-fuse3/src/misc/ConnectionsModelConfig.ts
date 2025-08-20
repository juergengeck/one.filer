/**
 * Connections Model Configuration
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import type {ConnectionsModelConfiguration} from '@refinio/one.models/lib/models/ConnectionsModel.js';

export const DefaultConnectionsModelConfig: ConnectionsModelConfiguration = {
    blacklist: [],
    whitelist: [],
    incomingConnectionLimit: 100,
    outgoingConnectionLimit: 100,
    acceptIncoming: true,
    establishOutgoing: true
};