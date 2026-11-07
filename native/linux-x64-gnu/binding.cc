#include <node_api.h>

#include <string>

extern "C" {
char* sh_syntax_parse(const char* text, const char* filepath);
void sh_syntax_free(char* value);
}

namespace {

napi_value Parse(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

  size_t textLength = 0;
  napi_get_value_string_utf8(env, argv[0], nullptr, 0, &textLength);
  std::string text(textLength, '\0');
  napi_get_value_string_utf8(env, argv[0], text.data(), textLength + 1, &textLength);

  std::string filepath = "<input>";
  if (argc > 1) {
    size_t filepathLength = 0;
    napi_get_value_string_utf8(env, argv[1], nullptr, 0, &filepathLength);
    filepath.resize(filepathLength);
    napi_get_value_string_utf8(env, argv[1], filepath.data(), filepathLength + 1, &filepathLength);
  }

  char* result = sh_syntax_parse(text.c_str(), filepath.c_str());
  napi_value value;
  napi_create_string_utf8(env, result, NAPI_AUTO_LENGTH, &value);
  sh_syntax_free(result);
  return value;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_value parse;
  napi_create_function(env, "parse", NAPI_AUTO_LENGTH, Parse, nullptr, &parse);
  napi_set_named_property(env, exports, "parse", parse);
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
