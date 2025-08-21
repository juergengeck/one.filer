import { expect } from 'chai';
import { closeAndDeleteCurrentInstance } from '@refinio/one.core/lib/instance.js';
import { createMessageBus } from '@refinio/one.core/lib/message-bus.js';
import { getObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
import { getAllVersionMapEntries } from '@refinio/one.core/lib/version-map-query.js';
import ChannelManager from '../lib/models/ChannelManager.js';
import { Order } from '../lib/models/ChannelManager.js';
import * as StorageTestInit from './_helpers.js';
import TestModel from './utils/TestModel.js';
import { wait } from '@refinio/one.core/lib/util/promise.js';
let channelManager;
let testModel;
const enableLogging = false;
const indentationMap = new Map();
function format(message, color) {
    const m = message;
    const mArr = m.split('#');
    if (m.length >= 3) {
        const mid = mArr[0];
        if (!indentationMap.has(mid)) {
            indentationMap.set(mid, 0);
        }
        if (mArr[2].includes('END')) {
            indentationMap.set(mid, (indentationMap.get(mid) || 0) - 1);
        }
        mArr[0] = mArr[0].padEnd(10, ' ');
        mArr[0] = `\x1b[${color}m${mArr[0]}\x1b[0m`;
        mArr[1] = mArr[1].padEnd((indentationMap.get(mid) || 0) + 70, ' ');
        mArr[1] = `\x1b[34m${mArr[1]}\x1b[0m`;
        mArr[2] = mArr[2].replace('START', '\x1b[32mSTART\x1b[0m');
        mArr[2] = mArr[2].replace('ENTER', '\x1b[32mENTER\x1b[0m');
        mArr[2] = mArr[2].replace('END', '\x1b[31mEND\x1b[0m');
        mArr[2] = mArr[2].replace('LEAVE', '\x1b[31mLEAVE\x1b[0m');
        if (mArr[2].includes('START')) {
            indentationMap.set(mid, (indentationMap.get(mid) || 0) + 1);
        }
    }
    return mArr;
}
const MessageBus = createMessageBus('dummy');
if (enableLogging) {
    MessageBus.on('ChannelManager:log', (_src, message) => {
        const m = format(message, 33);
        console.log(...m);
    });
    MessageBus.on('ChannelManager:debug', (_src, message) => {
        const m = format(message, 32);
        console.log(...m);
    });
}
describe('Channel Manager test', () => {
    before(async () => {
        await StorageTestInit.init();
        const model = new TestModel('ws://localhost:8000');
        await model.init(undefined);
        testModel = model;
        channelManager = model.channelManager;
    });
    after(async () => {
        await testModel.shutdown();
        await closeAndDeleteCurrentInstance();
    });
    it('should create channels and init channelManager', async () => {
        await channelManager.createChannel('first');
        await channelManager.createChannel('second');
        await channelManager.createChannel('third');
        await channelManager.createChannel('fourth');
    });
    it('should get zero objects by iterator', async () => {
        expect((await channelManager.objectIterator().next()).done).to.be.true;
    });
    it('should get zero objects by getObjects', async () => {
        expect((await channelManager.getObjects()).length).to.be.equal(0);
    }).timeout(5000);
    it('should add data to created channels', async () => {
        await channelManager.postToChannel('first', { $type$: 'BodyTemperature', temperature: 1 });
        await channelManager.postToChannel('second', { $type$: 'BodyTemperature', temperature: 2 });
        await channelManager.postToChannel('third', { $type$: 'BodyTemperature', temperature: 3 });
        await channelManager.postToChannel('third', { $type$: 'BodyTemperature', temperature: 4 });
        await channelManager.postToChannel('second', { $type$: 'BodyTemperature', temperature: 5 });
        await channelManager.postToChannel('first', { $type$: 'BodyTemperature', temperature: 6 });
        await wait(1000);
    });
    it('MergeBugTestIter', async () => {
        async function* valueGenerator(arr) {
            yield* arr;
        }
        const W = [
            {
                channelEntryHash: '5688af95b1f68d1a9118d7e17be9e219a91168e694ab407b2bad3ed915087d04',
                creationTimeHash: '1547e5350908a3de7f655d255cd93af0e7623ad0330bbfbd3aefab7bc98630db',
                creationTime: 1614773672411
            },
            {
                channelEntryHash: 'f3f4aa9aaa21794b826951a4ee12e49400f23ac13fe71449f158bf779ec89573',
                creationTimeHash: 'bea92e05d611a3f27c354fc23db0f3e921d7b5d0d4936d2ecc45f3c3f0751cec',
                creationTime: 1614773575275
            },
            {
                channelEntryHash: 'fc64bb17a9fa12425e439beee9909a8a2edafc143c9e0b39257982414a9cbe56',
                creationTimeHash: 'b5d0d2ccc210930438d8109466d7816566307b94aa302927c2645a8027abab87',
                creationTime: 1614174911147
            },
            {
                channelEntryHash: '1870c02045ab1a985550a88a2454e16cda952edeabdedb4b616f97959472ce15',
                creationTimeHash: '523a2bf86fbc8755a0b6a48bd698178b996f2832a063ea8216cd476a64e0bfef',
                creationTime: 1614170581769
            }
        ];
        const Z = [
            {
                channelEntryHash: '5b4cce50265587493b3eedc8b07ec4ad2ba26c1a17c7c817b04c8ef6914e6c86',
                creationTimeHash: '1547e5350908a3de7f655d255cd93af0e7623ad0330bbfbd3aefab7bc98630db',
                creationTime: 1614773672411
            },
            {
                channelEntryHash: 'd5f0d34790e7d14129fdfdee60285c6f073cd860740506c87c4d773c651c96ca',
                creationTimeHash: 'bea92e05d611a3f27c354fc23db0f3e921d7b5d0d4936d2ecc45f3c3f0751cec',
                creationTime: 1614773575275
            },
            {
                channelEntryHash: '646f91d9a141227488e5249b09ca23bfb159e9d5b4e5977781581b966b03b363',
                creationTimeHash: 'b5d0d2ccc210930438d8109466d7816566307b94aa302927c2645a8027abab87',
                creationTime: 1614174911147
            }
        ];
        const iter = ChannelManager.mergeIteratorMostCurrent([
            valueGenerator(W),
            valueGenerator(Z)
        ], true);
        let i = 0;
        for await (const _item of iter) {
            ++i;
        }
        expect(i).to.be.equal(4);
    });
    it('should get objects with iterator', async () => {
        async function arrayFromAsync(iter) {
            const arr = [];
            for await (const elem of iter) {
                arr.push(elem);
            }
            return arr;
        }
        const allValues = await arrayFromAsync(channelManager.objectIteratorWithType('BodyTemperature'));
        expect(allValues.map(e => e.data.temperature)).to.be.eql([6, 5, 4, 3, 2, 1]);
        const firstValues = await arrayFromAsync(channelManager.objectIteratorWithType('BodyTemperature', {
            channelId: 'first'
        }));
        expect(firstValues.map(e => e.data.temperature)).to.be.eql([6, 1]);
        const secondValues = await arrayFromAsync(channelManager.objectIteratorWithType('BodyTemperature', {
            channelId: 'second'
        }));
        expect(secondValues.map(e => e.data.temperature)).to.be.eql([5, 2]);
        const thirdValues = await arrayFromAsync(channelManager.objectIteratorWithType('BodyTemperature', {
            channelId: 'third'
        }));
        expect(thirdValues.map(e => e.data.temperature)).to.be.eql([4, 3]);
        const fourthValues = await arrayFromAsync(channelManager.objectIteratorWithType('BodyTemperature', {
            channelId: 'fourth'
        }));
        expect(fourthValues.map(e => e.data.temperature)).to.be.eql([]);
    });
    it('should get objects', async () => {
        const allValuesAsc = await channelManager.getObjectsWithType('BodyTemperature');
        const allValuesDes = await channelManager.getObjectsWithType('BodyTemperature', {
            orderBy: Order.Descending
        });
        expect(allValuesAsc.map(e => e.data.temperature)).to.be.eql([1, 2, 3, 4, 5, 6]);
        expect(allValuesDes.map(e => e.data.temperature)).to.be.eql([6, 5, 4, 3, 2, 1]);
        const firstValuesAsc = await channelManager.getObjectsWithType('BodyTemperature', {
            channelId: 'first'
        });
        const firstValuesDes = await channelManager.getObjectsWithType('BodyTemperature', {
            channelId: 'first',
            orderBy: Order.Descending
        });
        expect(firstValuesAsc.map(e => e.data.temperature)).to.be.eql([1, 6]);
        expect(firstValuesDes.map(e => e.data.temperature)).to.be.eql([6, 1]);
        const secondValuesAsc = await channelManager.getObjectsWithType('BodyTemperature', {
            channelId: 'second'
        });
        const secondValuesDes = await channelManager.getObjectsWithType('BodyTemperature', {
            channelId: 'second',
            orderBy: Order.Descending
        });
        expect(secondValuesAsc.map(e => e.data.temperature)).to.be.eql([2, 5]);
        expect(secondValuesDes.map(e => e.data.temperature)).to.be.eql([5, 2]);
        const thirdValuesAsc = await channelManager.getObjectsWithType('BodyTemperature', {
            channelId: 'third'
        });
        const thirdValuesDes = await channelManager.getObjectsWithType('BodyTemperature', {
            channelId: 'third',
            orderBy: Order.Descending
        });
        expect(thirdValuesAsc.map(e => e.data.temperature)).to.be.eql([3, 4]);
        expect(thirdValuesDes.map(e => e.data.temperature)).to.be.eql([4, 3]);
        const fourthValuesAsc = await channelManager.getObjectsWithType('BodyTemperature', {
            channelId: 'fourth'
        });
        const fourthValuesDes = await channelManager.getObjectsWithType('BodyTemperature', {
            channelId: 'fourth',
            orderBy: Order.Descending
        });
        expect(fourthValuesAsc.map(e => e.data.temperature)).to.be.eql([]);
        expect(fourthValuesDes.map(e => e.data.temperature)).to.be.eql([]);
    });
    it('should get objects by id', async () => {
        const allValuesAsc = await channelManager.getObjectsWithType('BodyTemperature');
        const allValuesDes = await channelManager.getObjectsWithType('BodyTemperature', {
            orderBy: Order.Descending
        });
        const allValuesAscById = await Promise.all(allValuesAsc.map(item => channelManager.getObjectById(item.id)));
        const allValuesDesById = await Promise.all(allValuesDes.map(item => channelManager.getObjectById(item.id)));
        expect(allValuesAscById.map(e => e.data.temperature)).to.be.eql([
            1, 2, 3, 4, 5, 6
        ]);
        expect(allValuesDesById.map(e => e.data.temperature)).to.be.eql([
            6, 5, 4, 3, 2, 1
        ]);
    });
    it('should iterate differences in versions', async () => {
        const channels = await channelManager.channels();
        const hash = await calculateIdHashOfObj({
            $type$: 'ChannelInfo',
            owner: channels[0].owner,
            id: 'first'
        });
        const firstValuesAsc = await channelManager.getObjectsWithType('BodyTemperature', {
            channelId: 'first'
        });
        await channelManager.internalChannelPost('first', channels[0].owner, { $type$: 'BodyTemperature', temperature: 9 }, undefined, firstValuesAsc[1].creationTime.getTime() - 1);
        const versionMap = await getAllVersionMapEntries(hash);
        const elements1 = [];
        for await (const entry of ChannelManager.differencesIteratorMostCurrent(versionMap[1].hash, versionMap[versionMap.length - 1].hash)) {
            elements1.push((await getObject(entry.dataHash)).temperature);
        }
        const elements2 = [];
        for await (const entry of ChannelManager.differencesIteratorMostCurrent(versionMap[2].hash, versionMap[versionMap.length - 1].hash)) {
            elements2.push((await getObject(entry.dataHash)).temperature);
        }
        expect(elements1).to.be.eql([6, 9]);
        expect(elements2).to.be.eql([9]);
    });
});
//# sourceMappingURL=ChannelManager-test.js.map