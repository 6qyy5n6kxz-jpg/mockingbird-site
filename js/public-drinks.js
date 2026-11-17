(function(root){
 'use strict';
 // The Drinks page reads the Command Center POS: the bar items it sells, with POS prices and the
 // website copy (tasting note, origin, heading) set in the Command Center. Any problem with the feed
 // returns null, and the page falls back to data/drinks.json.
 const SECTIONS={
  'wine by the glass':{id:'wine-flights',title:'Flights + Pours',description:'Mix and match any wine or eligible tap pour shown below. Wines are listed from sweeter to drier.'},
  'on tap':{id:'on-tap',title:'On Tap'},
  'cans & bottles':{id:'beer-cans',title:'Beer, Cans + More'},
  // Non-alcoholic drinks sit under their own heading in Beer, Cans + More, as on the hand-kept page.
  'nonalcoholic':{id:'beer-cans',title:'Beer, Cans + More',group:'Non-Alcoholic'},
  'bottled wine':{id:'bottled-wine',title:'Bottle Shop'}
 };
 const ORDER=['wine-flights','on-tap','beer-cans','bottled-wine'];
 const text=(value,max)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):'';
 const money=cents=>`$${(cents/100).toFixed(2)}`;
 const slug=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'drinks';

 function normalizeFeed(data,now=Date.now()){
  if(data?.schema_version!==1||!Array.isArray(data.sections))throw new Error('Invalid drinks feed');
  const generated=Date.parse(data.generated_at);
  if(!Number.isFinite(generated)||Math.abs(now-generated)>15*60*1000)throw new Error('Stale drinks feed');
  const sections=data.sections.map(section=>{
   const name=text(section?.name,60);
   if(!name||!Array.isArray(section.items))throw new Error('Invalid section');
   const {group:defaultGroup='',...known}=SECTIONS[name.toLowerCase()]||{id:slug(name),title:name};
   const groups=[];
   for(const item of section.items){
    const itemName=text(item?.name,120);
    if(!itemName||!Array.isArray(item.prices)||!item.prices.length)throw new Error('Invalid drink');
    const prices=item.prices.map(p=>{
     if(!Number.isSafeInteger(p?.cents)||p.cents<=0)throw new Error('Invalid price');
     return {label:text(p.label,40),value:money(p.cents)};
    });
    const title=text(item.group,40)||defaultGroup;
    let group=groups.find(g=>g.title===title);
    if(!group){group={title,items:[]};groups.push(group);}
    group.items.push({name:itemName,meta:text(item.origin,24),description:text(item.description,160),prices});
   }
   return {...known,subsections:groups.map(group=>{
    // One shared column header when every drink in the list has the same serving sizes;
    // otherwise each drink names its own (Pint $6.50 · Pitcher $22.00).
    const labels=group.items[0]?.prices.map(p=>p.label)||[];
    const same=group.items.every(i=>i.prices.length===labels.length&&i.prices.every((p,n)=>p.label===labels[n]));
    return {title:group.title,priceHeader:same?(labels.every(Boolean)?labels:['Price']):[],
     items:group.items.map(i=>({name:i.name,meta:i.meta,description:i.description,
      priceText:same?i.prices.map(p=>p.value).join(' | '):i.prices.map(p=>p.label?`${p.label} ${p.value}`:p.value).join(' · ')}))};
   })};
  }).filter(section=>section.subsections.length).reduce((all,section)=>{
   const same=all.find(s=>s.id===section.id);
   if(same)same.subsections.push(...section.subsections);else all.push(section);
   return all;
  },[]);
  // The website keeps its own section order (wine and flights first); new POS sections follow.
  const rank=section=>{const i=ORDER.indexOf(section.id);return i<0?ORDER.length:i;};
  sections.sort((a,b)=>rank(a)-rank(b));
  if(!sections.length)throw new Error('Empty drinks feed');
  return {source:'command-center',sections};
 }

 // Keep the hand-kept Bottle Shop until its bottles are in the POS (config drinks_bottle_shop_source: "file").
 function withFileBottleShop(live,file){
  const shop=(file?.sections||[]).find(s=>s.id==='bottled-wine');
  const sections=live.sections.filter(s=>s.id!=='bottled-wine');
  return {...live,sections:shop?[...sections,shop]:sections};
 }

 function createLoader(fetcher){
  let configPromise;
  return async function load(withBase,readFile){
   try{
    configPromise??=fetcher(withBase('/data/public-content.json'),{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(async response=>{
     if(!response.ok)throw new Error('Configuration unavailable');return response.json();
    });
    const config=await configPromise;
    if(config?.drinks_enabled!==true)return null;
    const url=new URL(config.drinks_endpoint||'');
    if(url.protocol!=='https:'||url.username||url.password||!url.pathname.endsWith('/functions/v1/mockingbird-public-drinks')||url.search||url.hash)throw new Error('Invalid endpoint');
    const response=await fetcher(url.href,{credentials:'omit',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Drinks unavailable');
    const live=normalizeFeed(await response.json());
    return config.drinks_bottle_shop_source==='file'?withFileBottleShop(live,await readFile()):live;
   }catch{return null;}
  };
 }
 root.MockingbirdPublicDrinks={load:createLoader((...args)=>root.fetch(...args)),createLoader,normalizeFeed,withFileBottleShop};
})(typeof window==='undefined'?globalThis:window);
