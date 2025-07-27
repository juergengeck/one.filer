#ifndef PROJFS_WRAPPER_H
#define PROJFS_WRAPPER_H

#include <napi.h>

// Windows SDK version requirements
#ifdef _WIN32
#include <windows.h>
#include <ProjectedFSLib.h>
#pragma comment(lib, "ProjectedFSLib.lib")
#endif

#include <memory>
#include <string>
#include <mutex>
#include <atomic>

class ProjFSWrapper : public Napi::ObjectWrap<ProjFSWrapper> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    ProjFSWrapper(const Napi::CallbackInfo& info);
    ~ProjFSWrapper();

private:
    // Node-API methods
    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value IsRunning(const Napi::CallbackInfo& info);
    Napi::Value GetStats(const Napi::CallbackInfo& info);

    // ProjFS callbacks
    static HRESULT CALLBACK GetPlaceholderInfoCallback(
        const PRJ_CALLBACK_DATA* callbackData
    );
    
    static HRESULT CALLBACK GetFileDataCallback(
        const PRJ_CALLBACK_DATA* callbackData,
        UINT64 byteOffset,
        UINT32 length
    );
    
    static HRESULT CALLBACK GetDirectoryEnumerationCallback(
        const PRJ_CALLBACK_DATA* callbackData,
        const GUID* enumerationId,
        PCWSTR searchExpression,
        PRJ_DIR_ENTRY_BUFFER_HANDLE dirEntryBufferHandle
    );
    
    static HRESULT CALLBACK NotificationCallback(
        const PRJ_CALLBACK_DATA* callbackData,
        BOOLEAN isDirectory,
        PRJ_NOTIFICATION notification,
        PCWSTR destinationFileName,
        PRJ_NOTIFICATION_PARAMETERS* notificationParameters
    );

    // Thread-safe callback functions
    napi_threadsafe_function placeholderInfoCallback_;
    napi_threadsafe_function fileDataCallback_;
    napi_threadsafe_function directoryEnumCallback_;
    napi_threadsafe_function notificationCallback_;

    // Instance data
    PRJ_NAMESPACE_VIRTUALIZATION_CONTEXT virtualizationContext_;
    std::wstring virtualizationRootPath_;
    GUID instanceId_;
    std::atomic<bool> isRunning_;
    
    // Statistics
    struct Stats {
        std::atomic<uint64_t> placeholderInfoRequests{0};
        std::atomic<uint64_t> fileDataRequests{0};
        std::atomic<uint64_t> directoryEnumerations{0};
        std::atomic<uint64_t> fileModifications{0};
        std::atomic<uint64_t> totalBytesRead{0};
        std::atomic<uint64_t> totalBytesWritten{0};
        std::chrono::steady_clock::time_point startTime;
    } stats_;

    // Helper methods
    static std::wstring StringToWString(const std::string& str);
    static std::string WStringToString(const std::wstring& wstr);
    static Napi::Value CreateErrorObject(Napi::Env env, HRESULT hr, const std::string& message);
    
    // Callback context
    struct CallbackContext {
        ProjFSWrapper* wrapper;
        Napi::Env env;
    };
    
    std::unique_ptr<CallbackContext> callbackContext_;
};

#endif // PROJFS_WRAPPER_H