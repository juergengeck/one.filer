#include "async_bridge.h"
#include <thread>

namespace oneifsprojfs {

AsyncBridge::AsyncBridge(Napi::Env env) 
    : cache_(std::make_shared<ContentCache>()) {
}

AsyncBridge::~AsyncBridge() {
    Stop();
}

void AsyncBridge::EmitDebugMessage(const std::string& message) {
    if (!onDebugMessageCallback_) return;
    
    try {
        onDebugMessageCallback_.NonBlockingCall([message](Napi::Env env, Napi::Function jsCallback) {
            if (env && !env.IsExceptionPending()) {
                jsCallback.Call({Napi::String::New(env, message)});
            }
        });
    } catch (...) {
        // Silently ignore callback errors to prevent crashes
    }
}

void AsyncBridge::RegisterCallbacks(const Napi::Object& callbacks) {
    auto env = callbacks.Env();
    
    // Register file info callback
    if (callbacks.Has("getFileInfo")) {
        auto getFileInfo = callbacks.Get("getFileInfo").As<Napi::Function>();
        getFileInfoCallback_ = Napi::ThreadSafeFunction::New(
            env,
            getFileInfo,
            "getFileInfo",
            0,
            1
        );
    }
    
    // Register read file callback
    if (callbacks.Has("readFile")) {
        auto readFile = callbacks.Get("readFile").As<Napi::Function>();
        readFileCallback_ = Napi::ThreadSafeFunction::New(
            env,
            readFile,
            "readFile",
            0,
            1
        );
    }
    
    // Register read directory callback
    if (callbacks.Has("readDirectory")) {
        auto readDirectory = callbacks.Get("readDirectory").As<Napi::Function>();
        readDirectoryCallback_ = Napi::ThreadSafeFunction::New(
            env,
            readDirectory,
            "readDirectory",
            0,
            1
        );
    }
    
    // Register write callbacks
    if (callbacks.Has("createFile")) {
        auto createFile = callbacks.Get("createFile").As<Napi::Function>();
        createFileCallback_ = Napi::ThreadSafeFunction::New(
            env,
            createFile,
            "createFile",
            0,
            1
        );
    }
    
    // Register debug message callback
    if (callbacks.Has("onDebugMessage")) {
        auto onDebugMessage = callbacks.Get("onDebugMessage").As<Napi::Function>();
        onDebugMessageCallback_ = Napi::ThreadSafeFunction::New(
            env,
            onDebugMessage,
            "onDebugMessage",
            0,
            1
        );
    }
}

void AsyncBridge::FetchFileInfo(const std::string& path) {
    if (!getFileInfoCallback_) {
        EmitDebugMessage("[AsyncBridge] FetchFileInfo called but no callback registered for: " + path);
        return;
    }
    
    try {
        // Call JavaScript async function
        getFileInfoCallback_.NonBlockingCall([this, path](Napi::Env env, Napi::Function jsCallback) {
            if (!env || env.IsExceptionPending()) {
                EmitDebugMessage("[AsyncBridge] ERROR: Invalid environment for file info: " + path);
                return;
            }
            
            try {
                // Call the JavaScript function with path
                auto result = jsCallback.Call({Napi::String::New(env, path)});
                
                // Handle the promise
                if (result.IsPromise()) {
                    auto promise = result.As<Napi::Promise>();
                    auto thenFunc = promise.Get("then").As<Napi::Function>();
                    
                    // Create callback for promise resolution
                    auto onResolve = Napi::Function::New(env, [this, path](const Napi::CallbackInfo& info) {
                        auto env = info.Env();
                        if (info.Length() > 0) {
                            if (info[0].IsObject() && !info[0].IsNull()) {
                                auto fileInfo = ParseFileInfo(info[0].As<Napi::Object>());
                                cache_->SetFileInfo(path, fileInfo);
                                EmitDebugMessage("[AsyncBridge] Cached file info for: " + path);
                            } else if (info[0].IsNull()) {
                                EmitDebugMessage("[AsyncBridge] File not found: " + path);
                            }
                        }
                        return env.Undefined();
                    });
                    
                    auto onReject = Napi::Function::New(env, [this, path](const Napi::CallbackInfo& info) {
                        EmitDebugMessage("[AsyncBridge] Promise rejected for file info: " + path);
                        return info.Env().Undefined();
                    });
                    
                    thenFunc.Call(promise, {onResolve, onReject});
                } else if (result.IsObject() && !result.IsNull()) {
                    // Direct object result (synchronous)
                    auto fileInfo = ParseFileInfo(result.As<Napi::Object>());
                    cache_->SetFileInfo(path, fileInfo);
                    EmitDebugMessage("[AsyncBridge] Cached file info (sync) for: " + path);
                }
            } catch (const std::exception& e) {
                EmitDebugMessage("[AsyncBridge] ERROR calling getFileInfo: " + std::string(e.what()));
            }
        });
    } catch (...) {
        EmitDebugMessage("[AsyncBridge] ERROR: Exception in FetchFileInfo for: " + path);
    }
}

void AsyncBridge::FetchDirectoryListing(const std::string& path) {
    if (!readDirectoryCallback_) {
        EmitDebugMessage("[AsyncBridge] FetchDirectoryListing called but no callback registered for path: " + path);
        return;
    }
    
    EmitDebugMessage("[AsyncBridge] FetchDirectoryListing called for path: " + path);
    
    try {
        readDirectoryCallback_.NonBlockingCall([this, path](Napi::Env env, Napi::Function jsCallback) {
            if (!env || env.IsExceptionPending()) {
                EmitDebugMessage("[AsyncBridge] ERROR: Invalid environment for path: " + path);
                return;
            }
            
            EmitDebugMessage("[AsyncBridge] Calling JavaScript readDirectory for path: " + path);
            
            try {
                auto result = jsCallback.Call({Napi::String::New(env, path)});
                
                if (result.IsPromise()) {
                    auto promise = result.As<Napi::Promise>();
                    auto thenFunc = promise.Get("then").As<Napi::Function>();
                    
                    auto onResolve = Napi::Function::New(env, [this, path](const Napi::CallbackInfo& info) {
                        auto env = info.Env();
                        EmitDebugMessage("[AsyncBridge] Promise resolved for path: " + path);
                        
                        if (info.Length() > 0) {
                            if (info[0].IsArray()) {
                                // Parse and cache the directory listing from JavaScript
                                auto listing = ParseDirectoryListing(info[0].As<Napi::Array>());
                                cache_->SetDirectoryListing(path, listing);
                                auto jsArray = info[0].As<Napi::Array>();
                                EmitDebugMessage("[AsyncBridge] Cached directory listing (" + std::to_string(jsArray.Length()) + ") for: " + path);
                            } else {
                                EmitDebugMessage("[AsyncBridge] WARNING: Expected array but got different type for: " + path);
                            }
                        } else {
                            EmitDebugMessage("[AsyncBridge] WARNING: Promise resolved with no data for: " + path);
                        }
                        return env.Undefined();
                    });
                    
                    auto onReject = Napi::Function::New(env, [this, path](const Napi::CallbackInfo& info) {
                        EmitDebugMessage("[AsyncBridge] Promise rejected for path: " + path);
                        return info.Env().Undefined();
                    });
                    
                    thenFunc.Call(promise, {onResolve, onReject});
                } else if (result.IsArray()) {
                    // Direct array result (synchronous)
                    // JS layer is the single source of truth for directory caching.
                    // Do NOT cache directory listings here to avoid double caching with different formats.
                    auto jsArray = result.As<Napi::Array>();
                    EmitDebugMessage("[AsyncBridge] Received directory listing (sync) (" + std::to_string(jsArray.Length()) + ") for: " + path + ", caching delegated to JS");
                } else {
                    EmitDebugMessage("[AsyncBridge] WARNING: Unexpected result type for: " + path);
                }
            } catch (const std::exception& e) {
                EmitDebugMessage("[AsyncBridge] ERROR calling readDirectory: " + std::string(e.what()));
            }
        });
    } catch (...) {
        EmitDebugMessage("[AsyncBridge] ERROR: Exception in FetchDirectoryListing for: " + path);
    }
}

void AsyncBridge::FetchFileContent(const std::string& path) {
    if (!readFileCallback_) return;
    
    readFileCallback_.NonBlockingCall([this, path](Napi::Env env, Napi::Function jsCallback) {
        auto result = jsCallback.Call({Napi::String::New(env, path)});
        
        if (result.IsPromise()) {
            auto promise = result.As<Napi::Promise>();
            auto thenFunc = promise.Get("then").As<Napi::Function>();
            
            auto onResolve = Napi::Function::New(env, [this, path](const Napi::CallbackInfo& info) {
                auto env = info.Env();
                if (info.Length() > 0 && info[0].IsBuffer()) {
                    auto buffer = info[0].As<Napi::Buffer<uint8_t>>();
                    std::vector<uint8_t> data(buffer.Data(), buffer.Data() + buffer.Length());
                    
                    FileContent content;
                    content.data = std::move(data);
                    cache_->SetFileContent(path, content);
                }
                return env.Undefined();
            });
            
            thenFunc.Call(promise, {onResolve});
        }
    });
}

void AsyncBridge::QueueCreateFile(const std::string& path, const std::vector<uint8_t>& content) {
    std::lock_guard<std::mutex> lock(writeQueueMutex_);
    writeQueue_.push({WriteOperation::CREATE, path, content});
}

void AsyncBridge::QueueUpdateFile(const std::string& path, const std::vector<uint8_t>& content) {
    std::lock_guard<std::mutex> lock(writeQueueMutex_);
    writeQueue_.push({WriteOperation::UPDATE, path, content});
}

void AsyncBridge::QueueDeleteFile(const std::string& path) {
    std::lock_guard<std::mutex> lock(writeQueueMutex_);
    writeQueue_.push({WriteOperation::DELETE_FILE, path, {}});
}

FileInfo AsyncBridge::ParseFileInfo(const Napi::Object& jsObject) {
    FileInfo info;
    
    if (jsObject.Has("name")) {
        info.name = jsObject.Get("name").As<Napi::String>().Utf8Value();
    }
    if (jsObject.Has("hash")) {
        info.hash = jsObject.Get("hash").As<Napi::String>().Utf8Value();
    }
    if (jsObject.Has("size")) {
        info.size = jsObject.Get("size").As<Napi::Number>().Uint32Value();
    }
    if (jsObject.Has("isDirectory")) {
        info.isDirectory = jsObject.Get("isDirectory").As<Napi::Boolean>().Value();
    }
    if (jsObject.Has("isBlobOrClob")) {
        info.isBlobOrClob = jsObject.Get("isBlobOrClob").As<Napi::Boolean>().Value();
    }
    if (jsObject.Has("mode")) {
        info.mode = jsObject.Get("mode").As<Napi::Number>().Uint32Value();
    }
    
    return info;
}

DirectoryListing AsyncBridge::ParseDirectoryListing(const Napi::Array& jsArray) {
    DirectoryListing listing;
    
    for (uint32_t i = 0; i < jsArray.Length(); i++) {
        if (jsArray.Get(i).IsObject()) {
            auto fileInfo = ParseFileInfo(jsArray.Get(i).As<Napi::Object>());
            listing.entries.push_back(fileInfo);
        }
    }
    
    return listing;
}

void AsyncBridge::Start() {
    running_ = true;
    
    // Start background thread for write queue processing
    std::thread([this]() {
        while (running_) {
            ProcessWriteQueue();
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
    }).detach();
}

void AsyncBridge::Stop() {
    running_ = false;
    
    // Release callbacks
    if (getFileInfoCallback_) {
        getFileInfoCallback_.Release();
    }
    if (readFileCallback_) {
        readFileCallback_.Release();
    }
    if (readDirectoryCallback_) {
        readDirectoryCallback_.Release();
    }
    if (createFileCallback_) {
        createFileCallback_.Release();
    }
    if (onDebugMessageCallback_) {
        onDebugMessageCallback_.Release();
    }
}

void AsyncBridge::ProcessWriteQueue() {
    std::queue<WriteOperation> toProcess;
    
    {
        std::lock_guard<std::mutex> lock(writeQueueMutex_);
        std::swap(toProcess, writeQueue_);
    }
    
    while (!toProcess.empty()) {
        auto& op = toProcess.front();
        
        switch (op.type) {
            case WriteOperation::CREATE:
                if (createFileCallback_) {
                    createFileCallback_.NonBlockingCall([op](Napi::Env env, Napi::Function jsCallback) {
                        auto path = Napi::String::New(env, op.path);
                        auto content = Napi::Buffer<uint8_t>::Copy(env, op.content.data(), op.content.size());
                        jsCallback.Call({path, content});
                    });
                }
                break;
                
            case WriteOperation::UPDATE:
                // Similar for update
                break;
                
            case WriteOperation::DELETE_FILE:
                // Similar for delete
                break;
        }
        
        toProcess.pop();
    }
}

} // namespace oneifsprojfs