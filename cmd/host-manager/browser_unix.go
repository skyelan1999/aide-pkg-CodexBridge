//go:build !windows

package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"time"
)

func openBrowser(u string) error {
	command := "xdg-open"
	if runtime.GOOS == "darwin" {
		command = "/usr/bin/open"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	// Do not forward command output: it may contain the private owner URL.
	if err := exec.CommandContext(ctx, command, u).Run(); err != nil {
		return fmt.Errorf("cannot open the manager page; check the default browser and reopen the manager")
	}
	return nil
}
func showManagerPage(u string) {
	if err := openBrowser(u); err != nil {
		reportStartupError(err)
	}
}
func reportStartupError(err error) { fmt.Fprintln(os.Stderr, "Codex Bridge:", err) }
