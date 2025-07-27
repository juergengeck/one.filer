import type { ConnectionsModelConfiguration } from '@refinio/one.models/lib/models/ConnectionsModel.js';
import type { FilerConfig } from './filer/FilerConfig';
export interface ReplicantConfig {
    directory: string;
    commServerUrl: string;
    createEveryoneGroup: boolean;
    useFiler: boolean;
    filerConfig: FilerConfig;
    connectionsConfig: ConnectionsModelConfiguration;
}
export declare const DefaultReplicantConfig: ReplicantConfig;
export declare function checkReplicantConfig(config: unknown): Partial<ReplicantConfig>;
//# sourceMappingURL=ReplicantConfig.d.ts.map