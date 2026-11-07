#include <node_api.h>

#include <cstdint>
#include <string>

extern "C" {
char* sh_syntax_parse(const char* text, const char* filepath);
char* sh_syntax_print(const char* text, const char* filepath);
char* sh_syntax_print_ast(const char* jsonText);
char* sh_syntax_parse_handle(const char* text, const char* filepath);
char* sh_syntax_patch_lit(uint64_t handle, uint64_t start, uint64_t end, const char* value);
char* sh_syntax_patch_scalar(uint64_t handle, const char* typeName, uint64_t start, uint64_t end, const char* field, const char* valueJSON);
char* sh_syntax_print_handle(uint64_t handle);
void sh_syntax_free_handle(uint64_t handle);
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

uint64_t GetInt64(napi_env env, napi_value value) {
  int64_t result = 0;
  napi_get_value_int64(env, value, &result);
  return static_cast<uint64_t>(result);
}

napi_value ReturnString(napi_env env, char* result) {
  napi_value value;
  napi_create_string_utf8(env, result, NAPI_AUTO_LENGTH, &value);
  sh_syntax_free(result);
  return value;
}

napi_value ParseHandle(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  std::string text = GetString(env, argv[0]);
  std::string filepath = GetFilepath(env, argc, argv);
  return ReturnString(env, sh_syntax_parse_handle(text.c_str(), filepath.c_str()));
}

napi_value PatchLit(napi_env env, napi_callback_info info) {
  size_t argc = 4;
  napi_value argv[4];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  std::string value = GetString(env, argv[3]);
  return ReturnString(env, sh_syntax_patch_lit(GetInt64(env, argv[0]), GetInt64(env, argv[1]),
                                               GetInt64(env, argv[2]), value.c_str()));
}

napi_value PatchScalar(napi_env env, napi_callback_info info) {
  size_t argc = 6;
  napi_value argv[6];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  std::string typeName = GetString(env, argv[1]);
  std::string field = GetString(env, argv[4]);
  std::string valueJSON = GetString(env, argv[5]);
  return ReturnString(env, sh_syntax_patch_scalar(GetInt64(env, argv[0]), typeName.c_str(),
                                                  GetInt64(env, argv[2]), GetInt64(env, argv[3]),
                                                  field.c_str(), valueJSON.c_str()));
}

napi_value PrintHandle(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  return ReturnString(env, sh_syntax_print_handle(GetInt64(env, argv[0])));
}

napi_value FreeHandle(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  sh_syntax_free_handle(GetInt64(env, argv[0]));
  return nullptr;
}

napi_value PrintAst(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

  std::string jsonText = GetString(env, argv[0]);
  char* result = sh_syntax_print_ast(jsonText.c_str());

  napi_value value;
  napi_create_string_utf8(env, result, NAPI_AUTO_LENGTH, &value);
  sh_syntax_free(result);
  return value;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_value parse;
  napi_value print;
  napi_value printAst;
  napi_value parseHandle;
  napi_value patchLit;
  napi_value patchScalar;
  napi_value printHandle;
  napi_value freeHandle;
  napi_create_function(env, "parse", NAPI_AUTO_LENGTH, Parse, nullptr, &parse);
  napi_create_function(env, "print", NAPI_AUTO_LENGTH, Print, nullptr, &print);
  napi_create_function(env, "printAst", NAPI_AUTO_LENGTH, PrintAst, nullptr, &printAst);
  napi_create_function(env, "parseHandle", NAPI_AUTO_LENGTH, ParseHandle, nullptr, &parseHandle);
  napi_create_function(env, "patchLit", NAPI_AUTO_LENGTH, PatchLit, nullptr, &patchLit);
  napi_create_function(env, "patchScalar", NAPI_AUTO_LENGTH, PatchScalar, nullptr, &patchScalar);
  napi_create_function(env, "printHandle", NAPI_AUTO_LENGTH, PrintHandle, nullptr, &printHandle);
  napi_create_function(env, "freeHandle", NAPI_AUTO_LENGTH, FreeHandle, nullptr, &freeHandle);
  napi_set_named_property(env, exports, "parse", parse);
  napi_set_named_property(env, exports, "print", print);
  napi_set_named_property(env, exports, "printAst", printAst);
  napi_set_named_property(env, exports, "parseHandle", parseHandle);
  napi_set_named_property(env, exports, "patchLit", patchLit);
  napi_set_named_property(env, exports, "patchScalar", patchScalar);
  napi_set_named_property(env, exports, "printHandle", printHandle);
  napi_set_named_property(env, exports, "freeHandle", freeHandle);
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
