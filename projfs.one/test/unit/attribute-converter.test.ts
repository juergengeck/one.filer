import { expect } from 'chai';
import { AttributeConverter } from '../../src/utils/AttributeConverter.js';
import { FileAttributes } from '../../src/native/projfs-types.js';

describe('AttributeConverter', () => {
    let converter: AttributeConverter;
    
    beforeEach(() => {
        converter = new AttributeConverter();
    });
    
    describe('modeToWindowsAttributes', () => {
        it('should convert regular file mode to Windows attributes', () => {
            const fileMode = 0o100644; // Regular file, rw-r--r--
            const attributes = converter.modeToWindowsAttributes(fileMode);
            
            expect(attributes & FileAttributes.ARCHIVE).to.be.above(0);
            expect(attributes & FileAttributes.DIRECTORY).to.equal(0);
        });
        
        it('should convert directory mode to Windows attributes', () => {
            const dirMode = 0o040755; // Directory, rwxr-xr-x
            const attributes = converter.modeToWindowsAttributes(dirMode);
            
            expect(attributes & FileAttributes.DIRECTORY).to.be.above(0);
            expect(attributes & FileAttributes.ARCHIVE).to.equal(0);
        });
        
        it('should set readonly attribute for files without write permission', () => {
            const readonlyMode = 0o100444; // Regular file, r--r--r--
            const attributes = converter.modeToWindowsAttributes(readonlyMode);
            
            expect(attributes & FileAttributes.READONLY).to.be.above(0);
        });
        
        it('should handle symbolic links', () => {
            const symlinkMode = 0o120777; // Symbolic link
            const attributes = converter.modeToWindowsAttributes(symlinkMode);
            
            expect(attributes & FileAttributes.REPARSE_POINT).to.be.above(0);
        });
    });
    
    describe('windowsAttributesToMode', () => {
        it('should convert directory attributes to Unix mode', () => {
            const attributes = FileAttributes.DIRECTORY;
            const mode = converter.windowsAttributesToMode(attributes, true);
            
            expect(converter.isDirectory(mode)).to.be.true;
            // Should have execute permissions for directories
            expect(mode & 0o111).to.be.above(0);
        });
        
        it('should convert readonly file attributes to Unix mode', () => {
            const attributes = FileAttributes.READONLY | FileAttributes.ARCHIVE;
            const mode = converter.windowsAttributesToMode(attributes, false);
            
            expect(converter.isRegularFile(mode)).to.be.true;
            // Should not have write permissions
            expect(mode & 0o200).to.equal(0); // No user write
            expect(mode & 0o020).to.equal(0); // No group write
        });
    });
    
    describe('File type checks', () => {
        it('should correctly identify directories', () => {
            expect(converter.isDirectory(0o040755)).to.be.true;
            expect(converter.isDirectory(0o040000)).to.be.true;
            expect(converter.isDirectory(0o100644)).to.be.false;
            expect(converter.isDirectory(0o120777)).to.be.false;
        });
        
        it('should correctly identify regular files', () => {
            expect(converter.isRegularFile(0o100644)).to.be.true;
            expect(converter.isRegularFile(0o100755)).to.be.true;
            expect(converter.isRegularFile(0o040755)).to.be.false;
            expect(converter.isRegularFile(0o120777)).to.be.false;
        });
        
        it('should correctly identify symbolic links', () => {
            expect(converter.isSymbolicLink(0o120777)).to.be.true;
            expect(converter.isSymbolicLink(0o120000)).to.be.true;
            expect(converter.isSymbolicLink(0o100644)).to.be.false;
            expect(converter.isSymbolicLink(0o040755)).to.be.false;
        });
    });
    
    describe('getFileType', () => {
        it('should return correct file type strings', () => {
            expect(converter.getFileType(0o100644)).to.equal('file');
            expect(converter.getFileType(0o040755)).to.equal('directory');
            expect(converter.getFileType(0o120777)).to.equal('symlink');
            expect(converter.getFileType(0o060000)).to.equal('unknown');
        });
    });
    
    describe('Hidden files', () => {
        it('should identify hidden files by name', () => {
            expect(converter.isHiddenFile('.gitignore')).to.be.true;
            expect(converter.isHiddenFile('.hidden')).to.be.true;
            expect(converter.isHiddenFile('normal.txt')).to.be.false;
            expect(converter.isHiddenFile('.')).to.be.false;
            expect(converter.isHiddenFile('..')).to.be.false;
        });
        
        it('should apply hidden attribute when needed', () => {
            const baseAttrs = FileAttributes.NORMAL;
            
            const hiddenAttrs = converter.applyHiddenAttribute(baseAttrs, '.hidden');
            expect(hiddenAttrs & FileAttributes.HIDDEN).to.be.above(0);
            
            const normalAttrs = converter.applyHiddenAttribute(baseAttrs, 'visible.txt');
            expect(normalAttrs & FileAttributes.HIDDEN).to.equal(0);
        });
    });
    
    describe('Permission formatting', () => {
        it('should format permissions correctly', () => {
            expect(converter.formatPermissions(0o755)).to.equal('rwxr-xr-x');
            expect(converter.formatPermissions(0o644)).to.equal('rw-r--r--');
            expect(converter.formatPermissions(0o600)).to.equal('rw-------');
            expect(converter.formatPermissions(0o777)).to.equal('rwxrwxrwx');
        });
    });
    
    describe('Default modes', () => {
        it('should provide correct default file mode', () => {
            const fileMode = converter.getDefaultFileMode();
            expect(converter.isRegularFile(fileMode)).to.be.true;
            expect(fileMode & 0o777).to.equal(0o664);
        });
        
        it('should provide correct default directory mode', () => {
            const dirMode = converter.getDefaultDirectoryMode();
            expect(converter.isDirectory(dirMode)).to.be.true;
            expect(dirMode & 0o777).to.equal(0o775);
        });
    });
});