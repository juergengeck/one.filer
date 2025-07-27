#include "projfs_wrapper.h"
#include <windows.h>
#include <chrono>
#include <codecvt>
#include <locale>

// Static member to store instance pointer for callbacks
static ProjFSWrapper* g_instance = nullptr;

Napi::Object ProjFSWrapper::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "ProjFSWrapper", {
        InstanceMethod("start", &ProjFSWrapper::Start),
        InstanceMethod("stop", &ProjFSWrapper::Stop),
        InstanceMethod("isRunning", &ProjFSWrapper::IsRunning),
        InstanceMethod("getStats", &ProjFSWrapper::GetStats)
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("ProjFSWrapper", func);
    return exports;
}

ProjFSWrapper::ProjFSWrapper(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<ProjFSWrapper>(info),
      virtualizationContext_(nullptr),
      isRunning_(false) {
    
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Virtualization root path required").ThrowAsJavaScriptException();
        return;
    }
    
    virtualizationRootPath_ = StringToWString(info[0].As<Napi::String>().Utf8Value());
    CoCreateGuid(&instanceId_);
    
    callbackContext_ = std::make_unique<CallbackContext>();
    callbackContext_->wrapper = this;
    callbackContext_->env = env;
    
    g_instance = this;
    
    // Initialize statistics
    stats_.startTime = std::chrono::steady_clock::now();
}

ProjFSWrapper::~ProjFSWrapper() {
    if (isRunning_) {
        PrjStopVirtualizing(virtualizationContext_);
    }
    g_instance = nullptr;
}

Napi::Value ProjFSWrapper::Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (isRunning_) {
        Napi::Error::New(env, "Already running").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Get JavaScript callbacks object
    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Callbacks object required").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    Napi::Object callbacks = info[0].As<Napi::Object>();
    
    // Create thread-safe functions for callbacks
    auto placeholderFunc = callbacks.Get("onGetPlaceholderInfo").As<Napi::Function>();
    placeholderInfoCallback_ = Napi::ThreadSafeFunction::New(
        env,
        placeholderFunc,
        "onGetPlaceholderInfo",
        0,
        1
    );
    
    auto fileDataFunc = callbacks.Get("onGetFileData").As<Napi::Function>();
    fileDataCallback_ = Napi::ThreadSafeFunction::New(
        env,
        fileDataFunc,
        "onGetFileData",
        0,
        1
    );
    
    auto dirEnumFunc = callbacks.Get("onGetDirectoryEnumeration").As<Napi::Function>();
    directoryEnumCallback_ = Napi::ThreadSafeFunction::New(
        env,
        dirEnumFunc,
        "onGetDirectoryEnumeration",
        0,
        1
    );
    
    auto notifyFunc = callbacks.Get("onNotifyFileHandleClosedFileModified").As<Napi::Function>();
    notificationCallback_ = Napi::ThreadSafeFunction::New(
        env,
        notifyFunc,
        "onNotifyFileHandleClosedFileModified",
        0,
        1
    );
    
    // Set up ProjFS callbacks
    PRJ_CALLBACKS callbacks_native = {};
    callbacks_native.GetPlaceholderInfoCallback = GetPlaceholderInfoCallback;
    callbacks_native.GetFileDataCallback = GetFileDataCallback;
    callbacks_native.GetDirectoryEnumerationCallback = GetDirectoryEnumerationCallback;
    callbacks_native.NotificationCallback = NotificationCallback;
    
    // Configure notifications
    PRJ_NOTIFICATION_MAPPING notificationMappings[] = {
        { L"", nullptr, PRJ_NOTIFY_FILE_HANDLE_CLOSED_FILE_MODIFIED | 
               PRJ_NOTIFY_FILE_HANDLE_CLOSED_FILE_DELETED }
    };
    
    // Start virtualization
    HRESULT hr = PrjMarkDirectoryAsPlaceholder(
        virtualizationRootPath_.c_str(),
        nullptr,
        nullptr,
        &instanceId_
    );
    
    if (FAILED(hr) && hr != HRESULT_FROM_WIN32(ERROR_REPARSE_POINT_ENCOUNTERED)) {
        return CreateErrorObject(env, hr, "Failed to mark directory as placeholder");
    }
    
    PRJ_STARTVIRTUALIZING_OPTIONS options = {};
    options.PoolThreadCount = 0;  // Use default
    options.ConcurrentThreadCount = 0;  // Use default
    options.NotificationMappings = notificationMappings;
    options.NotificationMappingsCount = ARRAYSIZE(notificationMappings);
    
    hr = PrjStartVirtualizing(
        virtualizationRootPath_.c_str(),
        &callbacks_native,
        this,  // Context
        &options,
        &virtualizationContext_
    );
    
    if (FAILED(hr)) {
        return CreateErrorObject(env, hr, "Failed to start virtualization");
    }
    
    isRunning_ = true;
    return Napi::Boolean::New(env, true);
}

Napi::Value ProjFSWrapper::Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!isRunning_) {
        return Napi::Boolean::New(env, false);
    }
    
    PrjStopVirtualizing(virtualizationContext_);
    virtualizationContext_ = nullptr;
    isRunning_ = false;
    
    // Release thread-safe functions
    placeholderInfoCallback_.Release();
    fileDataCallback_.Release();
    directoryEnumCallback_.Release();
    notificationCallback_.Release();
    
    return Napi::Boolean::New(env, true);
}

Napi::Value ProjFSWrapper::IsRunning(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), isRunning_.load());
}

Napi::Value ProjFSWrapper::GetStats(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object stats = Napi::Object::New(env);
    
    auto now = std::chrono::steady_clock::now();
    auto uptime = std::chrono::duration_cast<std::chrono::seconds>(now - stats_.startTime).count();
    
    stats.Set("placeholderInfoRequests", Napi::Number::New(env, stats_.placeholderInfoRequests.load()));
    stats.Set("fileDataRequests", Napi::Number::New(env, stats_.fileDataRequests.load()));
    stats.Set("directoryEnumerations", Napi::Number::New(env, stats_.directoryEnumerations.load()));
    stats.Set("fileModifications", Napi::Number::New(env, stats_.fileModifications.load()));
    stats.Set("totalBytesRead", Napi::BigInt::New(env, stats_.totalBytesRead.load()));
    stats.Set("totalBytesWritten", Napi::BigInt::New(env, stats_.totalBytesWritten.load()));
    stats.Set("uptime", Napi::Number::New(env, uptime));
    
    return stats;
}

// ProjFS Callbacks
HRESULT CALLBACK ProjFSWrapper::GetPlaceholderInfoCallback(
    const PRJ_CALLBACK_DATA* callbackData
) {
    if (!g_instance) return E_FAIL;
    
    g_instance->stats_.placeholderInfoRequests++;
    
    struct CallbackData {
        std::string relativePath;
        HRESULT result;
        PRJ_PLACEHOLDER_INFO placeholderInfo;
        bool completed;
        std::condition_variable cv;
        std::mutex mutex;
    };
    
    auto data = std::make_shared<CallbackData>();
    data->relativePath = g_instance->WStringToString(callbackData->FilePathName);
    data->completed = false;
    data->result = E_FAIL;
    
    // Call JavaScript function
    auto status = g_instance->placeholderInfoCallback_.BlockingCall(
        [data](Napi::Env env, Napi::Function jsCallback) {
            try {
                // Call JavaScript with relative path
                Napi::Value result = jsCallback.Call({
                    Napi::String::New(env, data->relativePath)
                });
                
                // Parse result
                if (result.IsObject()) {
                    Napi::Object info = result.As<Napi::Object>();
                    
                    // Initialize placeholder info
                    memset(&data->placeholderInfo, 0, sizeof(PRJ_PLACEHOLDER_INFO));
                    data->placeholderInfo.FileBasicInfo.IsDirectory = 
                        info.Get("isDirectory").As<Napi::Boolean>().Value();
                    data->placeholderInfo.FileBasicInfo.FileSize = 
                        info.Get("fileSize").As<Napi::BigInt>().Int64Value(nullptr);
                    
                    // Set timestamps
                    FILETIME ft;
                    GetSystemTimeAsFileTime(&ft);
                    data->placeholderInfo.FileBasicInfo.CreationTime = ft;
                    data->placeholderInfo.FileBasicInfo.LastWriteTime = ft;
                    data->placeholderInfo.FileBasicInfo.LastAccessTime = ft;
                    data->placeholderInfo.FileBasicInfo.ChangeTime = ft;
                    
                    if (info.Has("fileAttributes")) {
                        data->placeholderInfo.FileBasicInfo.FileAttributes = 
                            info.Get("fileAttributes").As<Napi::Number>().Uint32Value();
                    } else {
                        data->placeholderInfo.FileBasicInfo.FileAttributes = 
                            data->placeholderInfo.FileBasicInfo.IsDirectory ? 
                            FILE_ATTRIBUTE_DIRECTORY : FILE_ATTRIBUTE_NORMAL;
                    }
                    
                    data->result = S_OK;
                }
            } catch (const std::exception& e) {
                data->result = E_FAIL;
            }
            
            std::lock_guard<std::mutex> lock(data->mutex);
            data->completed = true;
            data->cv.notify_one();
        }
    );
    
    if (status != napi_ok) {
        return E_FAIL;
    }
    
    // Wait for JavaScript callback to complete
    std::unique_lock<std::mutex> lock(data->mutex);
    data->cv.wait(lock, [&data] { return data->completed; });
    
    if (SUCCEEDED(data->result)) {
        // Write placeholder info
        return PrjWritePlaceholderInfo(
            g_instance->virtualizationContext_,
            callbackData->FilePathName,
            &data->placeholderInfo,
            sizeof(data->placeholderInfo)
        );
    }
    
    return data->result;
}

HRESULT CALLBACK ProjFSWrapper::GetFileDataCallback(
    const PRJ_CALLBACK_DATA* callbackData,
    UINT64 byteOffset,
    UINT32 length
) {
    if (!g_instance) return E_FAIL;
    
    g_instance->stats_.fileDataRequests++;
    g_instance->stats_.totalBytesRead += length;
    
    // TODO: Marshal to JavaScript and get result
    return HRESULT_FROM_WIN32(ERROR_NOT_IMPLEMENTED);
}

HRESULT CALLBACK ProjFSWrapper::GetDirectoryEnumerationCallback(
    const PRJ_CALLBACK_DATA* callbackData,
    const GUID* enumerationId,
    PCWSTR searchExpression,
    PRJ_DIR_ENTRY_BUFFER_HANDLE dirEntryBufferHandle
) {
    if (!g_instance) return E_FAIL;
    
    g_instance->stats_.directoryEnumerations++;
    
    // TODO: Marshal to JavaScript and get result
    return HRESULT_FROM_WIN32(ERROR_NOT_IMPLEMENTED);
}

HRESULT CALLBACK ProjFSWrapper::NotificationCallback(
    const PRJ_CALLBACK_DATA* callbackData,
    BOOLEAN isDirectory,
    PRJ_NOTIFICATION notification,
    PCWSTR destinationFileName,
    PRJ_NOTIFICATION_PARAMETERS* notificationParameters
) {
    if (!g_instance) return E_FAIL;
    
    if (notification == PRJ_NOTIFICATION_FILE_HANDLE_CLOSED_FILE_MODIFIED ||
        notification == PRJ_NOTIFICATION_FILE_HANDLE_CLOSED_FILE_DELETED) {
        g_instance->stats_.fileModifications++;
    }
    
    // TODO: Marshal to JavaScript and get result
    return S_OK;
}

// Helper methods
std::wstring ProjFSWrapper::StringToWString(const std::string& str) {
    if (str.empty()) return std::wstring();
    int size_needed = MultiByteToWideChar(CP_UTF8, 0, &str[0], (int)str.size(), NULL, 0);
    std::wstring wstrTo(size_needed, 0);
    MultiByteToWideChar(CP_UTF8, 0, &str[0], (int)str.size(), &wstrTo[0], size_needed);
    return wstrTo;
}

std::string ProjFSWrapper::WStringToString(const std::wstring& wstr) {
    if (wstr.empty()) return std::string();
    int size_needed = WideCharToMultiByte(CP_UTF8, 0, &wstr[0], (int)wstr.size(), NULL, 0, NULL, NULL);
    std::string strTo(size_needed, 0);
    WideCharToMultiByte(CP_UTF8, 0, &wstr[0], (int)wstr.size(), &strTo[0], size_needed, NULL, NULL);
    return strTo;
}

Napi::Value ProjFSWrapper::CreateErrorObject(Napi::Env env, HRESULT hr, const std::string& message) {
    Napi::Object error = Napi::Object::New(env);
    error.Set("message", Napi::String::New(env, message));
    error.Set("code", Napi::Number::New(env, hr));
    return error;
}