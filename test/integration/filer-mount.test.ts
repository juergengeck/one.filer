import { expect } from 'chai';
import { DefaultFilerConfig, checkFilerConfig } from '../../src/filer/FilerConfig.js';

describe('Filer Integration Tests', () => {
    describe('FilerConfig', () => {
        it('should have valid default configuration', () => {
            expect(DefaultFilerConfig).to.have.property('mountPoint', 'mnt');
            expect(DefaultFilerConfig).to.have.property('iomMode', 'light');
            expect(DefaultFilerConfig).to.have.property('logCalls', false);
        });

        it('should validate configuration correctly', () => {
            const validConfig = {
                mountPoint: '/custom/mount',
                iomMode: 'full' as const,
                logCalls: true
            };

            expect(() => checkFilerConfig(validConfig)).to.not.throw();
        });

        it('should reject invalid iomMode', () => {
            const invalidConfig = {
                iomMode: 'invalid'
            };

            expect(() => checkFilerConfig(invalidConfig)).to.throw('"iomMode" of filer configuration needs to be "light" or "full"');
        });
    });

    // Note: Actual FUSE mounting tests require running in a Linux environment with FUSE installed
    // and proper permissions. These tests are better suited for manual testing or CI environments
    // with proper setup.
});