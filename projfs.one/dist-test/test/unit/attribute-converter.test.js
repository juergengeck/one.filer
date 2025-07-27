"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const AttributeConverter_js_1 = require("../../src/utils/AttributeConverter.js");
const projfs_types_js_1 = require("../../src/native/projfs-types.js");
describe('AttributeConverter', () => {
    let converter;
    beforeEach(() => {
        converter = new AttributeConverter_js_1.AttributeConverter();
    });
    describe('modeToWindowsAttributes', () => {
        it('should convert regular file mode to Windows attributes', () => {
            const fileMode = 0o100644; // Regular file, rw-r--r--
            const attributes = converter.modeToWindowsAttributes(fileMode);
            (0, chai_1.expect)(attributes & projfs_types_js_1.FileAttributes.ARCHIVE).to.be.above(0);
            (0, chai_1.expect)(attributes & projfs_types_js_1.FileAttributes.DIRECTORY).to.equal(0);
        });
        it('should convert directory mode to Windows attributes', () => {
            const dirMode = 0o040755; // Directory, rwxr-xr-x
            const attributes = converter.modeToWindowsAttributes(dirMode);
            (0, chai_1.expect)(attributes & projfs_types_js_1.FileAttributes.DIRECTORY).to.be.above(0);
            (0, chai_1.expect)(attributes & projfs_types_js_1.FileAttributes.ARCHIVE).to.equal(0);
        });
        it('should set readonly attribute for files without write permission', () => {
            const readonlyMode = 0o100444; // Regular file, r--r--r--
            const attributes = converter.modeToWindowsAttributes(readonlyMode);
            (0, chai_1.expect)(attributes & projfs_types_js_1.FileAttributes.READONLY).to.be.above(0);
        });
        it('should handle symbolic links', () => {
            const symlinkMode = 0o120777; // Symbolic link
            const attributes = converter.modeToWindowsAttributes(symlinkMode);
            (0, chai_1.expect)(attributes & projfs_types_js_1.FileAttributes.REPARSE_POINT).to.be.above(0);
        });
    });
    describe('windowsAttributesToMode', () => {
        it('should convert directory attributes to Unix mode', () => {
            const attributes = projfs_types_js_1.FileAttributes.DIRECTORY;
            const mode = converter.windowsAttributesToMode(attributes, true);
            (0, chai_1.expect)(converter.isDirectory(mode)).to.be.true;
            // Should have execute permissions for directories
            (0, chai_1.expect)(mode & 0o111).to.be.above(0);
        });
        it('should convert readonly file attributes to Unix mode', () => {
            const attributes = projfs_types_js_1.FileAttributes.READONLY | projfs_types_js_1.FileAttributes.ARCHIVE;
            const mode = converter.windowsAttributesToMode(attributes, false);
            (0, chai_1.expect)(converter.isRegularFile(mode)).to.be.true;
            // Should not have write permissions
            (0, chai_1.expect)(mode & 0o200).to.equal(0); // No user write
            (0, chai_1.expect)(mode & 0o020).to.equal(0); // No group write
        });
    });
    describe('File type checks', () => {
        it('should correctly identify directories', () => {
            (0, chai_1.expect)(converter.isDirectory(0o040755)).to.be.true;
            (0, chai_1.expect)(converter.isDirectory(0o040000)).to.be.true;
            (0, chai_1.expect)(converter.isDirectory(0o100644)).to.be.false;
            (0, chai_1.expect)(converter.isDirectory(0o120777)).to.be.false;
        });
        it('should correctly identify regular files', () => {
            (0, chai_1.expect)(converter.isRegularFile(0o100644)).to.be.true;
            (0, chai_1.expect)(converter.isRegularFile(0o100755)).to.be.true;
            (0, chai_1.expect)(converter.isRegularFile(0o040755)).to.be.false;
            (0, chai_1.expect)(converter.isRegularFile(0o120777)).to.be.false;
        });
        it('should correctly identify symbolic links', () => {
            (0, chai_1.expect)(converter.isSymbolicLink(0o120777)).to.be.true;
            (0, chai_1.expect)(converter.isSymbolicLink(0o120000)).to.be.true;
            (0, chai_1.expect)(converter.isSymbolicLink(0o100644)).to.be.false;
            (0, chai_1.expect)(converter.isSymbolicLink(0o040755)).to.be.false;
        });
    });
    describe('getFileType', () => {
        it('should return correct file type strings', () => {
            (0, chai_1.expect)(converter.getFileType(0o100644)).to.equal('file');
            (0, chai_1.expect)(converter.getFileType(0o040755)).to.equal('directory');
            (0, chai_1.expect)(converter.getFileType(0o120777)).to.equal('symlink');
            (0, chai_1.expect)(converter.getFileType(0o060000)).to.equal('unknown');
        });
    });
    describe('Hidden files', () => {
        it('should identify hidden files by name', () => {
            (0, chai_1.expect)(converter.isHiddenFile('.gitignore')).to.be.true;
            (0, chai_1.expect)(converter.isHiddenFile('.hidden')).to.be.true;
            (0, chai_1.expect)(converter.isHiddenFile('normal.txt')).to.be.false;
            (0, chai_1.expect)(converter.isHiddenFile('.')).to.be.false;
            (0, chai_1.expect)(converter.isHiddenFile('..')).to.be.false;
        });
        it('should apply hidden attribute when needed', () => {
            const baseAttrs = projfs_types_js_1.FileAttributes.NORMAL;
            const hiddenAttrs = converter.applyHiddenAttribute(baseAttrs, '.hidden');
            (0, chai_1.expect)(hiddenAttrs & projfs_types_js_1.FileAttributes.HIDDEN).to.be.above(0);
            const normalAttrs = converter.applyHiddenAttribute(baseAttrs, 'visible.txt');
            (0, chai_1.expect)(normalAttrs & projfs_types_js_1.FileAttributes.HIDDEN).to.equal(0);
        });
    });
    describe('Permission formatting', () => {
        it('should format permissions correctly', () => {
            (0, chai_1.expect)(converter.formatPermissions(0o755)).to.equal('rwxr-xr-x');
            (0, chai_1.expect)(converter.formatPermissions(0o644)).to.equal('rw-r--r--');
            (0, chai_1.expect)(converter.formatPermissions(0o600)).to.equal('rw-------');
            (0, chai_1.expect)(converter.formatPermissions(0o777)).to.equal('rwxrwxrwx');
        });
    });
    describe('Default modes', () => {
        it('should provide correct default file mode', () => {
            const fileMode = converter.getDefaultFileMode();
            (0, chai_1.expect)(converter.isRegularFile(fileMode)).to.be.true;
            (0, chai_1.expect)(fileMode & 0o777).to.equal(0o664);
        });
        it('should provide correct default directory mode', () => {
            const dirMode = converter.getDefaultDirectoryMode();
            (0, chai_1.expect)(converter.isDirectory(dirMode)).to.be.true;
            (0, chai_1.expect)(dirMode & 0o777).to.equal(0o775);
        });
    });
});
