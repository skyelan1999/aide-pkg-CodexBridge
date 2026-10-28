package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"unsafe"
)

func configureProcess(c *exec.Cmd) { c.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000} }
func terminateProcess(c *exec.Cmd) {
	if c.Process != nil {
		p := exec.Command(filepath.Join(os.Getenv("SystemRoot"), "System32", "taskkill.exe"), "/PID", strconv.Itoa(c.Process.Pid), "/T", "/F")
		configureProcess(p)
		_ = p.Run()
	}
}
func replaceFile(a, b string) error {
	x, e := syscall.UTF16PtrFromString(a)
	if e != nil {
		return e
	}
	y, e := syscall.UTF16PtrFromString(b)
	if e != nil {
		return e
	}
	p := syscall.NewLazyDLL("kernel32.dll").NewProc("MoveFileExW")
	r, _, err := p.Call(uintptr(unsafe.Pointer(x)), uintptr(unsafe.Pointer(y)), 1)
	if r == 0 {
		return err
	}
	return nil
}

func terminationSignals() []os.Signal { return []os.Signal{os.Interrupt} }
