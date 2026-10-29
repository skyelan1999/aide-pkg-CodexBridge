package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestPrepareConfigRejectsUnverifiedCLIWithoutChangingSettings(t *testing.T) {
	m := fixture(t)
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	if executable("node") == "" {
		t.Skip("Node unavailable")
	}
	fake := filepath.Join(m.root, "invalid-cli.cjs")
	if e := os.WriteFile(fake, []byte("console.log('unrelated-tool 1.0')"), 0600); e != nil {
		t.Fatal(e)
	}
	d, _ := m.config()
	d["codex"] = fake
	d["proxy"] = "fixture-proxy"
	d["preserve"] = "fixture-settings"
	d["preserveNumeric"] = int64(9007199254740993)
	b, _ := json.Marshal(d)
	p := filepath.Join(m.root, "config.json")
	if e := atomic(p, b, 0600); e != nil {
		t.Fatal(e)
	}
	if e := m.prepareConfig(); e == nil {
		t.Fatal("unverified CLI must fail diagnosis")
	}
	after, _ := os.ReadFile(p)
	if string(after) != string(b) {
		t.Fatal("failed probe changed config")
	}
}
func TestPrepareConfigPersistsVerifiedBareCLIAndRetainsOtherSettings(t *testing.T) {
	m := fixture(t)
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	node := executable("node")
	if node == "" {
		t.Skip("Node unavailable")
	}
	bin := filepath.Join(t.TempDir(), "GUI bin with spaces")
	if e := os.MkdirAll(bin, 0700); e != nil {
		t.Fatal(e)
	}
	expected := filepath.Join(bin, "codex")
	if runtime.GOOS == "windows" {
		expected = filepath.Join(bin, "node_modules", "@openai", "codex", "bin", "codex.js")
		if e := os.MkdirAll(filepath.Dir(expected), 0700); e != nil {
			t.Fatal(e)
		}
		if e := os.WriteFile(filepath.Join(bin, "codex.cmd"), []byte("this shim must never execute"), 0600); e != nil {
			t.Fatal(e)
		}
	}
	if e := os.WriteFile(expected, []byte("#!"+node+"\nconsole.log('codex-cli 0.0.0-fixture')"), 0755); e != nil {
		t.Fatal(e)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+filepath.Dir(node))
	d, _ := m.config()
	d["codex"] = "codex"
	d["proxy"] = "fixture-proxy"
	d["preserve"] = "fixture-settings"
	d["preserveNumeric"] = int64(9007199254740993)
	b, _ := json.Marshal(d)
	if e := atomic(filepath.Join(m.root, "config.json"), b, 0600); e != nil {
		t.Fatal(e)
	}
	if e := m.prepareConfig(); e != nil {
		t.Fatal(e)
	}
	after, e := m.config()
	if e != nil {
		t.Fatal(e)
	}
	if after["codex"] != expected {
		t.Fatal("verified executable not persisted")
	}
	var originalFields, savedFields map[string]json.RawMessage
	_ = json.Unmarshal(b, &originalFields)
	savedBytes, _ := os.ReadFile(filepath.Join(m.root, "config.json"))
	_ = json.Unmarshal(savedBytes, &savedFields)
	delete(originalFields, "codex")
	delete(savedFields, "codex")
	before, _ := json.Marshal(originalFields)
	retained, _ := json.Marshal(savedFields)
	if string(before) != string(retained) {
		t.Fatal("unrelated settings changed")
	}
	t.Setenv("PATH", filepath.Dir(node))
	if found, _ := m.status()["codexFound"].(bool); !found {
		t.Fatal("diagnosed configured executable should remain found")
	}
	if e := os.WriteFile(expected, []byte("#!"+node+"\nconsole.log('wrong-cli')"), 0755); e != nil {
		t.Fatal(e)
	}
	beforeBytes, _ := os.ReadFile(filepath.Join(m.root, "config.json"))
	if e := m.prepareConfig(); e == nil {
		t.Fatal("invalid replacement must fail")
	}
	afterBytes, _ := os.ReadFile(filepath.Join(m.root, "config.json"))
	if string(beforeBytes) != string(afterBytes) {
		t.Fatal("failed reprobe changed settings")
	}
}

func TestPrepareConfigDoesNotOverwriteConcurrentUserEdit(t *testing.T) {
	m := fixture(t)
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	if executable("node") == "" {
		t.Skip("Node unavailable")
	}
	fake := filepath.Join(m.root, "editing-cli.cjs")
	code := `const fs=require('node:fs'),path=require('node:path'),file=path.join(__dirname,'config.json'),value=JSON.parse(fs.readFileSync(file,'utf8'));value.proxy='synthetic-user-edit';fs.writeFileSync(file,JSON.stringify(value));console.log('codex-cli 0.0.0-fixture');`
	if e := os.WriteFile(fake, []byte(code), 0600); e != nil {
		t.Fatal(e)
	}
	d, _ := m.config()
	d["codex"] = fake
	b, _ := json.Marshal(d)
	if e := atomic(filepath.Join(m.root, "config.json"), b, 0600); e != nil {
		t.Fatal(e)
	}
	if e := m.prepareConfig(); e == nil {
		t.Fatal("concurrent edit must require a new diagnosis")
	}
	after, _ := m.config()
	if after["proxy"] != "synthetic-user-edit" || after["codex"] != fake {
		t.Fatal("user edit was overwritten")
	}
}
