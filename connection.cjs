'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(path.dirname(__dirname),'.codex-bridge-private');
function rejectLinks(file){let current=path.resolve(file);for(;;){try{if(fs.lstatSync(current).isSymbolicLink())throw Error('Private connection path must not contain links');}catch(e){if(e.code!=='ENOENT')throw e;}const parent=path.dirname(current);if(parent===current)break;current=parent;}}
function createStore(directory=root){
 const file=path.join(directory,'connection.json');
 return {
  read(){rejectLinks(file);if(!fs.existsSync(file))return null;const st=fs.lstatSync(file);if(!st.isFile()||st.size>4096)throw Error('Invalid private connection state');if(process.platform!=='win32'&&(st.mode&0o077))throw Error('Private connection permissions are too broad');const d=JSON.parse(fs.readFileSync(file,'utf8'));if(!/^[a-f0-9]{64}$/.test(d.token))throw Error('Invalid private pairing');return d;},
  write(value){rejectLinks(file);fs.mkdirSync(directory,{recursive:true,mode:0o700});if(process.platform!=='win32')fs.chmodSync(directory,0o700);const tmp=path.join(directory,'.pair-'+crypto.randomBytes(12).toString('hex'));try{fs.writeFileSync(tmp,JSON.stringify(value),{flag:'wx',mode:0o600});fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}},
  clear(){rejectLinks(file);if(fs.existsSync(file))fs.unlinkSync(file);}
 };
}
module.exports={createStore,store:createStore()};
