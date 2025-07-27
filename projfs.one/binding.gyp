{
  "targets": [
    {
      "target_name": "projfs_native",
      "sources": [
        "src/native/projfs_wrapper.cpp",
        "src/native/callbacks.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "libraries": [
        "ProjectedFSLib.lib"
      ],
      "defines": [
        "NAPI_CPP_EXCEPTIONS",
        "_WIN32_WINNT=0x0A00"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": ["/std:c++17"]
        }
      },
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "-lProjectedFSLib"
          ],
          "msvs_settings": {
            "VCLinkerTool": {
              "AdditionalLibraryDirectories": [
                "$(WindowsSdkDir)lib\\$(WindowsSDKLibVersion)\\um\\x64"
              ]
            }
          }
        }]
      ]
    }
  ]
}