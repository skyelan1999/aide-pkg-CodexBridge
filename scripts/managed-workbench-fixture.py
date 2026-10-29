#!/usr/bin/env python3
"""Isolated Linux UI fixture: real headless manager and bridge, synthetic CLI.
Parent MessageChannel transport is a test adapter; production Aide authorization
and response projection are tested separately in Aide's Go regression suite.
"""
import http.server,json,os,pathlib,shutil,subprocess,sys,tempfile,time,urllib.request,urllib.error
root=pathlib.Path(__file__).resolve().parents[1]
tmp=tempfile.TemporaryDirectory(prefix='codex-managed-fixture-');state=pathlib.Path(tmp.name);bin=state/'bin';bin.mkdir()
node=shutil.which('node');assert node
cli=bin/'codex';cli.write_text('#!'+node+'\n'+'''if(process.argv.includes('--version')){console.log('codex-cli fixture');process.exit(0)}
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{const q=JSON.parse(line);if(q.id)console.log(JSON.stringify({id:q.id,result:q.method==='model/list'?{data:[{id:'synthetic-model'}]}:q.method==='account/rateLimits/read'?{rateLimits:{primary:{usedPercent:25,windowDurationMins:300,resetsAt:2000000000}}}:{}}))});
''');cli.chmod(0o755)
connection=state/'private'/'codex-bridge.json'
env={**os.environ,'XDG_DATA_HOME':str(state),'PATH':str(bin)+os.pathsep+str(pathlib.Path(node).parent)}
manager=subprocess.Popen([str(root/'dist/manager-managed'),'--aide-managed',str(connection)],env=env)
for _ in range(100):
 if connection.exists():break
 time.sleep(.05)
assert connection.exists(),'metadata missing'
# Reopen must reuse service without opening a browser or rotating credentials.
before=connection.read_bytes();assert subprocess.run([str(root/'dist/manager-managed'),'--aide-managed',str(connection)],env=env,timeout=5).returncode==0;assert before==connection.read_bytes()
parent='''<!doctype html><meta charset=utf-8><style>body{margin:0}iframe{width:100%;height:100vh;border:0}</style><iframe src=/viewer.html></iframe><script>
window.addEventListener('message',e=>{if(e.data?.type!=='aide.workbench.ready')return;const c=new MessageChannel();c.port1.onmessage=async({data:m})=>{try{if(m.method!=='host.component')throw Error('Unexpected method');const r=await fetch('/fixture-rpc',{method:'POST',body:JSON.stringify(m.arguments)});const value=await r.json();c.port1.postMessage(r.ok?{requestId:m.requestId,status:'result',result:value}:{requestId:m.requestId,status:'error',error:value.error});}catch(err){c.port1.postMessage({requestId:m.requestId,status:'error',error:err.message})}};c.port1.start();e.source.postMessage({type:'aide.workbench.connect',protocol:1,pluginId:'codex-bridge',tools:[],capabilities:['host.component.codex-bridge']},'*',[c.port2]);});</script>'''
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def send(self,status,data,kind='application/json'):
  self.send_response(status);self.send_header('Content-Type',kind);self.end_headers();self.wfile.write(data)
 def do_GET(self):
  if self.path=='/':self.send(200,parent.encode(),'text/html')
  elif self.path=='/viewer.html':self.send(200,(root/'viewer.html').read_bytes(),'text/html')
  else:self.send(404,b'{}')
 def do_POST(self):
  action=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))['action']
  if action not in ['status','install','start','stop','uninstall','key','models','usage']:self.send(400,b'{}');return
  meta=json.loads(connection.read_text());route='/api/'+action;body=None
  if action in ['install','start','stop','uninstall']:route='/api/action';body=json.dumps({'action':action}).encode()
  if action=='key':body=b'{}'
  request=urllib.request.Request('http://127.0.0.1:17888'+route,data=body,headers={'Authorization':'Bearer '+meta['token'],'X-Manager-Owner-UI':'1','Content-Type':'application/json'})
  try:
   with urllib.request.urlopen(request,timeout=40) as r:value=json.load(r)
   if action=='usage':value=value['usage'];value['available']=False
   elif action not in ['key','models']:
    value['available']=True;value['paired']=True;value['phase']='external_bridge' if value.get('externalBridge') else 'host_missing' if not value.get('installed') else 'host_stopped' if not value.get('running') else 'ready'
   self.send(200,json.dumps(value).encode())
  except urllib.error.HTTPError as e:self.send(e.code,e.read())
try:
 print('READY managed UI fixture, synthetic state only',flush=True)
 http.server.ThreadingHTTPServer(('0.0.0.0',18091),Handler).serve_forever()
finally:
 manager.terminate();manager.wait(timeout=10);tmp.cleanup()
