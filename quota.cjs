'use strict';
// Shared allowlist for account metadata. Never return raw RPC/account payloads.
function label(value, fallback) { return typeof value === 'string' && value.trim() ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0,120) : fallback; }
function number(value) { return typeof value === 'number' && Number.isFinite(value); }
function window(value) {
  if (!value || !number(value.usedPercent) || value.usedPercent < 0) return null;
  return {usedPercent:value.usedPercent,remainingPercent:Math.max(0,Math.min(100,100-value.usedPercent)),
    windowDurationMins:number(value.windowDurationMins)&&value.windowDurationMins>0?value.windowDurationMins:null,
    resetsAt:Number.isSafeInteger(value.resetsAt)&&value.resetsAt>0&&value.resetsAt<253402300800?value.resetsAt:null};
}
function normalizeRateLimits(result, now=new Date()) {
  const map=result?.rateLimitsByLimitId;
  const items=map&&typeof map==='object'&&!Array.isArray(map)?Object.entries(map):result?.rateLimits?[[result.rateLimits.limitId||'codex',result.rateLimits]]:[];
  const buckets=[];
  for(const [key,value] of items.slice(0,32)) {
    if(!value||typeof value!=='object')continue;
    const primary=window(value.primary),secondary=window(value.secondary);
    if(!primary&&!secondary)continue;
    const id=label(value.limitId,label(key,'codex'));
    buckets.push({id,label:label(value.limitName,id),primary,secondary});
  }
  return {available:buckets.length>0,buckets,checkedAt:now.toISOString(),reason:buckets.length?null:'no_data'};
}
function safeSnapshot(value) {
  const map={};
  for(const b of (Array.isArray(value?.buckets)?value.buckets:[]).slice(0,32)) {
    if(!b||typeof b.id!=='string')continue;
    Object.defineProperty(map,b.id,{value:{limitId:b.id,limitName:b.label,primary:b.primary,secondary:b.secondary},enumerable:true,configurable:true});
  }
  const out=normalizeRateLimits({rateLimitsByLimitId:map});
  if(typeof value?.checkedAt==='string'&&Number.isFinite(Date.parse(value.checkedAt)))out.checkedAt=new Date(value.checkedAt).toISOString();
  if(!out.available&&['unsupported','unavailable','no_data'].includes(value?.reason))out.reason=value.reason;
  return out;
}
module.exports={normalizeRateLimits,safeSnapshot};
