const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../drinks/index.html'),'utf8');
const drinks=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/drinks.json'),'utf8'));
const names=new Set();
(function walk(x){if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object'){if(typeof x.name==='string')names.add(x.name);Object.values(x).forEach(walk);}})(drinks);
const norm=s=>s.replace(/&amp;/g,'&').replace(/[’']/g,"'").trim();
const all=new Set([...names].map(norm));
test('every drink the "If you like… try…" guide names is on the drinks list',()=>{
 const named=[...html.matchAll(/<strong data-drink>([^<]+)<\/strong>/g)].map(m=>norm(m[1]));
 assert.ok(named.length>=10,'guide names drinks');
 const missing=named.filter(n=>!all.has(n));
 assert.deepEqual(missing,[],'remove or update these suggestions: they are not on data/drinks.json');
});
test('beer and seltzer cards only suggest beer, seltzers and cans; wine-for-beer-drinkers is its own group',()=>{
 const section=html.slice(html.indexOf('Beer, seltzers &amp; more'),html.indexOf('Usually a beer drinker?'));
 // Which drinks list sub-section (Whites/Rosé, Reds, IPAs, Beer, …) a drink is listed under.
 const sectionOf=name=>{let found=null;const walk=(x,title)=>{if(found)return;if(Array.isArray(x))return x.forEach(y=>walk(y,title));
  if(x&&typeof x==='object'){if(typeof x.name==='string'&&norm(x.name)===name)found=title;for(const v of Object.values(x))walk(v,title);}};
  for(const s of drinks.sections)for(const sub of s.subsections||[])walk(sub,sub.title||s.title);return found;};
 assert.match(String(sectionOf(norm('Zywiec Porter'))),/Beer/);
 for(const m of section.matchAll(/<strong data-drink>([^<]+)<\/strong>/g))
  {const where=sectionOf(norm(m[1]));assert.ok(where,`${m[1]} not found`);assert.doesNotMatch(where,/White|Ros|Red/,`${m[1]} is a wine`);}
});
