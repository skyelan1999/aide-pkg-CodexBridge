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
 files['LICENSE']=((ROOT/'LICENSE').read_bytes(),0o644)
 files['START-HERE.txt']=(('Codex Bridge Manager '+version+'\nDouble-click the application/executable to open local setup. Node.js 18+ and a signed-in Codex CLI are prerequisites.\nmacOS: copy the .app to Applications. Windows: run the .exe in your user session. Linux: run the executable from your graphical desktop.\nGenerate a one-time connection code in the native manager and enter it in the Aide plugin workbench. It expires in two minutes and works once. No manager or diagnostic keys belong in ordinary plugin settings. Then use plugin lifecycle buttons.\nNo PowerShell or shell command entry is required. No automatic login, firewall change, startup task or provider overwrite.\nUnsigned software may require normal OS approval. Do not disable OS protections. Existing terminal-launched bridges must be closed once before management takeover.\nUninstall removes bridge program files but retains config and keys; the separate manager remains available for reinstall.\n').encode(),0o644)
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
