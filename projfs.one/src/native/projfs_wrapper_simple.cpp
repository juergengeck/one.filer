/**
 * Simplified ProjFS wrapper for testing Windows build
 */

#include <napi.h>
#include <string>

class ProjFSWrapper : public Napi::ObjectWrap<ProjFSWrapper> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
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

    ProjFSWrapper(const Napi::CallbackInfo& info) : Napi::ObjectWrap<ProjFSWrapper>(info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 1 || !info[0].IsString()) {
            Napi::TypeError::New(env, "String expected for virtualizationRootPath").ThrowAsJavaScriptException();
            return;
        }
        
        this->virtualizationRootPath = info[0].As<Napi::String>().Utf8Value();
        this->isRunning = false;
    }

private:
    std::string virtualizationRootPath;
    bool isRunning;

    Napi::Value Start(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        // For now, just mark as running
        this->isRunning = true;
        
        // In real implementation, would call PrjStartVirtualizing here
        return Napi::Boolean::New(env, true);
    }

    Napi::Value Stop(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        // For now, just mark as not running
        this->isRunning = false;
        
        // In real implementation, would call PrjStopVirtualizing here
        return Napi::Boolean::New(env, true);
    }

    Napi::Value IsRunning(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        return Napi::Boolean::New(env, this->isRunning);
    }

    Napi::Value GetStats(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        Napi::Object stats = Napi::Object::New(env);
        stats.Set("placeholderInfoRequests", Napi::Number::New(env, 0));
        stats.Set("fileDataRequests", Napi::Number::New(env, 0));
        stats.Set("directoryEnumerations", Napi::Number::New(env, 0));
        stats.Set("fileModifications", Napi::Number::New(env, 0));
        stats.Set("totalBytesRead", Napi::Number::New(env, 0));
        stats.Set("totalBytesWritten", Napi::Number::New(env, 0));
        stats.Set("uptime", Napi::Number::New(env, 0));
        
        return stats;
    }
};

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return ProjFSWrapper::Init(env, exports);
}

NODE_API_MODULE(projfs_native, Init)