package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed payload.zip
var payload []byte

//go:embed ui.html
var ui string

var launchers = map[string]bool{"install.sh": true, "install.command": true, "start.sh": true, "start.command": true, "get-key.sh": true, "get-key.command": true, "uninstall.sh": true, "uninstall.command": true}
var owned = []string{"manifest.json", "index.js", "connection.cjs", "quota.cjs", "viewer.html", "manage.cjs", "config.example.json", "README.md", "LICENSE", "runtime/bridge.cjs", "runtime/launch.cjs", "install.cmd", "start.cmd", "uninstall.cmd", "get-key.cmd", "install.sh", "start.sh", "uninstall.sh", "get-key.sh", "install.command", "start.command", "uninstall.command", "get-key.command"}

func token() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func userRoot() string {
	home, _ := os.UserHomeDir()
	switch runtime.GOOS {
	case "windows":
		d := os.Getenv("LOCALAPPDATA")
		if d == "" {
			d = filepath.Join(home, "AppData", "Local")
		}
		return filepath.Join(d, "aide-codex-bridge")
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", "aide-codex-bridge")
	default:
		d := os.Getenv("XDG_DATA_HOME")
		if d == "" {
			d = filepath.Join(home, ".local", "share")
		}
		return filepath.Join(d, "aide-codex-bridge")
	}
}
func regular(p string) error {
	s, e := os.Lstat(p)
	if e != nil {
		return e
	}
	if !s.Mode().IsRegular() {
		return errors.New("non-regular file rejected")
	}
	return nil
}
func noLinks(p string) error {
	p = filepath.Clean(p)
	for {
		s, e := os.Lstat(p)
		if e == nil && s.Mode()&os.ModeSymlink != 0 {
			return errors.New("symbolic link path rejected")
		}
		if e != nil && !os.IsNotExist(e) {
			return e
		}
		q := filepath.Dir(p)
		if q == p {
			return nil
		}
		p = q
	}
}
func atomic(p string, b []byte, mode os.FileMode) error {
	if e := noLinks(p); e != nil {
		return e
	}
	f, e := os.CreateTemp(filepath.Dir(p), ".manager-")
	if e != nil {
		return e
	}
	name := f.Name()
	defer os.Remove(name)
	if e = f.Chmod(mode); e == nil {
		_, e = f.Write(b)
	}
	if e == nil {
		e = f.Sync()
	}
	ce := f.Close()
	if e == nil {
		e = ce
	}
	if e != nil {
		return e
	}
	return replaceFile(name, p)
}
func ensureKey(p string) (string, error) {
	if b, e := os.ReadFile(p); e == nil {
		if e = regular(p); e != nil {
			return "", e
		}
		s := strings.TrimSpace(string(b))
		if len(s) != 64 {
			return "", errors.New("invalid local key")
		}
		if _, e = hex.DecodeString(s); e != nil {
			return "", errors.New("invalid local key")
		}
		return s, nil
	} else if !os.IsNotExist(e) {
		return "", e
	}
	s := token()
	if e := atomic(p, []byte(s), 0600); e != nil {
		return "", e
	}
	return s, nil
}

type manager struct {
	mu            sync.Mutex
	op            sync.Mutex
	root, control string
	child         *exec.Cmd
	wait          chan struct{}
	last          string
	payload       []byte
	probe         func() bool
	shutdown      chan struct{}
	quitOnce      sync.Once
	closing       bool
	stopping      bool
	pairCode      string
	pairUntil     time.Time
	pairAttempts  int
	clients       map[string]bool
}

func (m *manager) marked() bool {
	b, e := os.ReadFile(filepath.Join(m.root, ".aide-codex-bridge"))
	return e == nil && (strings.HasPrefix(string(b), "aide-codex-bridge") || strings.HasPrefix(string(b), "settings-retained"))
}
func (m *manager) installed() bool {
	return m.marked() && regular(filepath.Join(m.root, "manage.cjs")) == nil && regular(filepath.Join(m.root, "manifest.json")) == nil
}
func unpack(raw []byte) (map[string][]byte, error) {
	z, e := zip.NewReader(bytes.NewReader(raw), int64(len(raw)))
	if e != nil {
		return nil, e
	}
	allow := map[string]bool{}
	for _, n := range owned {
		allow[n] = true
	}
	out := map[string][]byte{}
	total := 0
	for _, f := range z.File {
		if !allow[f.Name] || out[f.Name] != nil || f.Mode()&os.ModeSymlink != 0 {
			return nil, errors.New("invalid installer payload")
		}
		r, e := f.Open()
		if e != nil {
			return nil, e
		}
		b, e := io.ReadAll(io.LimitReader(r, 2<<20))
		r.Close()
		if e != nil {
			return nil, e
		}
		total += len(b)
		if len(b) >= 2<<20 || total > 24<<20 {
			return nil, errors.New("payload budget exceeded")
		}
		out[f.Name] = b
	}
	if len(out) != len(owned) {
		return nil, errors.New("incomplete installer payload")
	}
	var v struct {
		ID string `json:"id"`
	}
	if json.Unmarshal(out["manifest.json"], &v) != nil || v.ID != "codex-bridge" {
		return nil, errors.New("invalid installer manifest")
	}
	return out, nil
}
func (m *manager) externalRunning() bool {
	if m.child != nil {
		return true
	}
	if m.probe != nil {
		return m.probe()
	}
	port := 8787
	if d, e := m.config(); e == nil {
		if n, ok := d["port"].(float64); ok && n >= 1 && n <= 65535 && n == float64(int(n)) {
			port = int(n)
		}
	}
	// Any listener occupies the configured port, including a custom or IPv6 bridge.
	// Do not overwrite a running installation merely because /health is unavailable.
	for _, host := range []string{"127.0.0.1", "::1"} {
		c, e := net.DialTimeout("tcp", net.JoinHostPort(host, strconv.Itoa(port)), 250*time.Millisecond)
		if e == nil {
			c.Close()
			return true
		}
	}
	return false
}
func (m *manager) install() error {
	if m.externalRunning() {
		return errors.New("Stop the existing bridge before install/update; an externally started bridge is never killed automatically")
	}
	files, e := unpack(m.payload)
	if e != nil {
		return e
	}
	if e = noLinks(m.root); e != nil {
		return e
	}
	if entries, e := os.ReadDir(m.root); e == nil && len(entries) > 0 && !m.marked() {
		return errors.New("nonempty unrelated installation directory")
	}
	if e = os.MkdirAll(m.root, 0700); e != nil {
		return e
	}
	for n := range files {
		if e = noLinks(filepath.Join(m.root, n)); e != nil {
			return e
		}
	}
	for _, n := range []string{"config.json", ".aide-codex-bridge", "data", "data/bridge.key"} {
		if e = noLinks(filepath.Join(m.root, n)); e != nil {
			return e
		}
	}
	// Validate everything and stage complete bytes before changing the installation.
	stage, e := os.MkdirTemp(m.root, ".install-")
	if e != nil {
		return e
	}
	defer os.RemoveAll(stage)
	for n, b := range files {
		p := filepath.Join(stage, n)
		if e = os.MkdirAll(filepath.Dir(p), 0700); e != nil {
			return e
		}
		mode := os.FileMode(0644)
		if launchers[n] {
			mode = 0755
		}
		if e = os.WriteFile(p, b, mode); e != nil {
			return e
		}
	}
	old := map[string][]byte{}
	modes := map[string]os.FileMode{}
	done := []string{}
	for n := range files {
		p := filepath.Join(m.root, n)
		if s, e := os.Lstat(p); e == nil {
			if !s.Mode().IsRegular() {
				return errors.New("non-regular destination rejected")
			}
			old[n], e = os.ReadFile(p)
			if e != nil {
				return e
			}
			modes[n] = s.Mode().Perm()
		} else if !os.IsNotExist(e) {
			return e
		}
	}
	for _, n := range owned {
		p := filepath.Join(m.root, n)
		if e = os.MkdirAll(filepath.Dir(p), 0700); e == nil {
			mode := os.FileMode(0644)
			if launchers[n] {
				mode = 0755
			}
			e = atomic(p, files[n], mode)
		}
		if e != nil {
			for i := len(done) - 1; i >= 0; i-- {
				name := done[i]
				p := filepath.Join(m.root, name)
				if b, ok := old[name]; ok {
					_ = atomic(p, b, modes[name])
				} else {
					_ = os.Remove(p)
				}
			}
			return errors.New("installation failed; previous program files restored")
		}
		done = append(done, n)
	}
	if _, e = os.Stat(filepath.Join(m.root, "config.json")); os.IsNotExist(e) {
		if e = atomic(filepath.Join(m.root, "config.json"), files["config.example.json"], 0600); e != nil {
			return e
		}
	}
	if e = noLinks(filepath.Join(m.root, "data")); e != nil {
		return e
	}
	if e = os.MkdirAll(filepath.Join(m.root, "data"), 0700); e != nil {
		return e
	}
	if _, e = ensureKey(filepath.Join(m.root, "data", "bridge.key")); e != nil {
		return e
	}
	return atomic(filepath.Join(m.root, ".aide-codex-bridge"), []byte("aide-codex-bridge\n"), 0600)
}
func executable(name string) string {
	if p, e := exec.LookPath(name); e == nil {
		return p
	}
	home, _ := os.UserHomeDir()
	var files []string
	switch name {
	case "node":
		if runtime.GOOS == "windows" {
			files = []string{filepath.Join(os.Getenv("ProgramFiles"), "nodejs", "node.exe"), filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "nodejs", "node.exe")}
		} else {
			files = []string{"/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node", filepath.Join(home, ".local", "bin", "node")}
			more, _ := filepath.Glob("/opt/node-v*/bin/node")
			if len(more) <= 32 {
				files = append(files, more...)
			}
		}
	case "codex":
		if runtime.GOOS == "darwin" {
			for _, root := range []string{"/Applications", filepath.Join(home, "Applications")} {
				files = append(files, filepath.Join(root, "ChatGPT.app", "Contents", "Resources", "codex-cli", "CodexCLI.app", "Contents", "MacOS", "codex"), filepath.Join(root, "Codex.app", "Contents", "Resources", "codex"))
			}
		}
	}
	for _, p := range files {
		if s, e := os.Stat(p); e == nil && s.Mode().IsRegular() && (runtime.GOOS == "windows" || s.Mode()&0111 != 0) {
			return p
		}
	}
	return ""
}
func (m *manager) config() (map[string]any, error) {
	p := filepath.Join(m.root, "config.json")
	if e := regular(p); e != nil {
		return nil, e
	}
	b, e := os.ReadFile(p)
	if e != nil {
		return nil, e
	}
	var d map[string]any
	e = json.Unmarshal(b, &d)
	return d, e
}
func (m *manager) prepareConfig() error {
	d, e := m.config()
	if e != nil {
		return e
	}
	if s, _ := d["codex"].(string); s == "codex" || s == "" {
		if binary := executable("codex"); binary != "" {
			d["codex"] = binary
			b, _ := json.MarshalIndent(d, "", "  ")
			return atomic(filepath.Join(m.root, "config.json"), b, 0600)
		}
	}
	return nil
}
func (m *manager) doctor() error {
	node := executable("node")
	if node == "" {
		return errors.New("Node.js 18+ is not installed or discoverable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()
	v, e := exec.CommandContext(ctx, node, "--version").Output()
	if e != nil {
		return errors.New("Cannot execute Node.js")
	}
	major, _ := strconv.Atoi(strings.Split(strings.TrimPrefix(strings.TrimSpace(string(v)), "v"), ".")[0])
	if major < 18 {
		return errors.New("Node.js 18+ is required")
	}
	if !m.installed() {
		return errors.New("Install the host component before checking Codex")
	}
	if e = m.prepareConfig(); e != nil {
		return e
	}
	cmd := exec.CommandContext(ctx, node, filepath.Join(m.root, "manage.cjs"), "doctor")
	configureProcess(cmd)
	if e = cmd.Run(); e != nil {
		return errors.New("Codex executable check failed; install/sign in to Codex and inspect the native setup guide")
	}
	return nil
}
func (m *manager) start() error {
	if m.child != nil {
		return nil
	}
	if !m.installed() {
		return errors.New("Install host component first")
	}
	if m.externalRunning() {
		return errors.New("Bridge is running outside this manager; close the old bridge terminal once before starting here")
	}
	if e := m.doctor(); e != nil {
		return e
	}
	node := executable("node")
	if node == "" {
		return errors.New("Node.js 18+ is required on the host; install it before starting")
	}
	d, e := m.config()
	if e != nil {
		return e
	}
	if s, _ := d["codex"].(string); s == "codex" || s == "" {
		if binary := executable("codex"); binary != "" {
			d["codex"] = binary
			b, _ := json.MarshalIndent(d, "", "  ")
			if e = atomic(filepath.Join(m.root, "config.json"), b, 0600); e != nil {
				return e
			}
		}
	}
	cmd := exec.Command(node, filepath.Join(m.root, "manage.cjs"), "start")
	cmd.Dir = m.root
	configureProcess(cmd)
	log, e := os.OpenFile(filepath.Join(m.root, "data", "manager-runtime.log"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if e != nil {
		return e
	}
	cmd.Stdout = log
	cmd.Stderr = log
	if e = cmd.Start(); e != nil {
		log.Close()
		return e
	}
	m.child = cmd
	m.stopping = false
	m.last = ""
	done := make(chan struct{})
	m.wait = done
	go func() {
		err := cmd.Wait()
		log.Close()
		m.mu.Lock()
		if m.child == cmd {
			m.child = nil
			if err != nil && !m.stopping {
				m.last = "Bridge stopped with an error; inspect the private local runtime log"
			}
		}
		m.mu.Unlock()
		close(done)
	}()
	return nil
}
func (m *manager) stop() error {
	if m.child == nil {
		if m.externalRunning() {
			return errors.New("External bridge is not owned by this manager; no process was stopped")
		}
		return nil
	}
	m.stopping = true
	terminateProcess(m.child)
	return nil
}
func (m *manager) repair() error {
	if !m.installed() {
		return errors.New("Install host first")
	}
	for n := range launchers {
		p := filepath.Join(m.root, n)
		if e := noLinks(p); e != nil {
			return e
		}
		if e := regular(p); e != nil {
			return e
		}
	}
	if runtime.GOOS != "windows" {
		for n := range launchers {
			if e := os.Chmod(filepath.Join(m.root, n), 0755); e != nil {
				return e
			}
		}
	}
	return nil
}
func (m *manager) uninstall() error {
	if m.externalRunning() {
		return errors.New("Stop the bridge before uninstall")
	}
	if !m.installed() {
		return errors.New("No marked installation")
	}
	for _, n := range owned {
		p := filepath.Join(m.root, n)
		if e := noLinks(p); e != nil {
			return e
		}
		if _, e := os.Lstat(p); e == nil {
			if e = regular(p); e != nil {
				return e
			}
		} else if !os.IsNotExist(e) {
			return e
		}
	}
	for _, n := range owned {
		if e := os.Remove(filepath.Join(m.root, n)); e != nil && !os.IsNotExist(e) {
			return e
		}
	}
	return atomic(filepath.Join(m.root, ".aide-codex-bridge"), []byte("settings-retained\n"), 0600)
}
func (m *manager) status() map[string]any {
	port := 8787
	codexFound := executable("codex") != ""
	if cfg, e := m.config(); e == nil {
		if p, ok := cfg["port"].(float64); ok && p >= 1 && p <= 65535 && p == float64(int(p)) {
			port = int(p)
		}
		if c, ok := cfg["codex"].(string); ok && c != "" && c != "codex" {
			codexFound = executable(c) != "" || regular(c) == nil
		}
	}
	return map[string]any{"port": port, "service": "aide-codex-bridge-manager", "version": version, "platform": runtime.GOOS, "arch": runtime.GOARCH, "installed": m.installed(), "running": m.child != nil, "externalBridge": m.child == nil && m.externalRunning(), "nodeFound": executable("node") != "", "codexFound": codexFound, "lastError": m.last}
}
func reply(w http.ResponseWriter, s int, d any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(s)
	_ = json.NewEncoder(w).Encode(d)
}
func (m *manager) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
		host, _, e := net.SplitHostPort(r.Host)
		if e != nil || !map[string]bool{"127.0.0.1": true, "localhost": true, "::1": true, "host.docker.internal": true}[host] {
			reply(w, 403, map[string]string{"error": "Invalid host"})
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" {
			u, e := url.Parse(origin)
			if e != nil || u.Scheme != "http" || u.Host != r.Host {
				reply(w, 403, map[string]string{"error": "Origin rejected"})
				return
			}
		}
		if r.URL.Path == "/" && r.Method == "GET" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = io.WriteString(w, strings.ReplaceAll(ui, "__BRIDGE_VERSION__", version))
			return
		}
		if r.URL.Path == "/health" && r.Method == "GET" {
			reply(w, 200, map[string]any{"service": "aide-codex-bridge-manager", "version": version, "pairingProtocol": 1})
			return
		}
		if r.URL.Path == "/api/pair" && r.Method == "POST" {
			m.pair(w, r)
			return
		}
		given := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		owner := len(given) == 64 && subtle.ConstantTimeCompare([]byte(given), []byte(m.control)) == 1
		if !owner && !m.clientAllowed(given) {
			reply(w, 401, map[string]string{"error": "Manager pairing key required"})
			return
		}
		if (r.URL.Path == "/api/pair-code" || r.URL.Path == "/api/revoke-clients") && r.Method == "POST" {
			if !owner || r.Header.Get("X-Manager-Owner-UI") != "1" {
				reply(w, 403, map[string]string{"error": "Use the native manager setup window"})
				return
			}
			m.pairingOwner(w, r, r.URL.Path)
			return
		}
		if r.URL.Path == "/api/usage" && r.Method == "GET" {
			m.usage(w, r)
			return
		}
		if r.URL.Path == "/api/models" && r.Method == "GET" {
			m.models(w, r)
			return
		}
		if r.URL.Path == "/api/quit" && r.Method == "POST" {
			if !owner || r.Header.Get("X-Manager-Owner-UI") != "1" {
				reply(w, 403, map[string]string{"error": "Use the manager setup window"})
				return
			}
			m.mu.Lock()
			if m.child != nil {
				_ = m.stop()
			}
			done := m.wait
			m.closing = true
			m.mu.Unlock()
			reply(w, 200, map[string]bool{"closing": true})
			if m.shutdown != nil {
				go func() {
					if done != nil {
						select {
						case <-done:
						case <-time.After(5 * time.Second):
						}
					}
					m.quitOnce.Do(func() { close(m.shutdown) })
				}()
			}
			return
		}
		if r.URL.Path == "/api/status" && r.Method == "GET" {
			m.mu.Lock()
			d := m.status()
			m.mu.Unlock()
			reply(w, 200, d)
			return
		}
		if r.URL.Path == "/api/key" && r.Method == "POST" {
			if !owner || r.Header.Get("X-Manager-Owner-UI") != "1" {
				reply(w, 403, map[string]string{"error": "Use the native manager window"})
				return
			}
			var in struct{}
			if !decodePair(r, w, &in) {
				return
			}
			m.op.Lock()
			defer m.op.Unlock()
			m.mu.Lock()
			defer m.mu.Unlock()
			if m.closing || !m.installed() {
				reply(w, 409, map[string]string{"error": "Install host first / 请先安装宿主程序"})
				return
			}
			p := filepath.Join(m.root, "data", "bridge.key")
			if e := noLinks(p); e != nil {
				reply(w, 409, map[string]string{"error": "Invalid key path"})
				return
			}
			_, statErr := os.Stat(p)
			created := os.IsNotExist(statErr)
			if created && (m.child != nil || m.externalRunning()) {
				reply(w, 409, map[string]string{"error": "Stop the bridge before generating a missing key / 请先停止桥接再生成缺失密钥"})
				return
			}
			value, e := ensureKey(p)
			if e != nil {
				reply(w, 409, map[string]string{"error": "Cannot read or generate local key"})
				return
			}
			reply(w, 200, map[string]any{"bridgeKey": value, "created": created})
			return
		}
		if r.URL.Path == "/api/provider" && r.Method == "GET" { // Owner setup UI only; plugin tool never proxies this route.
			if !owner || r.Header.Get("X-Manager-Owner-UI") != "1" {
				reply(w, 403, map[string]string{"error": "Use the manager setup window"})
				return
			}
			m.mu.Lock()
			p := filepath.Join(m.root, "data", "bridge.key")
			b, e := os.ReadFile(p)
			if e == nil {
				e = regular(p)
			}
			m.mu.Unlock()
			if e != nil {
				reply(w, 409, map[string]string{"error": "Install host first"})
				return
			}
			reply(w, 200, map[string]string{"bridgeKey": strings.TrimSpace(string(b))})
			return
		}
		if r.URL.Path != "/api/action" || r.Method != "POST" {
			reply(w, 404, map[string]string{"error": "Unknown operation"})
			return
		}
		var in struct {
			Action string `json:"action"`
		}
		r.Body = http.MaxBytesReader(w, r.Body, 1024)
		d := json.NewDecoder(r.Body)
		d.DisallowUnknownFields()
		if e := d.Decode(&in); e != nil {
			reply(w, 400, map[string]string{"error": "Invalid request"})
			return
		}
		if e := d.Decode(&struct{}{}); e != io.EOF {
			reply(w, 400, map[string]string{"error": "Trailing input"})
			return
		}
		m.op.Lock()
		defer m.op.Unlock()
		m.mu.Lock()
		closing := m.closing
		m.mu.Unlock()
		if closing {
			reply(w, 409, map[string]string{"error": "Manager is shutting down"})
			return
		}
		if in.Action == "restart" || in.Action == "stop" {
			m.mu.Lock()
			err := m.stop()
			done := m.wait
			m.mu.Unlock()
			if err != nil {
				reply(w, 409, map[string]string{"error": err.Error()})
				return
			}
			if done != nil {
				select {
				case <-done:
				case <-time.After(5 * time.Second):
					reply(w, 409, map[string]string{"error": "Bridge stop still pending"})
					return
				}
			}
			m.mu.Lock()
			if in.Action == "restart" {
				err = m.start()
			}
			d := m.status()
			m.mu.Unlock()
			if err != nil {
				reply(w, 409, map[string]string{"error": err.Error()})
				return
			}
			reply(w, 200, d)
			return
		}
		m.mu.Lock()
		var err error
		switch in.Action {
		case "install":
			err = m.install()
		case "start":
			err = m.start()
		case "stop":
			err = m.stop()
		case "repair":
			err = m.repair()
		case "uninstall":
			err = m.uninstall()
		case "doctor":
			err = m.doctor()
		default:
			m.mu.Unlock()
			reply(w, 400, map[string]string{"error": "Unsupported action"})
			return
		}
		result := m.status()
		m.mu.Unlock()
		if err != nil {
			reply(w, 409, map[string]string{"error": err.Error()})
			return
		}
		reply(w, 200, result)
	})
	return mux
}
func openBrowser(u string) {
	var c *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		c = exec.Command("/usr/bin/open", u)
	case "windows":
		c = exec.Command(filepath.Join(os.Getenv("SystemRoot"), "System32", "rundll32.exe"), "url.dll,FileProtocolHandler", u)
	default:
		c = exec.Command("xdg-open", u)
	}
	_ = c.Start()
}
func main() {
	if len(os.Args) > 1 && os.Args[1] == "--version" {
		fmt.Println("Codex Bridge Manager " + version)
		return
	}
	root := userRoot()
	state := root + "-manager"
	if e := noLinks(state); e != nil {
		panic(e)
	}
	if e := os.MkdirAll(state, 0700); e != nil {
		panic(e)
	}
	key, e := ensureKey(filepath.Join(state, "control.key"))
	if e != nil {
		panic(e)
	}
	m := &manager{root: root, control: key, payload: payload, shutdown: make(chan struct{})}
	if e := m.loadClients(); e != nil {
		panic(e)
	}
	ln, e := net.Listen("tcp", "127.0.0.1:8788")
	if e != nil {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		req, _ := http.NewRequestWithContext(ctx, "GET", "http://127.0.0.1:8788/api/status", nil)
		req.Header.Set("Authorization", "Bearer "+key)
		r, err := http.DefaultClient.Do(req)
		if err == nil {
			r.Body.Close()
			if r.StatusCode == 200 {
				openBrowser("http://127.0.0.1:8788/#" + key)
				return
			}
		}
		panic("Manager port unavailable")
	}
	openBrowser("http://127.0.0.1:8788/#" + key)
	server := &http.Server{Handler: m.handler(), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16 << 10}
	errs := make(chan error, 1)
	go func() { errs <- server.Serve(ln) }()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, terminationSignals()...)
	defer signal.Stop(signals)
	select {
	case <-m.shutdown:
	case <-signals:
	case <-errs:
	}
	m.mu.Lock()
	if m.child != nil {
		_ = m.stop()
	}
	done := m.wait
	m.mu.Unlock()
	if done != nil {
		select {
		case <-done:
		case <-time.After(5 * time.Second):
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}
