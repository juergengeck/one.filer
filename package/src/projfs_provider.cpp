#include "projfs_provider.h"
#include <iostream>
#include <vector>
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <sstream>
#include <thread>
#include <condition_variable>

#pragma comment(lib, "ProjectedFSLib.lib")

namespace oneifsprojfs {

ProjFSProvider::ProjFSProvider(const std::string& instancePath)
    : storage_(std::make_unique<SyncStorage>(instancePath)),
      virtualizationContext_(nullptr),
      isRunning_(false),
      lastError_("") {
    CoCreateGuid(&virtualizationInstanceId_);
}

ProjFSProvider::~ProjFSProvider() {
    Stop();
}

bool ProjFSProvider::Start(const std::string& virtualRoot) {
    if (isRunning_) {
        return false;
    }

    virtualRoot_ = ToWide(virtualRoot);

    // Ensure the virtualization root exists
    if (!CreateDirectoryW(virtualRoot_.c_str(), nullptr)) {
        DWORD lastErr = static_cast<DWORD>(::GetLastError());
        if (lastErr != ERROR_ALREADY_EXISTS) {
            lastError_ = "Failed to create virtual root directory. Error: " + std::to_string(lastErr);
            return false;
        }
    }

    // Mark the directory as the virtualization root
    HRESULT hr = PrjMarkDirectoryAsPlaceholder(
        virtualRoot_.c_str(),
        nullptr,  // targetPathName
        nullptr,  // versionInfo
        &virtualizationInstanceId_
    );

    if (FAILED(hr) && hr != HRESULT_FROM_WIN32(ERROR_REPARSE_POINT_ENCOUNTERED)) {
        lastError_ = "PrjMarkDirectoryAsPlaceholder failed with HRESULT: " + std::to_string(hr);
        return false;
    }

    // Set up callbacks
    PRJ_CALLBACKS callbacks = {};
    callbacks.GetPlaceholderInfoCallback = GetPlaceholderInfoCallback;
    callbacks.GetFileDataCallback = GetFileDataCallback;
    callbacks.QueryFileNameCallback = QueryFileNameCallback;
    callbacks.StartDirectoryEnumerationCallback = StartDirectoryEnumerationCallback;
    callbacks.GetDirectoryEnumerationCallback = GetDirectoryEnumerationCallback;
    callbacks.EndDirectoryEnumerationCallback = EndDirectoryEnumerationCallback;
    callbacks.NotificationCallback = NotificationCallback;

    // Start virtualization
    PRJ_STARTVIRTUALIZING_OPTIONS options = {};
    options.PoolThreadCount = 0;  // Use default
    options.ConcurrentThreadCount = 0;  // Use default
    // options.EnableNegativePathCache = TRUE; // May not be available in all SDK versions

    hr = PrjStartVirtualizing(
        virtualRoot_.c_str(),
        &callbacks,
        this,  // instanceContext
        &options,
        &virtualizationContext_
    );

    if (FAILED(hr)) {
        lastError_ = "PrjStartVirtualizing failed with HRESULT: " + std::to_string(hr);
        return false;
    }

    isRunning_ = true;
    return true;
}

void ProjFSProvider::Stop() {
    if (isRunning_ && virtualizationContext_) {
        PrjStopVirtualizing(virtualizationContext_);
        virtualizationContext_ = nullptr;
        isRunning_ = false;
    }
}

bool ProjFSProvider::IsRunning() const {
    return isRunning_;
}

// ProjFS Callbacks

HRESULT CALLBACK ProjFSProvider::GetPlaceholderInfoCallback(const PRJ_CALLBACK_DATA* callbackData) {
    auto* provider = static_cast<ProjFSProvider*>(callbackData->InstanceContext);
    if (!provider) {
        return HRESULT_FROM_WIN32(ERROR_INVALID_PARAMETER);
    }
    provider->stats_.placeholderRequests++;

    // Convert Windows path to Unix-style path
    std::string relativePath = provider->ToUtf8(callbackData->FilePathName);
    std::replace(relativePath.begin(), relativePath.end(), '\\', '/');
    std::string virtualPath = relativePath.empty() ? "/" : "/" + relativePath;
    
    // Debug: Log every placeholder request
    if (provider->asyncBridge_) {
        std::stringstream msg;
        msg << "[PLACEHOLDER] Called for: '" << virtualPath << "'";
        provider->asyncBridge_->EmitDebugMessage(msg.str());
    }
    
    // Prefer authoritative storage metadata when available
    {
        ObjectMetadata metadata = provider->storage_->GetVirtualPathMetadata(virtualPath);
        if (metadata.exists) {
            PRJ_PLACEHOLDER_INFO placeholderInfo = {};
            placeholderInfo.FileBasicInfo = provider->CreateFileBasicInfo(metadata);
            return PrjWritePlaceholderInfo(
                callbackData->NamespaceVirtualizationContext,
                callbackData->FilePathName,
                &placeholderInfo,
                sizeof(placeholderInfo)
            );
        }
    }

    
    // Try cache first, then async bridge, then not found - let file system be authoritative
    auto cache = provider->asyncBridge_ ? provider->asyncBridge_->GetCache() : nullptr;
    if (cache) {
        auto fileInfo = cache->GetFileInfo(virtualPath);
        if (fileInfo) {
            // Use cached metadata as-is from file system
            ObjectMetadata metadata;
            metadata.exists = true;
            metadata.isDirectory = fileInfo->isDirectory;
            metadata.size = fileInfo->size;
            metadata.type = fileInfo->isDirectory ? "DIRECTORY" : "FILE";
            
            if (provider->asyncBridge_) {
                std::stringstream msg;
                msg << "[TRACE] Cache hit for " << virtualPath 
                    << " - isDirectory: " << metadata.isDirectory
                    << ", size: " << metadata.size;
                provider->asyncBridge_->EmitDebugMessage(msg.str());
            }
            
            PRJ_PLACEHOLDER_INFO placeholderInfo = {};
            placeholderInfo.FileBasicInfo = provider->CreateFileBasicInfo(metadata);

            provider->stats_.cacheHits++;
            return PrjWritePlaceholderInfo(
                callbackData->NamespaceVirtualizationContext,
                callbackData->FilePathName,
                &placeholderInfo,
                sizeof(placeholderInfo)
            );
        }
        provider->stats_.cacheMisses++;
        
        if (provider->asyncBridge_) {
            std::stringstream msg;
            msg << "[TRACE] Cache miss for " << virtualPath;
            provider->asyncBridge_->EmitDebugMessage(msg.str());
        }
    }
    
    // Known virtual directories that should always be directories
    // This is NOT hardcoded smartness - this is essential ProjFS plumbing
    if (virtualPath == "/objects" || virtualPath == "/chats" || 
        virtualPath == "/invites" || virtualPath == "/debug" || 
        virtualPath == "/types") {
        
        ObjectMetadata metadata;
        metadata.exists = true;
        metadata.isDirectory = true;
        metadata.size = 0;
        metadata.type = "DIRECTORY";
        
        PRJ_PLACEHOLDER_INFO placeholderInfo = {};
        placeholderInfo.FileBasicInfo = provider->CreateFileBasicInfo(metadata);
        
        // Debug logging to verify what we're setting
        if (provider->asyncBridge_) {
            std::stringstream msg;
            msg << "[DEBUG] Setting placeholder for " << virtualPath 
                << " - metadata.isDirectory: " << metadata.isDirectory
                << ", IsDirectory: " << placeholderInfo.FileBasicInfo.IsDirectory
                << ", FileAttributes: 0x" << std::hex << placeholderInfo.FileBasicInfo.FileAttributes;
            provider->asyncBridge_->EmitDebugMessage(msg.str());
        }
        
        return PrjWritePlaceholderInfo(
            callbackData->NamespaceVirtualizationContext,
            callbackData->FilePathName,
            &placeholderInfo,
            sizeof(placeholderInfo)
        );
    }
    
    // Request async fetch from JavaScript for other paths
    if (provider->asyncBridge_) {
        provider->asyncBridge_->FetchFileInfo(virtualPath);
        return HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND);
    }
    
    return HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND);
}

HRESULT CALLBACK ProjFSProvider::GetFileDataCallback(
    const PRJ_CALLBACK_DATA* callbackData,
    UINT64 byteOffset,
    UINT32 length) {
    
    auto* provider = static_cast<ProjFSProvider*>(callbackData->InstanceContext);
    if (!provider) {
        return HRESULT_FROM_WIN32(ERROR_INVALID_PARAMETER);
    }
    
    provider->stats_.fileDataRequests++;

    // Convert Windows path to Unix-style path
    std::string relativePath = provider->ToUtf8(callbackData->FilePathName);
    std::replace(relativePath.begin(), relativePath.end(), '\\', '/');
    std::string virtualPath = relativePath.empty() ? "/" : "/" + relativePath;
    
    // Check cache first
    auto cache = provider->asyncBridge_ ? provider->asyncBridge_->GetCache() : nullptr;
    if (cache) {
        auto content = cache->GetFileContent(virtualPath);
        if (content && !content->data.empty()) {
            // Use cached content
            size_t contentSize = content->data.size();
            if (byteOffset >= contentSize) {
                return S_OK;  // Nothing to write
            }

            size_t bytesToWrite = (std::min)((size_t)length, contentSize - (size_t)byteOffset);
            provider->stats_.bytesRead += bytesToWrite;
            provider->stats_.cacheHits++;

            // Allocate aligned buffer for ProjFS
            void* buffer = PrjAllocateAlignedBuffer(
                callbackData->NamespaceVirtualizationContext,
                bytesToWrite
            );

            if (!buffer) {
                return E_OUTOFMEMORY;
            }

            try {
                // Copy data to buffer
                memcpy(buffer, content->data.data() + byteOffset, bytesToWrite);

                // Write data
                HRESULT hr = PrjWriteFileData(
                    callbackData->NamespaceVirtualizationContext,
                    &callbackData->DataStreamId,
                    buffer,
                    byteOffset,
                    bytesToWrite
                );

                PrjFreeAlignedBuffer(buffer);
                return hr;
            } catch (...) {
                PrjFreeAlignedBuffer(buffer);
                return HRESULT_FROM_WIN32(ERROR_UNHANDLED_EXCEPTION);
            }
        }
        provider->stats_.cacheMisses++;
    }
    
    // For /objects paths, try direct disk access for BLOB/CLOB
    if (virtualPath.compare(0, 9, "/objects/") == 0) {
        auto content = provider->storage_->ReadVirtualPath(virtualPath);
        if (content) {
            size_t contentSize = content->size();
            if (byteOffset >= contentSize) {
                return S_OK;  // Nothing to write
            }

            size_t bytesToWrite = (std::min)((size_t)length, contentSize - (size_t)byteOffset);
            provider->stats_.bytesRead += bytesToWrite;

            void* buffer = PrjAllocateAlignedBuffer(
                callbackData->NamespaceVirtualizationContext,
                bytesToWrite
            );

            if (!buffer) {
                return E_OUTOFMEMORY;
            }

            try {
                memcpy(buffer, content->data() + byteOffset, bytesToWrite);

                HRESULT hr = PrjWriteFileData(
                    callbackData->NamespaceVirtualizationContext,
                    &callbackData->DataStreamId,
                    buffer,
                    byteOffset,
                    bytesToWrite
                );

                PrjFreeAlignedBuffer(buffer);
                return hr;
            } catch (...) {
                PrjFreeAlignedBuffer(buffer);
                return HRESULT_FROM_WIN32(ERROR_UNHANDLED_EXCEPTION);
            }
        }
    }
    
    // Request async fetch from JavaScript
    if (provider->asyncBridge_) {
        provider->asyncBridge_->FetchFileContent(virtualPath);
        // Return error for now - the cache will be populated for next access
        // Returning ERROR_IO_PENDING can cause Explorer to hang
        return HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND);
    }
    
    return HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND);
}

HRESULT CALLBACK ProjFSProvider::QueryFileNameCallback(const PRJ_CALLBACK_DATA* callbackData) {
    // We don't support case-insensitive matching
    return HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND);
}

HRESULT CALLBACK ProjFSProvider::StartDirectoryEnumerationCallback(
    const PRJ_CALLBACK_DATA* callbackData,
    const GUID* enumerationId) {
    auto* provider = static_cast<ProjFSProvider*>(callbackData->InstanceContext);
    
    // Track active enumerations
    provider->stats_.activeEnumerations++;
    
    // Debug: Log enumeration start
    char guidStr[40];
    sprintf_s(guidStr, sizeof(guidStr), "%08lX-%04X-%04X-%02X%02X-%02X%02X%02X%02X%02X%02X",
        enumerationId->Data1, enumerationId->Data2, enumerationId->Data3,
        enumerationId->Data4[0], enumerationId->Data4[1], enumerationId->Data4[2], enumerationId->Data4[3],
        enumerationId->Data4[4], enumerationId->Data4[5], enumerationId->Data4[6], enumerationId->Data4[7]);
    
    // Convert Windows path to Unix-style path
    std::string relativePath = provider->ToUtf8(callbackData->FilePathName);
    std::replace(relativePath.begin(), relativePath.end(), '\\', '/');
    std::string path = relativePath.empty() ? "[ROOT]" : "/" + relativePath;
    
    std::cout << "[ProjFS] START ENUM " << guidStr << " for path: " << path
        << " (active: " << provider->stats_.activeEnumerations << ")" << std::endl;
    
    // Special handling for root directory to prevent infinite duplicates
    if (path == "[ROOT]") {
        provider->rootEnumerationCount_++;
        std::cout << "[ProjFS] Root enumeration #" << provider->rootEnumerationCount_ 
                  << " - rootComplete: " << provider->rootEnumerationComplete_ << std::endl;
    }
    
    if (provider->asyncBridge_) {
        std::stringstream msg;
        msg << "[ProjFS] START ENUM " << guidStr << " for path: " << path
            << " (active: " << provider->stats_.activeEnumerations << ")";
        provider->asyncBridge_->EmitDebugMessage(msg.str());
    }
    
    // Reset enumeration state for this session
    std::lock_guard<std::mutex> lock(provider->enumerationMutex_);
    
    // Check if this enumeration already exists (shouldn't happen normally)
    auto it = provider->enumerationStates_.find(*enumerationId);
    if (it != provider->enumerationStates_.end()) {
        if (provider->asyncBridge_) {
            std::stringstream msg;
            msg << "[ProjFS] WARNING: Enumeration already exists - this might cause issues!";
            provider->asyncBridge_->EmitDebugMessage(msg.str());
        }
    }
    
    provider->enumerationStates_[*enumerationId] = EnumerationState{};
    
    return S_OK;
}

HRESULT CALLBACK ProjFSProvider::GetDirectoryEnumerationCallback(
    const PRJ_CALLBACK_DATA* callbackData,
    const GUID* enumerationId,
    PCWSTR searchExpression,
    PRJ_DIR_ENTRY_BUFFER_HANDLE dirEntryBufferHandle) {
    
    auto* provider = static_cast<ProjFSProvider*>(callbackData->InstanceContext);
    provider->stats_.directoryEnumerations++;
    provider->stats_.enumerationCallbacks++;

    // Convert Windows path to Unix-style path
    std::string relativePath = provider->ToUtf8(callbackData->FilePathName);
    
    // Replace backslashes with forward slashes
    std::replace(relativePath.begin(), relativePath.end(), '\\', '/');
    
    // Ensure path starts with / for IFileSystem
    std::string virtualPath = relativePath.empty() ? "/" : "/" + relativePath;
    
    // Log the path transformation
    std::cout << "[ProjFS] GetDirEnum - FilePathName: '" << provider->ToUtf8(callbackData->FilePathName) 
              << "' -> virtualPath: '" << virtualPath << "'" << std::endl;
    
    // Special logging for invites folder
    if (virtualPath == "/invites") {
        std::cout << "[ProjFS] INVITES FOLDER ENUMERATION REQUESTED" << std::endl;
        if (provider->asyncBridge_) {
            provider->asyncBridge_->EmitDebugMessage("[ProjFS] INVITES FOLDER ENUMERATION REQUESTED");
        }
    }
    
    // Log search expression
    std::wstring searchExpr = searchExpression ? searchExpression : L"*";
    std::cout << "[ProjFS] searchExpr: " << provider->ToUtf8(searchExpr) << std::endl;
    
    // Get or create enumeration state
    std::unique_lock<std::mutex> lock(provider->enumerationMutex_);
    
    // Check if this enumeration exists
    auto it = provider->enumerationStates_.find(*enumerationId);
    if (it == provider->enumerationStates_.end()) {
        // This shouldn't happen - StartDirectoryEnumerationCallback should have created it
        if (provider->asyncBridge_) {
            std::stringstream msg;
            msg << "[ProjFS] WARNING: Enumeration ID not found for " << virtualPath 
                << " - creating new state (this might indicate a bug!)";
            provider->asyncBridge_->EmitDebugMessage(msg.str());
        }
        // Create a new state
        provider->enumerationStates_[*enumerationId] = EnumerationState{};
    }
    
    auto& enumState = provider->enumerationStates_[*enumerationId];
    
    // CRITICAL: Log the current state before any modifications
    {
        std::stringstream msg;
        msg << "[ProjFS] ENUM STATE BEFORE for " << virtualPath 
            << " - entries.size: " << enumState.entries.size()
            << ", nextIndex: " << enumState.nextIndex
            << ", isComplete: " << enumState.isComplete
            << ", callCount: " << enumState.callCount;
        std::cout << msg.str() << std::endl;  // Direct console output
        if (provider->asyncBridge_) {
            provider->asyncBridge_->EmitDebugMessage(msg.str());
        }
    }
    
    // Check for restart scan flag
    if (callbackData->Flags & PRJ_CB_DATA_FLAG_ENUM_RESTART_SCAN) {
        // Explorer wants to restart the enumeration from the beginning
        enumState.nextIndex = 0;
        enumState.callCount = 0;  // Reset call count on restart
        enumState.entries.clear();  // Clear entries to force re-fetch
        enumState.isComplete = false;  // Reset completion state
        enumState.isLoading = false;  // Reset loading state
        if (provider->asyncBridge_) {
            std::stringstream msg;
            msg << "[ProjFS] RESTART SCAN requested for " << virtualPath << " - clearing state";
            provider->asyncBridge_->EmitDebugMessage(msg.str());
        }
    }
    
    // Safety check to prevent infinite loops
    enumState.callCount++;
    if (enumState.callCount > EnumerationState::MAX_CALLS_PER_ENUM) {
        if (provider->asyncBridge_) {
            std::stringstream msg;
            msg << "[ProjFS] ERROR: Enumeration loop detected for " << virtualPath 
                << " - aborting after " << enumState.callCount << " calls";
            provider->asyncBridge_->EmitDebugMessage(msg.str());
        }
        return S_OK;  // Return empty to break the loop
    }
    
    // Debug: log enumeration info
    char guidStr[40];
    sprintf_s(guidStr, sizeof(guidStr), "%08lX-%04X-%04X-%02X%02X-%02X%02X%02X%02X%02X%02X",
        enumerationId->Data1, enumerationId->Data2, enumerationId->Data3,
        enumerationId->Data4[0], enumerationId->Data4[1], enumerationId->Data4[2], enumerationId->Data4[3],
        enumerationId->Data4[4], enumerationId->Data4[5], enumerationId->Data4[6], enumerationId->Data4[7]);
    if (provider->asyncBridge_) {
        std::stringstream msg;
        msg << "[ProjFS] GetDirEnum for " << virtualPath << " enum: " << guidStr 
            << " nextIndex: " << enumState.nextIndex 
            << " entries: " << enumState.entries.size()
            << " isLoading: " << enumState.isLoading
            << " isComplete: " << enumState.isComplete;
        provider->asyncBridge_->EmitDebugMessage(msg.str());
    }
    
    // If this is the first call for this enumeration, populate the entries
    if (enumState.entries.empty() && !enumState.isComplete) {
        // Check if already loading to prevent duplicate fetches
        if (enumState.isLoading) {
            // Another thread is loading, wait for it to complete with timeout
            auto timeout = std::chrono::milliseconds(5000);
            if (!provider->enumerationCv_.wait_for(lock, timeout, [&enumState] {
                return !enumState.isLoading;
            })) {
                // Timeout occurred - prevent deadlock
                if (provider->asyncBridge_) {
                    provider->asyncBridge_->EmitDebugMessage("[ProjFS] WARNING: Enumeration wait timeout");
                }
                return S_OK;
            }
            // After waiting, check if we now have entries
            if (!enumState.entries.empty() || enumState.isComplete) {
                // Entries are now available, continue with enumeration
                goto process_entries;
            }
            // If still no entries, something went wrong, return empty
            return S_OK;
        }
        
        enumState.isLoading = true;
        lock.unlock(); // Release lock while getting entries
        
        // Try cache first
        auto cache = provider->asyncBridge_ ? provider->asyncBridge_->GetCache() : nullptr;
        bool gotEntries = false;
        
        if (cache) {
            auto listing = cache->GetDirectoryListing(virtualPath);
            if (listing) {
                provider->stats_.cacheHits++;
                // Convert FileInfo entries to string names
                for (const auto& fileInfo : listing->entries) {
                    enumState.entries.push_back(fileInfo.name);
                }
                gotEntries = true;
            } else {
                provider->stats_.cacheMisses++;
            }
        }
        
        // If not in cache, use storage ONLY for /objects paths
        if (!gotEntries && (virtualPath == "/objects" || virtualPath.compare(0, 9, "/objects/") == 0)) {
            enumState.entries = provider->storage_->ListDirectory(virtualPath);
            gotEntries = true;
            
            // Debug: log what we got from storage
            if (provider->asyncBridge_) {
                std::stringstream msg;
                msg << "[ProjFS] Got " << enumState.entries.size() << " entries for path: " << virtualPath;
                provider->asyncBridge_->EmitDebugMessage(msg.str());
                for (const auto& e : enumState.entries) {
                    msg.str("");
                    msg << "[ProjFS]   - " << e;
                    provider->asyncBridge_->EmitDebugMessage(msg.str());
                }
            }
        }
        
        
        // For non-cached paths, we need to call JavaScript synchronously
        if (!gotEntries && provider->asyncBridge_) {
            // Log what we're looking for
            std::cout << "[ProjFS] Cache miss for path: " << virtualPath << ", calling JS readDirectory synchronously" << std::endl;
            
            // Try to get entries synchronously from JavaScript layer
            // This calls the JavaScript readDirectory method which should return immediately for virtual directories
            provider->asyncBridge_->FetchDirectoryListing(virtualPath);
            
            // Wait a short time for the cache to be populated by the async call
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            
            // Check cache again after the async call
            if (cache) {
                auto listing = cache->GetDirectoryListing(virtualPath);
                if (listing) {
                    provider->stats_.cacheHits++;
                    enumState.entries.clear(); // Clear any previous entries
                    for (const auto& fileInfo : listing->entries) {
                        enumState.entries.push_back(fileInfo.name);
                    }
                    gotEntries = true;
                    
                    if (provider->asyncBridge_) {
                        std::stringstream msg;
                        msg << "[ProjFS] Got " << enumState.entries.size() << " entries from cache after async fetch for: " << virtualPath;
                        provider->asyncBridge_->EmitDebugMessage(msg.str());
                    }
                }
            }
            
            // If still no entries after async call, return empty (don't set gotEntries = true)
            if (!gotEntries) {
                std::cout << "[ProjFS] No entries available for path: " << virtualPath << std::endl;
                if (provider->asyncBridge_) {
                    std::stringstream msg;
                    msg << "[ProjFS] No entries available for path: " << virtualPath;
                    provider->asyncBridge_->EmitDebugMessage(msg.str());
                }
            }
        }
        
        lock.lock(); // Re-acquire lock
        enumState.isLoading = false;
        enumState.isComplete = true;
        
        // Notify any waiting threads that loading is complete
        provider->enumerationCv_.notify_all();
    }
    
process_entries:
    
    // Sanity check: ensure nextIndex is valid
    if (enumState.nextIndex >= enumState.entries.size()) {
        if (provider->asyncBridge_) {
            std::stringstream msg;
            msg << "[ProjFS] ENUMERATION COMPLETE for " << virtualPath 
                << " - all " << enumState.entries.size() << " entries returned";
            provider->asyncBridge_->EmitDebugMessage(msg.str());
        }
        // Mark enumeration as truly complete
        enumState.isComplete = true;
        return S_OK;  // No more entries to return
    }
    
    // Return entries starting from nextIndex
    size_t entriesAdded = 0;
    size_t totalEntries = enumState.entries.size();
    
    // Debug log at start of enumeration
    std::cout << "[ProjFS] Starting enumeration return for " << virtualPath 
              << " - nextIndex: " << enumState.nextIndex 
              << ", totalEntries: " << totalEntries << std::endl;
    if (provider->asyncBridge_) {
        std::stringstream msg;
        msg << "[ProjFS] Starting enumeration return for " << virtualPath 
            << " - nextIndex: " << enumState.nextIndex 
            << ", totalEntries: " << totalEntries;
        provider->asyncBridge_->EmitDebugMessage(msg.str());
    }
    
    // Convert search expression to string for filtering
    std::wstring searchPattern = searchExpression ? searchExpression : L"*";
    
    while (enumState.nextIndex < enumState.entries.size()) {
        const auto& entry = enumState.entries[enumState.nextIndex];
        
        // Check if entry matches search pattern
        std::wstring wideEntry = provider->ToWide(entry);
        if (!PrjFileNameMatch(wideEntry.c_str(), searchPattern.c_str())) {
            // Entry doesn't match search pattern, skip it
            enumState.nextIndex++;
            std::cout << "[ProjFS] Skipping " << entry << " - doesn't match " << provider->ToUtf8(searchPattern) << std::endl;
            continue;
        }
        
        ObjectMetadata entryMeta;
        std::string entryPath = virtualPath + "/" + entry;
        
        // Virtual directories that are always directories
        if (virtualPath == "/" && (entry == "objects" || entry == "chats" || 
                                  entry == "invites" || entry == "debug" || 
                                  entry == "types")) {
            entryMeta.exists = true;
            entryMeta.isDirectory = true;
            entryMeta.size = 0;
            entryMeta.type = "DIRECTORY";
            
            // Debug logging
            if (provider->asyncBridge_) {
                std::stringstream msg;
                msg << "[ENUM] Forcing directory for root entry: " << entry;
                provider->asyncBridge_->EmitDebugMessage(msg.str());
            }
        } else {
            // Try cache first for other entries
            auto cache = provider->asyncBridge_ ? provider->asyncBridge_->GetCache() : nullptr;
            if (cache) {
                auto fileInfo = cache->GetFileInfo(entryPath);
                if (fileInfo) {
                    entryMeta.exists = true;
                    entryMeta.isDirectory = fileInfo->isDirectory;
                    entryMeta.size = fileInfo->size;
                    entryMeta.type = fileInfo->isDirectory ? "DIRECTORY" : "FILE";
                } else {
                    // Fallback to storage metadata
                    entryMeta = provider->storage_->GetVirtualPathMetadata(entryPath);
                }
            } else {
                // No cache, use storage metadata
                entryMeta = provider->storage_->GetVirtualPathMetadata(entryPath);
            }
            
            // Skip non-existent entries
            if (!entryMeta.exists) {
                enumState.nextIndex++;
                continue;
            }
        }
        
        PRJ_FILE_BASIC_INFO fileInfo = provider->CreateFileBasicInfo(entryMeta);
        
        // Debug logging for directory enumeration
        if (provider->asyncBridge_) {
            std::stringstream msg;
            msg << "[DirEnum] Entry: " << entry 
                << ", metadata.isDirectory: " << entryMeta.isDirectory 
                << ", fileInfo.IsDirectory: " << (fileInfo.IsDirectory ? "TRUE" : "FALSE")
                << ", FileAttributes: 0x" << std::hex << fileInfo.FileAttributes
                << " (expected for dir: 0x" << std::hex << FILE_ATTRIBUTE_DIRECTORY << ")";
            provider->asyncBridge_->EmitDebugMessage(msg.str());
        }
        
        HRESULT hr = PrjFillDirEntryBuffer(
            wideEntry.c_str(),
            &fileInfo,
            dirEntryBufferHandle
        );
        
        if (FAILED(hr) && hr != HRESULT_FROM_WIN32(ERROR_INSUFFICIENT_BUFFER)) {
            // Log any other error
            if (provider->asyncBridge_) {
                std::stringstream msg;
                msg << "[ProjFS] ERROR in PrjFillDirEntryBuffer for entry '" << entry 
                    << "' in " << virtualPath 
                    << ": 0x" << std::hex << hr;
                provider->asyncBridge_->EmitDebugMessage(msg.str());
            }
            // Skip this entry and continue
            enumState.nextIndex++;
            continue;
        }
        
        if (hr == HRESULT_FROM_WIN32(ERROR_INSUFFICIENT_BUFFER)) {
            // Buffer is full, we'll continue from this index next time
            if (provider->asyncBridge_) {
                std::stringstream msg;
                msg << "[ProjFS] BUFFER FULL for " << virtualPath 
                    << " after " << entriesAdded << " entries"
                    << ", nextIndex stays at " << enumState.nextIndex
                    << " (entry: " << entry << ")";
                provider->asyncBridge_->EmitDebugMessage(msg.str());
            }
            // CRITICAL: Do NOT increment nextIndex when buffer is full
            // We need to retry this same entry next time
            break;
        }
        
        // Successfully added entry, move to next
        enumState.nextIndex++;
        entriesAdded++;
        
        if (provider->asyncBridge_) {
            std::stringstream msg;
            msg << "[ProjFS] Added entry #" << entriesAdded << ": " << entry
                << " (nextIndex now: " << enumState.nextIndex << ")";
            provider->asyncBridge_->EmitDebugMessage(msg.str());
        }
    }
    
    if (provider->asyncBridge_) {
        std::stringstream msg;
        msg << "[ProjFS] ENUM CALLBACK COMPLETE for " << virtualPath 
            << ": returned " << entriesAdded << " entries"
            << ", nextIndex=" << enumState.nextIndex
            << ", total=" << enumState.entries.size()
            << ", hasMore=" << (enumState.nextIndex < enumState.entries.size())
            << ", totalCallbacks=" << provider->stats_.enumerationCallbacks;
        provider->asyncBridge_->EmitDebugMessage(msg.str());
    }
    
    return S_OK;
}

HRESULT CALLBACK ProjFSProvider::EndDirectoryEnumerationCallback(
    const PRJ_CALLBACK_DATA* callbackData,
    const GUID* enumerationId) {
    auto* provider = static_cast<ProjFSProvider*>(callbackData->InstanceContext);
    
    // Debug: Log enumeration end
    if (provider->asyncBridge_) {
        char guidStr[40];
        sprintf_s(guidStr, sizeof(guidStr), "%08lX-%04X-%04X-%02X%02X-%02X%02X%02X%02X%02X%02X",
            enumerationId->Data1, enumerationId->Data2, enumerationId->Data3,
            enumerationId->Data4[0], enumerationId->Data4[1], enumerationId->Data4[2], enumerationId->Data4[3],
            enumerationId->Data4[4], enumerationId->Data4[5], enumerationId->Data4[6], enumerationId->Data4[7]);
        
        std::lock_guard<std::mutex> lock(provider->enumerationMutex_);
        auto it = provider->enumerationStates_.find(*enumerationId);
        if (it != provider->enumerationStates_.end()) {
            std::stringstream msg;
            msg << "[ProjFS] END ENUM " << guidStr 
                << " - processed " << it->second.nextIndex 
                << " of " << it->second.entries.size() << " entries";
            provider->asyncBridge_->EmitDebugMessage(msg.str());
        }
    }
    
    // Track active enumerations
    provider->stats_.activeEnumerations--;
    
    // Clean up enumeration state
    std::lock_guard<std::mutex> lock(provider->enumerationMutex_);
    provider->enumerationStates_.erase(*enumerationId);
    
    return S_OK;
}

HRESULT CALLBACK ProjFSProvider::NotificationCallback(
    const PRJ_CALLBACK_DATA* callbackData,
    BOOLEAN isDirectory,
    PRJ_NOTIFICATION notification,
    PCWSTR destinationFileName,
    PRJ_NOTIFICATION_PARAMETERS* operationParameters) {
    
    // For now, we're read-only, so deny all modifications
    switch (notification) {
        case PRJ_NOTIFICATION_FILE_OPENED:
        // case PRJ_NOTIFICATION_FILE_CLOSED: // May not be available in all SDK versions
            // These are informational only
            return S_OK;
            
        default:
            // Deny all other operations
            return HRESULT_FROM_WIN32(ERROR_ACCESS_DENIED);
    }
}

// Helper methods

std::wstring ProjFSProvider::ToWide(const std::string& str) {
    if (str.empty()) return L"";
    
    int size = MultiByteToWideChar(CP_UTF8, 0, str.c_str(), -1, nullptr, 0);
    std::wstring result(size - 1, 0);
    MultiByteToWideChar(CP_UTF8, 0, str.c_str(), -1, result.data(), size);
    return result;
}

std::string ProjFSProvider::ToUtf8(const std::wstring& wstr) {
    if (wstr.empty()) return "";
    
    int size = WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), -1, nullptr, 0, nullptr, nullptr);
    std::string result(size - 1, 0);
    WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), -1, result.data(), size, nullptr, nullptr);
    return result;
}

PRJ_FILE_BASIC_INFO ProjFSProvider::CreateFileBasicInfo(const ObjectMetadata& metadata) {
    PRJ_FILE_BASIC_INFO info = {};
    
    if (metadata.isDirectory) {
        info.IsDirectory = TRUE;
        // ProjFS directories should just have DIRECTORY attribute
        info.FileAttributes = FILE_ATTRIBUTE_DIRECTORY;
        
        // Debug logging
        if (asyncBridge_) {
            std::stringstream msg;
            msg << "[CreateFileBasicInfo] DIRECTORY - isDirectory: " << metadata.isDirectory 
                << ", IsDirectory: " << info.IsDirectory 
                << ", FileAttributes: 0x" << std::hex << info.FileAttributes;
            asyncBridge_->EmitDebugMessage(msg.str());
        }
    } else {
        info.IsDirectory = FALSE;
        // Regular files should have NORMAL attribute (not REPARSE_POINT)
        info.FileAttributes = FILE_ATTRIBUTE_NORMAL;
        info.FileSize = metadata.size;
        
        // Debug logging
        if (asyncBridge_) {
            std::stringstream msg;
            msg << "[CreateFileBasicInfo] FILE - isDirectory: " << metadata.isDirectory 
                << ", IsDirectory: " << info.IsDirectory 
                << ", FileAttributes: 0x" << std::hex << info.FileAttributes 
                << ", size: " << metadata.size;
            asyncBridge_->EmitDebugMessage(msg.str());
        }
    }
    
    // Set timestamps to current time
    FILETIME ft;
    GetSystemTimeAsFileTime(&ft);
    info.CreationTime.LowPart = ft.dwLowDateTime;
    info.CreationTime.HighPart = ft.dwHighDateTime;
    info.LastWriteTime = info.CreationTime;
    info.LastAccessTime = info.CreationTime;
    info.ChangeTime = info.CreationTime;
    
    return info;
}

} // namespace oneifsprojfs