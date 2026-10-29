#!/usr/bin/env python3
"""Exercise real Aide ZIP upload in a disposable container; never use production data."""
import argparse, json, pathlib, ssl, subprocess, time, urllib.error, urllib.request, uuid

def docker(*args):
    return subprocess.check_output(['docker', *args], text=True).strip()

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--image',required=True)
    p.add_argument('--previous',type=pathlib.Path,required=True)
    p.add_argument('--candidate',type=pathlib.Path,required=True)
    p.add_argument('--receipt',type=pathlib.Path,required=True)
    a=p.parse_args()
    name='codex-import-fixture-'+uuid.uuid4().hex[:12]
    receipt={'image':a.image,'checks':{}}
    try:
        docker('run','-d','--name',name,'--user','0','--memory','768m','--cpus','1',
               '-e','AIDE_DATA=/tmp/data','-e','AIDE_WORKSPACE=/tmp/workspace',
               '-e','AIDE_CONTEXT=/tmp/context','-p','127.0.0.1::8080',a.image)
        info=json.loads(docker('inspect',name))[0]
        receipt['imageID']=info['Image']
        port=info['NetworkSettings']['Ports']['8080/tcp'][0]['HostPort']
        base='https://127.0.0.1:'+port
        context=ssl._create_unverified_context() # Disposable loopback self-signed server only.
        for attempt in range(40):
            try:
                urllib.request.urlopen(base+'/healthz',context=context,timeout=2).close();break
            except (OSError, urllib.error.URLError): time.sleep(.25)
        else: raise RuntimeError('Isolated Aide did not become healthy')
        token=docker('exec',name,'cat','/tmp/data/auth/access-token')
        def request(route,data=None,ctype='application/json'):
            req=urllib.request.Request(base+route,data=data,headers={'Authorization':'Bearer '+token,'Content-Type':ctype})
            try:
                with urllib.request.urlopen(req,context=context,timeout=60) as r:return r.status,json.load(r)
            except urllib.error.HTTPError as e:return e.code,json.load(e)
        def upload(file):
            boundary='fixture-'+uuid.uuid4().hex
            body=('--'+boundary+'\r\nContent-Disposition: form-data; name="bundle"; filename="plugin.zip"\r\nContent-Type: application/zip\r\n\r\n').encode()+file.read_bytes()+('\r\n--'+boundary+'--\r\n').encode()
            return request('/api/plugins/bundle',body,'multipart/form-data; boundary='+boundary)
        status,old=upload(a.previous)
        assert status==400 and "Cannot find module './connection.cjs'" in old.get('error',''),(status,old)
        receipt['checks']['previousUploadFailsWithReportedMissingModule']=True
        status,new=upload(a.candidate)
        assert status==201 and new.get('enabled') is True,(status,new)
        receipt['checks']['candidateUploadEnabled']=True
        status,listing=request('/api/plugins')
        plugin=next(x for x in listing['plugins'] if x['id']=='codex-bridge')
        assert status==200 and plugin['enabled'] and not plugin.get('error'),plugin
        receipt['version']=plugin['version']
        status,workbench=request('/api/plugins/codex-bridge/workbench/open',b'{}')
        assert status==200 and len(workbench['bridge']['tools'])==7
        receipt['checks']['workbenchOpensWithSevenTools']=True
        with urllib.request.urlopen(base+workbench['url'],context=context,timeout=30) as page:
            assert page.status==200 and b'Codex' in page.read()
        instance=workbench['bridge']['instanceId']
        status,result=request('/api/plugins/codex-bridge/workbench/'+instance+'/call',json.dumps({'protocol':1,'requestId':'r_1','method':'tool.call','tool':'codex_bridge_manager_status','arguments':{}}).encode())
        assert status==200 and result.get('status')=='result' and not result.get('error'),(status,result)
        value=result['result']
        if isinstance(value,str): value=json.loads(value)
        assert value['pluginVersion']==plugin['version'] and value['paired'] is False,(status,value)
        receipt['checks']['workbenchStatusToolCall']=True
        receipt['scope']='Disposable Linux Aide HTTP upload/enable/workbench path; no production mounts, account or native Windows desktop acceptance.'
        a.receipt.parent.mkdir(parents=True,exist_ok=True)
        a.receipt.write_text(json.dumps(receipt,indent=2)+'\n')
        print(json.dumps(receipt))
    finally:
        subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
if __name__=='__main__': main()
