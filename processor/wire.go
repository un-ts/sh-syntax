package processor

import (
	"fmt"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"mvdan.cc/sh/v3/syntax"
)

// wireValue is a JSON value that has not been decoded yet. The AST decoder
// splits objects and arrays itself so it does not pull encoding/json into the
// WASM binary.
type wireValue []byte

func isNull(raw wireValue) bool {
	trimmed := strings.TrimSpace(string(raw))
	return trimmed == "" || trimmed == "null"
}

func decodeObject(raw wireValue) (map[string]wireValue, error) {
	index, err := skipSpace(raw, 0)
	if err != nil {
		return nil, err
	}
	if index >= len(raw) || raw[index] != '{' {
		return nil, fmt.Errorf("expected object")
	}
	index++
	result := make(map[string]wireValue)
	for {
		index, err = skipSpace(raw, index)
		if err != nil {
			return nil, err
		}
		if index >= len(raw) {
			return nil, fmt.Errorf("unterminated object")
		}
		if raw[index] == '}' {
			return result, nil
		}
		end, err := scanString(raw, index)
		if err != nil {
			return nil, err
		}
		key, err := decodeStringValue(raw[index:end])
		if err != nil {
			return nil, err
		}
		index, err = skipSpace(raw, end)
		if err != nil {
			return nil, err
		}
		if index >= len(raw) || raw[index] != ':' {
			return nil, fmt.Errorf("expected colon")
		}
		index, err = skipSpace(raw, index+1)
		if err != nil {
			return nil, err
		}
		end, err = scanValue(raw, index)
		if err != nil {
			return nil, err
		}
		result[key] = raw[index:end]
		index, err = skipSpace(raw, end)
		if err != nil {
			return nil, err
		}
		if index >= len(raw) {
			return nil, fmt.Errorf("unterminated object")
		}
		switch raw[index] {
		case ',':
			index++
		case '}':
			return result, nil
		default:
			return nil, fmt.Errorf("expected comma or closing brace")
		}
	}
}

func decodeArray(raw wireValue, visit func(wireValue) error) error {
	index, err := skipSpace(raw, 0)
	if err != nil {
		return err
	}
	if index >= len(raw) || raw[index] != '[' {
		return fmt.Errorf("expected array")
	}
	index++
	for {
		index, err = skipSpace(raw, index)
		if err != nil {
			return err
		}
		if index >= len(raw) {
			return fmt.Errorf("unterminated array")
		}
		if raw[index] == ']' {
			return nil
		}
		end, err := scanValue(raw, index)
		if err != nil {
			return err
		}
		if err := visit(raw[index:end]); err != nil {
			return err
		}
		index, err = skipSpace(raw, end)
		if err != nil {
			return err
		}
		if index >= len(raw) {
			return fmt.Errorf("unterminated array")
		}
		switch raw[index] {
		case ',':
			index++
		case ']':
			return nil
		default:
			return fmt.Errorf("expected comma or closing bracket")
		}
	}
}

func decodeStringValue(raw wireValue) (string, error) {
	index, err := skipSpace(raw, 0)
	if err != nil {
		return "", err
	}
	end, err := scanString(raw, index)
	if err != nil {
		return "", err
	}
	index++
	var builder strings.Builder
	for index < end-1 {
		char := raw[index]
		if char != '\\' {
			start := index
			for index < end-1 && raw[index] != '\\' {
				index++
			}
			builder.Write(raw[start:index])
			continue
		}
		index++
		if index >= end-1 {
			return "", fmt.Errorf("invalid escape")
		}
		switch raw[index] {
		case '"', '\\', '/':
			builder.WriteByte(raw[index])
			index++
		case 'b':
			builder.WriteByte('\b')
			index++
		case 'f':
			builder.WriteByte('\f')
			index++
		case 'n':
			builder.WriteByte('\n')
			index++
		case 'r':
			builder.WriteByte('\r')
			index++
		case 't':
			builder.WriteByte('\t')
			index++
		case 'u':
			codepoint, next, err := readHex(raw, index+1, 4)
			if err != nil {
				return "", err
			}
			index = next
			if utf16.IsSurrogate(rune(codepoint)) && index+6 <= end && raw[index] == '\\' && raw[index+1] == 'u' {
				low, nextLow, err := readHex(raw, index+2, 4)
				if err != nil {
					return "", err
				}
				if paired := utf16.DecodeRune(rune(codepoint), rune(low)); paired != utf8.RuneError {
					codepoint = uint64(paired)
					index = nextLow
				}
			}
			if !utf8.ValidRune(rune(codepoint)) {
				return "", fmt.Errorf("invalid unicode escape")
			}
			builder.WriteRune(rune(codepoint))
		default:
			return "", fmt.Errorf("invalid escape")
		}
	}
	return builder.String(), nil
}

func decodeString(raw wireValue, out *string) error {
	value, err := decodeStringValue(raw)
	if err != nil {
		return err
	}
	*out = value
	return nil
}

func decodeBool(raw wireValue, out *bool) error {
	switch strings.TrimSpace(string(raw)) {
	case "true":
		*out = true
	case "false":
		*out = false
	default:
		return fmt.Errorf("expected boolean")
	}
	return nil
}

func decodeUint(raw wireValue, out *uint64) error {
	value, err := strconv.ParseUint(strings.TrimSpace(string(raw)), 10, 64)
	if err != nil {
		return err
	}
	*out = value
	return nil
}

func decodePos(raw wireValue) (syntax.Pos, error) {
	object, err := decodeObject(raw)
	if err != nil {
		return syntax.Pos{}, err
	}
	var offset, line, column uint64
	for key, value := range map[string]*uint64{"offset": &offset, "line": &line, "column": &column} {
		if entry := object[key]; entry != nil {
			if err := decodeUint(entry, value); err != nil {
				return syntax.Pos{}, err
			}
		}
	}
	var recovered bool
	if entry := object["recovered"]; entry != nil {
		if err := decodeBool(entry, &recovered); err != nil {
			return syntax.Pos{}, err
		}
	}
	if recovered {
		return syntax.NewPos(0, 0, 0), nil
	}
	if offset != 0 || line != 0 {
		column++
	}
	return syntax.NewPos(uint(offset), uint(line), uint(column)), nil
}

func skipSpace(raw wireValue, index int) (int, error) {
	for index < len(raw) {
		switch raw[index] {
		case ' ', '\n', '\r', '\t':
			index++
		default:
			return index, nil
		}
	}
	return index, nil
}

func scanString(raw wireValue, start int) (int, error) {
	if start >= len(raw) || raw[start] != '"' {
		return 0, fmt.Errorf("expected string")
	}
	for index := start + 1; index < len(raw); index++ {
		switch raw[index] {
		case '\\':
			index++
		case '"':
			return index + 1, nil
		}
	}
	return 0, fmt.Errorf("unterminated string")
}

func scanValue(raw wireValue, start int) (int, error) {
	index, err := skipSpace(raw, start)
	if err != nil {
		return 0, err
	}
	if index >= len(raw) {
		return 0, fmt.Errorf("missing value")
	}
	switch raw[index] {
	case '"':
		return scanString(raw, index)
	case '{', '[':
		depth := 0
		for index < len(raw) {
			switch raw[index] {
			case '"':
				next, err := scanString(raw, index)
				if err != nil {
					return 0, err
				}
				index = next
				continue
			case '{', '[':
				depth++
			case '}', ']':
				depth--
				if depth == 0 {
					return index + 1, nil
				}
			}
			index++
		}
		return 0, fmt.Errorf("unterminated value")
	default:
		for index < len(raw) {
			switch raw[index] {
			case ',', ']', '}', ' ', '\n', '\r', '\t':
				return index, nil
			}
			index++
		}
		return index, nil
	}
}

func readHex(raw wireValue, start, length int) (uint64, int, error) {
	if start+length > len(raw) {
		return 0, 0, fmt.Errorf("invalid unicode escape")
	}
	value, err := strconv.ParseUint(string(raw[start:start+length]), 16, 32)
	if err != nil {
		return 0, 0, err
	}
	return value, start + length, nil
}
