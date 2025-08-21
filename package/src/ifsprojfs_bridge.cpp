#include <napi.h>
#include "projfs_provider.h"
#include "async_bridge.h"
#include "content_cache.h"
#include <memory>

using namespace oneifsprojfs;

class IFSProjFSBridge : public Napi::ObjectWrap<IFSProjFSBridge> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "IFSProjFSProvider", {
            InstanceMethod("registerCallbacks", &IFSProjFSBridge::RegisterCallbacks),
            InstanceMethod("start", &IFSProjFSBridge::Start),
            InstanceMethod("stop", &IFSProjFSBridge::Stop),
            InstanceMethod("isRunning", &IFSProjFSBridge::IsRunning),
            InstanceMethod("getStats", &IFSProjFSBridge::GetStats),
            InstanceMethod("setCachedDirectory", &IFSProjFSBridge::SetCachedDirectory),
            InstanceMethod("setCachedContent", &IFSProjFSBridge::SetCachedContent)
        });

        Napi::FunctionReference* constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);

        exports.Set("IFSProjFSProvider", func);
        return exports;
    }

    IFSProjFSBridge(const Napi::CallbackInfo& info) : Napi::ObjectWrap<IFSProjFSBridge>(info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1 || !info[0].IsString()) {
            Napi::TypeError::New(env, "Instance path required").ThrowAsJavaScriptException();
            return;
        }

        std::string instancePath = info[0].As<Napi::String>().Utf8Value();

        try {
            provider_ = std::make_unique<ProjFSProvider>(instancePath);
            asyncBridge_ = std::make_shared<AsyncBridge>(env);
            provider_->SetAsyncBridge(asyncBridge_);
        } catch (const std::exception& e) {
            Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        }
    }

private:
    Napi::Value RegisterCallbacks(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1 || !info[0].IsObject()) {
            Napi::TypeError::New(env, "Callbacks object required").ThrowAsJavaScriptException();
            return env.Undefined();
        }

        if (!asyncBridge_) {
            Napi::Error::New(env, "AsyncBridge not initialized").ThrowAsJavaScriptException();
            return env.Undefined();
        }

        try {
            Napi::Object callbacks = info[0].As<Napi::Object>();
            asyncBridge_->RegisterCallbacks(callbacks);
            return env.Undefined();
        } catch (const std::exception& e) {
            Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
            return env.Undefined();
        }
    }

    Napi::Value Start(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1 || !info[0].IsString()) {
            Napi::TypeError::New(env, "Virtual root path required").ThrowAsJavaScriptException();
            return env.Undefined();
        }

        if (!provider_ || !asyncBridge_) {
            Napi::Error::New(env, "Provider not properly initialized").ThrowAsJavaScriptException();
            return Napi::Boolean::New(env, false);
        }

        std::string virtualRoot = info[0].As<Napi::String>().Utf8Value();

        try {
            // Start async bridge first
            asyncBridge_->Start();
            
            // Then start ProjFS provider
            bool success = provider_->Start(virtualRoot);
            if (!success) {
                asyncBridge_->Stop();
                std::string error = "Failed to start ProjFS provider: " + provider_->GetLastError();
                Napi::Error::New(env, error).ThrowAsJavaScriptException();
                return Napi::Boolean::New(env, false);
            }
            
            return Napi::Boolean::New(env, success);
        } catch (const std::exception& e) {
            asyncBridge_->Stop();
            Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
            return Napi::Boolean::New(env, false);
        }
    }

    Napi::Value Stop(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        try {
            if (provider_) {
                provider_->Stop();
            }
            if (asyncBridge_) {
                asyncBridge_->Stop();
            }
            return Napi::Boolean::New(env, true);
        } catch (const std::exception& e) {
            Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
            return Napi::Boolean::New(env, false);
        }
    }

    Napi::Value IsRunning(const Napi::CallbackInfo& info) {
        return Napi::Boolean::New(info.Env(), provider_->IsRunning());
    }

    Napi::Value GetStats(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        Napi::Object stats = Napi::Object::New(env);

        const ProviderStats& providerStats = provider_->GetStats();

        stats.Set("placeholderRequests", Napi::Number::New(env, providerStats.placeholderRequests.load()));
        stats.Set("fileDataRequests", Napi::Number::New(env, providerStats.fileDataRequests.load()));
        stats.Set("directoryEnumerations", Napi::Number::New(env, providerStats.directoryEnumerations.load()));
        stats.Set("bytesRead", Napi::BigInt::New(env, providerStats.bytesRead.load()));
        stats.Set("cacheHits", Napi::Number::New(env, providerStats.cacheHits.load()));
        stats.Set("cacheMisses", Napi::Number::New(env, providerStats.cacheMisses.load()));

        return stats;
    }
    
    Napi::Value SetCachedDirectory(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 2 || !info[0].IsString() || !info[1].IsArray()) {
            Napi::TypeError::New(env, "Path string and entries array required").ThrowAsJavaScriptException();
            return env.Undefined();
        }
        
        std::string path = info[0].As<Napi::String>().Utf8Value();
        Napi::Array entries = info[1].As<Napi::Array>();
        
        // Convert JavaScript array to DirectoryListing
        DirectoryListing listing;
        for (uint32_t i = 0; i < entries.Length(); i++) {
            if (entries.Get(i).IsObject()) {
                Napi::Object entry = entries.Get(i).As<Napi::Object>();
                FileInfo fileInfo;
                
                if (entry.Has("name")) {
                    fileInfo.name = entry.Get("name").As<Napi::String>().Utf8Value();
                }
                if (entry.Has("hash")) {
                    fileInfo.hash = entry.Get("hash").As<Napi::String>().Utf8Value();
                }
                if (entry.Has("size")) {
                    fileInfo.size = entry.Get("size").As<Napi::Number>().Uint32Value();
                }
                
                // Force correct directory flags for virtual directories at root
                if (path == "/" && (fileInfo.name == "objects" || fileInfo.name == "chats" || fileInfo.name == "invites" || fileInfo.name == "debug" || fileInfo.name == "types")) {
                    fileInfo.isDirectory = true;
                } else if (entry.Has("isDirectory")) {
                    fileInfo.isDirectory = entry.Get("isDirectory").As<Napi::Boolean>().Value();
                } else {
                    // Derive from authoritative storage metadata when not provided
                    std::string entryPath = path == "/" ? "/" + fileInfo.name : (path + "/" + fileInfo.name);
                    if (provider_) {
                        auto meta = provider_->GetStorage()->GetVirtualPathMetadata(entryPath);
                        fileInfo.isDirectory = meta.exists ? meta.isDirectory : false;
                    } else {
                        fileInfo.isDirectory = false;
                    }
                }
                if (entry.Has("isBlobOrClob")) {
                    fileInfo.isBlobOrClob = entry.Get("isBlobOrClob").As<Napi::Boolean>().Value();
                }
                if (entry.Has("mode")) {
                    fileInfo.mode = entry.Get("mode").As<Napi::Number>().Uint32Value();
                }
                
                listing.entries.push_back(fileInfo);
            }
        }
        
        // Store in cache with adjusted directory/file classification for /objects
        if (asyncBridge_ && asyncBridge_->GetCache()) {
            // Preserve directory flags provided by JS (root virtual folders remain directories)
            asyncBridge_->GetCache()->SetDirectoryListing(path, listing);
            
            // Also cache each entry as FileInfo for direct lookups
            for (const auto& entry : listing.entries) {
                std::string entryPath;
                if (path == "/") {
                    entryPath = "/" + entry.name;
                    asyncBridge_->GetCache()->SetFileInfo(entryPath, entry);
                    asyncBridge_->GetCache()->SetFileInfo(entry.name, entry);
                } else {
                    entryPath = path;
                    if (entryPath.back() != '/') {
                        entryPath += '/';
                    }
                    entryPath += entry.name;
                    asyncBridge_->GetCache()->SetFileInfo(entryPath, entry);
                }
            }
        }
        
        return env.Undefined();
    }
    
    Napi::Value SetCachedContent(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 2 || !info[0].IsString() || !info[1].IsBuffer()) {
            Napi::TypeError::New(env, "Path string and content buffer required").ThrowAsJavaScriptException();
            return env.Undefined();
        }
        
        std::string path = info[0].As<Napi::String>().Utf8Value();
        Napi::Buffer<uint8_t> buffer = info[1].As<Napi::Buffer<uint8_t>>();
        
        // Store content in cache
        if (asyncBridge_ && asyncBridge_->GetCache()) {
            FileContent content;
            content.data.assign(buffer.Data(), buffer.Data() + buffer.Length());
            asyncBridge_->GetCache()->SetFileContent(path, content);
        }
        
        return env.Undefined();
    }

    std::unique_ptr<ProjFSProvider> provider_;
    std::shared_ptr<AsyncBridge> asyncBridge_;
  public:
    ProjFSProvider* GetProvider() const { return provider_.get(); }
};

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return IFSProjFSBridge::Init(env, exports);
}

NODE_API_MODULE(ifsprojfs, Init)