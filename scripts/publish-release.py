#!/usr/bin/env python3
"""Publish only a checked draft from an explicit source/CI identity. Never overwrite assets."""
import argparse,hashlib,json,pathlib,re,subprocess,tempfile

def validate_release(release,version,source):
 if not re.fullmatch(r'\d+\.\d+\.\d+',version) or not re.fullmatch(r'[0-9a-f]{40}',source):raise ValueError('Invalid release identity')
 if release.get('tag_name')!='v'+version or not release.get('draft') or release.get('target_commitish')!=source:raise ValueError('Expected an unpublished draft at the exact source commit')
 return release

def validate_ci(run,tested):
 if run.get('conclusion')!='success' or run.get('head_sha')!=tested or run.get('name')!='Cross-platform bridge checks':raise ValueError('Exact cross-platform CI run is not successful')
 return run

def file_digest(file):return hashlib.sha256(file.read_bytes()).hexdigest()
def gh(*args):return subprocess.check_output(['gh',*args],text=True)
def api(repo,route):return json.loads(gh('api','repos/'+repo+'/'+route))
def main():
 p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--version',required=True);p.add_argument('--source',required=True);p.add_argument('--tested',required=True);p.add_argument('--ci-run',required=True);p.add_argument('--release-id',required=True);p.add_argument('--publish',action='store_true');a=p.parse_args()
 if not re.fullmatch(r'\d+\.\d+\.\d+',a.version) or not re.fullmatch(r'[0-9a-f]{40}',a.source):raise ValueError('Invalid release identity')
 if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',a.repo) or not re.fullmatch(r'[0-9a-f]{40}',a.tested) or not a.ci_run.isdigit() or not a.release_id.isdigit():raise ValueError('Invalid CI/repository identity')
 version=json.loads(pathlib.Path('manifest.json').read_text())['version']
 if version!=a.version:raise ValueError('Manifest does not match requested version')
 run=api(a.repo,'actions/runs/'+a.ci_run)
 validate_ci(run,a.tested)
 tree=lambda ref:subprocess.check_output(['git','rev-parse',ref+'^{tree}'],text=True).strip()
 if tree(a.source)!=tree(a.tested):raise ValueError('Source tree differs from tested tree')
 subprocess.run(['git','merge-base','--is-ancestor',a.source,'origin/main'],check=True)
 release=validate_release(api(a.repo,'releases/'+a.release_id),version,a.source)
 plugin=pathlib.Path('dist')/('codex-bridge-'+version+'.zip');files=[plugin,plugin.with_name(plugin.name+'.sha256')]
 for target in ['linux','darwin','windows']:
  for arch in ['amd64','arm64']:
   name=f'codex-bridge-manager-{version}-{target}-{arch}'+('.tar.gz' if target=='linux' else '.zip');file=pathlib.Path('dist/managers')/name;files.extend([file,file.with_name(name+'.sha256')])
 for file in files:
  if not file.is_file():raise ValueError('Missing required asset: '+file.name)
  if file.name.endswith('.sha256'):
   base=file.with_suffix('');record=file.read_text().split()
   if len(record)!=2 or record[0]!=file_digest(base) or record[1]!=base.name:raise ValueError('Incorrect checksum sidecar: '+file.name)
 checksums=pathlib.Path('dist/SHA256SUMS');checksums.write_text(''.join(file_digest(file)+'  '+file.name+'\n' for file in files if not file.name.endswith('.sha256')));files.append(checksums)
 existing={asset['name']:asset for asset in release.get('assets',[])}
 for file in files:
  if file.name in existing:
   with tempfile.TemporaryDirectory() as directory:
    subprocess.run(['gh','release','download','v'+version,'--repo',a.repo,'--pattern',file.name,'--dir',directory],check=True)
    if file_digest(pathlib.Path(directory)/file.name)!=file_digest(file):raise ValueError('Refusing to overwrite different draft asset: '+file.name)
  else:subprocess.run(['gh','release','upload','v'+version,'--repo',a.repo,str(file)],check=True)
 # Verify every remote asset byte before making the draft visible.
 with tempfile.TemporaryDirectory() as directory:
  subprocess.run(['gh','release','download','v'+version,'--repo',a.repo,'--dir',directory],check=True)
  for file in files:
   if file_digest(pathlib.Path(directory)/file.name)!=file_digest(file):raise ValueError('Remote asset differs: '+file.name)
 latest=validate_release(api(a.repo,'releases/'+a.release_id),version,a.source)
 if set(asset['name'] for asset in latest['assets'])!=set(file.name for file in files):raise ValueError('Unexpected/missing remote assets')
 if a.publish:
  body=latest['body']+'\n\nPublished archives were rebuilt by GitHub Actions from the exact source above. SHA256SUMS and per-file sidecars attached to this Release are authoritative; local candidate hashes in the acceptance document are historical.\n'
  with tempfile.NamedTemporaryFile(mode='w',suffix='.json') as request:
   json.dump({'draft':False,'prerelease':True,'make_latest':'false','body':body},request);request.flush();gh('api','repos/'+a.repo+'/releases/'+str(latest['id']),'--method','PATCH','--input',request.name)
  print(json.dumps({'published':True,'tag':'v'+version,'source':a.source,'assets':len(files)}))
 else:print(json.dumps({'published':False,'verifiedDraft':True,'assets':len(files)}))
if __name__=='__main__':main()
