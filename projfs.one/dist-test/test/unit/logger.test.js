"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const sinon = __importStar(require("sinon"));
const Logger_js_1 = require("../../src/utils/Logger.js");
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
            const logger = new Logger_js_1.Logger('Test', 'debug');
            logger.debug('debug message');
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');
            (0, chai_1.expect)(console.debug.calledOnce).to.be.true;
            (0, chai_1.expect)(console.info.calledOnce).to.be.true;
            (0, chai_1.expect)(console.warn.calledOnce).to.be.true;
            (0, chai_1.expect)(console.error.calledOnce).to.be.true;
        });
        it('should respect info level', () => {
            const logger = new Logger_js_1.Logger('Test', 'info');
            logger.debug('debug message');
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');
            (0, chai_1.expect)(console.debug.called).to.be.false;
            (0, chai_1.expect)(console.info.calledOnce).to.be.true;
            (0, chai_1.expect)(console.warn.calledOnce).to.be.true;
            (0, chai_1.expect)(console.error.calledOnce).to.be.true;
        });
        it('should respect warn level', () => {
            const logger = new Logger_js_1.Logger('Test', 'warn');
            logger.debug('debug message');
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');
            (0, chai_1.expect)(console.debug.called).to.be.false;
            (0, chai_1.expect)(console.info.called).to.be.false;
            (0, chai_1.expect)(console.warn.calledOnce).to.be.true;
            (0, chai_1.expect)(console.error.calledOnce).to.be.true;
        });
        it('should respect error level', () => {
            const logger = new Logger_js_1.Logger('Test', 'error');
            logger.debug('debug message');
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');
            (0, chai_1.expect)(console.debug.called).to.be.false;
            (0, chai_1.expect)(console.info.called).to.be.false;
            (0, chai_1.expect)(console.warn.called).to.be.false;
            (0, chai_1.expect)(console.error.calledOnce).to.be.true;
        });
    });
    describe('Message Formatting', () => {
        it('should include module name in messages', () => {
            const logger = new Logger_js_1.Logger('TestModule', 'debug');
            logger.info('test message');
            const call = console.info.getCall(0);
            (0, chai_1.expect)(call.args[0]).to.include('[TestModule]');
            (0, chai_1.expect)(call.args[0]).to.include('test message');
        });
        it('should format additional arguments', () => {
            const logger = new Logger_js_1.Logger('Test', 'debug');
            const obj = { key: 'value' };
            logger.info('message with object', obj);
            const call = console.info.getCall(0);
            (0, chai_1.expect)(call.args[0]).to.include('message with object');
            (0, chai_1.expect)(call.args[1]).to.equal(obj);
        });
        it('should handle errors specially', () => {
            const logger = new Logger_js_1.Logger('Test', 'error');
            const error = new Error('Test error');
            logger.error('Error occurred', error);
            const call = console.error.getCall(0);
            (0, chai_1.expect)(call.args[0]).to.include('Error occurred');
            (0, chai_1.expect)(call.args[1]).to.equal(error);
        });
    });
    describe('Default Log Level', () => {
        it('should default to info level', () => {
            const logger = new Logger_js_1.Logger('Test');
            logger.debug('should not appear');
            logger.info('should appear');
            (0, chai_1.expect)(console.debug.called).to.be.false;
            (0, chai_1.expect)(console.info.calledOnce).to.be.true;
        });
    });
});
