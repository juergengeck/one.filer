#include "projfs_wrapper.h"
#include <vector>
#include <string>

/**
 * Callback marshaling implementation
 * 
 * These functions handle the thread-safe marshaling of ProjFS callbacks
 * from the native thread pool to JavaScript.
 */

// Structure to pass data to JavaScript callbacks
struct PlaceholderInfoRequest {
    std::wstring relativePath;
    PRJ_PLACEHOLDER_INFO* placeholderInfo;
    size_t placeholderInfoSize;
    HANDLE eventHandle;
    HRESULT result;
};

struct FileDataRequest {
    std::wstring relativePath;
    UINT64 byteOffset;
    UINT32 length;
    void* dataBuffer;
    HANDLE eventHandle;
    HRESULT result;
    UINT32 bytesReturned;
};

struct DirectoryEnumRequest {
    std::wstring relativePath;
    std::wstring searchExpression;
    PRJ_DIR_ENTRY_BUFFER_HANDLE dirEntryBufferHandle;
    HANDLE eventHandle;
    HRESULT result;
};

// Enhanced callback implementation
HRESULT CALLBACK ProjFSWrapper::GetPlaceholderInfoCallback(
    const PRJ_CALLBACK_DATA* callbackData
) {
    if (!g_instance) return E_FAIL;
    
    auto wrapper = static_cast<ProjFSWrapper*>(callbackData->InstanceContext);
    wrapper->stats_.placeholderInfoRequests++;
    
    // Create request structure
    auto request = std::make_unique<PlaceholderInfoRequest>();
    request->relativePath = callbackData->FilePathName;
    request->placeholderInfoSize = callbackData->VersionInfo.ContentID.FileSize;
    request->eventHandle = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    
    // Allocate buffer for placeholder info
    request->placeholderInfo = static_cast<PRJ_PLACEHOLDER_INFO*>(
        PrjAllocateAlignedBuffer(callbackData->NamespaceVirtualizationContext, sizeof(PRJ_PLACEHOLDER_INFO))
    );
    
    if (!request->placeholderInfo) {
        CloseHandle(request->eventHandle);
        return E_OUTOFMEMORY;
    }
    
    // Call JavaScript function
    auto status = wrapper->placeholderInfoCallback_.BlockingCall(
        [](Napi::Env env, Napi::Function jsCallback, PlaceholderInfoRequest* data) {
            // Convert path to JavaScript string
            std::string path = WStringToString(data->relativePath);
            
            // Call JavaScript callback
            Napi::Value result = jsCallback.Call({
                Napi::String::New(env, path)
            });
            
            // Handle promise result
            if (result.IsPromise()) {
                // For now, we need synchronous behavior
                // TODO: Implement proper async handling
                data->result = S_OK;
            } else if (result.IsObject()) {
                Napi::Object info = result.As<Napi::Object>();
                
                // Extract placeholder info from JavaScript object
                data->placeholderInfo->FileBasicInfo.IsDirectory = 
                    info.Get("isDirectory").As<Napi::Boolean>().Value();
                data->placeholderInfo->FileBasicInfo.FileSize = 
                    info.Get("fileSize").As<Napi::BigInt>().Int64Value();
                data->placeholderInfo->FileBasicInfo.FileAttributes = 
                    info.Get("fileAttributes").As<Napi::Number>().Uint32Value();
                
                // Set timestamps
                FILETIME ft;
                GetSystemTimeAsFileTime(&ft);
                data->placeholderInfo->FileBasicInfo.CreationTime = ft;
                data->placeholderInfo->FileBasicInfo.LastAccessTime = ft;
                data->placeholderInfo->FileBasicInfo.LastWriteTime = ft;
                data->placeholderInfo->FileBasicInfo.ChangeTime = ft;
                
                data->result = S_OK;
            } else {
                data->result = E_FAIL;
            }
            
            // Signal completion
            SetEvent(data->eventHandle);
        },
        request.get()
    );
    
    if (status != napi_ok) {
        PrjFreeAlignedBuffer(request->placeholderInfo);
        CloseHandle(request->eventHandle);
        return E_FAIL;
    }
    
    // Wait for JavaScript to complete
    WaitForSingleObject(request->eventHandle, INFINITE);
    CloseHandle(request->eventHandle);
    
    // Write placeholder info if successful
    HRESULT hr = request->result;
    if (SUCCEEDED(hr)) {
        hr = PrjWritePlaceholderInfo(
            callbackData->NamespaceVirtualizationContext,
            callbackData->FilePathName,
            request->placeholderInfo,
            sizeof(PRJ_PLACEHOLDER_INFO)
        );
    }
    
    PrjFreeAlignedBuffer(request->placeholderInfo);
    return hr;
}

HRESULT CALLBACK ProjFSWrapper::GetFileDataCallback(
    const PRJ_CALLBACK_DATA* callbackData,
    UINT64 byteOffset,
    UINT32 length
) {
    if (!g_instance) return E_FAIL;
    
    auto wrapper = static_cast<ProjFSWrapper*>(callbackData->InstanceContext);
    wrapper->stats_.fileDataRequests++;
    
    // Create request structure
    auto request = std::make_unique<FileDataRequest>();
    request->relativePath = callbackData->FilePathName;
    request->byteOffset = byteOffset;
    request->length = length;
    request->eventHandle = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    
    // Allocate aligned buffer for file data
    request->dataBuffer = PrjAllocateAlignedBuffer(
        callbackData->NamespaceVirtualizationContext,
        length
    );
    
    if (!request->dataBuffer) {
        CloseHandle(request->eventHandle);
        return E_OUTOFMEMORY;
    }
    
    // Call JavaScript function
    auto status = wrapper->fileDataCallback_.BlockingCall(
        [](Napi::Env env, Napi::Function jsCallback, FileDataRequest* data) {
            std::string path = WStringToString(data->relativePath);
            
            // Call JavaScript callback with path, offset, length
            Napi::Value result = jsCallback.Call({
                Napi::String::New(env, path),
                Napi::BigInt::New(env, data->byteOffset),
                Napi::Number::New(env, data->length)
            });
            
            // Handle result
            if (result.IsBuffer()) {
                Napi::Buffer<uint8_t> buffer = result.As<Napi::Buffer<uint8_t>>();
                size_t bufferLength = buffer.Length();
                
                // Copy data to aligned buffer
                data->bytesReturned = static_cast<UINT32>(
                    std::min<size_t>(bufferLength, data->length)
                );
                memcpy(data->dataBuffer, buffer.Data(), data->bytesReturned);
                data->result = S_OK;
            } else {
                data->result = E_FAIL;
                data->bytesReturned = 0;
            }
            
            SetEvent(data->eventHandle);
        },
        request.get()
    );
    
    if (status != napi_ok) {
        PrjFreeAlignedBuffer(request->dataBuffer);
        CloseHandle(request->eventHandle);
        return E_FAIL;
    }
    
    // Wait for JavaScript to complete
    WaitForSingleObject(request->eventHandle, INFINITE);
    CloseHandle(request->eventHandle);
    
    // Write file data if successful
    HRESULT hr = request->result;
    if (SUCCEEDED(hr) && request->bytesReturned > 0) {
        hr = PrjWriteFileData(
            callbackData->NamespaceVirtualizationContext,
            &callbackData->DataStreamId,
            request->dataBuffer,
            byteOffset,
            request->bytesReturned
        );
        
        wrapper->stats_.totalBytesRead += request->bytesReturned;
    }
    
    PrjFreeAlignedBuffer(request->dataBuffer);
    return hr;
}

HRESULT CALLBACK ProjFSWrapper::GetDirectoryEnumerationCallback(
    const PRJ_CALLBACK_DATA* callbackData,
    const GUID* enumerationId,
    PCWSTR searchExpression,
    PRJ_DIR_ENTRY_BUFFER_HANDLE dirEntryBufferHandle
) {
    if (!g_instance) return E_FAIL;
    
    auto wrapper = static_cast<ProjFSWrapper*>(callbackData->InstanceContext);
    wrapper->stats_.directoryEnumerations++;
    
    // Create request structure
    auto request = std::make_unique<DirectoryEnumRequest>();
    request->relativePath = callbackData->FilePathName;
    request->searchExpression = searchExpression ? searchExpression : L"*";
    request->dirEntryBufferHandle = dirEntryBufferHandle;
    request->eventHandle = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    
    // Call JavaScript function
    auto status = wrapper->directoryEnumCallback_.BlockingCall(
        [](Napi::Env env, Napi::Function jsCallback, DirectoryEnumRequest* data) {
            std::string path = WStringToString(data->relativePath);
            std::string pattern = WStringToString(data->searchExpression);
            
            // Call JavaScript callback
            Napi::Value result = jsCallback.Call({
                Napi::String::New(env, path),
                Napi::String::New(env, pattern)
            });
            
            // Handle result - expect array of directory entries
            if (result.IsArray()) {
                Napi::Array entries = result.As<Napi::Array>();
                
                for (uint32_t i = 0; i < entries.Length(); i++) {
                    Napi::Object entry = entries.Get(i).As<Napi::Object>();
                    
                    // Extract entry information
                    std::string fileName = entry.Get("fileName").As<Napi::String>().Utf8Value();
                    bool isDirectory = entry.Get("isDirectory").As<Napi::Boolean>().Value();
                    int64_t fileSize = entry.Get("fileSize").As<Napi::BigInt>().Int64Value();
                    uint32_t fileAttributes = entry.Get("fileAttributes").As<Napi::Number>().Uint32Value();
                    
                    // Convert to wide string
                    std::wstring wFileName = StringToWString(fileName);
                    
                    // Create file basic info
                    PRJ_FILE_BASIC_INFO fileInfo = {};
                    fileInfo.IsDirectory = isDirectory;
                    fileInfo.FileSize = fileSize;
                    fileInfo.FileAttributes = fileAttributes;
                    
                    // Set timestamps
                    FILETIME ft;
                    GetSystemTimeAsFileTime(&ft);
                    fileInfo.CreationTime = ft;
                    fileInfo.LastAccessTime = ft;
                    fileInfo.LastWriteTime = ft;
                    fileInfo.ChangeTime = ft;
                    
                    // Add entry to enumeration
                    PrjFillDirEntryBuffer(
                        data->dirEntryBufferHandle,
                        wFileName.c_str(),
                        &fileInfo
                    );
                }
                
                data->result = S_OK;
            } else {
                data->result = E_FAIL;
            }
            
            SetEvent(data->eventHandle);
        },
        request.get()
    );
    
    if (status != napi_ok) {
        CloseHandle(request->eventHandle);
        return E_FAIL;
    }
    
    // Wait for JavaScript to complete
    WaitForSingleObject(request->eventHandle, INFINITE);
    CloseHandle(request->eventHandle);
    
    return request->result;
}

HRESULT CALLBACK ProjFSWrapper::NotificationCallback(
    const PRJ_CALLBACK_DATA* callbackData,
    BOOLEAN isDirectory,
    PRJ_NOTIFICATION notification,
    PCWSTR destinationFileName,
    PRJ_NOTIFICATION_PARAMETERS* notificationParameters
) {
    if (!g_instance) return E_FAIL;
    
    auto wrapper = static_cast<ProjFSWrapper*>(callbackData->InstanceContext);
    
    // Only handle file modification notifications
    if (notification != PRJ_NOTIFICATION_FILE_HANDLE_CLOSED_FILE_MODIFIED &&
        notification != PRJ_NOTIFICATION_FILE_HANDLE_CLOSED_FILE_DELETED) {
        return S_OK;
    }
    
    wrapper->stats_.fileModifications++;
    
    // For now, just acknowledge the notification
    // TODO: Implement proper file modification handling
    return S_OK;
}