#ifndef PROJFS_PROVIDER_H
#define PROJFS_PROVIDER_H

#include <windows.h>
#include <projectedfslib.h>
#include <string>
#include <memory>
#include <atomic>
#include <unordered_map>
#include <mutex>
#include <vector>
#include <condition_variable>
#include <chrono>
#include "sync_storage.h"
#include "async_bridge.h"
#include "content_cache.h"

namespace oneifsprojfs {

// Helper for GUID hashing
struct GuidHash {
    size_t operator()(const GUID& guid) const {
        const uint64_t* p = reinterpret_cast<const uint64_t*>(&guid);
        return std::hash<uint64_t>()(p[0]) ^ std::hash<uint64_t>()(p[1]);
    }
};

// Helper for GUID comparison
inline bool operator==(const GUID& a, const GUID& b) {
    return memcmp(&a, &b, sizeof(GUID)) == 0;
}

// Enumeration state tracking
struct EnumerationState {
    std::vector<std::string> entries;
    size_t nextIndex = 0;
    bool isLoading = false;  // Prevent duplicate fetches
    bool isComplete = false; // Mark when fetch is done
    int callCount = 0;       // Track calls to detect loops
    static constexpr int MAX_CALLS_PER_ENUM = 100; // Safety limit
};

struct ProviderStats {
    std::atomic<uint64_t> placeholderRequests{0};
    std::atomic<uint64_t> fileDataRequests{0};
    std::atomic<uint64_t> directoryEnumerations{0};
    std::atomic<uint64_t> enumerationCallbacks{0};
    std::atomic<uint64_t> activeEnumerations{0};
    std::atomic<uint64_t> bytesRead{0};
    std::atomic<uint64_t> cacheHits{0};
    std::atomic<uint64_t> cacheMisses{0};
};

class ProjFSProvider {
public:
    ProjFSProvider(const std::string& instancePath);
    ~ProjFSProvider();

    // Set async bridge for metadata operations
    void SetAsyncBridge(std::shared_ptr<AsyncBridge> bridge) { 
        asyncBridge_ = bridge; 
        if (bridge) {
            cache_ = bridge->GetCache();
        }
    }
    
    // Start/stop virtualization
    bool Start(const std::string& virtualRoot);
    void Stop();
    bool IsRunning() const;
    
    // Get statistics
    const ProviderStats& GetStats() const { return stats_; }
    
    // Get last error
    std::string GetLastError() const { return lastError_; }
    
    // Expose storage for metadata queries when JS omits fields
    inline SyncStorage* GetStorage() const { return storage_.get(); }

private:
    // ProjFS callbacks
    static HRESULT CALLBACK GetPlaceholderInfoCallback(const PRJ_CALLBACK_DATA* callbackData);
    static HRESULT CALLBACK GetFileDataCallback(const PRJ_CALLBACK_DATA* callbackData,
                                                UINT64 byteOffset,
                                                UINT32 length);
    static HRESULT CALLBACK QueryFileNameCallback(const PRJ_CALLBACK_DATA* callbackData);
    static HRESULT CALLBACK StartDirectoryEnumerationCallback(const PRJ_CALLBACK_DATA* callbackData,
                                                              const GUID* enumerationId);
    static HRESULT CALLBACK GetDirectoryEnumerationCallback(const PRJ_CALLBACK_DATA* callbackData,
                                                            const GUID* enumerationId,
                                                            PCWSTR searchExpression,
                                                            PRJ_DIR_ENTRY_BUFFER_HANDLE dirEntryBufferHandle);
    static HRESULT CALLBACK EndDirectoryEnumerationCallback(const PRJ_CALLBACK_DATA* callbackData,
                                                           const GUID* enumerationId);
    
    // Notification callbacks
    static HRESULT CALLBACK NotificationCallback(const PRJ_CALLBACK_DATA* callbackData,
                                                BOOLEAN isDirectory,
                                                PRJ_NOTIFICATION notification,
                                                PCWSTR destinationFileName,
                                                PRJ_NOTIFICATION_PARAMETERS* operationParameters);

    // Helper methods
    std::wstring ToWide(const std::string& str);
    std::string ToUtf8(const std::wstring& wstr);
    PRJ_FILE_BASIC_INFO CreateFileBasicInfo(const ObjectMetadata& metadata);
    
    // Member variables
    std::unique_ptr<SyncStorage> storage_;  // For direct BLOB/CLOB access
    std::shared_ptr<AsyncBridge> asyncBridge_;  // For metadata and structure
    std::shared_ptr<ContentCache> cache_;  // Shared cache
    std::wstring virtualRoot_;
    PRJ_NAMESPACE_VIRTUALIZATION_CONTEXT virtualizationContext_;
    GUID virtualizationInstanceId_;
    bool isRunning_;
    
    // Statistics
    mutable ProviderStats stats_;
    std::string lastError_;
    
    // Enumeration state tracking
    mutable std::mutex enumerationMutex_;
    mutable std::unordered_map<GUID, EnumerationState, GuidHash> enumerationStates_;
    mutable std::condition_variable enumerationCv_;
    
    // Global directory cache to prevent concurrent fetch issues
    struct DirectoryCache {
        std::vector<std::string> entries;
        std::chrono::steady_clock::time_point lastFetch;
        bool isFetching = false;
        std::condition_variable fetchCv;
    };
    mutable std::mutex directoryCacheMutex_;
    mutable std::unordered_map<std::string, DirectoryCache> directoryCache_;
    static constexpr std::chrono::milliseconds CACHE_VALIDITY_MS{5000}; // 5 seconds
    
    // Track if root enumeration has been completed to prevent duplicates
    mutable std::atomic<bool> rootEnumerationComplete_{false};
    mutable std::atomic<int> rootEnumerationCount_{0};
};

} // namespace oneifsprojfs

#endif // PROJFS_PROVIDER_H