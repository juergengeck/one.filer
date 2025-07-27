"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const PathMapper_js_1 = require("../../src/utils/PathMapper.js");
describe('PathMapper', () => {
    let mapper;
    describe('Windows-style root', () => {
        beforeEach(() => {
            mapper = new PathMapper_js_1.PathMapper('C:\\VirtualDrive');
        });
        it('should convert Windows path to virtual path', () => {
            (0, chai_1.expect)(mapper.toVirtualPath('test.txt')).to.equal('/test.txt');
            (0, chai_1.expect)(mapper.toVirtualPath('folder\\file.txt')).to.equal('/folder/file.txt');
            (0, chai_1.expect)(mapper.toVirtualPath('folder\\subfolder\\file.txt')).to.equal('/folder/subfolder/file.txt');
            (0, chai_1.expect)(mapper.toVirtualPath('')).to.equal('/');
            (0, chai_1.expect)(mapper.toVirtualPath('\\')).to.equal('/');
        });
        it('should convert virtual path to Windows path', () => {
            (0, chai_1.expect)(mapper.toWindowsPath('/test.txt')).to.equal('C:\\VIRTUALDRIVE\\test.txt');
            (0, chai_1.expect)(mapper.toWindowsPath('/folder/file.txt')).to.equal('C:\\VIRTUALDRIVE\\folder\\file.txt');
            (0, chai_1.expect)(mapper.toWindowsPath('/')).to.equal('C:\\VIRTUALDRIVE');
            (0, chai_1.expect)(mapper.toWindowsPath('')).to.equal('C:\\VIRTUALDRIVE');
        });
        it('should handle edge cases', () => {
            // Multiple slashes
            (0, chai_1.expect)(mapper.toVirtualPath('folder\\\\file.txt')).to.equal('/folder/file.txt');
            // Trailing slashes
            (0, chai_1.expect)(mapper.toVirtualPath('folder\\')).to.equal('/folder');
        });
        it('should join paths correctly', () => {
            (0, chai_1.expect)(mapper.join('/folder', 'file.txt')).to.equal('/folder/file.txt');
            (0, chai_1.expect)(mapper.join('/', 'file.txt')).to.equal('/file.txt');
            (0, chai_1.expect)(mapper.join('/folder/', '/file.txt')).to.equal('/folder/file.txt');
            (0, chai_1.expect)(mapper.join('', 'file.txt')).to.equal('/file.txt');
        });
        it('should get parent path', () => {
            (0, chai_1.expect)(mapper.getParent('/folder/file.txt')).to.equal('/folder');
            (0, chai_1.expect)(mapper.getParent('/file.txt')).to.equal('/');
            (0, chai_1.expect)(mapper.getParent('/')).to.equal('/');
            (0, chai_1.expect)(mapper.getParent('')).to.equal('/');
        });
        it('should get filename', () => {
            (0, chai_1.expect)(mapper.getFilename('/folder/file.txt')).to.equal('file.txt');
            (0, chai_1.expect)(mapper.getFilename('/file.txt')).to.equal('file.txt');
            (0, chai_1.expect)(mapper.getFilename('/')).to.equal('');
            (0, chai_1.expect)(mapper.getFilename('')).to.equal('');
        });
        it('should check if path is root', () => {
            (0, chai_1.expect)(mapper.isRoot('/')).to.be.true;
            (0, chai_1.expect)(mapper.isRoot('')).to.be.true;
            (0, chai_1.expect)(mapper.isRoot('/folder')).to.be.false;
            (0, chai_1.expect)(mapper.isRoot('/file.txt')).to.be.false;
        });
    });
    describe('UNC-style root', () => {
        beforeEach(() => {
            mapper = new PathMapper_js_1.PathMapper('\\\\server\\share\\virtual');
        });
        it('should handle UNC paths', () => {
            (0, chai_1.expect)(mapper.toVirtualPath('test.txt')).to.equal('/test.txt');
            (0, chai_1.expect)(mapper.toVirtualPath('folder\\file.txt')).to.equal('/folder/file.txt');
        });
    });
    describe('Pattern matching', () => {
        beforeEach(() => {
            mapper = new PathMapper_js_1.PathMapper('C:\\VirtualDrive');
        });
        it('should match Windows wildcard patterns', () => {
            (0, chai_1.expect)(mapper.matchesPattern('test.txt', '*.txt')).to.be.true;
            (0, chai_1.expect)(mapper.matchesPattern('test.txt', '*.doc')).to.be.false;
            (0, chai_1.expect)(mapper.matchesPattern('test.txt', 'test.*')).to.be.true;
            (0, chai_1.expect)(mapper.matchesPattern('test.txt', '*')).to.be.true;
            (0, chai_1.expect)(mapper.matchesPattern('test.txt', '*.*')).to.be.true;
            (0, chai_1.expect)(mapper.matchesPattern('readme', '*.*')).to.be.false;
            (0, chai_1.expect)(mapper.matchesPattern('test.txt', 'test?.txt')).to.be.false;
            (0, chai_1.expect)(mapper.matchesPattern('test1.txt', 'test?.txt')).to.be.true;
        });
    });
});
