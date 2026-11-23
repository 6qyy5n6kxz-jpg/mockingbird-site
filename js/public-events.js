(function(root){
 'use strict';
 const labels={live_music:'Live music',trivia:'Trivia',book_club:'Book club',game_night:'Game night',holiday:'Holiday',dinner:'Special dinner',community:'Community',seasonal:'Seasonal',other:'Event'};
 const zone='America/New_York';
 const text=value=>typeof value==='string'?value:'';
 function safeUrl(value){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
 }
 function safeFormspree(value){return /^https:\/\/formspree[.]io\/f\/[A-Za-z0-9]+$/.test(text(value))?value:'';}
 function registrationClosed(event,now=Date.now()){
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  return !!event.registration_deadline&&date>event.registration_deadline;
 }
 function normalizeFeed(data,now=Date.now()){
  if(data?.schema_version!==1||!Array.isArray(data.events)||data.events.length>500)throw new Error('Invalid public feed');
  const generated=Date.parse(data.generated_at);
  if(!Number.isFinite(generated)||Math.abs(now-generated)>15*60*1000)throw new Error('Stale feed');
  const events=data.events.map(event=>{
   const start=Date.parse(event.starts_at),end=Date.parse(event.ends_at);
   if(!text(event.id)||!text(event.title)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error('Invalid public event');
   const mode=event.registration_mode||'external';
   if(!['external','formspree'].includes(mode)||(mode==='formspree'&&!safeFormspree(event.formspree_url)))throw new Error('Invalid registration method');
   const deadline=text(event.registration_deadline);
   if(deadline&&(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||!Number.isFinite(Date.parse(deadline+'T00:00:00Z'))||new Date(deadline+'T00:00:00Z').toISOString().slice(0,10)!==deadline))throw new Error('Invalid deadline');
   return {id:text(event.id),title:text(event.title),event_type:text(event.event_type),starts_at:event.starts_at,ends_at:event.ends_at,
    performer:text(event.performer),description:text(event.description),admission:text(event.admission),venue_area:text(event.venue_area),
    image_url:safeUrl(event.image_url),image_alt:text(event.image_alt),reservation_required:event.reservation_required===true,
    reservation_url:safeUrl(event.reservation_url),registration_mode:mode,formspree_url:safeFormspree(event.formspree_url),
    registration_deadline:deadline,recording_consent_required:event.recording_consent_required===true,pinned:event.pinned===true,
    signup:event.signup&&typeof event.signup==='object'?{free:event.signup.free===true,open:event.signup.open===true,
     spots_left:Number.isSafeInteger(event.signup.spots_left)&&event.signup.spots_left>=0?event.signup.spots_left:null}:null};
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
 // Flyers uploaded in the Command Center are full size (often 2+ MB). Supabase can resize them on the fly.
 function flyerSources(url){
  try{
   const parsed=new URL(url);
   if(!/[.]supabase[.]co$/.test(parsed.hostname)||!parsed.pathname.startsWith('/storage/v1/object/public/'))return null;
   const base=parsed.origin+parsed.pathname.replace('/storage/v1/object/public/','/storage/v1/render/image/public/');
   const at=width=>`${base}?width=${width}&resize=contain&quality=75`;
   return {src:at(480),srcset:[320,480,720].map(width=>`${at(width)} ${width}w`).join(', ')};
  }catch{return null;}
 }
 const monthKey=event=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit'}).format(new Date(event.starts_at));
 const monthLabel=event=>new Intl.DateTimeFormat('en-US',{timeZone:zone,month:'long',year:'numeric'}).format(new Date(event.starts_at));
 function eventSchema(events,pageUrl){
  const place={'@type':'Place',name:'The Mockingbird on Mill Road',address:{'@type':'PostalAddress',streetAddress:'4408 N. Elliston-Trowbridge Rd.',
   addressLocality:'Graytown',addressRegion:'OH',postalCode:'43432',addressCountry:'US'}};
  return events.slice(0,50).map(event=>{
   const item={'@context':'https://schema.org','@type':'Event',name:event.title,startDate:event.starts_at,endDate:event.ends_at,
    eventStatus:'https://schema.org/EventScheduled',eventAttendanceMode:'https://schema.org/OfflineEventAttendanceMode',location:place,
    organizer:{'@type':'Organization',name:'The Mockingbird on Mill Road',url:'https://themockingbirdonmillroad.com/'},
    url:event.reservation_url||`${pageUrl}#event-${encodeURIComponent(event.id)}`};
   if(event.description)item.description=event.description.slice(0,500);
   if(event.image_url)item.image=[event.image_url];
   if(event.performer)item.performer={'@type':'PerformingGroup',name:event.performer};
   if(event.signup?.free)item.offers={'@type':'Offer',price:'0',priceCurrency:'USD',availability:event.signup.spots_left===0?'https://schema.org/SoldOut':'https://schema.org/InStock',url:item.url};
   return item;
  });
 }
 function injectEventSchema(events){
  const doc=root.document;
  if(!doc?.head||typeof doc.getElementById!=='function')return;
  doc.getElementById('events-schema')?.remove();
  if(!events.length)return;
  const script=doc.createElement('script');script.type='application/ld+json';script.id='events-schema';
  script.textContent=JSON.stringify(eventSchema(events,'https://themockingbirdonmillroad.com/events/'));
  doc.head.appendChild(script);
 }
 function when(event){
  const start=new Date(event.starts_at),end=new Date(event.ends_at);
  const date=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric'});
  const time=new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'});
  const lastDate=date.format(start)===date.format(end)?'':`${date.format(end)} `;
  return `${date.format(start)} · ${time.format(start)}–${lastDate}${time.format(end)} Eastern`;
 }
 let formSequence=0;
 function registrationForm(event){
  const wrap=node('div',null,'event-registration');
  const form=node('form',null,'form-card compact event-registration-form');
  form.action=event.formspree_url;form.method='POST';
  form.appendChild(node('p',event.reservation_url?'Complete your registration to continue to payment. Your seat is confirmed only after payment.':'Submit your registration details. Please contact The Mockingbird to confirm availability.','note'));
  const prefix='event-registration-'+(++formSequence);
  for(const [name,label,type,autocomplete] of [['name','Name','text','name'],['phone','Phone','tel','tel'],['email','Email','email','email']]){
   const labelNode=node('label',label+' (required)');labelNode.setAttribute('for',prefix+'-'+name);
   const field=node('input');field.id=prefix+'-'+name;field.name=name;field.type=type;field.required=true;field.autocomplete=autocomplete;field.maxLength=name==='email'?254:160;
   form.appendChild(labelNode);form.appendChild(field);
  }
  if(event.recording_consent_required){
   const group=node('fieldset',null,'event-registration-consent-fieldset');
   group.appendChild(node('legend','Video Recording Consent (required)','event-registration-section-header'));
   group.appendChild(node('p','This event will be video recorded for documentation and promotional purposes. At times, audience members may appear in the recording to show audience engagement. Guests who choose not to be recorded will have designated seating available outside the filming area.','note event-help'));
   for(const [value,label] of [['CONSENT','I consent to the recording and use of my image, voice, or likeness in connection with this event.'],['OPT_OUT','I opt out of being recorded. I understand that designated seating will be available for guests who do not wish to appear in the recording.']]){
    const option=node('label',null,'event-registration-consent-option'),radio=node('input');
    radio.type='radio';radio.name='recording_consent';radio.value=value;radio.required=true;
    option.appendChild(radio);option.appendChild(node('span',label,'event-registration-consent-label'));group.appendChild(option);
   }
   form.appendChild(group);
  }
  const hidden={event_id:event.id,event_title:event.title,event_date_display:when(event),event_datetime_iso:event.starts_at,registration_deadline:event.registration_deadline,registration_status:'SUBMITTED',payment_status:event.reservation_url?'UNCONFIRMED':'NOT_REQUESTED',payment_url:event.reservation_url,source:'mockingbird_public_event_registration'};
  for(const [name,value] of Object.entries(hidden)){const field=node('input');field.type='hidden';field.name=name;field.value=value;form.appendChild(field);}
  const honeypot=node('input');honeypot.name='_gotcha';honeypot.type='text';honeypot.autocomplete='off';honeypot.tabIndex=-1;honeypot.className='sr-only';honeypot.setAttribute('aria-hidden','true');form.appendChild(honeypot);
  const submit=node('button',event.reservation_url?'Submit and continue to payment':'Submit registration','btn btn-primary');submit.type='submit';form.appendChild(submit);
  const status=node('p',null,'form-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.tabIndex=-1;
  wrap.appendChild(form);wrap.appendChild(status);
  let pending=false,submitted=false;
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(pending||submitted)return;
   if(registrationClosed(event)){status.textContent='Online registration has closed. Please contact The Mockingbird about availability.';submit.disabled=true;return;}
   if(!form.checkValidity()){form.reportValidity();return;}
   pending=true;submit.disabled=true;status.textContent='Sending registration…';
   try{
    const response=await root.fetch(event.formspree_url,{method:'POST',body:new root.FormData(form),headers:{Accept:'application/json'},credentials:'omit',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('Registration unavailable');
    submitted=true;form.hidden=true;form.style.display='none';
    status.textContent=event.reservation_url?'Registration information received. Your spot is not confirmed until payment is completed.':'Registration information received. Please contact The Mockingbird to confirm availability.';
    if(event.reservation_url){const pay=node('a','Continue to payment','btn btn-primary');pay.href=event.reservation_url;pay.target='_blank';pay.rel='noopener noreferrer';wrap.appendChild(pay);}
    status.focus();
   }catch{status.textContent='We could not confirm your submission. Please try again or contact The Mockingbird. Payment has not been processed.';status.focus();}
   finally{pending=false;submit.disabled=submitted;}
  });
  return wrap;
 }
 function render(data,container,preview=false){
  if(!container)return;
  container.replaceChildren();
  if(data.unavailable||!data.events.length){
   const message=node('p',data.unavailable?'Events are temporarily unavailable. Please check back soon.':'New events coming soon.','note');
   message.setAttribute('role','status');container.appendChild(message);return;
  }
  const ordered=data.events.filter(event=>event.pinned).concat(data.events.filter(event=>!event.pinned));
  const grouped=!preview&&ordered.length>=6;
  const seenMonths=new Set();
  if(!preview)injectEventSchema(data.events);
  if(grouped){
   const months=[];
   data.events.filter(event=>!event.pinned).forEach(event=>{const key=monthKey(event);if(!months.some(m=>m.key===key))months.push({key,label:monthLabel(event)});});
   if(months.length>1){
    const nav=node('nav',null,'events-jump');nav.setAttribute('aria-label','Jump to month');
    nav.appendChild(node('span','Jump to:','events-jump-label'));
    months.forEach(month=>{const link=node('a',month.label.replace(/ \d{4}$/,''),'events-jump-link');link.href=`#events-${month.key}`;nav.appendChild(link);});
    container.appendChild(nav);
   }
  }
  (preview?ordered.slice(0,3):ordered).forEach(event=>{
   if(grouped&&!event.pinned){
    const key=monthKey(event);
    if(!seenMonths.has(key)){
     seenMonths.add(key);
     const heading=node('h2',monthLabel(event),'events-month-heading');heading.id=`events-${key}`;heading.tabIndex=-1;container.appendChild(heading);
    }
   }
   const card=node('article',null,(preview?'home-event-card fade-in':'card fade-in')+(event.pinned?' event-pinned':''));
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
   if(event.pinned&&!preview)body.appendChild(node('p',event.signup?.free?'Sign up in advance':'Featured','event-pinned-label'));
   body.appendChild(node('h3',event.title));body.appendChild(node('p',when(event),'note'));
   if(event.performer)body.appendChild(node('p',event.performer));
   if(!preview&&event.image_url){
    const wrap=node('div',null,'event-thumb'),image=node('img'),sized=flyerSources(event.image_url);
    image.alt=event.image_alt;image.loading='lazy';image.decoding='async';
    if(sized){image.srcset=sized.srcset;image.sizes='220px';image.src=sized.src;}else image.src=event.image_url;
    image.addEventListener('error',()=>{
     if(sized&&image.dataset.fallback!=='1'){image.dataset.fallback='1';image.removeAttribute('srcset');image.src=event.image_url;}else wrap.remove();
    });
    wrap.appendChild(image);card.appendChild(wrap);
   }
   if(!preview&&event.description){
    const description=node('p',event.description,'event-description');description.style.whiteSpace='pre-wrap';body.appendChild(description);
    // Long descriptions start folded to a few lines so the list stays easy to scroll on a phone.
    if(event.description.length>240){
     description.className='event-description is-clamped';description.id=`event-description-${event.id}`;
     const more=node('button','Read more','text-button event-more');more.type='button';
     more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls',description.id);
     more.addEventListener('click',()=>{
      const open=description.className.includes('is-clamped');
      description.className=open?'event-description':'event-description is-clamped';
      more.textContent=open?'Show less':'Read more';more.setAttribute('aria-expanded',String(open));
     });
     body.appendChild(more);
    }
   }
   if(event.admission)body.appendChild(node('p',event.admission,'badge'));
   if(!preview&&event.venue_area)body.appendChild(node('p',event.venue_area,'note'));
   if(registrationClosed(event)){
    body.appendChild(node('p','Online registration has closed. Please contact The Mockingbird about availability.','note event-help'));
   }else if(event.registration_mode==='formspree'){
    if(event.registration_deadline)body.appendChild(node('p',`Register by ${event.registration_deadline} at 11:59 PM Eastern.`,'note'));
    if(preview){const link=node('a','Register','btn btn-primary');link.href=(root.Mockingbird?.withBase('/events/')||'/events/')+'#event-'+encodeURIComponent(event.id);body.appendChild(link);}
    else{card.id='event-'+event.id;const details=node('details',null,'event-registration-container');details.appendChild(node('summary','Register','btn btn-primary'));details.appendChild(registrationForm(event));body.appendChild(details);}
   }else if(event.reservation_url){
    const free=event.signup?.free===true,full=free&&event.signup.open&&event.signup.spots_left===0;
    if(free&&event.signup.open&&event.signup.spots_left>0)body.appendChild(node('p',`Free · ${event.signup.spots_left} ${event.signup.spots_left===1?'spot':'spots'} left`,'event-spots'));
    if(full)body.appendChild(node('p','This night is full. Check back in case a spot opens up.','note event-help'));
    const link=node('a',free?(full?'See details':'Sign up free'):event.reservation_required?'Reserve / tickets':'Event details','btn btn-primary');
    link.href=event.reservation_url;link.target='_blank';link.rel='noopener noreferrer';body.appendChild(link);
   }
   if(preview){const link=node('a','View events →','btn btn-secondary');link.href=root.Mockingbird?.withBase('/events/')||'/events/';body.appendChild(link);}
   card.appendChild(body);container.appendChild(card);
  });
 }
 root.MockingbirdPublicEvents={load:createLoader((...args)=>root.fetch(...args)),createLoader,normalizeFeed,safeUrl,safeFormspree,registrationClosed,registrationForm,when,render,flyerSources,eventSchema};
})(typeof window==='undefined'?globalThis:window);
