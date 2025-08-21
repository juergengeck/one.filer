import AccessModel from '../../lib/models/AccessModel.js';
import BodyTemperatureModel from '../../lib/models/BodyTemperatureModel.js';
import ChannelManager from '../../lib/models/ChannelManager.js';
import LeuteModel from '../../lib/models/Leute/LeuteModel.js';
import ECGModel from '../../lib/models/ECGModel.js';
export declare function removeDir(dir: string): Promise<void>;
export default class TestModel {
    private readonly secret;
    ecgModel: ECGModel;
    channelManager: ChannelManager;
    bodyTemperature: BodyTemperatureModel;
    leuteModel: LeuteModel;
    accessModel: AccessModel;
    constructor(commServerUrl: string);
    init(_anonymousEmail?: string, _takeOver?: boolean, _recoveryState?: boolean): Promise<void>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=TestModel.d.ts.map