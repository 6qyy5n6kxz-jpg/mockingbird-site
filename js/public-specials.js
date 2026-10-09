(function(root){
 'use strict';
 const labels={soup:'Soup of the Day',salad:'Seasonal Salad',pressed:'Featured Pressed Sandwich',side:'Featured Side',dessert:'Sweet Bite of the Day'};
 const order=Object.keys(labels);
 const safeText=value=>typeof value==='string'?value.slice(0,2000):'';
 function normalizeFeed(data,now=Date.now()){
  if(data?.schema_version!==1||!Array.isArray(data.items)||![0,5].includes(data.items.length))throw new Error('Invalid specials feed');
  const generated=Date.parse(data.generated_at);
  if(!Number.isFinite(generated)||Math.abs(now-generated)>15*60*1000)throw new Error('Stale specials feed');
  const items=data.items.map((item,index)=>{
   if(item?.slot!==order[index]||typeof item.name!=='string'||!item.name.trim()||
      !Number.isInteger(item.price_cents)||item.price_cents<0||
      item.vegetarian!==true&&item.vegetarian!==false||
      item.gluten_free!==true&&item.gluten_free!==false)throw new Error('Invalid special');
   const price=value=>Number.isInteger(value)&&value>=0?`$${(value/100).toFixed(2)}`:'';
   if(item.slot==='soup'&&(!Number.isInteger(item.secondary_price_cents)||item.secondary_price_cents<0))throw new Error('Invalid soup price');
   return {label:labels[item.slot],slot:item.slot,name:safeText(item.name),description:safeText(item.description),
    price:price(item.price_cents),secondaryPrice:item.slot==='soup'?price(item.secondary_price_cents):'',
    vegetarian:item.vegetarian,glutenFree:item.gluten_free,
    notes:Array.isArray(item.notes)?item.notes.slice(0,3).map(safeText):[]};
  });
  if(items.length){
   const start=Date.parse(data.service_start+'T12:00:00Z'),end=Date.parse(data.service_end+'T12:00:00Z');
   const monday=Date.parse(data.week_of+'T12:00:00Z');
   if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(monday)||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.week_of)||start-monday!==3*86400000||end-monday!==5*86400000)throw new Error('Invalid service dates');
   const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(part=>[part.type,part.value]));
   const today=`${parts.year}-${parts.month}-${parts.day}`;
   if(data.service_end<today)throw new Error('Expired specials feed');
  }
  const range=items.length?new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',day:'numeric'}):null;
  return {source:'command-center',weekOf:safeText(data.week_of),dateRange:range?`${range.format(new Date(data.service_start+'T12:00:00Z'))}–${new Intl.DateTimeFormat('en-US',{timeZone:'UTC',day:'numeric'}).format(new Date(data.service_end+'T12:00:00Z'))}`:'',
   items};
 }
 function createLoader(fetcher){
  let configPromise;
  return async function load(withBase){
   try{
    configPromise??=fetcher(withBase('/data/public-content.json'),{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(async response=>{
     if(!response.ok)throw new Error('Configuration unavailable');return response.json();
    });
    const config=await configPromise;
    if(config?.specials_enabled===false)return null;
    const url=new URL(config?.specials_endpoint||'');
    if(config?.specials_enabled!==true||url.protocol!=='https:'||url.username||url.password||
       !url.pathname.endsWith('/functions/v1/mockingbird-public-specials')||url.search||url.hash)throw new Error('Invalid endpoint');
    const response=await fetcher(url.href,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Specials unavailable');
    return normalizeFeed(await response.json());
   }catch{return {source:'command-center',unavailable:true,items:[]};}
  };
 }
 root.MockingbirdPublicSpecials={load:createLoader((...args)=>root.fetch(...args)),createLoader,normalizeFeed};
})(typeof window==='undefined'?globalThis:window);
