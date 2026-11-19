const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../drinks/index.html'),'utf8');
const drinks=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/drinks.json'),'utf8'));
const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/public-drinks.js'),'utf8'),{window,URL,AbortSignal,Date});
const {drinkKey,trimFlavorGuide}=window.MockingbirdPublicDrinks;
const unescape=s=>s.replace(/&amp;/g,'&');
const guide=html.slice(html.indexOf('data-flavor-guide-section'),html.indexOf('</section>',html.indexOf('data-flavor-guide-section')));
const named=section=>[...section.matchAll(/<strong data-drink>([^<]+)<\/strong>/g)].map(m=>unescape(m[1]));
// Which drinks list sub-section (Whites/Rosé, Reds, IPAs, Beer, …) a drink is listed under.
const sectionOf=name=>{for(const s of drinks.sections)for(const sub of s.subsections||[])
 for(const item of sub.items||[])if(drinkKey(item.name)===drinkKey(name))return `${s.title} ${sub.title||''}`;return null;};

test('every drink the "If you like… try…" guide names is on the current drinks list',()=>{
 const names=named(guide);
 assert.ok(names.length>=10,'guide names drinks');
 assert.deepEqual(names.filter(n=>!sectionOf(n)),[],'remove or update these suggestions: they are not on data/drinks.json');
});

test('each suggestion is its own sentence, so a drink that sells out hides only its own sentence',()=>{
 const cards=[...guide.matchAll(/<article class="card" data-flavor-guide>([\s\S]*?)<\/article>/g)].map(m=>m[1]);
 assert.ok(cards.length>=10);
 for(const card of cards){
  assert.match(card,/<span data-suggest>/,'every card has suggestions');
  assert.deepEqual(named(card.replace(/<span data-suggest>[\s\S]*?<\/span>/g,'')),[],'every named drink sits inside a suggestion');
 }
});

test('beer and seltzer cards only suggest beer, seltzers and cans; wine-for-beer-drinkers is its own group',()=>{
 const section=guide.slice(guide.indexOf('Beer, seltzers &amp; more'),guide.indexOf('Usually a beer drinker?'));
 for(const name of named(section))assert.doesNotMatch(sectionOf(name),/White|Ros|Red|Flights/,`${name} is a wine`);
 for(const name of named(guide.slice(guide.indexOf('Usually a beer drinker?'))))assert.match(sectionOf(name),/Flights/,`${name} is not a wine pour`);
});

test('names match despite accents, curly apostrophes and case, but not misspellings',()=>{
 assert.equal(drinkKey('Żywiec Porter'),drinkKey('Zywiec porter'));
 assert.equal(drinkKey('Voulet Malvasia d’Asti'),drinkKey("Voulet Malvasia d'Asti"));
 assert.equal(drinkKey('Bell’s Two Hearted'),drinkKey("Bell's Two Hearted"));
 assert.notEqual(drinkKey('Pinot Grigio'),drinkKey('Pinot Griogio'));
});

// A tiny stand-in for the page: elements with attributes, text and children.
function el(attr,children=[],text=''){return {attr,children,hidden:false,get textContent(){return text+children.map(c=>c.textContent).join('');},
 querySelectorAll(sel){const a=sel.slice(1,-1);const out=[];const walk=n=>n.children.forEach(c=>{if(a in c.attr)out.push(c);walk(c);});walk(this);return out;},
 querySelector(sel){return this.querySelectorAll(sel)[0]||null;}};}
const drink=name=>el({'data-drink':''},[],name);
const suggest=(...names)=>el({'data-suggest':''},names.map(drink));

test('suggestions, cards and groups for drinks not on the list are hidden; nothing hides without a list',()=>{
 const ipa=el({'data-flavor-guide':''},[suggest('Gone IPA'),suggest('Hazy One')]);
 const gone=el({'data-flavor-guide':''},[suggest('Gone Seltzer')]);
 const pair=el({'data-flavor-guide':''},[suggest('Hazy One','Gone Cider')]);
 const beer=el({'data-flavor-group':''},[ipa,gone,pair]);
 const allGone=el({'data-flavor-group':''},[el({'data-flavor-guide':''},[suggest('Gone Wine')])]);
 const section=el({'data-flavor-guide-section':''},[beer,allGone]);
 const doc=el({},[section]);
 trimFlavorGuide(doc,{sections:[]});
 assert.equal(section.querySelectorAll('[data-suggest]').some(s=>s.hidden),false);
 trimFlavorGuide(doc,{sections:[{subsections:[{items:[{name:'HAZY ONE'}]}]}]});
 assert.deepEqual(ipa.children.map(s=>s.hidden),[true,false]);
 assert.equal(ipa.hidden,false);
 assert.equal(gone.hidden,true);
 assert.equal(pair.hidden,true,'a sentence naming two drinks needs both');
 assert.equal(beer.hidden,false);
 assert.equal(allGone.hidden,true);
 assert.equal(section.hidden,false);
 trimFlavorGuide(doc,{sections:[{subsections:[{items:[{name:'Something Else'}]}]}]});
 assert.equal(section.hidden,true);
});
