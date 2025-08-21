import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { objectEvents } from '../../lib/misc/ObjectEventDispatcher.js';
import AccessModel from '../../lib/models/AccessModel.js';
import BodyTemperatureModel from '../../lib/models/BodyTemperatureModel.js';
import ChannelManager from '../../lib/models/ChannelManager.js';
import LeuteModel from '../../lib/models/Leute/LeuteModel.js';
import ECGModel from '../../lib/models/ECGModel.js';
const readdir = util.promisify(fs.readdir);
const lstat = util.promisify(fs.lstat);
const unlink = util.promisify(fs.unlink);
const rmdir = util.promisify(fs.rmdir);
export async function removeDir(dir) {
    try {
        const files = await readdir(dir);
        await Promise.all(files.map(async (file) => {
            try {
                const p = path.join(dir, file);
                const stat = await lstat(p);
                if (stat.isDirectory()) {
                    await removeDir(p);
                }
                else {
                    await unlink(p);
                }
            }
            catch (err) {
                console.error(err);
            }
        }));
        await rmdir(dir);
    }
    catch (err) {
        console.error(err);
    }
}
export default class TestModel {
    secret;
    ecgModel;
    channelManager;
    bodyTemperature;
    leuteModel;
    accessModel;
    constructor(commServerUrl) {
        this.secret = 'test-secret';
        this.accessModel = new AccessModel();
        this.leuteModel = new LeuteModel(commServerUrl, true);
        this.channelManager = new ChannelManager(this.leuteModel);
        this.ecgModel = new ECGModel(this.channelManager);
        this.bodyTemperature = new BodyTemperatureModel(this.channelManager);
    }
    async init(_anonymousEmail, _takeOver, _recoveryState) {
        await objectEvents.init();
        await this.accessModel.init();
        await this.leuteModel.init();
        await this.channelManager.init();
        await this.ecgModel.init();
        await this.bodyTemperature.init();
    }
    async shutdown() {
        try {
            await this.bodyTemperature.shutdown();
        }
        catch (e) {
            console.error(e);
        }
        try {
            await this.ecgModel.shutdown();
        }
        catch (e) {
            console.error(e);
        }
        try {
            await this.channelManager.shutdown();
        }
        catch (e) {
            console.error(e);
        }
        try {
            await this.leuteModel.shutdown();
        }
        catch (e) {
            console.error(e);
        }
        try {
            await objectEvents.shutdown();
        }
        catch (e) {
            console.error(e);
        }
    }
}
//# sourceMappingURL=TestModel.js.map