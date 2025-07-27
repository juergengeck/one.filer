import { expect } from 'chai';
import { checkReplicantConfig, DefaultReplicantConfig } from '../../src/ReplicantConfig.js';

describe('ReplicantConfig', () => {

    describe('DefaultReplicantConfig', () => {
        it('should have correct default values', () => {
            expect(DefaultReplicantConfig.directory).to.equal('data');
            expect(DefaultReplicantConfig.commServerUrl).to.equal('wss://comm10.dev.refinio.one');
            expect(DefaultReplicantConfig.createEveryoneGroup).to.be.true;
            expect(DefaultReplicantConfig.useFiler).to.be.false;
        });
    });

    describe('checkReplicantConfig', () => {
        it('should validate correct configuration', () => {
            const validConfig = {
                directory: 'test-data',
                commServerUrl: 'wss://example.com',
                createEveryoneGroup: false,
                useFiler: true
            };
            
            expect(() => checkReplicantConfig(validConfig)).to.not.throw();
        });

        it('should throw error for non-object config', () => {
            expect(() => checkReplicantConfig('invalid')).to.throw('Replicant configuration needs to be an object.');
            expect(() => checkReplicantConfig(null)).to.throw('Replicant configuration needs to be an object.');
            expect(() => checkReplicantConfig(123)).to.throw('Replicant configuration needs to be an object.');
        });

        it('should throw error for invalid directory', () => {
            const invalidConfig = {
                directory: 123
            };
            
            expect(() => checkReplicantConfig(invalidConfig)).to.throw('"directory" of Replicant configuration needs to be string.');
        });

        it('should throw error for invalid commServerUrl', () => {
            const invalidConfig = {
                commServerUrl: 'http://example.com'
            };
            
            expect(() => checkReplicantConfig(invalidConfig)).to.throw('"commServerUrl" of Replicant configuration needs to be string and a wss? url.');
        });

        it('should throw error for invalid createEveryoneGroup', () => {
            const invalidConfig = {
                createEveryoneGroup: 'yes'
            };
            
            expect(() => checkReplicantConfig(invalidConfig)).to.throw('"createEveryoneGroup" of Replicant configuration needs to be boolean.');
        });

        it('should throw error for invalid useFiler', () => {
            const invalidConfig = {
                useFiler: 'yes'
            };
            
            expect(() => checkReplicantConfig(invalidConfig)).to.throw('"useFiler" of Replicant configuration needs to be boolean.');
        });
    });

    describe('partial configuration', () => {
        it('should accept partial configuration', () => {
            const partialConfig = {
                directory: 'custom-data'
            };
            
            const result = checkReplicantConfig(partialConfig);
            expect(result).to.have.property('directory', 'custom-data');
        });

        it('should validate wss URLs correctly', () => {
            const validUrls = [
                'wss://example.com',
                'ws://localhost:8080',
                'wss://sub.domain.example.com/path',
                'wss://example.com:3000/api/v1'
            ];

            for (const url of validUrls) {
                expect(() => checkReplicantConfig({ commServerUrl: url })).to.not.throw();
            }
        });
    });
});