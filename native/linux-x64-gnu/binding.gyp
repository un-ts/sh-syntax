{
  "targets": [
    {
      "target_name": "sh_syntax_binding",
      "sources": [
        "binding.cc"
      ],
      "libraries": [
        "<(module_root_dir)/../../build/libshsyntax.so"
      ],
      "cflags_cc": [
        "-std=c++17"
      ],
      "ldflags": [
        "-s"
      ]
    }
  ]
}
