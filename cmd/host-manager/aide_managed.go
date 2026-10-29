package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"time"
)

// Aide starts this mode itself. It never opens a separate browser or installs
// the bridge automatically. The trusted Aide workbench owns the five actions.
func runAideManaged(args []string) error {
	if len(args) < 1 || len(args) > 2 || !filepath.IsAbs(args[0]) {
		return errors.New("Aide connection file must be absolute")
	}
	connection := filepath.Clean(args[0])
	bind := "127.0.0.1"
	if len(args) == 2 {
		bind = args[1]
	}
	ip := net.ParseIP(bind)
	if ip == nil || !(ip.IsLoopback() || ip.IsPrivate()) || ip.IsUnspecified() {
		return errors.New("Aide host binding must be a local or private interface")
	}
	if err := noLinks(connection); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(connection), 0700); err != nil {
		return err
	}
	key, err := ensureKey(filepath.Join(filepath.Dir(connection), "codex-bridge-control.key"))
	if err != nil {
		return err
	}
	address := net.JoinHostPort(bind, "17888")
	listener, err := net.Listen("tcp", address)
	if err != nil {
		// An existing managed instance can be reused only with this installation's
		// private key and the expected service identity. Do not rotate its key.
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		req, _ := http.NewRequestWithContext(ctx, "GET", "http://"+address+"/api/status", nil)
		req.Host = "host.docker.internal:17888"
		req.Header.Set("Authorization", "Bearer "+key)
		client := &http.Client{Transport: &http.Transport{Proxy: nil}, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
		resp, e := client.Do(req)
		if e == nil {
			defer resp.Body.Close()
			var status struct {
				Service string `json:"service"`
				Version string `json:"version"`
			}
			if resp.StatusCode == 200 && json.NewDecoder(io.LimitReader(resp.Body, 65536)).Decode(&status) == nil && status.Service == "aide-codex-bridge-manager" && status.Version == version {
				metadata, _ := json.Marshal(map[string]any{"protocol": 1, "service": "codex-bridge", "version": version, "token": key, "port": 17888})
				return atomic(connection, metadata, 0600)
			}
		}
		return errors.New("Aide host port 17888 is occupied by another service")
	}
	defer listener.Close()
	m := &manager{root: userRoot(), control: key, payload: payload, shutdown: make(chan struct{}), clients: map[string]bool{}}
	// This file is private launcher/backend state. It is never a plugin-tool
	// result, public health response, command argument or browser URL.
	metadata, _ := json.Marshal(map[string]any{"protocol": 1, "service": "codex-bridge", "version": version, "token": key, "port": 17888})
	if err := atomic(connection, metadata, 0600); err != nil {
		return err
	}
	server := &http.Server{Handler: m.handler(), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16 << 10}
	errorsCh := make(chan error, 1)
	go func() { errorsCh <- server.Serve(listener) }()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, terminationSignals()...)
	defer signal.Stop(signals)
	var serveErr error
	select {
	case <-m.shutdown:
	case <-signals:
	case serveErr = <-errorsCh:
	}
	m.mu.Lock()
	if m.child != nil {
		_ = m.stop()
	}
	m.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	// Remove only our own metadata. Retain the key and user configuration.
	if raw, e := os.ReadFile(connection); e == nil && strings.Contains(string(raw), key) {
		_ = os.Remove(connection)
	}
	if serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
		return errors.New("Aide host component stopped")
	}
	return nil
}
