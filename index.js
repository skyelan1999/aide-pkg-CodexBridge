'use strict';
const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]', 'host.docker.internal']);
function bridgeURL(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('Invalid bridge URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || !localHosts.has(url.hostname) || url.username || url.password || url.search || url.hash || !['/v1','/v1/'].includes(url.pathname)) throw Error('Invalid bridge URL: use a local /v1 endpoint without credentials');
  return url.href.replace(/\/$/, '');
}
module.exports = {
  name: 'codex-bridge',
  apply(api) {
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
