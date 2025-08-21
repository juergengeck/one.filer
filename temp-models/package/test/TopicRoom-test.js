import { expect } from 'chai';
import { readFile } from 'fs/promises';
import * as StorageTestInit from './_helpers.js';
import TestModel from './utils/TestModel.js';
import { closeAndDeleteCurrentInstance } from '@refinio/one.core/lib/instance.js';
import path from 'path';
import { statSync } from 'fs';
import TopicModel from '../lib/models/Chat/TopicModel.js';
import TopicRoom from '../lib/models/Chat/TopicRoom.js';
function buildTestFile() {
    const filePath = './test/consent.pdf';
    const stats = statSync(filePath);
    return {
        lastModified: stats.ctimeMs,
        name: path.basename(filePath),
        size: stats.size,
        type: 'application/pdf',
        arrayBuffer: () => readFile(filePath)
    };
}
describe('Consent', () => {
    const testModel = new TestModel('ws://localhost:8000');
    const topicModel = new TopicModel(testModel.channelManager, testModel.leuteModel);
    let topicRoom;
    before(async () => {
        await StorageTestInit.init();
        await testModel.init(undefined);
        await topicModel.init();
        const everyoneTopic = await topicModel.createEveryoneTopic();
        topicRoom = new TopicRoom(everyoneTopic, testModel.channelManager, testModel.leuteModel);
    });
    after(async () => {
        await testModel.shutdown();
        await topicModel.shutdown();
        await closeAndDeleteCurrentInstance();
    });
    it('should receive a message', async function () {
    });
    it('should receive a message containing a BlobDescriptors', async function () {
    });
    it.skip('should recover the file from BlobDescriptors', async function () {
        const messages = await topicRoom.retrieveAllMessagesWithAttachments();
        const messageWithAttachment = messages[1];
        expect(messageWithAttachment.data.attachments).to.not.be.undefined;
        const blobDescriptor = messageWithAttachment.data.attachments[0];
        expect(blobDescriptor.data instanceof ArrayBuffer);
    });
});
//# sourceMappingURL=TopicRoom-test.js.map