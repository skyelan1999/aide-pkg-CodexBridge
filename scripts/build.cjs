'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/viewer.html'),'utf8');
fs.writeFileSync(path.join(root,'viewer.html'),source.replace('/* HOST_CLIENT */',fs.readFileSync(path.join(root,'src/host-client.js'),'utf8')));
