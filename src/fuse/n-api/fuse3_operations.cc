#include <napi.h>
#include <fuse3/fuse.h>
#include <string.h>
#include <errno.h>
#include <mutex>
#include <condition_variable>
#include <future>
#include <unordered_map>
#include <memory>
#include <unistd.h>
#include <sys/types.h>

// External context
struct FuseContext {
    Napi::ThreadSafeFunction tsfn;
    Napi::ObjectReference operations;
    std::string mountPoint;
    struct fuse *fuse;
    std::thread *fuseThread;
    bool mounted;
    bool tsfnCreated;
    std::mutex cleanup_mutex;
};

extern std::unordered_map<struct fuse*, FuseContext*> g_fuse_contexts;
extern std::mutex g_contexts_mutex;
extern FuseContext* GetContextFromFuse();

// Helper to call JavaScript operation
template<typename... Args>
static int CallJsOperation(const std::string& opName, const char* path, Args&&... args) {
    FuseContext* ctx = GetContextFromFuse();
    if (!ctx) {
        fprintf(stderr, "CallJsOperation: No context found for operation %s\n", opName.c_str());
        return -EIO;
    }
    
    // ThreadSafeFunction doesn't have IsEmpty, we trust it's valid if ctx exists
    
    auto promise = std::make_shared<std::promise<int>>();
    std::future<int> future = promise->get_future();
    
    auto callback = [opName, path, promise, ctx, &args...](Napi::Env env, Napi::Function jsCallback) {
        try {
            Napi::Object ops = ctx->operations.Value();
            Napi::Value opFunc = ops.Get(opName);
            
            if (!opFunc.IsFunction()) {
                promise->set_value(-ENOSYS);
                return;
            }
            
            // Create arguments array
            std::vector<napi_value> jsArgs;
            jsArgs.push_back(Napi::String::New(env, path));
            
            // Add additional arguments based on operation
            // This is a simplified version - real implementation would handle each operation's specific args
            
            // Create callback for async result
            auto resultCallback = Napi::Function::New(env, [promise](const Napi::CallbackInfo& info) {
                if (info.Length() > 0 && info[0].IsNumber()) {
                    promise->set_value(info[0].As<Napi::Number>().Int32Value());
                } else {
                    promise->set_value(0);
                }
            });
            
            jsArgs.push_back(resultCallback);
            
            // Call the JavaScript function with path and callback
            opFunc.As<Napi::Function>().Call(ops, {Napi::String::New(env, path), resultCallback});
            
        } catch (const std::exception& e) {
            fprintf(stderr, "CallJsOperation exception: %s\n", e.what());
            promise->set_value(-EIO);
        } catch (...) {
            fprintf(stderr, "CallJsOperation unknown exception\n");
            promise->set_value(-EIO);
        }
    };
    
    napi_status status = ctx->tsfn.BlockingCall(callback);
    if (status != napi_ok) {
        fprintf(stderr, "CallJsOperation: BlockingCall failed with status %d\n", status);
        return -EIO;
    }
    
    return future.get();
}

// FUSE operation implementations
int fuse3_getattr(const char *path, struct stat *stbuf, struct fuse_file_info *fi) {
    FuseContext* ctx = GetContextFromFuse();
    if (!ctx) {
        fprintf(stderr, "fuse3_getattr: No context found\n");
        return -EIO;
    }
    
    // ThreadSafeFunction doesn't have IsEmpty, we trust it's valid if ctx exists
    
    memset(stbuf, 0, sizeof(struct stat));
    
    auto promise = std::make_shared<std::promise<int>>();
    std::future<int> future = promise->get_future();
    
    auto callback = [path, stbuf, promise, ctx](Napi::Env env, Napi::Function jsCallback) {
        try {
            Napi::Object ops = ctx->operations.Value();
            Napi::Value getattr = ops.Get("getattr");
            
            if (!getattr.IsFunction()) {
                // Default handling for root
                if (strcmp(path, "/") == 0) {
                    stbuf->st_mode = S_IFDIR | 0755;
                    stbuf->st_nlink = 2;
                    stbuf->st_uid = getuid();
                    stbuf->st_gid = getgid();
                    promise->set_value(0);
                } else {
                    promise->set_value(-ENOENT);
                }
                return;
            }
            
            // Create callback for result
            auto resultCb = Napi::Function::New(env, [stbuf, promise](const Napi::CallbackInfo& info) {
                if (info.Length() < 1) {
                    promise->set_value(-EINVAL);
                    return;
                }
                
                // First arg is error code
                int err = 0;
                if (info[0].IsNumber()) {
                    err = info[0].As<Napi::Number>().Int32Value();
                }
                
                if (err != 0) {
                    promise->set_value(err);
                    return;
                }
                
                // Second arg is stat object
                if (info.Length() < 2 || !info[1].IsObject()) {
                    promise->set_value(-EINVAL);
                    return;
                }
                
                Napi::Object stat = info[1].As<Napi::Object>();
                
                // Parse stat object with defaults
                stbuf->st_mode = S_IFREG | 0644; // Default to regular file
                stbuf->st_nlink = 1;
                stbuf->st_uid = getuid();
                stbuf->st_gid = getgid();
                stbuf->st_size = 0;
                stbuf->st_mtime = time(nullptr);
                stbuf->st_atime = stbuf->st_mtime;
                stbuf->st_ctime = stbuf->st_mtime;
                
                if (stat.Has("mode") && stat.Get("mode").IsNumber()) {
                    stbuf->st_mode = stat.Get("mode").As<Napi::Number>().Uint32Value();
                }
                if (stat.Has("size") && stat.Get("size").IsNumber()) {
                    stbuf->st_size = stat.Get("size").As<Napi::Number>().Int64Value();
                }
                if (stat.Has("uid") && stat.Get("uid").IsNumber()) {
                    stbuf->st_uid = stat.Get("uid").As<Napi::Number>().Uint32Value();
                }
                if (stat.Has("gid") && stat.Get("gid").IsNumber()) {
                    stbuf->st_gid = stat.Get("gid").As<Napi::Number>().Uint32Value();
                }
                if (stat.Has("mtime")) {
                    if (stat.Get("mtime").IsNumber()) {
                        stbuf->st_mtime = stat.Get("mtime").As<Napi::Number>().Int64Value();
                    } else if (stat.Get("mtime").IsDate()) {
                        stbuf->st_mtime = stat.Get("mtime").As<Napi::Date>().ValueOf() / 1000;
                    }
                }
                if (stat.Has("atime")) {
                    if (stat.Get("atime").IsNumber()) {
                        stbuf->st_atime = stat.Get("atime").As<Napi::Number>().Int64Value();
                    } else if (stat.Get("atime").IsDate()) {
                        stbuf->st_atime = stat.Get("atime").As<Napi::Date>().ValueOf() / 1000;
                    }
                }
                if (stat.Has("ctime")) {
                    if (stat.Get("ctime").IsNumber()) {
                        stbuf->st_ctime = stat.Get("ctime").As<Napi::Number>().Int64Value();
                    } else if (stat.Get("ctime").IsDate()) {
                        stbuf->st_ctime = stat.Get("ctime").As<Napi::Date>().ValueOf() / 1000;
                    }
                }
                
                promise->set_value(0);
            });
            
            getattr.As<Napi::Function>().Call(ops, {Napi::String::New(env, path), resultCb});
            
        } catch (const std::exception& e) {
            fprintf(stderr, "fuse3_getattr exception: %s\n", e.what());
            promise->set_value(-EIO);
        } catch (...) {
            fprintf(stderr, "fuse3_getattr unknown exception\n");
            promise->set_value(-EIO);
        }
    };
    
    napi_status status = ctx->tsfn.BlockingCall(callback);
    if (status != napi_ok) {
        fprintf(stderr, "fuse3_getattr: BlockingCall failed with status %d\n", status);
        return -EIO;
    }
    
    return future.get();
}

int fuse3_readdir(const char *path, void *buf, fuse_fill_dir_t filler,
                  off_t offset, struct fuse_file_info *fi, enum fuse_readdir_flags flags) {
    FuseContext* ctx = GetContextFromFuse();
    if (!ctx) {
        fprintf(stderr, "fuse3_readdir: No context found\n");
        return -EIO;
    }
    
    // ThreadSafeFunction doesn't have IsEmpty, we trust it's valid if ctx exists
    
    auto promise = std::make_shared<std::promise<int>>();
    std::future<int> future = promise->get_future();
    
    auto callback = [path, buf, filler, promise, ctx](Napi::Env env, Napi::Function jsCallback) {
        try {
            Napi::Object ops = ctx->operations.Value();
            Napi::Value readdir = ops.Get("readdir");
            
            if (!readdir.IsFunction()) {
                promise->set_value(-ENOSYS);
                return;
            }
            
            auto resultCb = Napi::Function::New(env, [buf, filler, promise](const Napi::CallbackInfo& info) {
                if (info.Length() < 1) {
                    promise->set_value(-EINVAL);
                    return;
                }
                
                // First arg is error code
                int err = 0;
                if (info[0].IsNumber()) {
                    err = info[0].As<Napi::Number>().Int32Value();
                }
                
                if (err != 0) {
                    promise->set_value(err);
                    return;
                }
                
                // Second arg is array of filenames
                if (info.Length() < 2 || !info[1].IsArray()) {
                    promise->set_value(-EINVAL);
                    return;
                }
                
                Napi::Array files = info[1].As<Napi::Array>();
                
                // Add . and .. entries
                filler(buf, ".", nullptr, 0, FUSE_FILL_DIR_PLUS);
                filler(buf, "..", nullptr, 0, FUSE_FILL_DIR_PLUS);
                
                // Add files from JavaScript
                for (uint32_t i = 0; i < files.Length(); i++) {
                    if (files.Get(i).IsString()) {
                        std::string filename = files.Get(i).As<Napi::String>().Utf8Value();
                        if (filler(buf, filename.c_str(), nullptr, 0, FUSE_FILL_DIR_PLUS) != 0) {
                            break; // Buffer full
                        }
                    }
                }
                
                promise->set_value(0);
            });
            
            readdir.As<Napi::Function>().Call(ops, {Napi::String::New(env, path), resultCb});
            
        } catch (const std::exception& e) {
            fprintf(stderr, "fuse3_readdir exception: %s\n", e.what());
            promise->set_value(-EIO);
        } catch (...) {
            fprintf(stderr, "fuse3_readdir unknown exception\n");
            promise->set_value(-EIO);
        }
    };
    
    napi_status status = ctx->tsfn.BlockingCall(callback);
    if (status != napi_ok) {
        fprintf(stderr, "fuse3_readdir: BlockingCall failed with status %d\n", status);
        return -EIO;
    }
    
    return future.get();
}

int fuse3_open(const char *path, struct fuse_file_info *fi) {
    FuseContext* ctx = GetContextFromFuse();
    if (!ctx) return -EIO;
    
    auto promise = std::make_shared<std::promise<int>>();
    std::future<int> future = promise->get_future();
    
    auto callback = [path, fi, promise, ctx](Napi::Env env, Napi::Function jsCallback) {
        try {
            Napi::Object ops = ctx->operations.Value();
            Napi::Value open = ops.Get("open");
            
            if (!open.IsFunction()) {
                promise->set_value(0); // Allow open by default
                return;
            }
            
            auto resultCb = Napi::Function::New(env, [fi, promise](const Napi::CallbackInfo& info) {
                if (info.Length() < 1) {
                    promise->set_value(-EINVAL);
                    return;
                }
                
                // First arg is error code
                int err = 0;
                if (info[0].IsNumber()) {
                    err = info[0].As<Napi::Number>().Int32Value();
                }
                
                if (err != 0) {
                    promise->set_value(err);
                    return;
                }
                
                // Second arg is file handle (optional)
                if (info.Length() >= 2 && info[1].IsNumber()) {
                    fi->fh = info[1].As<Napi::Number>().Uint32Value();
                }
                
                promise->set_value(0);
            });
            
            open.As<Napi::Function>().Call(ops, {
                Napi::String::New(env, path),
                Napi::Number::New(env, fi->flags),
                resultCb
            });
            
        } catch (...) {
            promise->set_value(-EIO);
        }
    };
    
    ctx->tsfn.BlockingCall(callback);
    return future.get();
}

int fuse3_read(const char *path, char *buf, size_t size, off_t offset,
               struct fuse_file_info *fi) {
    FuseContext* ctx = GetContextFromFuse();
    if (!ctx) return -EIO;
    
    auto promise = std::make_shared<std::promise<int>>();
    std::future<int> future = promise->get_future();
    
    auto callback = [path, buf, size, offset, fi, promise, ctx](Napi::Env env, Napi::Function jsCallback) {
        try {
            Napi::Object ops = ctx->operations.Value();
            Napi::Value read = ops.Get("read");
            
            if (!read.IsFunction()) {
                promise->set_value(-ENOSYS);
                return;
            }
            
            // Allocate buffer that JavaScript will fill
            Napi::Buffer<char> buffer = Napi::Buffer<char>::New(env, size);
            
            auto resultCb = Napi::Function::New(env, [buf, size, buffer, promise](const Napi::CallbackInfo& info) {
                if (info.Length() < 1) {
                    promise->set_value(-EINVAL);
                    return;
                }
                
                // First arg is either error code or bytes read
                int result = info[0].As<Napi::Number>().Int32Value();
                
                if (result < 0) {
                    // Error code
                    promise->set_value(result);
                    return;
                }
                
                // Positive result means bytes read
                size_t bytesRead = std::min(static_cast<size_t>(result), size);
                
                // Second arg might be the buffer (if provided)
                if (info.Length() >= 2 && info[1].IsBuffer()) {
                    Napi::Buffer<char> returnedBuffer = info[1].As<Napi::Buffer<char>>();
                    size_t copySize = std::min(bytesRead, returnedBuffer.Length());
                    memcpy(buf, returnedBuffer.Data(), copySize);
                    promise->set_value(copySize);
                } else {
                    // Use the original buffer
                    memcpy(buf, buffer.Data(), bytesRead);
                    promise->set_value(bytesRead);
                }
            });
            
            read.As<Napi::Function>().Call(ops, {
                Napi::String::New(env, path),
                Napi::Number::New(env, fi->fh),
                buffer,
                Napi::Number::New(env, size),
                Napi::Number::New(env, offset),
                resultCb
            });
            
        } catch (...) {
            promise->set_value(-EIO);
        }
    };
    
    ctx->tsfn.BlockingCall(callback);
    return future.get();
}

int fuse3_write(const char *path, const char *buf, size_t size, off_t offset,
                struct fuse_file_info *fi) {
    FuseContext* ctx = GetContextFromFuse();
    if (!ctx) return -EIO;
    
    auto promise = std::make_shared<std::promise<int>>();
    std::future<int> future = promise->get_future();
    
    auto callback = [path, buf, size, offset, fi, promise, ctx](Napi::Env env, Napi::Function jsCallback) {
        try {
            Napi::Object ops = ctx->operations.Value();
            Napi::Value write = ops.Get("write");
            
            if (!write.IsFunction()) {
                promise->set_value(-ENOSYS);
                return;
            }
            
            auto resultCb = Napi::Function::New(env, [promise](const Napi::CallbackInfo& info) {
                if (info.Length() < 1) {
                    promise->set_value(-EINVAL);
                    return;
                }
                
                int result = info[0].As<Napi::Number>().Int32Value();
                promise->set_value(result);
            });
            
            Napi::Buffer<char> buffer = Napi::Buffer<char>::Copy(env, buf, size);
            
            write.As<Napi::Function>().Call(ops, {
                Napi::String::New(env, path),
                Napi::Number::New(env, fi->fh),
                buffer,
                Napi::Number::New(env, size),
                Napi::Number::New(env, offset),
                resultCb
            });
            
        } catch (...) {
            promise->set_value(-EIO);
        }
    };
    
    ctx->tsfn.BlockingCall(callback);
    return future.get();
}

// Simplified implementations for other operations
int fuse3_create(const char *path, mode_t mode, struct fuse_file_info *fi) {
    return CallJsOperation("create", path, mode);
}

int fuse3_unlink(const char *path) {
    return CallJsOperation("unlink", path);
}

int fuse3_mkdir(const char *path, mode_t mode) {
    return CallJsOperation("mkdir", path, mode);
}

int fuse3_rmdir(const char *path) {
    return CallJsOperation("rmdir", path);
}

int fuse3_rename(const char *from, const char *to, unsigned int flags) {
    FuseContext* ctx = GetContextFromFuse();
    if (!ctx) return -EIO;
    
    auto promise = std::make_shared<std::promise<int>>();
    std::future<int> future = promise->get_future();
    
    auto callback = [from, to, promise, ctx](Napi::Env env, Napi::Function jsCallback) {
        try {
            Napi::Object ops = ctx->operations.Value();
            Napi::Value rename = ops.Get("rename");
            
            if (!rename.IsFunction()) {
                promise->set_value(-ENOSYS);
                return;
            }
            
            auto resultCb = Napi::Function::New(env, [promise](const Napi::CallbackInfo& info) {
                if (info.Length() > 0 && info[0].IsNumber()) {
                    promise->set_value(info[0].As<Napi::Number>().Int32Value());
                } else {
                    promise->set_value(0);
                }
            });
            
            rename.As<Napi::Function>().Call(ops, {
                Napi::String::New(env, from),
                Napi::String::New(env, to),
                resultCb
            });
            
        } catch (...) {
            promise->set_value(-EIO);
        }
    };
    
    ctx->tsfn.BlockingCall(callback);
    return future.get();
}

int fuse3_chmod(const char *path, mode_t mode, struct fuse_file_info *fi) {
    return CallJsOperation("chmod", path, mode);
}

int fuse3_chown(const char *path, uid_t uid, gid_t gid, struct fuse_file_info *fi) {
    return CallJsOperation("chown", path, uid, gid);
}

int fuse3_truncate(const char *path, off_t size, struct fuse_file_info *fi) {
    return CallJsOperation("truncate", path, size);
}

int fuse3_utimens(const char *path, const struct timespec ts[2], struct fuse_file_info *fi) {
    return CallJsOperation("utimens", path, ts[0].tv_sec, ts[1].tv_sec);
}

int fuse3_release(const char *path, struct fuse_file_info *fi) {
    FuseContext* ctx = GetContextFromFuse();
    if (!ctx) return -EIO;
    
    auto promise = std::make_shared<std::promise<int>>();
    std::future<int> future = promise->get_future();
    
    auto callback = [path, fi, promise, ctx](Napi::Env env, Napi::Function jsCallback) {
        try {
            Napi::Object ops = ctx->operations.Value();
            Napi::Value release = ops.Get("release");
            
            if (!release.IsFunction()) {
                promise->set_value(0); // No-op if not implemented
                return;
            }
            
            auto resultCb = Napi::Function::New(env, [promise](const Napi::CallbackInfo& info) {
                if (info.Length() > 0 && info[0].IsNumber()) {
                    promise->set_value(info[0].As<Napi::Number>().Int32Value());
                } else {
                    promise->set_value(0);
                }
            });
            
            release.As<Napi::Function>().Call(ops, {
                Napi::String::New(env, path),
                Napi::Number::New(env, fi->fh),
                resultCb
            });
            
        } catch (...) {
            promise->set_value(-EIO);
        }
    };
    
    ctx->tsfn.BlockingCall(callback);
    return future.get();
}

int fuse3_fsync(const char *path, int isdatasync, struct fuse_file_info *fi) {
    return CallJsOperation("fsync", path, isdatasync, fi->fh);
}

int fuse3_flush(const char *path, struct fuse_file_info *fi) {
    return CallJsOperation("flush", path, fi->fh);
}

int fuse3_access(const char *path, int mask) {
    return CallJsOperation("access", path, mask);
}

int fuse3_statfs(const char *path, struct statvfs *stbuf) {
    // Basic implementation - can be expanded
    memset(stbuf, 0, sizeof(struct statvfs));
    stbuf->f_bsize = 4096;
    stbuf->f_frsize = 4096;
    stbuf->f_blocks = 1000000;
    stbuf->f_bfree = 500000;
    stbuf->f_bavail = 500000;
    stbuf->f_files = 1000000;
    stbuf->f_ffree = 500000;
    stbuf->f_namemax = 255;
    return 0;
}