package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func ownerCall(m *manager, route string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("POST", "http://127.0.0.1:8788"+route, strings.NewReader(`{}`))
	r.Header.Set("Authorization", "Bearer "+m.control)
	r.Header.Set("X-Manager-Owner-UI", "1")
	w := httptest.NewRecorder()
	m.handler().ServeHTTP(w, r)
	return w
}
func getCode(t *testing.T, m *manager) string {
	t.Helper()
	w := ownerCall(m, "/api/pair-code")
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var d map[string]any
	if json.Unmarshal(w.Body.Bytes(), &d) != nil {
		t.Fatal("decode")
	}
	return d["code"].(string)
}
func TestPairingExpiryReplayRevocationAndPersistence(t *testing.T) {
	m := fixture(t)
	if e := m.loadClients(); e != nil {
		t.Fatal(e)
	}
	code := getCode(t, m)
	m.pairUntil = time.Now().Add(-time.Second)
	if w := call(m, "POST", "/api/pair", `{"code":"`+code+`"}`, "", ""); w.Code != 401 {
		t.Fatal(w.Code)
	}
	code = getCode(t, m)
	for i := 0; i < 8; i++ {
		if w := call(m, "POST", "/api/pair", `{"code":"0000-0000-0000"}`, "", ""); w.Code != 401 {
			t.Fatal(w.Code)
		}
	}
	if w := call(m, "POST", "/api/pair", `{"code":"`+code+`"}`, "", ""); w.Code != 401 {
		t.Fatal("attempt budget", w.Code)
	}
	code = getCode(t, m)
	w := call(m, "POST", "/api/pair", `{"code":"`+code+`"}`, "", "")
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var d map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &d)
	grant := d["token"]
	if len(grant) != 64 || grant == m.control {
		t.Fatal("grant")
	}
	if call(m, "POST", "/api/pair", `{"code":"`+code+`"}`, "", "").Code != 401 {
		t.Fatal("code reused")
	}
	if call(m, "GET", "/api/status", "", grant, "").Code != 200 {
		t.Fatal("grant rejected")
	}
	for _, route := range []string{"/api/provider", "/api/quit", "/api/pair-code", "/api/revoke-clients"} {
		r := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8788"+route, strings.NewReader(`{}`))
		if route == "/api/provider" {
			r.Method = "GET"
		}
		r.Header.Set("Authorization", "Bearer "+grant)
		r.Header.Set("X-Manager-Owner-UI", "1")
		v := httptest.NewRecorder()
		m.handler().ServeHTTP(v, r)
		if v.Code != 403 {
			t.Fatal("client gained owner route", route, v.Code)
		}
	}
	raw, e := os.ReadFile(filepath.Join(m.root+"-manager", "clients.json"))
	if e != nil || strings.Contains(string(raw), grant) || strings.Contains(string(raw), m.control) {
		t.Fatal("secret in client hash store", e)
	}
	reloaded := fixture(t)
	reloaded.root = m.root
	if e := reloaded.loadClients(); e != nil || !reloaded.clientAllowed(grant) {
		t.Fatal("restart lost pairing", e)
	}
	if w := ownerCall(m, "/api/revoke-clients"); w.Code != 200 {
		t.Fatal(w.Code)
	}
	if m.clientAllowed(grant) {
		t.Fatal("revocation failed")
	}
	if e := reloaded.loadClients(); e != nil || reloaded.clientAllowed(grant) {
		t.Fatal("revocation not persisted", e)
	}
}
func TestPairingBoundedBodyAndOwnerOnly(t *testing.T) {
	m := fixture(t)
	for _, body := range []string{`{"code":"bad","path":"/tmp"}`, `{"code":"bad"} {}`, strings.Repeat("x", 1200)} {
		if w := call(m, "POST", "/api/pair", body, "", ""); w.Code != 400 {
			t.Fatal(w.Code)
		}
	}
	if w := call(m, "POST", "/api/pair-code", `{}`, m.control, ""); w.Code != 403 {
		t.Fatal(w.Code)
	}
	if w := call(m, "GET", "/health", "", "", ""); w.Code != 200 || strings.Contains(w.Body.String(), m.control) {
		t.Fatal(w.Code)
	}
}

func TestQuotaRequiresAuthentication(t *testing.T) {
	m := fixture(t)
	if w := call(m, "GET", "/api/usage", "", "", ""); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if w := call(m, "GET", "/api/usage", "", m.control, ""); w.Code != 409 {
		t.Fatal("uninstalled host must stay unavailable", w.Code)
	}
}

func keyCall(m *manager) *httptest.ResponseRecorder {
	r := httptest.NewRequest("POST", "http://127.0.0.1:8788/api/key", strings.NewReader(`{}`))
	r.Header.Set("Authorization", "Bearer "+m.control)
	r.Header.Set("X-Manager-Owner-UI", "1")
	w := httptest.NewRecorder()
	m.handler().ServeHTTP(w, r)
	return w
}
func TestOwnerKeyGenerationReuseAndUninstall(t *testing.T) {
	m := fixture(t)
	if w := keyCall(m); w.Code != 409 {
		t.Fatal("key before installation", w.Code)
	}
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	file := filepath.Join(m.root, "data", "bridge.key")
	original, _ := os.ReadFile(file)
	for i := 0; i < 2; i++ {
		w := keyCall(m)
		var d struct {
			BridgeKey string `json:"bridgeKey"`
			Created   bool   `json:"created"`
		}
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &d) != nil || d.Created || d.BridgeKey != string(original) {
			t.Fatal("existing key must be reused")
		}
	}
	if w := call(m, "POST", "/api/key", "{}", m.control, ""); w.Code != 403 {
		t.Fatal("key exposed outside owner UI", w.Code)
	}
	grant := strings.Repeat("c", 64)
	m.clients = map[string]bool{keyHash(grant): true}
	if w := call(m, "POST", "/api/key", "{}", grant, ""); w.Code != 403 {
		t.Fatal("paired client gained model key", w.Code)
	}
	if e := m.uninstall(); e != nil {
		t.Fatal(e)
	}
	retained, _ := os.ReadFile(file)
	if string(retained) != string(original) {
		t.Fatal("uninstall deleted key")
	}
	if w := keyCall(m); w.Code != 409 {
		t.Fatal("uninstalled program returned key")
	}
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	if e := os.Remove(file); e != nil {
		t.Fatal(e)
	}
	w := keyCall(m)
	var d struct {
		BridgeKey string `json:"bridgeKey"`
		Created   bool   `json:"created"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &d) != nil || !d.Created || len(d.BridgeKey) != 64 {
		t.Fatal("missing key was not generated")
	}
	saved, _ := os.ReadFile(file)
	if string(saved) != d.BridgeKey {
		t.Fatal("generated key not persisted")
	}
}

func TestMissingKeyWhileRunningAndCustomStatus(t *testing.T) {
	m := fixture(t)
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	p := filepath.Join(m.root, "data", "bridge.key")
	os.Remove(p)
	m.child = &exec.Cmd{}
	if w := keyCall(m); w.Code != 409 {
		t.Fatal("running missing key must not change auth", w.Code)
	}
	if _, e := os.Stat(p); !os.IsNotExist(e) {
		t.Fatal("unexpected key write")
	}
	m.child = nil
	cfg, e := m.config()
	if e != nil {
		t.Fatal(e)
	}
	fake := filepath.Join(m.root, "configured-codex.cjs")
	os.WriteFile(fake, []byte("// fixture"), 0600)
	cfg["codex"] = fake
	cfg["port"] = 18787
	b, _ := json.Marshal(cfg)
	atomic(filepath.Join(m.root, "config.json"), b, 0600)
	d := m.status()
	if d["port"] != 18787 || d["codexFound"] != true {
		t.Fatal("configured host status wrong", d)
	}
}
