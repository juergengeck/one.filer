import { expect } from 'chai';
import { fillMissingWithDefaults, assignConfigOption } from '../../src/misc/configHelper.js';

describe('configHelper', () => {
    describe('fillMissingWithDefaults', () => {
        it('should fill missing fields with defaults', () => {
            const defaults = {
                name: 'default',
                value: 100,
                enabled: true
            };

            const partial = {
                name: 'custom'
            };

            const result = fillMissingWithDefaults(partial, defaults);

            expect(result).to.deep.equal({
                name: 'custom',
                value: 100,
                enabled: true
            });
        });

        it('should override all provided fields', () => {
            const defaults = {
                name: 'default',
                value: 100,
                enabled: true
            };

            const partial = {
                name: 'custom',
                value: 200,
                enabled: false
            };

            const result = fillMissingWithDefaults(partial, defaults);

            expect(result).to.deep.equal(partial);
        });

        it('should return defaults when partial is empty', () => {
            const defaults = {
                name: 'default',
                value: 100
            };

            const result = fillMissingWithDefaults({}, defaults);

            expect(result).to.deep.equal(defaults);
        });
    });

    describe('assignConfigOption', () => {
        it('should assign simple value to config', () => {
            const config = {};
            assignConfigOption(config, 'key', 'value');

            expect(config).to.deep.equal({ key: 'value' });
        });

        it('should assign nested value to config', () => {
            const config = {};
            assignConfigOption(config, 'a.b.c', 'value');

            expect(config).to.deep.equal({
                a: {
                    b: {
                        c: 'value'
                    }
                }
            });
        });

        it('should overwrite existing values', () => {
            const config = { a: { b: 'old' } };
            assignConfigOption(config, 'a.b', 'new');

            expect(config).to.deep.equal({
                a: {
                    b: 'new'
                }
            });
        });

        it('should create intermediate objects as needed', () => {
            const config = { a: {} };
            assignConfigOption(config, 'a.b.c.d', 'deep');

            expect(config).to.deep.equal({
                a: {
                    b: {
                        c: {
                            d: 'deep'
                        }
                    }
                }
            });
        });

        it('should throw error when intermediate path is not an object', () => {
            const config = { a: 'string' };

            expect(() => {
                assignConfigOption(config, 'a.b', 'value');
            }).to.throw('Cannot assign config value, because inner path element points to a type that is not an object');
        });

        it('should handle undefined values by doing nothing', () => {
            const config = { existing: 'value' };
            assignConfigOption(config, 'new', undefined);

            expect(config).to.deep.equal({ existing: 'value' });
        });
    });

    // Note: readJsonFileOrEmpty tests would require ES module mocking which is complex
    // These functions are better tested via integration tests
});