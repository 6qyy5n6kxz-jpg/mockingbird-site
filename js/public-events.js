(function(root){
 'use strict';
 const labels={live_music:'Live music',trivia:'Trivia',book_club:'Book club',holiday:'Holiday',dinner:'Special dinner',community:'Community',seasonal:'Seasonal',other:'Event'};
 const zone='America/New_York';
 const text=value=>typeof value==='string'?value:'';
 function safeUrl(value){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
 }
 function normalizeFeed(data,now=Date.now()){
  if(data?.schema_version!==1||!Array.isArray(data.events)||data.events.length>500)throw new Error('Invalid public feed');
  const generated=Date.parse(data.generated_at);
  if(!Number.isFinite(generated)||Math.abs(now-generated)>15*60*1000)throw new Error('Stale feed');
  const events=data.events.map(event=>{
   const start=Date.parse(event.starts_at),end=Date.parse(event.ends_at);
   if(!text(event.id)||!text(event.title)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error('Invalid public event');
   return {id:text(event.id),title:text(event.title),event_type:text(event.event_type),starts_at:event.starts_at,ends_at:event.ends_at,
    performer:text(event.performer),description:text(event.description),admission:text(event.admission),venue_area:text(event.venue_area),
    image_url:safeUrl(event.image_url),image_alt:text(event.image_alt),reservation_required:event.reservation_required===true,
    reservation_url:safeUrl(event.reservation_url)};
  }).filter(event=>Date.parse(event.ends_at)>=now).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||a.id.localeCompare(b.id));
  return {source:'command-center',events,generated_at:data.generated_at};
 }
 function createLoader(fetcher){
  let configPromise;
  return async function load(withBase){
   try{
    configPromise??=fetcher(withBase('/data/public-content.json'),{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(async response=>{
     if(!response.ok)throw new Error('Configuration unavailable');return response.json();
    });
    const config=await configPromise;
    if(config?.enabled===false)return null; // Explicit legacy mode only.
    const endpoint=safeUrl(config?.events_endpoint);
    if(config?.enabled!==true||!endpoint||!new URL(endpoint).pathname.endsWith('/functions/v1/mockingbird-public-content'))throw new Error('Invalid endpoint');
    const response=await fetcher(endpoint,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Events unavailable');
    return normalizeFeed(await response.json());
   }catch{return {source:'command-center',unavailable:true,events:[]};}
  };
 }
 function node(tag,value,className){
  const element=root.document.createElement(tag);if(value)element.textContent=value;if(className)element.className=className;return element;
 }
 function when(event){
  const start=new Date(event.starts_at),end=new Date(event.ends_at);
  const date=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric'});
  const time=new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'});
  const lastDate=date.format(start)===date.format(end)?'':`${date.format(end)} `;
  return `${date.format(start)} · ${time.format(start)}–${lastDate}${time.format(end)} Eastern`;
 }
 function render(data,container,preview=false){
  if(!container)return;
  container.replaceChildren();
  if(data.unavailable||!data.events.length){
   const message=node('p',data.unavailable?'Events are temporarily unavailable. Please check back soon.':'New events coming soon.','note');
   message.setAttribute('role','status');container.appendChild(message);return;
  }
  (preview?data.events.slice(0,3):data.events).forEach(event=>{
   const card=node('article',null,preview?'home-event-card fade-in':'card fade-in');
   if(preview){
    const date=new Date(event.starts_at),badge=node('div',null,'home-event-date');
    badge.setAttribute('aria-label',new Intl.DateTimeFormat('en-US',{timeZone:zone,dateStyle:'full'}).format(date));
    badge.appendChild(node('span',new Intl.DateTimeFormat('en-US',{timeZone:zone,month:'short'}).format(date),'home-event-month'));
    badge.appendChild(node('strong',new Intl.DateTimeFormat('en-US',{timeZone:zone,day:'numeric'}).format(date)));
    badge.appendChild(node('span',new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short'}).format(date)));
    card.appendChild(badge);
   }
   const body=node('div',null,preview?'home-event-details':'event-content');
   body.appendChild(node('p',labels[event.event_type]||'Event','badge badge-soft'));
   body.appendChild(node('h3',event.title));body.appendChild(node('p',when(event),'note'));
   if(event.performer)body.appendChild(node('p',event.performer));
   if(!preview&&event.image_url){
    const wrap=node('div',null,'event-thumb'),image=node('img');image.src=event.image_url;image.alt=event.image_alt;image.loading='lazy';
    image.addEventListener('error',()=>wrap.remove());wrap.appendChild(image);card.appendChild(wrap);
   }
   if(!preview&&event.description){const description=node('p',event.description);description.style.whiteSpace='pre-wrap';body.appendChild(description);}
   if(event.admission)body.appendChild(node('p',event.admission,'badge'));
   if(!preview&&event.venue_area)body.appendChild(node('p',event.venue_area,'note'));
   if(event.reservation_url){
    const link=node('a',event.reservation_required?'Reserve / tickets':'Event details','btn btn-primary');
    link.href=event.reservation_url;link.target='_blank';link.rel='noopener noreferrer';body.appendChild(link);
   }
   if(preview){const link=node('a','View events →','btn btn-secondary');link.href=root.Mockingbird?.withBase('/events/')||'/events/';body.appendChild(link);}
   card.appendChild(body);container.appendChild(card);
  });
 }
 root.MockingbirdPublicEvents={load:createLoader((...args)=>root.fetch(...args)),createLoader,normalizeFeed,safeUrl,when,render};
})(typeof window==='undefined'?globalThis:window);
