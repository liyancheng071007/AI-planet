const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function visit(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  if(['node_modules','backup'].includes(item.name))continue;
  const file=path.join(dir,item.name);
  if(item.isDirectory())visit(file);
  else if(/\.(js|cjs)$/.test(file))cp.execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
  else if(file.endsWith('.json'))JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
}}
visit(root);
const app=JSON.parse(fs.readFileSync(path.join(root,'miniprogram/app.json'),'utf8'));
for(const page of app.pages)for(const extension of ['.js','.wxml']){
  if(!fs.existsSync(path.join(root,'miniprogram',page+extension)))throw Error('Missing page '+page+extension);
}
for(const file of ['engine.js','content.js','domain.js']){
  if(fs.readFileSync(path.join(root,'cloudfunctions/game',file),'utf8')!==fs.readFileSync(path.join(root,'miniprogram/lib',file),'utf8'))throw Error('Demo/server drift: '+file);
}
console.log('JavaScript, JSON, page entries and demo/server parity passed.');
