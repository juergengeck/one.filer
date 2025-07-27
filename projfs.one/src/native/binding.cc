#include <napi.h>
#include "projfs_wrapper.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return ProjFSWrapper::Init(env, exports);
}

NODE_API_MODULE(projfs_native, Init)