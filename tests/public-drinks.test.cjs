const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/public-drinks.js'),'utf8');
function api(){const window={fetch:()=>{throw Error('Unexpected request');}};vm.runInNewContext(source,{window,URL,AbortSignal,Date});return window.MockingbirdPublicDrinks;}
const endpoint='https://example.supabase.co/functions/v1/mockingbird-public-drinks';
const feed=()=>({schema_version:1,generated_at:new Date().toISOString(),sections:[
 {name:'On Tap',items:[
  {name:'Fictional Lager',group:null,prices:[{label:'Pint',cents:650},{label:'Pitcher',cents:2200}]},
  {name:'Fictional Sangria',group:null,prices:[{label:'Snifter',cents:600}]}]},
 {name:'Wine by the Glass',items:[
  {name:'Fictional Moscato',description:'Sweet, peach',origin:'ITA',group:'Whites/Rosé',prices:[{label:'Glass',cents:900},{label:'Bottle',cents:2100}]},
  {name:'Fictional Malbec',description:null,origin:null,group:'Reds',prices:[{label:'Glass',cents:1000},{label:'Bottle',cents:2400}]}]},
 {name:'Nonalcoholic',items:[{name:'Fictional Cola',prices:[{label:null,cents:250}]}]},
 {name:'Bottled Wine',items:[{name:'POS Bottle',prices:[{label:null,cents:3000}]}]}]});
const response=data=>({ok:true,json:async()=>data});
const fileDrinks={sections:[{id:'wine-flights',subsections:[]},{id:'bottled-wine',title:'Bottle Shop',subsections:[{title:'Red',items:[{name:'Hand-kept Bottle',prices:{bottle:'$25.00'}}]}]}]};

test('POS sections map to the drinks page sections in website order, grouped under their headings',()=>{
 const result=api().normalizeFeed(feed());
 assert.equal(result.source,'command-center');
 assert.deepEqual([...result.sections].map(s=>[s.id,s.title]),[['wine-flights','Flights + Pours'],['on-tap','On Tap'],['beer-cans','Beer, Cans + More'],['bottled-wine','Bottle Shop']]);
 const wine=result.sections[0];
 assert.deepEqual([...wine.subsections].map(s=>s.title),['Whites/Rosé','Reds']);
 assert.deepEqual([...wine.subsections[0].priceHeader],['Glass','Bottle']);
 assert.deepEqual({...wine.subsections[0].items[0]},{name:'Fictional Moscato',meta:'ITA',description:'Sweet, peach',priceText:'$9.00 | $21.00'});
});

test('drinks with different serving sizes name each price; a lone price gets a Price header',()=>{
 const result=api().normalizeFeed(feed());
 const tap=result.sections[1].subsections[0];
 assert.deepEqual([...tap.priceHeader],[]);
 assert.equal(tap.items[0].priceText,'Pint $6.50 · Pitcher $22.00');
 assert.equal(tap.items[1].priceText,'Snifter $6.00');
 const na=result.sections[2].subsections[0];
 assert.equal(na.title,'Non-Alcoholic');
 assert.deepEqual([...na.priceHeader],['Price']);
 assert.equal(na.items[0].priceText,'$2.50');
});

test('the hand-kept Bottle Shop replaces the POS one when configured, and credentials are never sent',async()=>{
 const calls=[];
 const load=api().createLoader(async(url,options)=>{calls.push([url,options]);return response(calls.length===1?
  {drinks_enabled:true,drinks_endpoint:endpoint,drinks_bottle_shop_source:'file'}:feed());});
 const result=await load(x=>'/site'+x,async()=>fileDrinks);
 assert.equal(calls[0][0],'/site/data/public-content.json');
 assert.equal(calls[1][1].credentials,'omit');
 const shop=result.sections.find(s=>s.id==='bottled-wine');
 assert.equal(shop.subsections[0].items[0].name,'Hand-kept Bottle');
 assert.equal(result.sections.filter(s=>s.id==='bottled-wine').length,1);
 const all=JSON.stringify(result);assert.ok(!all.includes('POS Bottle'));
});

test('disabled config, bad endpoints, errors and malformed or stale feeds fall back to the file',async()=>{
 const run=async(config,second)=>{let n=0;return api().createLoader(async()=>++n===1?response(config):second)(x=>x,async()=>fileDrinks);};
 assert.equal(await run({drinks_enabled:false,drinks_endpoint:endpoint},response(feed())),null);
 assert.equal(await run({drinks_enabled:true,drinks_endpoint:'http://example.test/functions/v1/mockingbird-public-drinks'},response(feed())),null);
 assert.equal(await run({drinks_enabled:true,drinks_endpoint:'https://evil.test/other'},response(feed())),null);
 assert.equal(await run({drinks_enabled:true,drinks_endpoint:endpoint},{ok:false}),null);
 const normalize=api().normalizeFeed;
 assert.throws(()=>normalize({...feed(),generated_at:'2020-01-01T00:00:00Z'}));
 assert.throws(()=>normalize({...feed(),schema_version:2}));
 assert.throws(()=>normalize({...feed(),sections:[]}));
 assert.throws(()=>normalize({...feed(),sections:[{name:'On Tap',items:[{name:'X',prices:[{label:'Pint',cents:0}]}]}]}));
});
