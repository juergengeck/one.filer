# ProjFS Directory Enumeration - Final Fix

## Root Cause Identified

The "Invalid argument" error occurs because `ThreadSafeFunction.BlockingCall()` requires two parameters:
1. Data pointer (can be nullptr)
2. Callback function

## The Fix

In `projfs_complete.cpp`, all three BlockingCall invocations were missing the first parameter:

```cpp
// WRONG:
context->getDirectoryEnumeration.BlockingCall(callback);

// CORRECT:
context->getDirectoryEnumeration.BlockingCall(nullptr, callback);
```

## Changes Applied

1. Line 223: `context->getDirectoryEnumeration.BlockingCall(nullptr, callback);`
2. Line 95: `context->getPlaceholderInfo.BlockingCall(nullptr, callback);`
3. Line 143: `context->getFileData.BlockingCall(nullptr, callback);`

## Current Status

✅ All code fixes have been applied:
- PrjMarkDirectoryAsPlaceholder added
- BlockingCall parameters fixed
- Error handling added
- Debug logging added

❌ Native module rebuild blocked by file lock

## To Complete Testing

1. Reboot or wait for file lock to release
2. Run: `cd one.projfs && npm run build:native`
3. Test: `node run-projfs-only.js`

## Expected Result

With these fixes, directory enumeration should work:
- Native callbacks will execute without "Invalid argument" error
- Entries will be added to Windows buffer
- File Explorer will show the 5 directories (chats, debug, invites, objects, types)

## Technical Details

The ThreadSafeFunction API in N-API requires:
```cpp
void BlockingCall(DataType* data, Callback callback);
```

Since we don't need to pass data to the callback, we use `nullptr` for the data parameter.