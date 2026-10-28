package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func fixture(t *testing.T) *manager {
	t.Helper()
	r, e := filepath.EvalSymlinks(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	return &manager{root: filepath.Join(r, "host with spaces"), control: strings.Repeat("a", 64), payload: payload, probe: func() bool { return false }}
}
func call(m *manager, method, route, body, key, origin string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "http://127.0.0.1:8788"+route, strings.NewReader(body))
	if key != "" {
		r.Header.Set("Authorization", "Bearer "+key)
	}
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	w := httptest.NewRecorder()
	m.handler().ServeHTTP(w, r)
	return w
}
func TestAPIAuthenticationAndFixedActions(t *testing.T) {
	m := fixture(t)
	for _, k := range []string{"", strings.Repeat("b", 64)} {
		if w := call(m, "GET", "/api/status", "", k, ""); w.Code != 401 {
			t.Fatal(w.Code)
		}
	}
	if w := call(m, "GET", "/api/status", "", m.control, "https://evil.example"); w.Code != 403 {
		t.Fatal(w.Code)
	}
	for _, body := range []string{`{"action":"shell","command":"id"}`, `{"action":"doctor","path":"/tmp"}`, `{"action":"doctor"} {}`} {
		if w := call(m, "POST", "/api/action", body, m.control, ""); w.Code != 400 {
			t.Fatal(body, w.Code)
		}
	}
	w := call(m, "GET", "/api/status", "", m.control, "")
	if w.Code != 200 || strings.Contains(w.Body.String(), m.control) {
		t.Fatal(w.Code, w.Body.String())
	}
	if w = call(m, "GET", "/api/provider", "", m.control, ""); w.Code != 403 {
		t.Fatal(w.Code)
	}
}
func TestInstallRepairUninstallPreserveSecrets(t *testing.T) {
	m := fixture(t)
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	key, _ := os.ReadFile(filepath.Join(m.root, "data", "bridge.key"))
	config, _ := os.ReadFile(filepath.Join(m.root, "config.json"))
	p := filepath.Join(m.root, "note.txt")
	_ = os.WriteFile(p, []byte("user data"), 0600)
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	if runtime.GOOS != "windows" {
		for n := range launchers {
			_ = os.Chmod(filepath.Join(m.root, n), 0644)
		}
		if e := m.repair(); e != nil {
			t.Fatal(e)
		}
		for n := range launchers {
			s, _ := os.Stat(filepath.Join(m.root, n))
			if s.Mode().Perm() != 0755 {
				t.Fatal(n)
			}
		}
	}
	if e := m.uninstall(); e != nil {
		t.Fatal(e)
	}
	for name, want := range map[string][]byte{"data/bridge.key": key, "config.json": config, "note.txt": []byte("user data")} {
		b, e := os.ReadFile(filepath.Join(m.root, name))
		if e != nil || !bytes.Equal(b, want) {
			t.Fatal(name, e)
		}
	}
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	b, _ := os.ReadFile(filepath.Join(m.root, "data/bridge.key"))
	if !bytes.Equal(b, key) {
		t.Fatal("key replaced")
	}
}
func TestPayloadRejectsTraversalDuplicatesAndIncomplete(t *testing.T) {
	for _, names := range [][]string{{"../config.json"}, {"manifest.json", "manifest.json"}, {"manifest.json"}} {
		var b bytes.Buffer
		z := zip.NewWriter(&b)
		for _, n := range names {
			f, _ := z.Create(n)
			_, _ = f.Write([]byte(`{"id":"codex-bridge"}`))
		}
		_ = z.Close()
		if _, e := unpack(b.Bytes()); e == nil {
			t.Fatal(names)
		}
	}
}
func TestSymlinksRefusedBeforeRepair(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlinks need Windows privilege")
	}
	m := fixture(t)
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	p := filepath.Join(m.root, "start.command")
	_ = os.Remove(p)
	outside := filepath.Join(filepath.Dir(m.root), "outside")
	_ = os.WriteFile(outside, []byte("keep"), 0600)
	_ = os.Symlink(outside, p)
	if e := m.repair(); e == nil {
		t.Fatal("symlink accepted")
	}
	if e := m.install(); e == nil {
		t.Fatal("symlink install accepted")
	}
	if e := m.uninstall(); e == nil {
		t.Fatal("symlink uninstall accepted")
	}
	b, _ := os.ReadFile(outside)
	if string(b) != "keep" {
		t.Fatal("outside changed")
	}
}
func TestRejectHostAndNoSecretsInStatus(t *testing.T) {
	m := fixture(t)
	r := httptest.NewRequest(http.MethodGet, "http://evil.example/api/status", nil)
	r.Header.Set("Authorization", "Bearer "+m.control)
	w := httptest.NewRecorder()
	m.handler().ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal(w.Code)
	}
	w = call(m, "GET", "/api/status", "", m.control, "")
	var d map[string]any
	if json.Unmarshal(w.Body.Bytes(), &d) != nil || d["version"] != version {
		t.Fatal(w.Body.String())
	}
}

func TestManagedRuntimeStartStopWithSyntheticCodex(t *testing.T) {
	m := fixture(t)
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	binary := executable("node")
	if binary == "" {
		t.Skip("Node unavailable")
	}
	fake := filepath.Join(m.root, "fake-codex.cjs")
	if e := os.WriteFile(fake, []byte(`if(process.argv.includes('--version')){console.log('codex-cli 0.0.0-fixture');process.exit(0)}const r=require('node:readline').createInterface({input:process.stdin});r.on('line',line=>{const q=JSON.parse(line);if(q.id)console.log(JSON.stringify({id:q.id,result:q.method==='model/list'?{data:[{id:'synthetic-manager-model'}]}:{}}))});`), 0600); e != nil {
		t.Fatal(e)
	}
	l, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	port := l.Addr().(*net.TCPAddr).Port
	l.Close()
	d, e := m.config()
	if e != nil {
		t.Fatal(e)
	}
	d["codex"] = fake
	d["port"] = port
	b, _ := json.Marshal(d)
	if e = atomic(filepath.Join(m.root, "config.json"), b, 0600); e != nil {
		t.Fatal(e)
	}
	m.mu.Lock()
	e = m.start()
	done := m.wait
	m.mu.Unlock()
	if e != nil {
		t.Fatal(e)
	}
	defer func() {
		m.mu.Lock()
		_ = m.stop()
		m.mu.Unlock()
		if done != nil {
			select {
			case <-done:
			case <-time.After(5 * time.Second):
				t.Error("runtime cleanup timed out")
			}
		}
	}()
	u := fmt.Sprintf("http://127.0.0.1:%d", port)
	client := &http.Client{Timeout: time.Second}
	ready := false
	for i := 0; i < 100; i++ {
		r, e := client.Get(u + "/health")
		if e == nil {
			r.Body.Close()
			if r.StatusCode == 200 {
				ready = true
				break
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	if !ready {
		t.Fatal("managed child health not ready")
	}
	key, _ := os.ReadFile(filepath.Join(m.root, "data", "bridge.key"))
	req, _ := http.NewRequest("GET", u+"/v1/models", nil)
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(string(key)))
	r, e := client.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	body, _ := io.ReadAll(r.Body)
	r.Body.Close()
	if r.StatusCode != 200 || !bytes.Contains(body, []byte("synthetic-manager-model")) {
		t.Fatal(r.StatusCode, string(body))
	}
	m.mu.Lock()
	e = m.stop()
	m.mu.Unlock()
	if e != nil {
		t.Fatal(e)
	}
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("managed child did not stop")
	}
	m.mu.Lock()
	running := m.child != nil
	last := m.last
	m.mu.Unlock()
	if running {
		t.Fatal("child still registered")
	}
	if last != "" {
		t.Fatal("expected stop reported as failure", last)
	}
}

// Explicit opt-in only: actual HTTP/UI fixture, synthetic storage and no model account.
func TestBrowserFixture(t *testing.T) {
	where := os.Getenv("CODEX_MANAGER_BROWSER_FIXTURE")
	if where == "" {
		t.Skip("opt-in browser fixture")
	}
	m := fixture(t)
	s := httptest.NewServer(m.handler())
	defer s.Close()
	defer func() {
		m.mu.Lock()
		if m.child != nil {
			_ = m.stop()
		}
		m.mu.Unlock()
	}()
	data, _ := json.Marshal(map[string]string{"url": s.URL + "/#" + m.control, "root": m.root})
	if e := os.WriteFile(where, data, 0600); e != nil {
		t.Fatal(e)
	}
	defer os.Remove(where)
	time.Sleep(240 * time.Second)
}
func TestQuitRequiresOwnerUIAndRejectsFurtherActions(t *testing.T) {
	m := fixture(t)
	m.shutdown = make(chan struct{})
	if w := call(m, "POST", "/api/quit", "", m.control, ""); w.Code != 403 {
		t.Fatal(w.Code)
	}
	r := httptest.NewRequest("POST", "http://127.0.0.1:8788/api/quit", nil)
	r.Header.Set("Authorization", "Bearer "+m.control)
	r.Header.Set("X-Manager-Owner-UI", "1")
	w := httptest.NewRecorder()
	m.handler().ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Code)
	}
	select {
	case <-m.shutdown:
	case <-time.After(time.Second):
		t.Fatal("quit not signaled")
	}
	if w = call(m, "POST", "/api/action", `{"action":"start"}`, m.control, ""); w.Code != 409 {
		t.Fatal(w.Code)
	}
}

func TestExternalCustomPortBlocksMutation(t *testing.T) {
	m := fixture(t)
	if e := m.install(); e != nil {
		t.Fatal(e)
	}
	listener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	defer listener.Close()
	d, e := m.config()
	if e != nil {
		t.Fatal(e)
	}
	d["port"] = listener.Addr().(*net.TCPAddr).Port
	b, _ := json.Marshal(d)
	if e = atomic(filepath.Join(m.root, "config.json"), b, 0600); e != nil {
		t.Fatal(e)
	}
	m.probe = nil
	if !m.externalRunning() {
		t.Fatal("custom-port listener missed")
	}
	if e = m.install(); e == nil {
		t.Fatal("updated occupied bridge")
	}
	if e = m.uninstall(); e == nil {
		t.Fatal("removed occupied bridge")
	}
	if e = m.stop(); e == nil {
		t.Fatal("attempted external stop")
	}
}
