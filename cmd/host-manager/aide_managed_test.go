package main

import "testing"

func TestAideManagedRejectsUnsafeBindingAndPaths(t *testing.T) {
	for _, args := range [][]string{{}, {"relative"}, {"/tmp/connection", "0.0.0.0"}, {"/tmp/connection", "8.8.8.8"}, {"/tmp/connection", "localhost"}, {"/tmp/connection", "::"}, {"/tmp/connection", "127.0.0.1", "extra"}} {
		if runAideManaged(args) == nil {
			t.Fatalf("accepted unsafe arguments: %v", args)
		}
	}
}
