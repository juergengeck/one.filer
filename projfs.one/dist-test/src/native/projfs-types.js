"use strict";
/**
 * TypeScript type definitions for Windows ProjectedFS
 *
 * These types represent the interface between the Node.js layer
 * and the native C++ ProjFS wrapper.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileAttributes = exports.NotificationType = void 0;
/**
 * Notification types for file operations
 */
var NotificationType;
(function (NotificationType) {
    NotificationType[NotificationType["FILE_OPENED"] = 1] = "FILE_OPENED";
    NotificationType[NotificationType["NEW_FILE_CREATED"] = 2] = "NEW_FILE_CREATED";
    NotificationType[NotificationType["FILE_OVERWRITTEN"] = 4] = "FILE_OVERWRITTEN";
    NotificationType[NotificationType["PRE_DELETE"] = 8] = "PRE_DELETE";
    NotificationType[NotificationType["PRE_RENAME"] = 16] = "PRE_RENAME";
    NotificationType[NotificationType["PRE_SET_HARDLINK"] = 32] = "PRE_SET_HARDLINK";
    NotificationType[NotificationType["FILE_RENAMED"] = 64] = "FILE_RENAMED";
    NotificationType[NotificationType["HARDLINK_CREATED"] = 128] = "HARDLINK_CREATED";
    NotificationType[NotificationType["FILE_HANDLE_CLOSED_NO_MODIFICATION"] = 256] = "FILE_HANDLE_CLOSED_NO_MODIFICATION";
    NotificationType[NotificationType["FILE_HANDLE_CLOSED_FILE_MODIFIED"] = 512] = "FILE_HANDLE_CLOSED_FILE_MODIFIED";
    NotificationType[NotificationType["FILE_HANDLE_CLOSED_FILE_DELETED"] = 1024] = "FILE_HANDLE_CLOSED_FILE_DELETED";
    NotificationType[NotificationType["FILE_PRE_CONVERT_TO_FULL"] = 2048] = "FILE_PRE_CONVERT_TO_FULL";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
/**
 * Windows file attributes
 */
var FileAttributes;
(function (FileAttributes) {
    FileAttributes[FileAttributes["READONLY"] = 1] = "READONLY";
    FileAttributes[FileAttributes["HIDDEN"] = 2] = "HIDDEN";
    FileAttributes[FileAttributes["SYSTEM"] = 4] = "SYSTEM";
    FileAttributes[FileAttributes["DIRECTORY"] = 16] = "DIRECTORY";
    FileAttributes[FileAttributes["ARCHIVE"] = 32] = "ARCHIVE";
    FileAttributes[FileAttributes["DEVICE"] = 64] = "DEVICE";
    FileAttributes[FileAttributes["NORMAL"] = 128] = "NORMAL";
    FileAttributes[FileAttributes["TEMPORARY"] = 256] = "TEMPORARY";
    FileAttributes[FileAttributes["SPARSE_FILE"] = 512] = "SPARSE_FILE";
    FileAttributes[FileAttributes["REPARSE_POINT"] = 1024] = "REPARSE_POINT";
    FileAttributes[FileAttributes["COMPRESSED"] = 2048] = "COMPRESSED";
    FileAttributes[FileAttributes["OFFLINE"] = 4096] = "OFFLINE";
    FileAttributes[FileAttributes["NOT_CONTENT_INDEXED"] = 8192] = "NOT_CONTENT_INDEXED";
    FileAttributes[FileAttributes["ENCRYPTED"] = 16384] = "ENCRYPTED";
})(FileAttributes || (exports.FileAttributes = FileAttributes = {}));
