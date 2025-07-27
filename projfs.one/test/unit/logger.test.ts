import { expect } from 'chai';
import * as sinon from 'sinon';
import { Logger } from '../../src/utils/Logger.js';

describe('Logger', () => {
    beforeEach(() => {
        // Stub console methods
        sinon.stub(console, 'debug');
        sinon.stub(console, 'info');
        sinon.stub(console, 'warn');
        sinon.stub(console, 'error');
    });
    
    afterEach(() => {
        // Restore console methods
        sinon.restore();
    });
    
    describe('Log Levels', () => {
        it('should respect debug level', () => {
            const logger = new Logger('Test', 'debug');
            
            logger.debug('debug message');
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');
            
            expect((console.debug as sinon.SinonStub).calledOnce).to.be.true;
            expect((console.info as sinon.SinonStub).calledOnce).to.be.true;
            expect((console.warn as sinon.SinonStub).calledOnce).to.be.true;
            expect((console.error as sinon.SinonStub).calledOnce).to.be.true;
        });
        
        it('should respect info level', () => {
            const logger = new Logger('Test', 'info');
            
            logger.debug('debug message');
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');
            
            expect((console.debug as sinon.SinonStub).called).to.be.false;
            expect((console.info as sinon.SinonStub).calledOnce).to.be.true;
            expect((console.warn as sinon.SinonStub).calledOnce).to.be.true;
            expect((console.error as sinon.SinonStub).calledOnce).to.be.true;
        });
        
        it('should respect warn level', () => {
            const logger = new Logger('Test', 'warn');
            
            logger.debug('debug message');
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');
            
            expect((console.debug as sinon.SinonStub).called).to.be.false;
            expect((console.info as sinon.SinonStub).called).to.be.false;
            expect((console.warn as sinon.SinonStub).calledOnce).to.be.true;
            expect((console.error as sinon.SinonStub).calledOnce).to.be.true;
        });
        
        it('should respect error level', () => {
            const logger = new Logger('Test', 'error');
            
            logger.debug('debug message');
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');
            
            expect((console.debug as sinon.SinonStub).called).to.be.false;
            expect((console.info as sinon.SinonStub).called).to.be.false;
            expect((console.warn as sinon.SinonStub).called).to.be.false;
            expect((console.error as sinon.SinonStub).calledOnce).to.be.true;
        });
    });
    
    describe('Message Formatting', () => {
        it('should include module name in messages', () => {
            const logger = new Logger('TestModule', 'debug');
            
            logger.info('test message');
            
            const call = (console.info as sinon.SinonStub).getCall(0);
            expect(call.args[0]).to.include('[TestModule]');
            expect(call.args[0]).to.include('test message');
        });
        
        it('should format additional arguments', () => {
            const logger = new Logger('Test', 'debug');
            const obj = { key: 'value' };
            
            logger.info('message with object', obj);
            
            const call = (console.info as sinon.SinonStub).getCall(0);
            expect(call.args[0]).to.include('message with object');
            expect(call.args[1]).to.equal(obj);
        });
        
        it('should handle errors specially', () => {
            const logger = new Logger('Test', 'error');
            const error = new Error('Test error');
            
            logger.error('Error occurred', error);
            
            const call = (console.error as sinon.SinonStub).getCall(0);
            expect(call.args[0]).to.include('Error occurred');
            expect(call.args[1]).to.equal(error);
        });
    });
    
    
    describe('Default Log Level', () => {
        it('should default to info level', () => {
            const logger = new Logger('Test');
            
            logger.debug('should not appear');
            logger.info('should appear');
            
            expect((console.debug as sinon.SinonStub).called).to.be.false;
            expect((console.info as sinon.SinonStub).calledOnce).to.be.true;
        });
    });
});