const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/public-events.js'),'utf8');
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.style={};this.className='';this.textContent='';this.classList={add:()=>{}};this.listeners={};this.valid=true;}
 appendChild(child){this.children.push(child);return child;}
 replaceChildren(...children){this.children=children;}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(name,handler){this.listeners[name]=handler;}
 checkValidity(){return this.valid;}
 reportValidity(){this.reported=true;}
 focus(){this.focused=true;}
 set innerHTML(value){throw new Error(`HTML interpolation is forbidden: ${value}`);}
}
function moduleApi(fetcher=()=>{throw new Error('Unexpected fetch');}){
 const window={document:{createElement:tag=>new Element(tag)},fetch:fetcher,FormData:class {constructor(form){this.form=form;}}};
 vm.runInNewContext(source,{window,URL,AbortSignal,Intl,Date,console});return window.MockingbirdPublicEvents;
}
const event=(patch={})=>({id:'one',title:'Music',event_type:'live_music',starts_at:new Date(Date.now()+3600000).toISOString(),ends_at:new Date(Date.now()+7200000).toISOString(),...patch});
const feed=events=>({schema_version:1,generated_at:new Date().toISOString(),events});
const response=data=>({ok:true,json:async()=>data});
const plain=x=>JSON.parse(JSON.stringify(x));
test('only explicitly disabled configuration uses the legacy calendar',async()=>{
 const api=moduleApi();let calls=0;
 assert.equal(await api.createLoader(async()=>{calls++;return response({enabled:false});})(x=>x),null);assert.equal(calls,1);
 const failure=await api.createLoader(async()=>{throw new Error('offline');})(x=>x);
 assert.equal(failure.source,'command-center');assert.equal(failure.unavailable,true);
});
test('enabled feed loads without credentials; a valid empty feed remains authoritative',async()=>{
 const api=moduleApi(),requests=[];
 const load=api.createLoader(async(url,options)=>{
  requests.push({url,options});return response(requests.length===1?{enabled:true,events_endpoint:'https://example.supabase.co/functions/v1/mockingbird-public-content'}:feed([]));
 });
 const result=await load(p=>'/repo'+p);
 assert.deepEqual(plain(result.events),[]);assert.equal(result.unavailable,undefined);assert.equal(result.source,'command-center');
 assert.equal(requests[0].url,'/repo/data/public-content.json');assert.equal(requests[1].options.credentials,'omit');assert.equal(requests[1].options.cache,'no-store');
});
test('enabled API failures cannot resurrect static events',async()=>{
 const api=moduleApi();let calls=0;
 const result=await api.createLoader(async()=>++calls===1?response({enabled:true,events_endpoint:'https://example.supabase.co/functions/v1/mockingbird-public-content'}):{ok:false})(x=>x);
 assert.equal(result.unavailable,true);assert.deepEqual(plain(result.events),[]);assert.equal(calls,2);
});
test('normalizer rejects stale/malformed feeds, filters completed events, and preserves ongoing events',()=>{
 const api=moduleApi();assert.throws(()=>api.normalizeFeed({schema_version:1,generated_at:'2020-01-01',events:[]}));
 assert.throws(()=>api.normalizeFeed(feed([event({ends_at:'invalid'})])));
 const result=api.normalizeFeed(feed([event({id:'past',starts_at:new Date(Date.now()-7200000).toISOString(),ends_at:new Date(Date.now()-3600000).toISOString()}),event({id:'ongoing',starts_at:new Date(Date.now()-3600000).toISOString()})]));
 assert.deepEqual(plain(result.events.map(x=>x.id)),['ongoing']);
});
test('customer cards render text safely on both surfaces and discard unsafe URLs/private fields',()=>{
 const api=moduleApi();const result=api.normalizeFeed(feed([event({title:'<img src=x onerror=alert(1)>',description:'<script>private attack</script>',image_url:'javascript:alert(1)',reservation_url:'https://example.test/tickets',reservation_required:true,internal_notes:'SECRET'})]));
 assert.equal(result.events[0].image_url,'');assert.equal(result.events[0].internal_notes,undefined);
 for(const preview of [false,true]){
  const container=new Element('div');api.render(result,container,preview);assert.equal(container.children.length,1);
  const body=container.children[0].children.find(x=>x.className==='home-event-details'||x.className==='event-content');assert.equal(body.children.find(x=>x.tagName==='h3').textContent,'<img src=x onerror=alert(1)>');
  const link=body.children.find(x=>x.tagName==='a');assert.equal(link.href,'https://example.test/tickets');assert.equal(link.rel,'noopener noreferrer');
 }
});
test('Eastern event times handle DST regardless of visitor timezone',()=>{
 const api=moduleApi();assert.match(api.when(event({starts_at:'2026-01-10T23:00:00Z',ends_at:'2026-01-11T02:00:00Z'})),/6:00 PM.*9:00 PM Eastern/);
 assert.match(api.when(event({starts_at:'2026-07-10T22:00:00Z',ends_at:'2026-07-11T01:00:00Z'})),/6:00 PM.*9:00 PM Eastern/);
});
test('unavailable and empty calendars display distinct accessible messages',()=>{
 const api=moduleApi();const container=new Element('div');
 api.render({unavailable:true,events:[]},container);assert.match(container.children[0].textContent,/temporarily unavailable/);assert.equal(container.children[0].attributes.role,'status');
 api.render({events:[]},container);assert.match(container.children[0].textContent,/New events/);
});

const registration=(patch={})=>event({registration_mode:'formspree',formspree_url:'https://formspree.io/f/xbddjoek',reservation_url:'https://link.clover.com/urlshortener/gV76BJ',recording_consent_required:true,...patch});
const descendants=element=>[element,...element.children.flatMap(descendants)];
test('registration refuses unsafe submission endpoints and malformed dates',()=>{
 const api=moduleApi();
 for(const url of ['https://evil.test/f/xbddjoek','https://formspree.io.evil.test/f/x','https://formspree.io/f/x?redirect=evil','http://formspree.io/f/x'])assert.throws(()=>api.normalizeFeed(feed([registration({formspree_url:url})])));
 assert.throws(()=>api.normalizeFeed(feed([registration({registration_deadline:'2026-02-30'})])));
 assert.throws(()=>api.normalizeFeed(feed([registration({registration_mode:'unknown'})])));
});
test('deadline stays open through the full Eastern date, including DST',()=>{
 const api=moduleApi();const ev=registration({registration_deadline:'2026-10-11'});
 assert.equal(api.registrationClosed(ev,Date.parse('2026-10-12T03:59:59Z')),false);
 assert.equal(api.registrationClosed(ev,Date.parse('2026-10-12T04:00:00Z')),true);
 assert.equal(api.registrationClosed(registration({registration_deadline:'2026-12-01'}),Date.parse('2026-12-02T04:59:59Z')),false);
});
test('cards require form submission before payment; homepage routes to the event form',()=>{
 const api=moduleApi(),data=api.normalizeFeed(feed([registration()]));
 const full=new Element('div');api.render(data,full);
 const elements=descendants(full);assert.equal(elements.filter(x=>x.tagName==='a').length,0);
 assert.equal(elements.filter(x=>x.name==='recording_consent').length,2);
 const radios=elements.filter(x=>x.name==='recording_consent');assert.ok(radios.every(x=>x.required&&!x.checked));
 const home=new Element('div');api.render(data,home,true);
 const links=descendants(home).filter(x=>x.tagName==='a');assert.equal(links[0].href,'/events/#event-one');
});
test('failed submission keeps details and hides payment, then successful retry reveals unconfirmed payment',async()=>{
 const requests=[];let fail=true;
 const api=moduleApi(async(url,options)=>{requests.push({url,options});return {ok:!fail};});
 const wrap=api.registrationForm(registration()),form=wrap.children[0],status=wrap.children[1];
 const submit=descendants(form).find(x=>x.type==='submit');
 const send=()=>form.listeners.submit({preventDefault(){}});
 form.valid=false;await send();assert.equal(requests.length,0);assert.equal(form.reported,true);
 form.valid=true;await send();assert.equal(form.hidden,undefined);assert.equal(submit.disabled,false);assert.equal(wrap.children.length,2);
 assert.match(status.textContent,/could not confirm/);assert.equal(requests[0].url,'https://formspree.io/f/xbddjoek');
 assert.equal(requests[0].options.headers.Accept,'application/json');assert.equal(requests[0].options.credentials,'omit');
 fail=false;await send();assert.equal(form.hidden,true);assert.match(status.textContent,/not confirmed until payment/);
 assert.equal(wrap.children[2].href,'https://link.clover.com/urlshortener/gV76BJ');
 await send();assert.equal(requests.length,2);
});
test('pending submits cannot duplicate and expired forms never submit',async()=>{
 let finish,calls=0;const api=moduleApi(()=>{calls++;return new Promise(resolve=>{finish=resolve;});});
 const wrap=api.registrationForm(registration()),form=wrap.children[0];
 const send=()=>form.listeners.submit({preventDefault(){}});
 const pending=send();await send();assert.equal(calls,1);finish({ok:true});await pending;
 const closed=api.registrationForm(registration({registration_deadline:'2020-01-01'}));
 await closed.children[0].listeners.submit({preventDefault(){}});assert.equal(calls,1);assert.match(closed.children[1].textContent,/closed/);
});
test('free registration and no recording consent omit payment and recording fields',async()=>{
 const api=moduleApi(async()=>({ok:true}));const wrap=api.registrationForm(registration({reservation_url:'',recording_consent_required:false}));
 assert.equal(descendants(wrap).filter(x=>x.name==='recording_consent').length,0);
 await wrap.children[0].listeners.submit({preventDefault(){}});assert.equal(wrap.children.length,2);assert.match(wrap.children[1].textContent,/received/);
});
