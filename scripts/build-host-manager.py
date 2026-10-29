#!/usr/bin/env python3
"""Build explicit native manager assets from current source and the allowlisted plugin ZIP."""
import argparse,os,pathlib,subprocess,zipfile,tarfile,io,json,hashlib,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
def build(target,arch,out):
 version=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))['version']
 payload=ROOT/'dist'/f'codex-bridge-{version}.zip'
 if not payload.is_file():raise RuntimeError('Build plugin package first')
 embedded=ROOT/'cmd/host-manager/payload.zip'
 if not embedded.exists() or embedded.read_bytes()!=payload.read_bytes():
  temp=embedded.with_suffix('.tmp');temp.write_bytes(payload.read_bytes());temp.replace(embedded)
 out.mkdir(parents=True,exist_ok=True)
 exe='CodexBridgeManager'+('.exe' if target=='windows' else '')
 binary=out/(target+'-'+arch+'-'+exe)
 env={**os.environ,'GOOS':target,'GOARCH':arch,'CGO_ENABLED':'0'}
 flags='-s -w'+(' -H=windowsgui' if target=='windows' else '')
 subprocess.run(['go','build','-buildvcs=false','-trimpath','-ldflags',flags,'-o',str(binary),'.'],cwd=ROOT/'cmd/host-manager',env=env,check=True)
 name=f'codex-bridge-manager-{version}-{target}-{arch}'
 files={}
 if target=='darwin':
  files={'Codex Bridge Manager.app/Contents/MacOS/CodexBridgeManager':(binary.read_bytes(),0o755),'Codex Bridge Manager.app/Contents/Info.plist':(('<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>CodexBridgeManager</string><key>CFBundleIdentifier</key><string>io.aide.codex-bridge.manager</string><key>CFBundleName</key><string>Codex Bridge Manager</string><key>CFBundleVersion</key><string>'+version+'</string><key>CFBundlePackageType</key><string>APPL</string><key>LSBackgroundOnly</key><true/></dict></plist>').encode(),0o644)}
 else:files={exe:(binary.read_bytes(),0o755)}
 files[f'codex-bridge-{version}.zip']=(payload.read_bytes(),0o644)
 files['LICENSE']=((ROOT/'LICENSE').read_bytes(),0o644)
 first='Codex Bridge Manager.app' if target=='darwin' else exe
 files['START-HERE.txt']=((f'Codex Bridge {version}\n\n请先完整解压此安装包，再双击 {first}。主界面只有安装、启动、停止、卸载、生成密钥五个操作。本包已包含桥接程序和同版插件 ZIP，不需要拉取仓库源码。已有密钥会直接复用，卸载保留配置和密钥。\n\n1. Extract this entire archive.\n2. Open {first}.\n3. Use the five main buttons: Install, Start, Stop, Uninstall, Generate key.\n\nProgram files are embedded in the manager; installation does not fetch repository source. The matching plugin ZIP is also included: import it into Aide only if you need the plugin workbench. Local host operations do not require pairing. Optional Aide plugin remote controls are under More settings.\n\nRequires an installed Node.js 18+ and signed-in Codex CLI. These third-party prerequisites and credentials are not bundled or installed automatically. No PowerShell or manual shell commands are used by the manager. Existing configuration and keys are retained; Generate key reuses an existing key. Uninstall removes the owned bridge program files only. No firewall changes, automatic login or startup task.\nUnsigned software may need normal OS approval; do not disable OS protections.\n').encode(),0o644)
 archive=out/(name+('.zip' if target in ('darwin','windows') else '.tar.gz'))
 if archive.suffix=='.zip':
  with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
   for path,(raw,mode) in sorted(files.items()):
    i=zipfile.ZipInfo(path,(2026,10,29,0,0,0));i.create_system=3;i.external_attr=(0o100000|mode)<<16;i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,raw)
 else:
  with tarfile.open(archive,'w:gz') as t:
   for path,(raw,mode) in sorted(files.items()):
    i=tarfile.TarInfo(path);i.size=len(raw);i.mode=mode;i.mtime=0;t.addfile(i,io.BytesIO(raw))
 sha=hashlib.sha256(archive.read_bytes()).hexdigest();archive.with_name(archive.name+'.sha256').write_text(sha+'  '+archive.name+'\n',encoding='utf-8');print(json.dumps({'archive':str(archive),'sha256':sha,'bytes':archive.stat().st_size}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--os',choices=['darwin','windows','linux'],required=True);p.add_argument('--arch',choices=['amd64','arm64'],required=True);p.add_argument('--out',type=pathlib.Path,default=ROOT/'dist/managers');a=p.parse_args();build(a.os,a.arch,a.out.resolve())
