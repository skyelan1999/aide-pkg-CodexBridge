//go:build !windows

package main

import (
	"os"
	"os/exec"
	"syscall"
)

func configureProcess(c *exec.Cmd) { c.SysProcAttr = &syscall.SysProcAttr{Setpgid: true} }
func terminateProcess(c *exec.Cmd) {
	if c.Process != nil {
		_ = syscall.Kill(-c.Process.Pid, syscall.SIGTERM)
	}
}
func replaceFile(a, b string) error { return os.Rename(a, b) }

func terminationSignals() []os.Signal { return []os.Signal{os.Interrupt, syscall.SIGTERM} }
