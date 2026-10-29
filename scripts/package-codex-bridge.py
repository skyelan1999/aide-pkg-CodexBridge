"""Deterministic allowlist package; never includes local configuration or credentials."""
import argparse, hashlib, json, shutil, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
FILES = ['manifest.json','index.js','connection.cjs','quota.cjs','viewer.html','manage.cjs','config.example.json','README.md','LICENSE',
         'uninstall.cmd','uninstall.sh','uninstall.command','get-key.cmd','get-key.sh','get-key.command','runtime/bridge.cjs','runtime/launch.cjs','install.cmd','start.cmd','install.sh','start.sh','install.command','start.command']
def build(output):
    version=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))['version']
    output.mkdir(parents=True,exist_ok=True)
    stage=output/'stage'; stage.mkdir(exist_ok=True)
    archive=output/f'codex-bridge-{version}.zip'
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name in sorted(FILES):
            data=(ROOT/name).read_bytes(); dest=stage/name; dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(data)
            mode=0o755 if name.endswith(('.sh','.command')) else 0o644; dest.chmod(mode)
            entry=zipfile.ZipInfo(name,(2026,10,28,0,0,0)); entry.create_system=3; entry.external_attr=(0o100000|mode)<<16; entry.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(entry,data)
    digest=hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n', encoding='utf-8')
    print(json.dumps({'archive':str(archive),'sha256':digest,'files':len(FILES),'stage':str(stage)}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,default=ROOT/'dist');a=p.parse_args();build(a.out.resolve())
