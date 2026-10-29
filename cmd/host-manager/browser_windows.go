package main

import (
	"fmt"
	"syscall"
	"unsafe"
)

// Use the Windows URL association directly. rundll32 process startup alone
// cannot report whether a URL handler accepted the request.
func openBrowser(u string) error {
	verb, _ := syscall.UTF16PtrFromString("open")
	target, err := syscall.UTF16PtrFromString(u)
	if err != nil {
		return fmt.Errorf("invalid manager address")
	}
	code, _, _ := syscall.NewLazyDLL("shell32.dll").NewProc("ShellExecuteW").Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(target)), 0, 0, 1)
	return browserLaunchResult(code)
}

func browserLaunchResult(code uintptr) error {
	if code > 32 {
		return nil
	}
	// Do not include the URL: its fragment contains the private owner credential.
	return fmt.Errorf("Windows could not open the default browser (code %d)", code)
}

func nativeMessage(message string, flags uintptr) uintptr {
	text, _ := syscall.UTF16PtrFromString(message)
	title, _ := syscall.UTF16PtrFromString("Codex Bridge")
	result, _, _ := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), flags|0x10000)
	return result
}

func showManagerPage(u string) {
	for {
		if err := openBrowser(u); err == nil {
			return
		}
		// MB_RETRYCANCEL | MB_ICONERROR. Keep the service available on Cancel.
		choice := nativeMessage("无法打开管理页面。请在 Windows 设置中确认默认浏览器可以打开网页，然后点击重试。取消后可再次双击管理器。\n\nCannot open the manager page. Check your default browser in Windows Settings, then choose Retry. You can also cancel and reopen the manager later.", 0x5|0x10)
		if choice != 4 {
			return
		}
	}
}

func reportStartupError(err error) {
	nativeMessage("管理器未能启动 / Manager could not start:\n"+err.Error(), 0x10)
}
