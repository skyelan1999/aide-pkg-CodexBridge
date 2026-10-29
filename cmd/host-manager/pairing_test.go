package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
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
