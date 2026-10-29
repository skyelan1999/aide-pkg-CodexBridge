#!/usr/bin/env python3
"""Verify actual native distribution layout and matching offline plugin payload."""
import argparse,io,json,pathlib,tarfile,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def verify(platform,arch):
 version=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))['version']
 base=ROOT/'dist/managers';name=f'codex-bridge-manager-{version}-{platform}-{arch}'
 if platform=='linux':
  with tarfile.open(base/(name+'.tar.gz')) as archive:files={m.name:archive.extractfile(m).read() for m in archive.getmembers() if m.isfile()}
 else:
  with zipfile.ZipFile(base/(name+'.zip')) as archive:
   assert archive.testzip() is None
   files={n:archive.read(n) for n in archive.namelist()}
 plugin=f'codex-bridge-{version}.zip';expected=(ROOT/'dist'/plugin).read_bytes()
 assert files[plugin]==expected,'Bundled plugin differs from marketplace payload'
 exe='Codex Bridge Manager.app/Contents/MacOS/CodexBridgeManager' if platform=='darwin' else 'CodexBridgeManager'+('.exe' if platform=='windows' else '')
 assert expected in files[exe],'Native executable embeds a stale payload'
 assert f'Open {"Codex Bridge Manager.app" if platform=="darwin" else exe}' in files['START-HERE.txt'].decode()
 with zipfile.ZipFile(io.BytesIO(expected)) as z:assert json.loads(z.read('manifest.json'))['version']==version
 print(f'PASS {platform}/{arch}: first-open guide, native embedded payload and included plugin ZIP match {version}')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--os',required=True,choices=['windows','darwin','linux']);p.add_argument('--arch',required=True,choices=['amd64','arm64']);a=p.parse_args();verify(a.os,a.arch)
