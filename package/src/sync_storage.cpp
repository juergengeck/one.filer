#include "sync_storage.h"
#include <fstream>
#include <sstream>
#include <regex>
#include <sys/stat.h>
#include <cstring>

namespace oneifsprojfs {

SyncStorage::SyncStorage(const std::string& instancePath) 
    : instancePath_(instancePath),
      objectsPath_(instancePath_ / "objects"),
      vheadsPath_(instancePath_ / "vheads"),
      rmapsPath_(instancePath_ / "rmaps") {
    
    // Create directories if they don't exist
    try {
        if (!std::filesystem::exists(objectsPath_)) {
            std::filesystem::create_directories(objectsPath_);
        }
        if (!std::filesystem::exists(vheadsPath_)) {
            std::filesystem::create_directories(vheadsPath_);
        }
        if (!std::filesystem::exists(rmapsPath_)) {
            std::filesystem::create_directories(rmapsPath_);
        }
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to create storage directories: " + std::string(e.what()));
    }
}

std::optional<std::string> SyncStorage::ReadObject(const std::string& hash) {
    try {
        std::filesystem::path objectPath = objectsPath_ / hash;
        if (!std::filesystem::exists(objectPath)) {
            return std::nullopt;
        }
        
        std::ifstream file(objectPath, std::ios::binary);
        if (!file.is_open()) {
            return std::nullopt;
        }
        
        std::stringstream buffer;
        buffer << file.rdbuf();
        return buffer.str();
    } catch (...) {
        return std::nullopt;
    }
}

std::optional<std::vector<uint8_t>> SyncStorage::ReadObjectBinary(const std::string& hash) {
    try {
        std::filesystem::path objectPath = objectsPath_ / hash;
        if (!std::filesystem::exists(objectPath)) {
            return std::nullopt;
        }
        
        std::ifstream file(objectPath, std::ios::binary | std::ios::ate);
        if (!file.is_open()) {
            return std::nullopt;
        }
        
        size_t size = file.tellg();
        file.seekg(0, std::ios::beg);
        
        std::vector<uint8_t> buffer(size);
        file.read(reinterpret_cast<char*>(buffer.data()), size);
        
        return buffer;
    } catch (...) {
        return std::nullopt;
    }
}

std::optional<std::string> SyncStorage::ReadObjectSection(const std::string& hash, size_t offset, size_t length) {
    try {
        std::filesystem::path objectPath = objectsPath_ / hash;
        if (!std::filesystem::exists(objectPath)) {
            return std::nullopt;
        }
        
        std::ifstream file(objectPath, std::ios::binary);
        if (!file.is_open()) {
            return std::nullopt;
        }
        
        file.seekg(offset);
        std::vector<char> buffer(length);
        file.read(buffer.data(), length);
        
        size_t bytesRead = file.gcount();
        return std::string(buffer.data(), bytesRead);
    } catch (...) {
        return std::nullopt;
    }
}

std::vector<std::string> SyncStorage::ListObjects() {
    std::vector<std::string> objects;
    try {
        for (const auto& entry : std::filesystem::directory_iterator(objectsPath_)) {
            if (entry.is_regular_file()) {
                objects.push_back(entry.path().filename().string());
            }
        }
    } catch (...) {
        // Return empty vector on error
    }
    return objects;
}

std::vector<std::string> SyncStorage::ListDirectory(const std::string& virtualPath) {
    std::vector<std::string> entries;
    
    // Root directory exposes virtual top-level folders
    if (virtualPath == "/" || virtualPath.empty()) {
        entries = {"objects", "chats", "debug", "invites", "types"};
    }
    else if (virtualPath == "/objects" || virtualPath == "/objects/") {
        // List all object hashes
        return ListObjects();
    }
    // Keep object hashes as direct children of /objects; no additional virtual sub-entries
    
    return entries;
}

ObjectMetadata SyncStorage::GetObjectMetadata(const std::string& hash) {
    // Check cache first
    auto cached = metadataCache_.find(hash);
    if (cached != metadataCache_.end()) {
        return cached->second;
    }
    
    ObjectMetadata metadata;
    std::filesystem::path objectPath = objectsPath_ / hash;
    
    try {
        if (std::filesystem::exists(objectPath)) {
            metadata.exists = true;
            metadata.size = std::filesystem::file_size(objectPath);
            metadata.isDirectory = false;
            metadata.type = GetObjectType(hash);
        } else {
            metadata.exists = false;
            metadata.size = 0;
            metadata.isDirectory = false;
            metadata.type = "UNKNOWN";
        }
    } catch (...) {
        metadata.exists = false;
    }
    
    // Cache the result
    metadataCache_[hash] = metadata;
    return metadata;
}

std::string SyncStorage::GetObjectType(const std::string& hash) {
    // Check cache first
    auto cached = typeCache_.find(hash);
    if (cached != typeCache_.end()) {
        return cached->second;
    }
    
    std::string type = "BLOB"; // Default
    
    try {
        std::string header = ReadFirst100Bytes((objectsPath_ / hash).string());
        type = ExtractTypeFromMicrodata(header);
    } catch (...) {
        // Keep default
    }
    
    // Cache the result
    typeCache_[hash] = type;
    return type;
}

std::string SyncStorage::ExtractHashFromPath(const std::string& virtualPath) {
    // Pattern: /objects/[64-char-hash]/...
    static const std::regex hashPattern(R"(/objects/([0-9a-fA-F]{64})(?:/|$))");
    std::smatch match;
    
    if (std::regex_search(virtualPath, match, hashPattern)) {
        return match[1].str();
    }
    
    return "";
}

bool SyncStorage::IsObjectPath(const std::string& virtualPath) {
    return virtualPath.compare(0, 9, "/objects/") == 0;
}

ObjectMetadata SyncStorage::GetVirtualPathMetadata(const std::string& virtualPath) {
    ObjectMetadata metadata;
    
    // Root directories
    if (virtualPath == "/" || virtualPath == "/objects" || virtualPath == "/chats" ||
        virtualPath == "/debug" || virtualPath == "/invites" || virtualPath == "/types") {
        metadata.exists = true;
        metadata.isDirectory = true;
        metadata.size = 0;
        metadata.type = "DIRECTORY";
        return metadata;
    }
    
    // Object paths
    if (IsObjectPath(virtualPath)) {
        std::string hash = ExtractHashFromPath(virtualPath);
        if (!hash.empty()) {
            ObjectMetadata objMeta = GetObjectMetadata(hash);
            
            // Expose the object hash itself as a file
            if (virtualPath == "/objects/" + hash) {
                metadata.exists = objMeta.exists;
                metadata.isDirectory = false;
                metadata.size = objMeta.size;
                metadata.type = "FILE";
            } else {
                metadata.exists = false;
            }
            
            return metadata;
        }
    }
    
    metadata.exists = false;
    return metadata;
}

std::optional<std::string> SyncStorage::ReadVirtualPath(const std::string& virtualPath) {
    if (!IsObjectPath(virtualPath)) {
        return std::nullopt;
    }
    
    std::string hash = ExtractHashFromPath(virtualPath);
    if (hash.empty()) {
        return std::nullopt;
    }
    
    // Expose the raw object content directly when path is /objects/<hash>
    if (virtualPath == "/objects/" + hash) {
        return ReadObject(hash);
    }
    
    return std::nullopt;
}

std::string SyncStorage::ReadFirst100Bytes(const std::string& objectPath) {
    std::ifstream file(objectPath, std::ios::binary);
    if (!file.is_open()) {
        return "";
    }
    
    char buffer[100];
    file.read(buffer, sizeof(buffer));
    size_t bytesRead = file.gcount();
    
    return std::string(buffer, bytesRead);
}

std::string SyncStorage::ExtractTypeFromMicrodata(const std::string& microdata) {
    // Look for itemtype in microdata
    static const std::regex typePattern("itemtype=\"//refin\\\\.io/([^\"]+)\"");
    std::smatch match;
    
    if (std::regex_search(microdata, match, typePattern)) {
        return match[1].str();
    }
    
    // Check if it looks like microdata at all
    if (microdata.find("<div") != std::string::npos || 
        microdata.find("itemscope") != std::string::npos) {
        return "CLOB"; // Character LOB
    }
    
    return "BLOB"; // Binary LOB
}

} // namespace oneifsprojfs