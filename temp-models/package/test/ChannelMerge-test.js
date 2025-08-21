import { VersionTree } from '@refinio/one.core/lib/crdts/VersionTree.js';
import { getCurrentVersion, storeVersionObjectAsChange } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { closeAndDeleteCurrentInstance, getInstanceOwnerIdHash } from '@refinio/one.core/lib/instance.js';
import { getObject, storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { registerCrdtAlgorithm } from '@refinio/one.core/lib/crdts/CrdtAlgorithmRegistry.js';
import { linkedListIterator } from '../lib/models/LinkedList/iterators.js';
import { LinkedListCrdtAlgorithm } from '../lib/models/LinkedList/LinkedListCrdtAlgorithm.js';
import * as StorageTestInit from './_helpers.js';
async function postMessage(channelId, text, versionHash) {
    const me = getInstanceOwnerIdHash();
    if (me === undefined) {
        throw new Error('Failed to get instance owner');
    }
    const message = await storeUnversionedObject({
        $type$: 'ChatMessage',
        text,
        sender: me
    });
    const creationTime = await storeUnversionedObject({
        $type$: 'CreationTime',
        timestamp: Date.now(),
        data: message.hash
    });
    const entry = await storeUnversionedObject({
        $type$: 'LinkedListEntry',
        data: creationTime.hash
    });
    return storeVersionObjectAsChange({
        $type$: 'ChannelInfo',
        id: channelId,
        head: entry.hash
    });
}
describe('Linked List Test', () => {
    before(async () => {
        await StorageTestInit.init();
        registerCrdtAlgorithm(new LinkedListCrdtAlgorithm());
    });
    after(async () => {
        await closeAndDeleteCurrentInstance();
    });
    it.skip('should create channels and init channelManager', async () => {
        const msg1 = await postMessage('test', 'aaa');
        const msg2 = await postMessage('test', 'bbb');
        const msg3 = await postMessage('test', 'ccc');
        console.log('MSG1', msg1);
        console.log('MSG2', msg2);
        console.log('MSG3', msg3);
        console.log(await VersionTree.getCurrentVersionTreeAsString(msg1.idHash));
        const channelResult = await getCurrentVersion(msg1.idHash);
        console.log('Result', channelResult);
        if (channelResult.head === undefined) {
            throw new Error('Head is undefined');
        }
        for await (const entry of linkedListIterator(channelResult.head)) {
            const data = await getObject(entry.dataHash);
            console.log('Message', data);
        }
    });
});
//# sourceMappingURL=ChannelMerge-test.js.map