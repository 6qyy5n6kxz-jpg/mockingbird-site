// Search basics: every listed page has the right canonical link, hidden pages stay out of the sitemap,
// and the home page business listing matches data/site.json.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ORIGIN='https://themockingbirdonmillroad.com';
const fileFor=u=>u.endsWith('.html')?u.slice(1):`${u.slice(1)}index.html`;
const sitemap=[...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replace(ORIGIN,''));

test('every sitemap page exists, has its own canonical link and a full title, and is indexable',()=>{
 assert.ok(sitemap.includes('/private-parties/estimate/'));
 for(const url of sitemap){
  const html=read(fileFor(url));
  assert.match(html,new RegExp(`<link rel="canonical" href="${ORIGIN}${url.replace(/[.]/g,'[.]')}">`),url);
  assert.match(html,/<title>[^<]*The Mockingbird[^<]*<\/title>/,url);
  assert.doesNotMatch(html,/name="robots" content="noindex"/,url);
  assert.match(html,/<meta name="description" content="[^"]{50,}"/,url);
 }
});
test('past fundraiser forms and the retired reserve page are hidden from search and the sitemap',()=>{
 for(const url of ['/reserve-date/','/donate-item/','/sponsor/','/public/mock-jam-sponsor.html','/jam/','/auction/']){
  assert.equal(sitemap.includes(url),false,url);
 }
 for(const f of ['reserve-date/index.html','donate-item/index.html','sponsor/index.html','public/mock-jam-sponsor.html','404.html']){
  assert.match(read(f),/<meta name="robots" content="noindex">/,f);
 }
 const reserve=read('reserve-date/index.html');
 assert.doesNotMatch(reserve,/clover|due the day of your event|mailto/i);
 assert.match(reserve,/private-parties\/estimate\//);
});
test('home page business listing matches site.json',()=>{
 const site=JSON.parse(read('data/site.json'));
 const block=read('index.html').match(/<script type="application\/ld\+json" id="localbusiness-schema">([\s\S]*?)<\/script>/);
 assert.ok(block,'structured data present');
 const data=JSON.parse(block[1]);
 assert.equal(data.name,site.name);
 assert.equal(data.telephone.replace(/\D/g,'').slice(-10),site.phone.replace(/\D/g,''));
 assert.equal(data.address.streetAddress,site.address.line1);assert.equal(data.address.postalCode,site.address.zip);
 const days={Sunday:'Sun',Monday:'Mon',Tuesday:'Tue',Wednesday:'Wed',Thursday:'Thu',Friday:'Fri',Saturday:'Sat'};
 const fmt=t=>{const [h,m]=t.split(':').map(Number);return `${h%12||12}${m?':'+String(m).padStart(2,'0'):''}`;};
 const fromSchema=Object.fromEntries(data.openingHoursSpecification.map(s=>[days[s.dayOfWeek.split('/').pop()],`${fmt(s.opens)}–${fmt(s.closes)} PM`]));
 for(const row of site.hours){
  if(/closed/i.test(row.value))assert.equal(fromSchema[row.label],undefined,row.label);
  else assert.equal(fromSchema[row.label],row.value,`${row.label} hours in index.html structured data are out of date`);
 }
});
test('gallery photos have phone-sized copies with matching sizes',()=>{
 const site=JSON.parse(read('data/site.json'));
 for(const image of site.images.gallery){
  assert.ok(image.thumb&&fs.existsSync(path.join(root,image.thumb)),image.src);
  assert.ok(image.width>0&&image.height>0,image.src);
 }
});
