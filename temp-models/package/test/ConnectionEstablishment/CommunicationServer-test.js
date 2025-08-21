import { CryptoApi } from '@refinio/one.core/lib/crypto/CryptoApi.js';
import CommunicationServer from '../../lib/misc/ConnectionEstablishment/communicationServer/CommunicationServer.js';
import CommunicationServerListener, { CommunicationServerListenerState } from '../../lib/misc/ConnectionEstablishment/communicationServer/CommunicationServerListener.js';
import tweetnacl from 'tweetnacl';
import WebSocketWS from 'isomorphic-ws';
import { expect } from 'chai';
import { wait } from '@refinio/one.core/lib/util/promise.js';
import { createWebSocket } from '@refinio/one.core/lib/system/websocket.js';
import { uint8arrayToHexString } from '@refinio/one.core/lib/util/arraybuffer-to-and-from-hex-string.js';
import Connection from '../../lib/misc/Connection/Connection.js';
import PromisePlugin from '../../lib/misc/Connection/plugins/PromisePlugin.js';
import { createKeyPair } from '@refinio/one.core/lib/crypto/encryption.js';
describe('communication server tests', () => {
    let commServer = null;
    before('Start comm server', async () => {
        commServer = new CommunicationServer();
        await commServer.start('localhost', 8080);
    });
    after(async () => {
        if (commServer) {
            return await commServer.stop();
        }
    });
    it('Register client open connection to commserver and exchange messages', async function () {
        let listenerFailure = null;
        const listenerKeyPair = createKeyPair();
        const cryptoApi = new CryptoApi(listenerKeyPair);
        const commServerListener = new CommunicationServerListener(cryptoApi, 1, 1000);
        commServerListener.onConnection(async (connection) => {
            if (connection.websocketPlugin().webSocket === null) {
                throw new Error('ws.webSocket is null');
            }
            try {
                while (connection.websocketPlugin().webSocket.readyState === WebSocketWS.OPEN) {
                    connection.send(await connection.promisePlugin().waitForMessage(1000));
                }
            }
            catch (e) {
                listenerFailure = e;
            }
        });
        commServerListener.start('ws://localhost:8080');
        try {
            let retryCount = 0;
            while (commServerListener.state !== CommunicationServerListenerState.Listening) {
                await wait(500);
                ++retryCount;
                if (++retryCount >= 5) {
                    throw new Error('Registering at comm server timed out.');
                }
            }
            const clientKeyPair = tweetnacl.box.keyPair();
            const clientConn = new Connection(createWebSocket('ws://localhost:8080'));
            clientConn.addPlugin(new PromisePlugin());
            try {
                await clientConn.waitForOpen(1000);
                clientConn.send(JSON.stringify({
                    command: 'communication_request',
                    sourcePublicKey: uint8arrayToHexString(clientKeyPair.publicKey),
                    targetPublicKey: uint8arrayToHexString(listenerKeyPair.publicKey)
                }));
                const msg1 = await clientConn.promisePlugin().waitForJSONMessage(1000);
                expect(msg1.command).to.be.equal('communication_request');
                expect(msg1.sourcePublicKey).to.be.equal(uint8arrayToHexString(clientKeyPair.publicKey));
                expect(msg1.targetPublicKey).to.be.equal(uint8arrayToHexString(listenerKeyPair.publicKey));
                clientConn.send('Hello Friend!');
                const msg2 = await clientConn.promisePlugin().waitForMessage();
                expect(msg2).to.be.equal('Hello Friend!');
                expect(listenerFailure).to.be.null;
            }
            finally {
                clientConn.close();
            }
        }
        finally {
            commServerListener.stop();
        }
    }).timeout(10000);
});
//# sourceMappingURL=CommunicationServer-test.js.map