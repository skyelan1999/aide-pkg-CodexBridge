"use strict";
// Explicitly targets an isolated, labelled test container. Never targets 9999.
const fs = require("node:fs"),
  https = require("node:https"),
  http = require("node:http"),
  cp = require("node:child_process"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const container = "aide-codex-bridge-acceptance";
const inspect = JSON.parse(
  cp.execFileSync("docker", ["inspect", container]),
)[0];
assert.equal(
  inspect.Config.Labels?.["aide.codex-bridge.acceptance"],
  "true",
  "Refusing a non-fixture Aide container",
);
const ca = cp.execFileSync("docker", [
  "exec",
  container,
  "cat",
  "/data/certs/cert.pem",
]);
const token = cp
  .execFileSync("docker", ["exec", container, "cat", "/data/auth/access-token"])
  .toString()
  .trim();
const root = ".agent-state/native-host";
fs.mkdirSync(root, { recursive: true });
function request(route, method = "GET", value, headers = {}) {
  const data = Buffer.isBuffer(value)
    ? value
    : value === undefined
      ? undefined
      : Buffer.from(JSON.stringify(value));
  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://127.0.0.1:18529" + route,
      {
        method,
        ca,
        headers: {
          Authorization: "Bearer " + token,
          ...(data
            ? {
                "Content-Type": "application/json",
                "Content-Length": data.length,
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        const parts = [];
        res.on("data", (c) => parts.push(c));
        res.on("end", () => {
          const bytes = Buffer.concat(parts);
          let result;
          try {
            result = JSON.parse(bytes);
          } catch (_) {
            result = bytes.toString();
          }
          resolve({ status: res.statusCode, value: result, bytes });
        });
      },
    );
    req.setTimeout(20000, () => req.destroy(Error("Native host timeout")));
    req.on("error", reject);
    req.end(data);
  });
}
async function open() {
  const r = await request(
    "/api/plugins/codex-bridge/workbench/open",
    "POST",
    {},
  );
  assert.equal(r.status, 200, JSON.stringify(r.value));
  const page = await request(r.value.url);
  assert.equal(page.status, 200);
  return { ...r.value, html: page.bytes, calls: 0, sequence: 0 };
}
async function invoke(bridge, tool, args) {
  if (bridge.calls >= 90) {
    const r = await request(
      "/api/plugins/codex-bridge/workbench/" +
        bridge.bridge.instanceId +
        "/renew",
      "POST",
      {},
    );
    assert.equal(r.status, 200);
    bridge.bridge.instanceId = r.value.instanceId;
    bridge.calls = 0;
  }
  bridge.calls++;
  const r = await request(
    "/api/plugins/codex-bridge/workbench/" + bridge.bridge.instanceId + "/call",
    "POST",
    {
      protocol: 1,
      requestId: "native_" + ++bridge.sequence,
      method: "tool.call",
      tool,
      arguments: args,
    },
  );
  if (r.status !== 200) throw Error(JSON.stringify(r.value));
  return r.value;
}
async function install() {
  const version = JSON.parse(fs.readFileSync("manifest.json")).version,
    zip = fs.readFileSync("dist/codex-bridge-" + version + ".zip"),
    b = "codex-bridge-" + crypto.randomBytes(10).toString("hex");
  const body = Buffer.concat([
    Buffer.from(
      "--" +
        b +
        '\r\nContent-Disposition: form-data; name="bundle"; filename="codex-bridge.zip"\r\nContent-Type: application/zip\r\n\r\n',
    ),
    zip,
    Buffer.from("\r\n--" + b + "--\r\n"),
  ]);
  const exists = await request("/api/plugins");
  const plugins = Array.isArray(exists.value)
    ? exists.value
    : exists.value.plugins || [];
  const route = plugins.some((p) => p.id === "codex-bridge")
    ? "/api/plugins/codex-bridge/upgrade"
    : "/api/plugins/bundle";
  const r = await request(route, "POST", body, {
    "Content-Type": "multipart/form-data; boundary=" + b,
  });
  assert.ok([200, 201].includes(r.status), JSON.stringify(r.value));
  const configured = await request('/api/plugins/codex-bridge/settings','PUT',{settings:{baseURL:'http://host.docker.internal:18531/v1',bridgeKey:fixtureKey}});
  assert.equal(configured.status,200,configured.value?.error);
  console.log("Native ZIP install/upgrade and isolated settings: PASS");
}

const fixtureKey=crypto.randomBytes(32).toString('hex');
const {createServer}=require('../runtime/bridge.cjs');
const modelServer=createServer({key:fixtureKey,maxBody:8192,timeout:5000,rpcFactory:()=>({async initialize(){},async call(method){if(method==='model/list')return{data:[{id:'synthetic-fixture-model'}]};throw Error('Unexpected fixture RPC');},close(){}})});
async function serve(){
 let bridge;
 const server=http.createServer(async(req,res)=>{try{
 if(req.method==='GET'&&req.url==='/'){
  bridge=await open();res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end(`<!doctype html><html><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}</style><iframe src="/viewer" sandbox="allow-scripts"></iframe><script>const f=document.querySelector('iframe');addEventListener('message',e=>{if(e.source!==f.contentWindow||e.data?.type!=='aide.workbench.ready')return;const c=new MessageChannel();c.port1.onmessage=async e=>{const m=e.data;try{const r=await fetch('/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(m)});c.port1.postMessage({...await r.json(),requestId:m.requestId})}catch(x){c.port1.postMessage({requestId:m.requestId,status:'error',error:x.message})}};f.contentWindow.postMessage({type:'aide.workbench.connect',protocol:1,pluginId:'codex-bridge',tools:${JSON.stringify(bridge.bridge.tools)},capabilities:[]},'*',[c.port2])});</script></html>`);
 }
 if(req.method==='GET'&&req.url==='/viewer'&&bridge){res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'");return res.end(bridge.html);}
 if(req.method==='POST'&&req.url==='/call'&&bridge){
  if(req.headers.origin!=='http://127.0.0.1:18530')throw Error('Test origin rejected');let body='';for await(const c of req){body+=c;if(body.length>8192)throw Error('Test body budget');}const m=JSON.parse(body);if(m.method!=='tool.call'||!bridge.bridge.tools.includes(m.tool))throw Error('Unknown test method');res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(await invoke(bridge,m.tool,m.arguments)));
 }res.writeHead(404);res.end();
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'error',error:e.message}));}});
 await new Promise(r=>server.listen(18530,'127.0.0.1',r));console.log('Native test workbench: http://127.0.0.1:18530');
 const stop=()=>{server.closeAllConnections();server.close();modelServer.shutdown();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
(async()=>{
 await new Promise(r=>modelServer.listen(18531,'127.0.0.1',r));
 await install();const bridge=await open();
 const health=await invoke(bridge,'codex_bridge_connection_info',{});assert.equal(JSON.parse(health.result).verifiedBridge,true,JSON.stringify(health));
 const models=await invoke(bridge,'codex_bridge_models',{});assert.equal(JSON.parse(models.result).models[0].id,'synthetic-fixture-model');assert.ok(!JSON.stringify(models).includes(fixtureKey));
 fs.writeFileSync(root+'/acceptance.json',JSON.stringify({installed:true,nativeHealth:true,nativeModels:true,syntheticCatalog:true},null,2)+'\n');console.log('Installed ZIP -> native workbench tools -> local bridge catalog: PASS');
 if(process.argv.includes('--serve'))await serve();else modelServer.shutdown();
})().catch(e=>{modelServer.shutdown();console.error(e.message);process.exitCode=1;});
