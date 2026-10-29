package main

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestNodeVersionBinsOrderAndBound(t *testing.T) {
	home := t.TempDir()
	for i := 0; i < 40; i++ {
		if e := os.MkdirAll(filepath.Join(home, ".nvm", "versions", "node", fmt.Sprintf("v%d.0.0", i)), 0700); e != nil {
			t.Fatal(e)
		}
	}
	if e := os.MkdirAll(filepath.Join(home, ".nvm", "versions", "node", "invalid"), 0700); e != nil {
		t.Fatal(e)
	}
	bins := nodeVersionBins(home)
	if len(bins) != 32 || bins[0] != filepath.Join(home, ".nvm", "versions", "node", "v39.0.0", "bin") || bins[31] != filepath.Join(home, ".nvm", "versions", "node", "v8.0.0", "bin") {
		t.Fatal("NVM candidates must be newest32 valid versions")
	}
}
