const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/public-specials.js'),'utf8');
function api(){const window={fetch:()=>{throw Error('Unexpected request');}};vm.runInNewContext(source,{window,URL,AbortSignal,Intl,Date});return window.MockingbirdPublicSpecials;}
const slots=['soup','salad','pressed','side','dessert'];
const items=()=>slots.map(slot=>({slot,name:`<${slot}> Special`,description:'Public copy',price_cents:1250,
 secondary_price_cents:slot==='soup'?900:null,vegetarian:false,gluten_free:true,notes:['Served fresh'],recipe_text:'SECRET',food_cost_percent:42}));
const feed=(entries=items())=>({schema_version:1,generated_at:new Date().toISOString(),week_of:'2099-01-05',
 service_start:'2099-01-08',service_end:'2099-01-10',items:entries});
const response=data=>({ok:true,json:async()=>data});
test('explicit disabled config stays on legacy JSON and enabled feed omits credentials',async()=>{
 assert.equal(await api().createLoader(async()=>response({specials_enabled:false}))(x=>x),null);
 const calls=[],load=api().createLoader(async(url,options)=>{calls.push([url,options]);return response(calls.length===1?
  {specials_enabled:true,specials_endpoint:'https://example.supabase.co/functions/v1/mockingbird-public-specials'}:feed());});
 const result=await load(x=>'/site'+x);
 assert.equal(calls[0][0],'/site/data/public-content.json');
 assert.equal(calls[1][1].credentials,'omit');assert.equal(calls[1][1].cache,'no-store');
 assert.equal(result.items.length,5);assert.equal(result.items[0].price,'$12.50');
 assert.equal(result.items[0].secondaryPrice,'$9.00');assert.equal(result.items[0].recipe_text,undefined);
 assert.equal(result.items[0].glutenFree,true);
});
test('empty published feed and API errors cannot resurrect old specials',async()=>{
 const endpoint='https://example.test/functions/v1/mockingbird-public-specials';
 for(const second of [response(feed([])),{ok:false}]){
  let calls=0;const result=await api().createLoader(async()=>++calls===1?response({specials_enabled:true,specials_endpoint:endpoint}):second)(x=>x);
  assert.equal(result.source,'command-center');assert.equal(result.items.length,0);
  assert.equal(result.unavailable,second.ok===false?true:undefined);
  assert.equal(calls,2);
 }
});
test('malformed, expired and stale feeds fail closed',()=>{
 const normalize=api().normalizeFeed;
 assert.throws(()=>normalize(feed(items().slice(0,4))));
 assert.throws(()=>normalize(feed(items().map((item,i)=>i===0?{...item,slot:'dessert'}:item))));
 assert.throws(()=>normalize(feed(items().map((item,i)=>i===0?{...item,vegetarian:'yes'}:item))));
 assert.throws(()=>normalize({...feed(),generated_at:'2020-01-01'}));
 assert.throws(()=>normalize({...feed(),service_end:'2020-01-01'}));
});
