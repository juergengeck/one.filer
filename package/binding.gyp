{
  "targets": [
    {
      "target_name": "ifsprojfs",
      "sources": [
        "src/ifsprojfs_bridge.cpp",
        "src/sync_storage.cpp",
        "src/projfs_provider.cpp",
        "src/content_cache.cpp",
        "src/async_bridge.cpp"
      ],
      "include_dirs": [
        "node_modules/node-addon-api"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [ "/std:c++17" ]
        },
        "VCLinkerTool": {
          "AdditionalDependencies": [ "ProjectedFSLib.lib" ]
        }
      },
      "conditions": [
        ["OS=='win'", {
          "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS", "_WIN32_WINNT=0x0A00" ]
        }]
      ]
    }
  ]
}