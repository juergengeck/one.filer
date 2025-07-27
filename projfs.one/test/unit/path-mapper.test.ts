import { expect } from 'chai';
import { PathMapper } from '../../src/utils/PathMapper.js';

describe('PathMapper', () => {
    let mapper: PathMapper;
    
    describe('Windows-style root', () => {
        beforeEach(() => {
            mapper = new PathMapper('C:\\VirtualDrive');
        });
        
        it('should convert Windows path to virtual path', () => {
            expect(mapper.toVirtualPath('test.txt')).to.equal('/test.txt');
            expect(mapper.toVirtualPath('folder\\file.txt')).to.equal('/folder/file.txt');
            expect(mapper.toVirtualPath('folder\\subfolder\\file.txt')).to.equal('/folder/subfolder/file.txt');
            expect(mapper.toVirtualPath('')).to.equal('/');
            expect(mapper.toVirtualPath('\\')).to.equal('/');
        });
        
        it('should convert virtual path to Windows path', () => {
            expect(mapper.toWindowsPath('/test.txt')).to.equal('C:\\VIRTUALDRIVE\\test.txt');
            expect(mapper.toWindowsPath('/folder/file.txt')).to.equal('C:\\VIRTUALDRIVE\\folder\\file.txt');
            expect(mapper.toWindowsPath('/')).to.equal('C:\\VIRTUALDRIVE');
            expect(mapper.toWindowsPath('')).to.equal('C:\\VIRTUALDRIVE');
        });
        
        it('should handle edge cases', () => {
            // Multiple slashes
            expect(mapper.toVirtualPath('folder\\\\file.txt')).to.equal('/folder/file.txt');
            
            // Trailing slashes
            expect(mapper.toVirtualPath('folder\\')).to.equal('/folder');
        });
        
        it('should join paths correctly', () => {
            expect(mapper.join('/folder', 'file.txt')).to.equal('/folder/file.txt');
            expect(mapper.join('/', 'file.txt')).to.equal('/file.txt');
            expect(mapper.join('/folder/', '/file.txt')).to.equal('/folder/file.txt');
            expect(mapper.join('', 'file.txt')).to.equal('/file.txt');
        });
        
        it('should get parent path', () => {
            expect(mapper.getParent('/folder/file.txt')).to.equal('/folder');
            expect(mapper.getParent('/file.txt')).to.equal('/');
            expect(mapper.getParent('/')).to.equal('/');
            expect(mapper.getParent('')).to.equal('/');
        });
        
        it('should get filename', () => {
            expect(mapper.getFilename('/folder/file.txt')).to.equal('file.txt');
            expect(mapper.getFilename('/file.txt')).to.equal('file.txt');
            expect(mapper.getFilename('/')).to.equal('');
            expect(mapper.getFilename('')).to.equal('');
        });
        
        it('should check if path is root', () => {
            expect(mapper.isRoot('/')).to.be.true;
            expect(mapper.isRoot('')).to.be.true;
            expect(mapper.isRoot('/folder')).to.be.false;
            expect(mapper.isRoot('/file.txt')).to.be.false;
        });
    });
    
    describe('UNC-style root', () => {
        beforeEach(() => {
            mapper = new PathMapper('\\\\server\\share\\virtual');
        });
        
        it('should handle UNC paths', () => {
            expect(mapper.toVirtualPath('test.txt')).to.equal('/test.txt');
            expect(mapper.toVirtualPath('folder\\file.txt')).to.equal('/folder/file.txt');
        });
    });
    
    describe('Pattern matching', () => {
        beforeEach(() => {
            mapper = new PathMapper('C:\\VirtualDrive');
        });
        
        it('should match Windows wildcard patterns', () => {
            expect(mapper.matchesPattern('test.txt', '*.txt')).to.be.true;
            expect(mapper.matchesPattern('test.txt', '*.doc')).to.be.false;
            expect(mapper.matchesPattern('test.txt', 'test.*')).to.be.true;
            expect(mapper.matchesPattern('test.txt', '*')).to.be.true;
            expect(mapper.matchesPattern('test.txt', '*.*')).to.be.true;
            expect(mapper.matchesPattern('readme', '*.*')).to.be.false;
            expect(mapper.matchesPattern('test.txt', 'test?.txt')).to.be.false;
            expect(mapper.matchesPattern('test1.txt', 'test?.txt')).to.be.true;
        });
    });
});