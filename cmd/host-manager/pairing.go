package main

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

func keyHash(key string) string { h := sha256.Sum256([]byte(key)); return hex.EncodeToString(h[:]) }
func (m *manager) loadClients() error {
	p := filepath.Join(m.root+"-manager", "clients.json")
	if err := noLinks(p); err != nil {
		return err
	}
	if _, e := os.Stat(p); os.IsNotExist(e) {
		m.clients = map[string]bool{}
		return nil
	}
	if err := regular(p); err != nil {
		return err
	}
	b, e := os.ReadFile(p)
	if e != nil {
		return e
	}
	if len(b) > 8192 {
		return errors.New("Invalid paired client store")
	}
	var clients map[string]bool
	if json.Unmarshal(b, &clients) != nil || len(clients) > 8 {
		return errors.New("Invalid paired client store")
	}
	for hash, enabled := range clients {
		if len(hash) != 64 || !enabled {
			return errors.New("Invalid paired client store")
		}
	}
	m.clients = clients
	return nil
}
func (m *manager) saveClients() error {
	dir := m.root + "-manager"
	if e := noLinks(dir); e != nil {
		return e
	}
	if e := os.MkdirAll(dir, 0700); e != nil {
		return e
	}
	b, e := json.Marshal(m.clients)
	if e != nil {
		return e
	}
	return atomic(filepath.Join(dir, "clients.json"), b, 0600)
}
func (m *manager) clientAllowed(key string) bool {
	if len(key) != 64 {
		return false
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.clients[keyHash(key)]
}
func decodePair(r *http.Request, w http.ResponseWriter, out any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(out) != nil || d.Decode(&struct{}{}) != io.EOF {
		reply(w, 400, map[string]string{"error": "Invalid pairing request"})
		return false
	}
	return true
}
func (m *manager) pair(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Code string `json:"code"`
	}
	if !decodePair(r, w, &in) {
		return
	}
	code := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(in.Code), "-", ""))
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.pairCode == "" || time.Now().After(m.pairUntil) || m.pairAttempts >= 8 {
		reply(w, 401, map[string]string{"error": "Generate a new connection code in the native manager / 请在宿主管理器生成新的连接码"})
		return
	}
	m.pairAttempts++
	if len(code) != 12 || subtle.ConstantTimeCompare([]byte(code), []byte(m.pairCode)) != 1 {
		reply(w, 401, map[string]string{"error": "Invalid or expired connection code / 连接码错误或已过期"})
		return
	}
	if len(m.clients) >= 8 {
		reply(w, 409, map[string]string{"error": "Revoke old paired clients in the native manager first"})
		return
	}
	grant := token()
	if m.clients == nil {
		m.clients = map[string]bool{}
	}
	hash := keyHash(grant)
	m.clients[hash] = true
	if e := m.saveClients(); e != nil {
		delete(m.clients, hash)
		reply(w, 500, map[string]string{"error": "Cannot save paired client"})
		return
	}
	m.pairCode = ""
	m.pairUntil = time.Time{}
	reply(w, 200, map[string]any{"service": "aide-codex-bridge-manager", "version": version, "token": grant})
}
func (m *manager) pairingOwner(w http.ResponseWriter, r *http.Request, route string) {
	var in struct{}
	if !decodePair(r, w, &in) {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if route == "/api/pair-code" {
		m.pairCode = strings.ToUpper(token()[:12])
		m.pairUntil = time.Now().Add(120 * time.Second)
		m.pairAttempts = 0
		c := m.pairCode
		reply(w, 200, map[string]any{"code": c[:4] + "-" + c[4:8] + "-" + c[8:], "expiresIn": 120})
		return
	}
	previous := m.clients
	m.clients = map[string]bool{}
	if e := m.saveClients(); e != nil {
		m.clients = previous
		reply(w, 500, map[string]string{"error": "Cannot revoke clients"})
		return
	}
	m.pairCode = ""
	reply(w, 200, map[string]bool{"revoked": true})
}
func (m *manager) bridgeRead(w http.ResponseWriter, r *http.Request, route string) []byte {
	m.mu.Lock()
	cfg, e := m.config()
	p := filepath.Join(m.root, "data", "bridge.key")
	var key []byte
	if e == nil {
		e = regular(p)
	}
	if e == nil {
		key, e = os.ReadFile(p)
	}
	m.mu.Unlock()
	if e != nil {
		reply(w, 409, map[string]string{"error": "Install and start the host bridge first / 请先安装并启动宿主桥接"})
		return nil
	}
	port, ok := cfg["port"].(float64)
	if !ok || port < 1 || port > 65535 || port != float64(int(port)) {
		reply(w, 409, map[string]string{"error": "Invalid bridge port"})
		return nil
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", "http://127.0.0.1:"+strconv.Itoa(int(port))+route, nil)
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(string(key)))
	client := http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("Redirect refused") }}
	res, err := client.Do(req)
	if err != nil {
		reply(w, 502, map[string]string{"error": "Host data unavailable; check that the bridge is running"})
		return nil
	}
	defer res.Body.Close()
	b, err := io.ReadAll(io.LimitReader(res.Body, 65537))
	if err != nil || len(b) > 65536 || res.StatusCode != 200 {
		reply(w, 502, map[string]string{"error": "Host bridge could not return account/model data"})
		return nil
	}
	return b
}
func (m *manager) models(w http.ResponseWriter, r *http.Request) {
	b := m.bridgeRead(w, r, "/v1/models")
	if b == nil {
		return
	}
	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if json.Unmarshal(b, &result) != nil || result.Data == nil {
		reply(w, 502, map[string]string{"error": "Invalid model catalog"})
		return
	}
	ids := []map[string]string{}
	for i, item := range result.Data {
		if i >= 200 {
			break
		}
		id := item.ID
		if len(id) > 200 {
			continue
		}
		ids = append(ids, map[string]string{"id": id})
	}
	reply(w, 200, map[string]any{"service": "aide-codex-bridge-manager", "version": version, "models": ids})
}

// usage decodes into a fixed public schema rather than forwarding arbitrary account data.
func (m *manager) usage(w http.ResponseWriter, r *http.Request) {
	b := m.bridgeRead(w, r, "/v1/usage")
	if b == nil {
		return
	}
	type window struct {
		UsedPercent        *float64 `json:"usedPercent"`
		WindowDurationMins *float64 `json:"windowDurationMins"`
		ResetsAt           *int64   `json:"resetsAt"`
	}
	var result struct {
		Buckets []struct {
			ID        string  `json:"id"`
			Label     string  `json:"label"`
			Primary   *window `json:"primary"`
			Secondary *window `json:"secondary"`
		} `json:"buckets"`
		CheckedAt string `json:"checkedAt"`
		Reason    string `json:"reason"`
	}
	if json.Unmarshal(b, &result) != nil || len(result.Buckets) > 32 {
		reply(w, 502, map[string]string{"error": "Invalid quota response"})
		return
	}
	reply(w, 200, map[string]any{"service": "aide-codex-bridge-manager", "version": version, "usage": result})
}
