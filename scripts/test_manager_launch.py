#!/usr/bin/env python3
"""Linux process acceptance for opening/reopening; synthetic state, no published ports."""
import json, os, pathlib, signal, subprocess, sys, tempfile, time, urllib.request

binary = sys.argv[1]
def wait_for(fn):
    end = time.monotonic() + 10
    while time.monotonic() < end:
        try:
            result = fn()
            if result: return result
        except (OSError, ValueError): pass
        time.sleep(.05)
    raise AssertionError("Manager launch timed out")

with tempfile.TemporaryDirectory(prefix="codex-launch-") as temp:
    root = pathlib.Path(temp)
    bindir = root / "bin"; bindir.mkdir()
    proof = root / "opened"
    opener = bindir / "xdg-open"
    opener.write_text("#!" + sys.executable + "\n" + r'''import json, os, sys, urllib.parse, urllib.request
u = urllib.parse.urlsplit(sys.argv[1])
assert u.scheme == "http" and u.netloc == "127.0.0.1:8788" and len(u.fragment) == 64
base = "http://127.0.0.1:8788"
with urllib.request.urlopen(base + "/health", timeout=3) as r:
    assert json.load(r)["service"] == "aide-codex-bridge-manager"
req = urllib.request.Request(base + "/api/status", headers={"Authorization":"Bearer " + u.fragment})
with urllib.request.urlopen(req, timeout=3) as r: assert json.load(r)["installed"] is False
with open(os.environ["LAUNCH_PROOF"], "a") as f: f.write("ready-page-requested\n")
''')
    opener.chmod(0o755)
    env = {**os.environ, "XDG_DATA_HOME": temp, "PATH": str(bindir), "LAUNCH_PROOF": str(proof)}
    process = subprocess.Popen([binary], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        wait_for(lambda: proof.exists() and len(proof.read_text().splitlines()) == 1)
        again = subprocess.run([binary], env=env, capture_output=True, timeout=10)
        assert again.returncode == 0, "Existing manager failed to reopen"
        assert len(proof.read_text().splitlines()) == 2
        assert process.poll() is None
        # A failing opener must report a bounded error without disclosing its URL.
        opener.write_text("#!" + sys.executable + "\nimport sys\nprint(sys.argv[1], file=sys.stderr)\nsys.exit(5)\n")
        failed = subprocess.run([binary], env=env, capture_output=True, timeout=10)
        assert b"cannot open the manager page" in failed.stderr
        secret = (root / "aide-codex-bridge-manager/control.key").read_bytes().strip()
        assert secret not in failed.stderr and b"http://" not in failed.stderr
        assert process.poll() is None
        print(json.dumps({"freshLaunchReady":True,"existingManagerReopens":True,"failedBrowserReported":True,"secretNotLogged":True,"windowsDesktop":"NOT_RUN"}))
    finally:
        process.send_signal(signal.SIGTERM)
        try: process.communicate(timeout=10)
        except subprocess.TimeoutExpired: process.kill(); process.communicate()
