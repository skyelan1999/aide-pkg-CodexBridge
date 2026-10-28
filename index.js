'use strict';
const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]', 'host.docker.internal']);
function bridgeURL(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('Invalid bridge URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || !localHosts.has(url.hostname) || url.username || url.password || url.search || url.hash || !['/v1','/v1/'].includes(url.pathname)) throw Error('Invalid bridge URL: use a local /v1 endpoint without credentials');
  return url.href.replace(/\/$/, '');
}
function managerURL(value){let u;try{u=new URL(value)}catch{throw Error('Invalid manager URL')};if(!['http:','https:'].includes(u.protocol)||!localHosts.has(u.hostname)||u.username||u.password||u.search||u.hash||!['','/'].includes(u.pathname))throw Error('Use a local manager origin without credentials or path');return u.origin;}
module.exports = {
  name: 'codex-bridge',
  apply(api) {
    const managerRequest=async(action)=>{
      const base=managerURL(api.settings?.managerURL||'http://host.docker.internal:8788');
      const key=String(api.settings?.managerKey||'');if(!/^[a-f0-9]{64}$/.test(key))throw Error('Open the native manager setup and pair its separate manager key in plugin settings / 请先打开宿主管理器，在插件设置中配对管理密钥');
      let r;try{r=await fetch(base+(action?'/api/action':'/api/status'),{method:action?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:action?JSON.stringify({action}):undefined,redirect:'error',signal:AbortSignal.timeout(15000)})}catch{throw Error('Manager unavailable. Open the native manager application first / 请先打开宿主管理器应用');}
      let text='';for await(const chunk of r.body){text+=Buffer.from(chunk).toString('utf8');if(Buffer.byteLength(text)>8192)throw Error('Manager response too large');}let d;try{d=JSON.parse(text)}catch{throw Error('Invalid manager response')};if(!r.ok)throw Error(String(d.error||'Manager action failed').replaceAll(key,'[REDACTED]').slice(0,500));
      // Rebuild an allowlisted result: never return credentials or provider configuration.
      if(d.service!=='aide-codex-bridge-manager')throw Error('Unexpected manager identity');
      return JSON.stringify(Object.fromEntries(['service','version','platform','arch','installed','running','externalBridge','nodeFound','codexFound','lastError'].filter(k=>['string','boolean'].includes(typeof d[k])).map(k=>[k,typeof d[k]==='string'?d[k].replaceAll(key,'[REDACTED]').slice(0,500):d[k]])));
    };
    api.tool({name:'codex_bridge_manager_status',description:'Read status of the separately paired native manager. No inference or account changes.',parameters:{type:'object',properties:{},additionalProperties:false},scheduling:{resources:[]},handler:()=>managerRequest()});
    api.tool({name:'codex_bridge_host_action',description:'Manage only this plugin’s installed host bridge through a separately paired local manager. Fixed actions only; no shell command, arbitrary path, provider overwrite or account access. Use only when explicitly requested.',parameters:{type:'object',properties:{action:{type:'string',enum:['install','start','stop','restart','doctor','repair','uninstall']}},required:['action'],additionalProperties:false},scheduling:{resources:['codex-bridge-host']},handler:args=>{if(!args||Object.keys(args).length!==1||!['install','start','stop','restart','doctor','repair','uninstall'].includes(args.action))throw Error('Unsupported host action');return managerRequest(args.action)}});
    const read = () => ({ baseURL: bridgeURL(api.settings?.baseURL || 'http://host.docker.internal:8787/v1'), key: String(api.settings?.bridgeKey || '') });
    api.tool({ name: 'codex_bridge_connection_info', description: 'Check the local Codex bridge identity and obtain provider setup guidance. No inference or settings changes.', parameters: {type:'object',properties:{},additionalProperties:false}, scheduling:{resources:[]}, async handler() {
      const {baseURL} = read();
      try {
        const r = await fetch(baseURL.replace(/\/v1$/, '/health'), {signal:AbortSignal.timeout(5000),redirect:'error'});
        const value = await r.json();
        const valid = r.ok && value.service === 'aide-codex-bridge';
        return JSON.stringify({baseURL,reachable:true,verifiedBridge:valid,version:valid?value.version:undefined,provider:{type:'OpenAI compatible / Chat Completions',baseURL,apiKey:'Use the locally generated bridge key',model:'Choose an ID from the authenticated catalog'},note:'Health is not login or inference acceptance. Install/start the host component separately; never paste keys into chat.'});
      } catch { return JSON.stringify({baseURL,reachable:false,verifiedBridge:false,note:'Start the host bridge and check the URL/firewall. Docker and native Aide use different host addresses.'}); }
    }});
    api.tool({name:'codex_bridge_models',description:'Read authenticated local Codex model catalog with the diagnostic key stored in plugin settings. No inference. Catalog is not entitlement.',parameters:{type:'object',properties:{},additionalProperties:false},scheduling:{resources:[]},async handler(){
      const {baseURL,key}=read(); if(!key) throw Error('Set the optional diagnostic key in plugin settings; do not send it in chat.');
      let r; try {r=await fetch(baseURL+'/models',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(30000),redirect:'error'});} catch {throw Error('Bridge catalog request failed; check the local service.');}
      if(!r.ok) throw Error('Bridge catalog HTTP '+r.status);
      let data; try {data=await r.json();} catch {throw Error('Invalid bridge catalog response');}
      if(!Array.isArray(data.data)) throw Error('Invalid bridge catalog');
      return JSON.stringify({models:data.data.slice(0,200).map(m=>({id:String(m.id).slice(0,200)})),note:'Catalog only. A successful inference turn is required to confirm account/model access.'});
    }});
  },
};
module.exports.bridgeURL=bridgeURL;

module.exports.managerURL=managerURL;
