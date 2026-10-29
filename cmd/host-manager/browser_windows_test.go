package main

import (
	"strings"
	"testing"
)

func TestShellExecuteFailureCodesAreNotSuccess(t *testing.T) {
	for _, code := range []uintptr{0, 2, 3, 5, 8, 26, 27, 28, 29, 30, 31, 32} {
		err := browserLaunchResult(code)
		if err == nil || strings.Contains(err.Error(), "http") {
			t.Fatalf("unsafe or missing error for code %d", code)
		}
	}
	for _, code := range []uintptr{33, 42, 65536} {
		if err := browserLaunchResult(code); err != nil {
			t.Fatal(err)
		}
	}
}
