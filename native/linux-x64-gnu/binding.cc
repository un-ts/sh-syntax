#include <node_api.h>

#include <string>

extern "C" {
char* sh_syntax_parse(const char* text, const char* filepath);
char* sh_syntax_print(const char* text, const char* filepath);
void sh_syntax_free(char* value);
}

namespace {

std::string GetString(napi_env env, napi_value value) {
  size_t length = 0;
  napi_get_value_string_utf8(env, value, nullptr, 0, &length);
  std::string result(length + 1, '\0');
  napi_get_value_string_utf8(env, value, result.data(), result.size(), &length);
  return result;
}

std::string GetFilepath(napi_env env, size_t argc, napi_value* argv) {
  return argc > 1 ? GetString(env, argv[1]) : "<input>";
}

napi_value Call(napi_env env, napi_callback_info info,
                char* (*method)(const char*, const char*)) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

  std::string text = GetString(env, argv[0]);
  std::string filepath = GetFilepath(env, argc, argv);
  char* result = method(text.c_str(), filepath.c_str());

  napi_value value;
  napi_create_string_utf8(env, result, NAPI_AUTO_LENGTH, &value);
  sh_syntax_free(result);
  return value;
}

napi_value Parse(napi_env env, napi_callback_info info) {
  return Call(env, info, sh_syntax_parse);
}

napi_value Print(napi_env env, napi_callback_info info) {
  return Call(env, info, sh_syntax_print);
}

napi_value Init(napi_env env, napi_value exports) {
  napi_value parse;
  napi_value print;
  napi_create_function(env, "parse", NAPI_AUTO_LENGTH, Parse, nullptr, &parse);
  napi_create_function(env, "print", NAPI_AUTO_LENGTH, Print, nullptr, &print);
  napi_set_named_property(env, exports, "parse", parse);
  napi_set_named_property(env, exports, "print", print);
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
