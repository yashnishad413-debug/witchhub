/* app.js: all site logic. Needs js/supabase.js loaded first (SB_URL, SB_KEY, SB, ssGet, ssPut, ssTok, sbAuth, sbq, upImg). */
(()=>{
'use strict';
/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const inr=n=>'₹'+Number(n).toLocaleString('en-IN');
const fdate=t=>new Date(t).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
const ftime=t=>new Date(t).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const ico=n=>'<svg class="ico" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
const safeUrl=u=>/^(https?:\/\/|assets\/)/i.test(String(u||'').trim())?String(u).trim():'';
let toastT;
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),3200)}
async function hash(pw,salt){
  try{ if(crypto&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+pw));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');} }catch(e){}
  let h=5381;const s=salt+':'+pw;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return 'w'+(h>>>0).toString(16);
}

/* ---------- data store (localStorage; Supabase schema in /supabase.sql for the live version) ---------- */
const KEY='orchestrator.site.v2';
const STATUSES=['Received','Reviewing','Quote sent','In progress','Delivered'];
const DEFAULTS={v:1,
  settings:{name:'Rumii',role:'AI Orchestrator',tagline:'Ideas in. Working products out.',
    sub:'I direct AI to design, build and ship your product, then test every piece before it reaches you.',
    bio:'I am an AI orchestrator. I turn ideas into working products by directing AI tools, checking every result and shipping only what holds up. Clear briefs in, tested products out.',
    email:''},
  services:[
   {id:'synthesis',name:'AI Product Synthesis',short:'Tell me what you want to build',
    blurb:'Bring me a request to build anything with AI. We start with a consultation, agree on what to make, and then I direct the AI to build it, test it and ship it.',
    outcomes:['A consultation to shape the idea and the scope','A written plan: what gets built, in what order, at what price','A tested first version you can use and show'],
    audience:'Founders, small teams and creators with an idea that needs AI to become real.',
    proof:'Hana Sensei and Lumen, both taken from idea to version 2 in production.',
    tiers:[{name:'Consultation',price:1999,from:false,note:'A call and a written plan of what to build.'},{name:'Prototype',price:24999,from:true,note:'A clickable first version, scoped after the consultation.'},{name:'Full build',price:59999,from:true,note:'A working product, priced after the consultation.'}]},
   {id:'knowledge',name:'Bespoke Knowledge Engines',short:'A chat that answers from your content',
    blurb:'You have hundreds of pages of PDFs, course videos or internal wikis. I structure that messy material and build a RAG (retrieval-augmented generation) system with a chat interface. Your audience or team asks questions and the AI answers only from your own knowledge, so it does not make things up.',
    outcomes:['Your documents, videos and notes cleaned and structured','A RAG system built on your content only','A chat interface where people ask questions and get grounded answers'],
    audience:'Course creators, life coaches, boutique consultants and clinics who want an interactive AI tutor or an internal search tool for their audience or team.',
    proof:'GenAI Forward Deployed Engineer certification, RAG and vector database skills, and the AI tutor logic behind Hana Sensei.',
    tiers:[{name:'Starter',price:29999,from:false,note:'One set of documents and one hosted chat page.'},{name:'Pro',price:59999,from:false,note:'Several sources, including video transcripts, embedded on your site.'},{name:'Custom',price:99999,from:true,note:'Internal search for a team, with access control.'}]},
   {id:'canopy',name:'Canopy',short:'Websites for small businesses',
    blurb:'Fast, good-looking websites for small businesses, built with AI-assisted development, tested on real phones and deployed live.',
    outcomes:['Your requirements gathered directly from you','A responsive site tested on phone and desktop','Hosting set up and launched, with a handover'],
    audience:'Small businesses that need a clean, fast web presence without hiring a developer.',
    proof:'w3bwerk, live on Netlify, and client websites live on Hostinger.',
    tiers:[{name:'Starter',price:9999,from:false,note:'One-page site with up to five sections.'},{name:'Pro',price:24999,from:false,note:'Multi-page site with forms and a content admin.'},{name:'Custom',price:49999,from:true,note:'Web app with accounts and dashboards.'}]}
  ],
  skills:[
   {id:'g1',name:'AI orchestration',items:['Prompt engineering','Agent design','Spec writing','Output testing','Structured outputs','MCP']},
   {id:'g2',name:'GenAI engineering',items:['LLMs','RAG','Vector databases','Embeddings','Python','FastAPI','SQL']},
   {id:'g3',name:'Shipping',items:['Netlify','Hostinger','Docker','Git and GitHub','AI-assisted development with Claude']}
  ],
  projects:[
   {id:'p1',title:'w3bwerk',tag:'Website studio',status:'Live on Netlify',link:'assets/w3bwerk/index.html',embed:'assets/w3bwerk/index.html',image:'',
    summary:'A fast, responsive website built with AI-assisted development and deployed to Netlify. Version 2 is in production.'},
   {id:'p2',title:'Hana Sensei',tag:'AI learning platform',status:'Version 2 in production',link:'',embed:'',image:'',
    summary:'A JLPT N5 and N4 learning platform with spaced-repetition flashcards, mock exams, an AI tutor and voice lessons, shipped as one self-contained app.'},
   {id:'p3',title:'Lumen',tag:'macOS app',status:'Version 2 in production',link:'',embed:'',image:'',
    summary:'A Mac app for custom wallpapers, widgets and menu-bar controls, with several design styles to choose from.'},
   {id:'p4',title:'Client websites',tag:'Freelance',status:'Live on Hostinger',link:'',embed:'',image:'',
    summary:'Websites for private clients, from requirements to launch, with hosting set up and one point of contact.'},
   {id:'p5',title:'MoonCat',tag:'macOS app',status:'Open source on GitHub',link:'https://github.com/yashnishad413-debug/mooncat',embed:'',image:'',
    summary:'A native macOS menu bar cat built in Swift and AppKit. It stores, searches and converts your files (244 conversions), locks private items in an encrypted vault, and has optional AI chat that can manage the Treasure Box.'}
  ],
  users:[],requests:[],adminSalt:null,adminHash:null,session:{userId:null}
};
let db=load();
function clone(o){return JSON.parse(JSON.stringify(o))}
function load(){try{const r=JSON.parse(localStorage.getItem(KEY));if(r&&r.settings&&r.settings.name==='Your Name')r.settings.name='Rumii';if(r&&r.v===1)return Object.assign(clone(DEFAULTS),r)}catch(e){}return clone(DEFAULTS)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}}
let adminAuthed=false;
try{adminAuthed=sessionStorage.getItem('orch.admin')==='1'}catch(e){}
const svcById=id=>db.services.find(s=>s.id===id);
let cloudMsg='',cSig={};
const sbPublish=()=>sbq('a','site_content',{m:'POST',h:{Prefer:'resolution=merge-duplicates'},b:{id:'main',data:{settings:db.settings,services:db.services,skills:db.skills,projects:db.projects}}});
async function sbLoadContent(){if(!SB()||ssGet('a'))return;try{const d=(await sbq(null,'site_content?id=eq.main&select=data'))[0];if(d&&d.data&&d.data.settings){['settings','services','skills','projects'].forEach(k=>{if(d.data[k])db[k]=d.data[k]});renderHome()}}catch(x){}}
function mapReqs(rows){return rows.map(x=>{const d=x.data||{},id='c:'+x.user_id;if(!db.users.find(u=>u.id===id))db.users.push({id,name:d.name||'Client',email:d.email||'',salt:'',hash:'',created:0});return{id:x.id,userId:id,svc:d.svc,tier:+d.tier||0,brief:d.brief||'',budget:d.budget||'',deadline:d.deadline||'',status:x.status,created:Date.parse(x.created_at),messages:(x.messages||[]).slice().sort((p,q)=>p.created_at<q.created_at?-1:1).map(m=>({from:m.from_admin?'admin':'client',text:m.text,at:Date.parse(m.created_at)}))}})}
async function cloudSync(role){if(!SB()||!ssGet(role))return false;const m=mapReqs(await sbq(role,'requests?select=*,messages(*)&order=created_at.desc')),sig=JSON.stringify(m),ch=sig!==cSig[role];cSig[role]=sig;db.requests=m;save();return ch}
async function tickOnce(){if(!SB()||document.hidden)return;const h=location.hash,busy=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('form');try{if(h.startsWith('#/admin')&&ssGet('a')){if(await cloudSync('a')&&!busy)renderAdmin()}else if(h.startsWith('#/account')&&ssGet('c')){if(await cloudSync('c')&&!busy)renderAccount()}}catch(x){}}
setInterval(tickOnce,15000);addEventListener('hashchange',()=>setTimeout(tickOnce,300));
function cloudHTML(){if(!SB())return '<div class="card stack"><h2>Cloud is not connected yet</h2><p>Paste your Supabase URL and key into SB_URL and SB_KEY near the top of the script in index.html. The README has the steps.</p></div>';
  const li=!!ssGet('a'),m=cloudMsg?'<p class="fine">'+esc(cloudMsg)+'</p>':'';
  return li?'<div class="card stack"><h2>Cloud</h2><p>Publish sends your text, services, skills and projects to every visitor. Client requests, replies and status changes sync on their own about every 15 seconds.</p><div class="rowline" style="gap:12px"><button class="btn" type="button" data-act="cloud-pub">Publish site to visitors</button><button class="btn ghost sm" type="button" data-act="cloud-inbox">Refresh requests</button><button class="btn ghost sm" type="button" data-act="cloud-out">Sign out</button></div>'+m+'</div>'
  :'<form class="card stack" data-form="cloud-login" style="max-width:520px"><h2>Admin sign in</h2><p>Sign in once to read client requests and publish your site.</p><div class="field"><label for="c-e">Email</label><input id="c-e" name="email" type="email" required></div><div class="field"><label for="c-p">Password</label><input id="c-p" name="password" type="password" required></div><div><button class="btn" type="submit">Sign in</button></div>'+m+'</form>'}
function notify(form,data){try{fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(Object.assign({'form-name':form},data)).toString()}).catch(()=>{})}catch(x){}}
const COPY=[['navProcess','Menu: first link','.nav-links a:nth-child(1)'],['navServices','Menu: second link','.nav-links a:nth-child(2)'],['navSkills','Menu: third link','.nav-links a:nth-child(3)'],['navWork','Menu: fourth link','.nav-links a:nth-child(4)'],['navStart','Menu: main button','.nav-actions .btn'],
['eyebrow','Hero: small line above the headline','.copy .eyebrow'],['heroBtn1','Hero: main button','.cta-row .btn:not(.ghost)'],['heroBtn2','Hero: second button','.cta-row .btn.ghost'],['cue','Hero: scroll hint','.cue span'],['marquee','Moving banner (separate words with the star)','.mq span'],
['procH','Process: heading','.process-sticky h2'],['procLead','Process: intro','.process-sticky .lead'],
['st1h','Step 1 title','.steps .step:nth-child(1) h3'],['st1p','Step 1 text','.steps .step:nth-child(1) p'],['st2h','Step 2 title','.steps .step:nth-child(2) h3'],['st2p','Step 2 text','.steps .step:nth-child(2) p'],['st3h','Step 3 title','.steps .step:nth-child(3) h3'],['st3p','Step 3 text','.steps .step:nth-child(3) p'],['st4h','Step 4 title','.steps .step:nth-child(4) h3'],['st4p','Step 4 text','.steps .step:nth-child(4) p'],
['noteH','Services side card: title','.svc-note strong'],['noteP','Services side card: text','.svc-note p'],['noteBtn','Services side card: button','.svc-note .btn'],
['skH','Skills: heading','#sk-h'],['wkH','Work: heading','#wk-h'],['voH','Kind words: heading','#vo-h'],['faqH','Questions: heading','#faq-h'],['abH','About: heading','#ab-h'],
['ctaH','Bottom block: title','.cta-block h2'],['ctaP','Bottom block: text','.cta-block p'],['ctaBtn','Bottom block: button','.cta-block .btn'],
['ft1','Footer: link 1','footer nav>:nth-child(1)'],['ft2','Footer: link 2','footer nav>:nth-child(2)'],['ft3','Footer: link 3','footer nav>:nth-child(3)'],['ft4','Footer: link 4','footer nav>:nth-child(4)'],['ft5','Footer: link 5','footer nav>:nth-child(5)'],['ft6','Footer: link 6','footer nav>:nth-child(6)'],['ft7','Footer: link 7','footer nav>:nth-child(7)'],['ft8','Footer: link 8','footer nav>:nth-child(8)']];
const UI=[['lblIncluded','Service panel: "Included" label','Included'],['lblOpen','Service panel: open button','Open full details'],['lblHide','Service panel: close button','Hide full details'],['lblWho','Service panel: who it is for','Who it is for'],['lblWhat','Service panel: what I do','What I do'],['lblProof','Service panel: proof','Proof'],['lblPricing','Service panel: pricing','Pricing'],['lblChoose','Plan button start (then plan name)','Choose'],['lblFine','Pricing note','Prices are in Indian rupees. The final quote comes after I read your brief.'],['lblBook','Button: book a call','Book a call'],['lblWa','Button: WhatsApp','Chat on WhatsApp'],['lblUpi','Button: pay by UPI','Pay by UPI']];
const COPY_DEF={},U=k=>{const c=db.settings.copy||{};return k in c?c[k]:UI.find(x=>x[0]===k)[2]};
const fmt=t=>esc(t).replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/\{(.+?)\}/g,'<small>$1</small>');
const unfmt=h=>h.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<em>(.*?)<\/em>/g,'*$1*').replace(/<small>(.*?)<\/small>/g,'{$1}').replace(/<[^>]+>/g,'').replace(/&#10022;/g,'\u2726').replace(/&copy;/g,'\u00a9').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
function applyCopy(){const c=db.settings.copy||{};COPY.forEach(([k,l,sel])=>{const els=$$(sel);if(!els.length)return;if(!(k in COPY_DEF))COPY_DEF[k]=unfmt(els[0].innerHTML);const v=k in c?c[k]:COPY_DEF[k];els.forEach(el=>{if(k==='marquee')el.innerHTML=v.split('\u2726').map(x=>x.trim()).filter(Boolean).map(x=>esc(x)+' <b>&#10022;</b> ').join('');else{const sv=el.querySelector(':scope>svg');el.innerHTML=fmt(v)+(sv?' '+sv.outerHTML:'')}})});
  const r=document.documentElement.style,IM={imgHero:'--img-hero',imgHeroM:'--img-hero-m',imgCta:'--img-cta',imgSky:'--img-sky',imgBg:'--img-bg'};
  Object.keys(IM).forEach(k=>{const u=safeUrl(db.settings[k]);u?r.setProperty(IM[k],'url("'+u+'")'):r.removeProperty(IM[k])});
  const ai=$('.about-art img');if(ai)ai.src=safeUrl(db.settings.imgAbout)||'assets/about.webp'}
const upBtn=id=>'<label class="btn sm ghost cp-up">Upload picture<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-up="'+id+'"></label>';
document.addEventListener('change',async e=>{const inp=e.target.closest&&e.target.closest('[data-up]');if(!inp||!inp.files[0])return;const t=document.getElementById(inp.dataset.up),lab=inp.parentElement,old=lab.firstChild.textContent;lab.firstChild.textContent='Uploading...';
  try{t.value=await upImg(inp.files[0]);t.dispatchEvent(new Event('input',{bubbles:true}));toast('Picture uploaded. Press Save to use it.')}catch(x){toast(x.message)}lab.firstChild.textContent=old;inp.value=''});
let cpGroup='hero';
const CPG=[['hero','Menu and hero',['navProcess','navServices','navSkills','navWork','navStart','eyebrow','heroBtn1','heroBtn2','cue','marquee']],['process','Process',['procH','procLead','st1h','st1p','st2h','st2p','st3h','st3p','st4h','st4p']],['services','Services',['noteH','noteP','noteBtn','lblIncluded','lblOpen','lblHide','lblWho','lblWhat','lblProof','lblPricing','lblChoose','lblFine']],['sections','Headings',['skH','wkH','voH','faqH','abH']],['bottom','Bottom and footer',['ctaH','ctaP','ctaBtn','ft1','ft2','ft3','ft4','ft5','ft6','ft7','ft8']],['buttons','Contact buttons',['lblBook','lblWa','lblUpi']],['pics','Pictures',null],['legal','Privacy and Terms',null]];
const IMGS=[['imgHero','Hero, computer','assets/hero.jpg'],['imgHeroM','Hero, phone','assets/hero-mobile.webp'],['imgAbout','About','assets/about.webp'],['imgCta','Bottom block','assets/cta.webp'],['imgSky','Footer skyline','assets/skyline.webp'],['imgBg','Sign in and Admin background','assets/bg.webp']];
function copyHTML(){const c=db.settings.copy||{},s=db.settings,all=[...COPY,...UI];
  const rs=k=>'<button type="button" class="cp-reset" data-act="cp-reset" data-k="'+k+'">Original</button>';
  const field=k=>{const x=all.find(y=>y[0]===k),d=(k in COPY_DEF)?COPY_DEF[k]:(x[2]||''),v=k in c?c[k]:d,wide=v.length>60||k==='marquee',id='cp-'+k;
    return '<div class="cp-f'+(wide?' wide':'')+'"><label for="'+id+'"><span>'+esc(x[1])+'</span>'+rs(k)+'</label>'+(wide?'<textarea id="'+id+'" name="'+k+'" data-def="'+esc(d)+'" style="min-height:92px">'+esc(v)+'</textarea>':'<input id="'+id+'" name="'+k+'" data-def="'+esc(d)+'" value="'+esc(v)+'">')+'</div>'};
  const pic=x=>'<div class="cp-f cp-thumb" data-thumb="'+x[2]+'"><label for="cp-'+x[0]+'"><span>'+esc(x[1])+'</span>'+rs(x[0])+'</label><img src="'+esc(safeUrl(s[x[0]])||x[2])+'" alt=""><input id="cp-'+x[0]+'" name="'+x[0]+'" data-def="" value="'+esc(s[x[0]]||'')+'" placeholder="'+x[2]+'"><div class="rowline">'+upBtn('cp-'+x[0])+'</div></div>';
  const lg=(k,l,t)=>'<div class="cp-f wide"><label for="cp-'+k+'"><span>'+l+'</span>'+rs(k)+'</label><textarea id="cp-'+k+'" name="'+k+'" data-def="'+esc(t)+'" style="min-height:260px">'+esc(s[k]||t)+'</textarea></div>';
  const panel=g=>g[2]?'<div class="cp-grid">'+g[2].map(field).join('')+'</div>':g[0]==='pics'?'<p class="fine">Press Upload picture to choose a file from your computer or phone (sign in under Cloud and inbox first). Empty uses the original picture. Tip: keep faces in the right half of the hero picture, because the text sits on the left.</p><div class="cp-grid">'+IMGS.map(pic).join('')+'</div>':'<p class="fine">One paragraph per line. {n} becomes your name and {e} your email.</p><div class="cp-grid">'+lg('legalPrivacy','Privacy policy',LEGAL.privacy[1].join('\n'))+lg('legalTerms','Terms of service',LEGAL.terms[1].join('\n'))+'</div>';
  return '<form class="cp" data-form="copy"><div><h2>All text and pictures</h2><p>Pick a part of the site, change the wording, then press Save. Use *word* for gold italic and {word} for the small italic line.</p></div>'
   +'<div class="cp-nav" role="group" aria-label="Parts of the site">'+CPG.map(g=>'<button type="button" data-act="cp-group" data-g="'+g[0]+'" aria-pressed="'+(g[0]===cpGroup)+'">'+g[1]+'</button>').join('')+'</div>'
   +CPG.map(g=>'<div data-cpg="'+g[0]+'"'+(g[0]===cpGroup?'':' hidden')+'>'+panel(g)+'</div>').join('')
   +'<div class="cp-bar"><span class="cp-state">All changes saved</span><button class="btn" type="submit">Save changes</button></div></form>'}
const FAQ_D="How long does a project take? | A one-page site usually takes about a week. Larger builds are scoped after I read your brief.\nHow does pricing work? | Each service lists starting prices in rupees. After I read your brief I send a fixed quote, so there are no surprises.\nHow do I pay? | By UPI or bank transfer. A part payment starts the work and the rest is due on handover, as set out in your quote.\nDo I own what you build? | Yes. Once the final payment is made, the code, designs and content are yours.\nWhat if something breaks after launch? | Tell me and I will look at it. Support terms are written into each quote.";
const kv=t=>String(t||'').split('\n').map(l=>{const i=l.indexOf('|');return i>0?[l.slice(0,i).trim(),l.slice(i+1).trim()]:null}).filter(Boolean);
function renderExtras(){applyCopy();const s=db.settings,nm=s.name||'',faq=kv(s.faq!=null?s.faq:FAQ_D),vo=kv(s.testi);
  $('#faqList').innerHTML=faq.map(a=>'<details class="qa"><summary>'+esc(a[0])+'</summary><p>'+esc(a[1])+'</p></details>').join('');
  $('#voiceGrid').innerHTML=vo.map(a=>'<figure class="voice"><blockquote>'+esc(a[1])+'</blockquote><figcaption>'+esc(a[0])+'</figcaption></figure>').join('');
  $('#voices').hidden=!vo.length;
  const wa=String(s.whatsapp||'').replace(/\D/g,''),bk=safeUrl(s.bookingUrl),up=/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(s.upiId||'')?s.upiId:'',L=[];
  if(bk)L.push('<a class="btn sm" href="'+esc(bk)+'" target="_blank" rel="noopener"'+esc(U('lblBook'))+'</a>');
  if(wa)L.push('<a class="btn sm ghost" href="https://wa.me/'+wa+'?text='+encodeURIComponent('Hi '+nm+', I would like to talk about a project.')+'" target="_blank" rel="noopener"'+esc(U('lblWa'))+'</a>');
  if(up)L.push('<a class="btn sm ghost" href="upi://pay?pa='+encodeURIComponent(up)+'&pn='+encodeURIComponent(nm)+'&cu=INR"'+esc(U('lblUpi'))+'</a>');
  $('#talkRow').innerHTML=L.join('');$('#faq').hidden=!faq.length&&!L.length;
  const w=$('#waBtn');w.textContent=U('lblWa');w.hidden=!wa;if(wa)w.href='https://wa.me/'+wa}
const LEGAL={privacy:['Privacy policy',['This site is run by {n}. Questions about your data: {e}.','What I collect: your name and email when you create an account, and the details, messages and files you send with a project request.','Why: only to answer you, quote, build and deliver your project.','Where it goes: requests may be stored in this site\'s database and forwarded to me by email through the hosting provider. In browser-only preview mode they stay in your own browser.','I do not sell your data or use it for advertising. This site sets no tracking cookies; it uses your browser\'s local storage to keep you signed in and to remember your requests.','You can ask me to see, correct or delete your data at any time by emailing {e}.']],
 terms:['Terms of service',['These terms cover work done by {n}.','Quotes: after I read your brief I send a fixed quote. Work starts when you accept it and pay the part payment named in it.','Payment: amounts, due dates and the final payment on handover are as written in your quote. Prices on the site are starting prices in Indian rupees.','Ownership: once the final payment has cleared, the code, designs and content made for you are yours. Third-party tools and licences stay with their owners.','Changes: the quote says how many rounds of changes are included. Extra work is quoted separately.','Your part: you give me the content, access and feedback I need in good time. Delays on your side can move the delivery date.','Liability: I will build with care and test before handover, but I am not liable for indirect losses. My total liability is limited to the amount you paid for the project.','These terms are governed by the laws of India.']]};
document.addEventListener('click',e=>{const b=e.target.closest('[data-legal]'),d=$('#legal');if(b){const L=LEGAL[b.dataset.legal],n=db.settings.name||'the site owner',m=db.settings.email||'the email shown on this site';const cu=db.settings[b.dataset.legal==='privacy'?'legalPrivacy':'legalTerms'],ps=cu?cu.split('\n').map(x=>x.trim()).filter(Boolean):L[1];$('#legalBody').innerHTML='<h2>'+L[0]+'</h2>'+ps.map(t=>'<p>'+esc(t.replace('{n}',n).replace('{e}',m))+'</p>').join('')+'<p class="fine">General template, not legal advice. Have it checked before you rely on it.</p>';d.showModal()}else if(e.target.closest('[data-legal-close]')||e.target===d)d.close()});
const me=()=>db.users.find(u=>u.id===db.session.userId)||null;

/* ---------- home rendering ---------- */
let activeSvc='synthesis';
const SVC_T='Choose your spell. Three ways to put AI to work.',SVC_L='Pick a service, compare the plans, and request the one that fits. I send a fixed quote once I have read your brief.';
const SVC_ART={synthesis:'svc-synthesis.webp',knowledge:'svc-knowledge.webp',canopy:'svc-canopy.webp'};
function renderHome(){
  const s=db.settings;
  $$('[data-bind]:not(#heroTitle)').forEach(el=>{const k=el.dataset.bind;if(s[k]!=null)el.textContent=s[k]});
  document.title=(s.name&&s.name!=='Your Name'?s.name+' | ':'')+s.role+' | '+s.tagline;
  $('#yr').textContent=new Date().getFullYear();
  const sh=$('#svc-h');sh.textContent='';String(s.svcTitle||SVC_T).split(/(?<=[.!?])\s+/).forEach((p,i)=>{if(i===1){const em=document.createElement('em');em.textContent=' '+p;sh.appendChild(em)}else sh.appendChild(document.createTextNode((i?' ':'')+p))});
  $('#svcLead').textContent=s.svcLead||SVC_L;
  renderExtras();
  const cl=$('#contactLine');if(s.email){cl.hidden=false;cl.innerHTML='Email: <a href="mailto:'+esc(s.email)+'">'+esc(s.email)+'</a>'}else cl.hidden=true;
  const hs=['\u2726','\u263D','\u2727'];
  $('#hcards').innerHTML=db.services.map((v,i)=>'<a class="hcard" href="#services" data-svc="'+esc(v.id)+'"'+(SVC_ART[v.id]?' style="--art:url(assets/'+SVC_ART[v.id]+')"':'')+'><i aria-hidden="true">'+hs[i%3]+'</i><strong>'+esc(v.name)+'</strong><span>'+esc(v.short)+'</span></a>').join('');
  const ht=$('#heroTitle'),parts=String(s.tagline||'').split(/(?<=[.!?])\s+/);
  ht.textContent='';parts.forEach((p,i)=>{if(i===1){const em=document.createElement('em');em.textContent=' '+p;ht.appendChild(em)}else ht.appendChild(document.createTextNode((i?' ':'')+p))});
  // services
  $('#svcTabs').innerHTML=db.services.map(v=>'<button class="tab" role="tab" type="button" id="tab-'+esc(v.id)+'" aria-controls="panel-'+esc(v.id)+'" aria-selected="'+(v.id===activeSvc)+'" data-svc="'+esc(v.id)+'" tabindex="'+(v.id===activeSvc?0:-1)+'"><strong>'+esc(v.name)+'</strong><span>'+esc(v.short)+'</span></button>').join('');
  $('#svcPanels').innerHTML=db.services.map(v=>{const im=safeUrl(v.image)||(SVC_ART[v.id]?'assets/'+SVC_ART[v.id]:'');
    return '<div class="panel" role="tabpanel" id="panel-'+esc(v.id)+'" aria-labelledby="tab-'+esc(v.id)+'" '+(v.id===activeSvc?'':'hidden')+'>'
    +(im?'<div class="svc-art" role="img" aria-label="'+esc(v.name)+' illustration" style="background-image:url(\''+esc(im)+'\')"></div>':'')
    +'<div class="p-head"><h3>'+esc(v.name)+'</h3>'+(v.short?'<p class="short">'+esc(v.short)+'</p>':'')+'</div>'
    +'<div class="inc"><h4>'+esc(U('lblIncluded'))+'</h4><ul class="outs">'+v.outcomes.map(o=>'<li>'+ico('check')+'<span>'+esc(o)+'</span></li>').join('')+'</ul></div>'
    +'<button class="btn sm more-btn" type="button" data-more="'+esc(v.id)+'" aria-expanded="false" aria-controls="more-'+esc(v.id)+'" data-lo="'+esc(U('lblOpen'))+'" data-lh="'+esc(U('lblHide'))+'"><span>'+esc(U('lblOpen'))+'</span>'+ico('arrow')+'</button>'
    +'<div class="more" id="more-'+esc(v.id)+'"><div class="more-in" inert><div class="dgrid"><div><h4>'+esc(U('lblWho'))+'</h4><p>'+esc(v.audience||'Add this in Admin, Services.')+'</p></div><div><h4>'+esc(U('lblWhat'))+'</h4><p>'+esc(v.blurb)+'</p></div>'+(v.proof?'<div><h4>'+esc(U('lblProof'))+'</h4><p>'+esc(v.proof)+'</p></div>':'')+'</div>'
    +'<div><h4>'+esc(U('lblPricing'))+'</h4><div class="tiers">'+v.tiers.map((t,i)=>'<div class="tier'+(i===1?' mid':'')+'"><h4>'+esc(t.name)+'</h4><div class="price">'+(t.from?'<small>from</small>':'')+(t.price!=null&&t.price!==''?inr(t.price):'Quote')+'</div><p>'+esc(t.note)+'</p><a class="btn sm'+(i===1?'':' ghost')+'" href="#/account/new" data-plan="'+esc(v.id)+'|'+i+'">'+esc(U('lblChoose'))+' '+esc(t.name)+'</a></div>').join('')+'</div></div>'
    +'<p class="fine">'+esc(U('lblFine'))+'</p></div></div></div>'}).join('');
  // skills
  $('#skillsGrid').innerHTML=db.skills.map(g=>'<div class="sk rv"><h3>'+esc(g.name)+'</h3><div class="chips">'+g.items.map(i=>'<span class="chip">'+esc(i)+'</span>').join('')+'</div></div>').join('');
  // work
  $('#workGrid').innerHTML=db.projects.map((p,i)=>{
    const link=safeUrl(p.link),emb=safeUrl(p.embed),img=safeUrl(p.image);
    const media=emb?'<div class="embed"><iframe src="'+esc(emb)+'" title="'+esc(p.title)+' website preview" loading="lazy" tabindex="-1" aria-hidden="true" sandbox="allow-scripts allow-same-origin"></iframe></div>'
      :img?'<div class="cover" role="img" aria-label="'+esc(p.title)+'" style="background-image:url(\''+esc(img)+'\')"></div>':'';
    const feat=!!media&&i===0;
    return '<article class="proj'+(feat?' feature':'')+' rv">'+media+'<div class="body"><div class="meta">'+esc(p.tag)+(p.status?'<br>'+esc(p.status):'')+'</div><h3>'+esc(p.title)+'</h3><p>'+esc(p.summary)+'</p>'
      +(link?'<a class="btn ghost sm" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">'+(/^https:\/\/github\.com\//i.test(link)?'View on GitHub ':'Open site ')+ico('arrow')+'</a>':'')+'</div></article>';
  }).join('')||'<div class="empty"><img src="assets/emblem.png" alt="" width="110" height="106"><h3>No projects yet</h3><p>Add your first project from the admin panel.</p></div>';
  fitEmbeds();
  observeReveals();
  updateNavAccount();
}
let embedRO;
function fitEmbeds(){
  const fit=el=>{const f=$('iframe',el);if(!f)return;const sc=el.clientWidth/1440;f.style.transform='scale('+sc+')';f.style.height=(el.clientHeight/sc)+'px'};
  if(!embedRO&&'ResizeObserver' in window)embedRO=new ResizeObserver(es=>es.forEach(e=>fit(e.target)));
  $$('.embed').forEach(el=>{fit(el);if(embedRO)embedRO.observe(el)});
}
function updateNavAccount(){const u=me();$('#navAccount').textContent=u?'My account':'Sign in'}
let io;
function observeReveals(){
  if(reduce||!('IntersectionObserver' in window)){$$('.rv').forEach(e=>e.classList.add('in'));return}
  if(!io)io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -8% 0px',threshold:.08});
  $$('.rv:not(.in)').forEach((e,i)=>{if(!e.dataset.o){e.dataset.o=1;io.observe(e)}});
}
function selectSvc(id,focus){
  activeSvc=id;
  $$('#svcTabs .tab').forEach(t=>{const on=t.dataset.svc===id;t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1;if(on&&focus)t.focus()});
  $$('#svcPanels .panel').forEach(p=>p.hidden=p.id!=='panel-'+id);
}

const navEl=$('#nav');
const sentinel=document.createElement('div');sentinel.style.cssText='position:absolute;top:80px;height:1px;width:1px';document.body.prepend(sentinel);
if('IntersectionObserver' in window)new IntersectionObserver(es=>navEl.classList.toggle('scrolled',!es[0].isIntersecting)).observe(sentinel);

/* ---------- router ---------- */
function route(){
  const h=location.hash||'';
  const isAcc=h.startsWith('#/account'),isAdm=h.startsWith('#/admin');
  $('#view-home').hidden=isAcc||isAdm;$('#view-account').hidden=!isAcc;$('#view-admin').hidden=!isAdm;
  navEl.classList.toggle('scrolled',isAcc||isAdm);
  if(isAcc){renderAccount(h.includes('/new')?'new':null);window.scrollTo(0,0)}
  else if(isAdm){renderAdmin();window.scrollTo(0,0)}
  else if(prevView!=='home'){const t=h.length>1&&!h.startsWith('#/')?document.getElementById(h.slice(1)):null;setTimeout(()=>t?t.scrollIntoView():window.scrollTo(0,0),30)}
  prevView=isAcc?'acc':isAdm?'adm':'home';
}
let prevView='home';

/* ---------- client account ---------- */
let accTab='requests',authMode='in',pendingPlan=null,openReq=null;
function renderAccount(forceTab){
  const root=$('#accountRoot');const u=me();
  if(forceTab)accTab=forceTab;
  if(!u){
    root.innerHTML='<div class="auth stack"><div class="panel-head" style="display:block;text-align:center"><h1>Client account</h1><p>Sign in to request a plan and follow your project.</p></div>'
     +'<div class="ptabs" role="tablist" aria-label="Account access"><button class="ptab" role="tab" type="button" data-act="auth-mode" data-mode="in" aria-selected="'+(authMode==='in')+'">Sign in</button><button class="ptab" role="tab" type="button" data-act="auth-mode" data-mode="up" aria-selected="'+(authMode==='up')+'">Create account</button></div>'
     +'<form class="card stack" data-form="auth" novalidate>'
     +(authMode==='up'?'<div class="field"><label for="a-name">Your name</label><input id="a-name" name="name" autocomplete="name" required><div class="err" data-err="name" role="alert"></div></div>':'')
     +'<div class="field"><label for="a-email">Email</label><input id="a-email" name="email" type="email" autocomplete="email" required><div class="err" data-err="email" role="alert"></div></div>'
     +'<div class="field"><label for="a-pw">Password</label><input id="a-pw" name="password" type="password" autocomplete="'+(authMode==='up'?'new-password':'current-password')+'" required><div class="help">'+(authMode==='up'?'At least 8 characters.':'The password you used to sign up.')+'</div><div class="err" data-err="password" role="alert"></div></div>'
     +'<button class="btn" type="submit">'+(authMode==='up'?'Create account':'Sign in')+'</button></form>'
     +(pendingPlan?'<p class="fine" style="text-align:center">Your selected plan is saved. Sign in to continue.</p>':'')+'</div>';
    return;
  }
  const mine=db.requests.filter(r=>r.userId===u.id).sort((a,b)=>b.created-a.created);
  let body='';
  if(accTab==='requests'){
    body=mine.length?'<div class="stack">'+mine.map(r=>reqCard(r,false)).join('')+'</div>'
      :'<div class="empty"><h3>No requests yet</h3><p>Pick a service and plan, describe what you need, and I will reply with scope and a fixed quote.</p><button class="btn" type="button" data-act="acc-tab" data-tab="new">New request</button></div>';
  }else if(accTab==='new'){
    const pp=pendingPlan||{};const sv=svcById(pp.svc)||db.services[0];
    body='<form class="card stack" data-form="request" novalidate style="max-width:760px"><h2>New request</h2>'
     +'<div class="grid2"><div class="field"><label for="r-svc">Service</label><select id="r-svc" name="svc" data-change="req-svc">'+db.services.map(v=>'<option value="'+esc(v.id)+'"'+(v.id===sv.id?' selected':'')+'>'+esc(v.name)+'</option>').join('')+'</select></div>'
     +'<div class="field"><label for="r-tier">Plan</label><select id="r-tier" name="tier">'+sv.tiers.map((t,i)=>'<option value="'+i+'"'+(String(pp.tier)===String(i)?' selected':'')+'>'+esc(t.name)+' ('+(t.from?'from ':'')+inr(t.price)+')</option>').join('')+'</select></div></div>'
     +'<div class="field"><label for="r-brief">What should we build?</label><textarea id="r-brief" name="brief" required></textarea><div class="help">Describe the goal, who it is for and anything you already have. At least 20 characters.</div><div class="err" data-err="brief" role="alert"></div></div>'
     +'<div class="grid2"><div class="field"><label for="r-budget">Budget (optional)</label><input id="r-budget" name="budget" placeholder="For example 25,000 rupees"></div><div class="field"><label for="r-date">Wanted by (optional)</label><input id="r-date" name="deadline" type="date"></div></div>'
     +'<div aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden"><input name="website" type="text" tabindex="-1" autocomplete="off"></div>'
     +'<div><button class="btn" type="submit">Send request '+ico('send')+'</button></div></form>';
  }else{
    body='<div class="stack">'+db.services.map(v=>'<div class="card"><h2>'+esc(v.name)+'</h2><p style="color:var(--ink-2)">'+esc(v.blurb)+'</p><div class="rowline" style="margin-top:14px">'+v.tiers.map((t,i)=>'<button class="btn ghost sm" type="button" data-act="pick-plan" data-svc="'+esc(v.id)+'" data-tier="'+i+'">'+esc(t.name)+' '+(t.from?'from ':'')+inr(t.price)+'</button>').join('')+'</div></div>').join('')
     +'<div class="card"><h2>Work so far</h2><div class="stack" style="gap:10px">'+db.projects.map(p=>'<div><strong>'+esc(p.title)+'</strong> <span class="fine">'+esc(p.tag)+(p.status?', '+esc(p.status):'')+'</span><p style="color:var(--ink-2);font-size:16px">'+esc(p.summary)+'</p></div>').join('')+'</div></div></div>';
  }
  root.innerHTML='<div class="panel-head"><div><h1>Hello, '+esc(u.name.split(' ')[0])+'</h1><p>Track your requests and message me from here.</p></div><button class="btn ghost sm" type="button" data-act="signout">Sign out</button></div>'
    +'<div class="ptabs" role="tablist" aria-label="Account sections">'+[['requests','My requests'],['new','New request'],['browse','Services and work']].map(t=>'<button class="ptab" role="tab" type="button" data-act="acc-tab" data-tab="'+t[0]+'" aria-selected="'+(accTab===t[0])+'">'+t[1]+'</button>').join('')+'</div>'+body;
}
function reqCard(r,admin){
  const sv=svcById(r.svc)||{name:r.svc,tiers:[]};const t=sv.tiers[r.tier]||{name:''};
  const stepper='<ol class="stepper" aria-label="Status">'+STATUSES.map((s,i)=>'<li class="'+(i<=r.status?'on':'')+'"'+(i===r.status?' aria-current="step"':'')+'>'+esc(s)+'</li>').join('')+'</ol>';
  const msgs=(r.messages||[]).length?'<div class="msgs" tabindex="0" aria-label="Messages">'+r.messages.map(m=>'<div class="msg '+m.from+'">'+esc(m.text)+'<small>'+(m.from==='admin'?'Reply':'You')+', '+ftime(m.at)+'</small></div>').join('')+'</div>':'';
  return '<article class="card req"><div class="req-top"><h3>'+esc(sv.name)+' '+esc(t.name)+'</h3><span class="badge'+(r.status===4?' done':'')+'">'+esc(STATUSES[r.status])+'</span></div>'
   +stepper+'<p style="color:var(--ink-2);white-space:pre-wrap;overflow-wrap:anywhere">'+esc(r.brief)+'</p><p class="fine">Sent '+fdate(r.created)+(r.budget?', budget '+esc(r.budget):'')+(r.deadline?', wanted by '+esc(r.deadline):'')+'</p>'
   +msgs+'<form class="reply" data-form="reply" data-id="'+esc(r.id)+'"><label class="sr" for="m-'+esc(r.id)+'">Message</label><input id="m-'+esc(r.id)+'" name="text" placeholder="Write a message" maxlength="1000" required><button class="btn sm" type="submit">Send</button></form></article>';
}

/* ---------- admin ---------- */
let admTab='requests',admReq=null,admErr='',admFilter='all';
function renderAdmin(){
  const root=$('#adminRoot');
  if(!db.adminHash){
    root.innerHTML='<div class="auth stack"><div class="panel-head" style="display:block;text-align:center"><h1>Set up admin</h1><p>Choose a passcode to protect this admin panel.</p></div><form class="card stack" data-form="admin-setup" novalidate><div class="field"><label for="ad-pw">Passcode</label><input id="ad-pw" name="pw" type="password" autocomplete="new-password" required><div class="help">At least 8 characters. Keep it safe, it cannot be recovered.</div><div class="err" data-err="pw" role="alert"></div></div><button class="btn" type="submit">Create passcode</button></form>'
      +'<div class="note">This preview stores data in this browser only. For a live site where visitors see your edits, connect Supabase using the included setup file.</div></div>';
    return;
  }
  if(!adminAuthed){
    root.innerHTML='<div class="auth stack"><div class="panel-head" style="display:block;text-align:center"><h1>Admin</h1><p>Enter your passcode.</p></div><form class="card stack" data-form="admin-login" novalidate><div class="field"><label for="ad-pw">Passcode</label><input id="ad-pw" name="pw" type="password" autocomplete="current-password" required><div class="err" data-err="pw" role="alert"></div></div><button class="btn" type="submit">Open admin</button></form></div>';
    return;
  }
  const newCount=db.requests.filter(r=>r.status===0).length;
  const tabs=[['requests','Requests'],['projects','Projects'],['skills','Skills'],['services','Services and pricing'],['settings','Site text'],['copy','All text and pictures'],['cloud','Cloud and inbox'],['data','Backup']];
  let body='';
  if(admTab==='requests'){
    const f=admFilter,all=db.requests.slice().sort((a,b)=>b.created-a.created);
    const list=f==='new'?all.filter(r=>r.status===0):f==='prog'?all.filter(r=>r.status===3):f.startsWith('u:')?all.filter(r=>r.userId===f.slice(2)):all;
    const cur=list.find(r=>r.id===admReq)||list[0];
    const st=(k,n,l)=>'<button class="stat" type="button" data-act="adm-filter" data-f="'+k+'" aria-pressed="'+(f===k||(k==='all'&&f.startsWith('u:')))+'"><b>'+n+'</b><span>'+l+'</span></button>';
    body='<div class="stats">'+st('all',db.requests.length,'Total requests')+st('new',newCount,'Waiting for review')+st('prog',db.requests.filter(r=>r.status===3).length,'In progress')+st('clients',db.users.length,'Client accounts')+'</div>';
    const un=f.startsWith('u:')?db.users.find(x=>x.id===f.slice(2)):null;
    const ttl=f==='clients'?'Client accounts':f==='new'?'Waiting for review':f==='prog'?'In progress':un?'Requests from '+un.name:'All requests';
    body+='<div class="view-h"><h2>'+esc(ttl)+'<span class="count">'+(f==='clients'?db.users.length:list.length)+'</span></h2>'+(f!=='all'?'<button class="btn ghost sm" type="button" data-act="adm-filter" data-f="all">Show all requests</button>':'')+'</div>';
    if(f==='clients'){
      body+='<div class="clients">'+(db.users.length?db.users.map(u=>{const n=all.filter(r=>r.userId===u.id).length;return '<div class="card client"><div><strong>'+esc(u.name)+'</strong><small>'+esc(u.email)+'</small></div><div class="client-n"><b>'+n+'</b><span>request'+(n===1?'':'s')+'</span></div><div class="rowline"><button class="btn sm ghost" type="button" data-act="adm-filter" data-f="u:'+esc(u.id)+'">View requests</button>'+(u.email?'<a class="btn sm ghost" href="mailto:'+esc(u.email)+'">Email</a>':'')+'</div></div>'}).join(''):'<div class="empty"><h3>No client accounts yet</h3><p>Clients appear here once they sign up and send a request.</p></div>')+'</div>';
    }else body+=list.length?'<div class="admin-split"><div class="list" role="list">'+list.map(r=>{const u=db.users.find(x=>x.id===r.userId)||{name:'Unknown'};const sv=svcById(r.svc)||{name:r.svc};return '<button class="item" type="button" data-act="adm-req" data-id="'+esc(r.id)+'" aria-current="'+(cur&&cur.id===r.id)+'"><strong>'+esc(u.name)+'</strong><small>'+esc(sv.name)+', '+esc(STATUSES[r.status])+'</small></button>'}).join('')+'</div>'
      +'<div class="card stack">'+admReqDetail(cur)+'</div></div>'
      :'<div class="empty"><h3>'+(all.length?'Nothing in this view':'No requests yet')+'</h3><p>'+(all.length?'No requests match this filter. Tap Total requests to see them all.':'When a client sends a request it appears here, and you can change its status and reply.')+'</p></div>';
  }else if(admTab==='projects'){
    const ed=db.projects.find(p=>p.id===admEdit)||null;
    body='<div class="admin-split"><div class="list">'+db.projects.map(p=>'<div class="item" style="cursor:default"><strong>'+esc(p.title)+'</strong><small>'+esc(p.tag)+'</small><div class="rowline" style="margin-top:8px"><button class="btn ghost sm" type="button" data-act="proj-edit" data-id="'+esc(p.id)+'">Edit</button><button class="btn danger sm" type="button" data-act="proj-del" data-id="'+esc(p.id)+'">Delete</button></div></div>').join('')+(db.projects.length?'':'<div class="empty"><h3>No projects</h3><p>Add one with the form.</p></div>')+'</div>'
      +'<form class="card stack" data-form="project" data-id="'+esc(ed?ed.id:'')+'" novalidate><h2>'+(ed?'Edit project':'Add a project')+'</h2>'
      +'<div class="grid2"><div class="field"><label for="p-title">Title</label><input id="p-title" name="title" value="'+esc(ed?ed.title:'')+'" required><div class="err" data-err="title" role="alert"></div></div><div class="field"><label for="p-tag">Type</label><input id="p-tag" name="tag" value="'+esc(ed?ed.tag:'')+'" placeholder="For example Mobile app"></div></div>'
      +'<div class="grid2"><div class="field"><label for="p-status">Status</label><input id="p-status" name="status" value="'+esc(ed?ed.status:'')+'" placeholder="For example Live on Netlify"></div><div class="field"><label for="p-link">Link (optional)</label><input id="p-link" name="link" value="'+esc(ed?ed.link:'')+'" placeholder="https:// or assets/"><div class="err" data-err="link" role="alert"></div></div></div>'
      +'<div class="field"><label for="p-sum">Summary</label><textarea id="p-sum" name="summary" required>'+esc(ed?ed.summary:'')+'</textarea><div class="err" data-err="summary" role="alert"></div></div>'
      +'<div class="field"><label for="p-embed">Website preview page (optional)</label><input id="p-embed" name="embed" value="'+esc(ed?ed.embed:'')+'" placeholder="assets/your-site/index.html or https://"><div class="help">Shows a live preview of this page on the card. Leave empty for a text-only card.</div></div>'
      +'<div class="field"><label for="p-image">Image address (optional)</label><input id="p-image" name="image" value="'+esc(ed?ed.image:'')+'" placeholder="Upload below, or paste an address"><div class="rowline">'+upBtn('p-image')+'</div><div class="help">Used only if there is no preview page.</div></div>'
      +'<div class="rowline"><button class="btn" type="submit">'+(ed?'Save changes':'Add project')+'</button>'+(ed?'<button class="btn ghost" type="button" data-act="proj-new">Cancel</button>':'')+'</div></form></div>';
  }else if(admTab==='skills'){
    body='<div class="stack">'+db.skills.map(g=>'<div class="card stack"><div class="rowline" style="justify-content:space-between"><h2>'+esc(g.name)+'</h2><button class="btn danger sm" type="button" data-act="sk-delgroup" data-id="'+esc(g.id)+'">Delete group</button></div><div class="chips">'+g.items.map((it,i)=>'<span class="chip">'+esc(it)+' <button type="button" class="link" style="text-decoration:none" aria-label="Remove '+esc(it)+'" data-act="sk-del" data-id="'+esc(g.id)+'" data-i="'+i+'">'+ico('plus').replace('class="ico"','class="ico" style="transform:rotate(45deg)"')+'</button></span>').join('')+'</div>'
      +'<form class="reply" data-form="skill" data-id="'+esc(g.id)+'"><label class="sr" for="s-'+esc(g.id)+'">New skill</label><input id="s-'+esc(g.id)+'" name="skill" placeholder="Add a skill" maxlength="60" required><button class="btn sm" type="submit">Add</button></form></div>').join('')
      +'<form class="card reply" data-form="skillgroup"><label class="sr" for="sg-name">New group</label><input id="sg-name" name="name" placeholder="New skill group name" maxlength="40" required><button class="btn sm" type="submit">Add group</button></form></div>';
  }else if(admTab==='services'){
    body='<div class="stack"><div><button class="btn sm" type="button" data-act="svc-add">Add a service</button></div>'+db.services.map(v=>'<form class="card stack" data-form="service" data-id="'+esc(v.id)+'"><h2>'+esc(v.name)+'</h2>'
      +'<div class="grid2"><div class="field"><label for="v-name-'+v.id+'">Name</label><input id="v-name-'+v.id+'" name="name" value="'+esc(v.name)+'" required></div><div class="field"><label for="v-short-'+v.id+'">Short label</label><input id="v-short-'+v.id+'" name="short" value="'+esc(v.short)+'"></div></div>'
      +'<div class="field"><label for="v-blurb-'+v.id+'">Description</label><textarea id="v-blurb-'+v.id+'" name="blurb">'+esc(v.blurb)+'</textarea></div>'
      +'<div class="field"><label for="v-aud-'+v.id+'">Who it is for</label><textarea id="v-aud-'+v.id+'" name="audience" style="min-height:80px">'+esc(v.audience||'')+'</textarea></div><div class="field"><label for="v-proof-'+v.id+'">Proof</label><textarea id="v-proof-'+v.id+'" name="proof" style="min-height:80px">'+esc(v.proof||'')+'</textarea></div>'
      +'<div class="field"><label for="v-out-'+v.id+'">What the client gets (one per line)</label><textarea id="v-out-'+v.id+'" name="outcomes">'+esc(v.outcomes.join('\n'))+'</textarea></div>'
      +'<div class="field"><label for="v-img-'+v.id+'">Picture address (optional)</label><input id="v-img-'+v.id+'" name="image" value="'+esc(v.image||'')+'" placeholder="Upload below, or paste an address"><div class="rowline">'+upBtn('v-img-'+v.id)+'</div></div>'
      +'<div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">'+v.tiers.map((t,i)=>'<div class="stack" style="gap:10px"><div class="field"><label for="t-'+v.id+i+'-n">Plan '+(i+1)+' name</label><input id="t-'+v.id+i+'-n" name="tn'+i+'" value="'+esc(t.name)+'"></div><div class="field"><label for="t-'+v.id+i+'-p">Price in rupees</label><input id="t-'+v.id+i+'-p" name="tp'+i+'" inputmode="numeric" value="'+esc(t.price)+'"></div><div class="field"><label for="t-'+v.id+i+'-f">Price style</label><select id="t-'+v.id+i+'-f" name="tf'+i+'"><option value="0"'+(t.from?'':' selected')+'>Fixed</option><option value="1"'+(t.from?' selected':'')+'>From</option></select></div><div class="field"><label for="t-'+v.id+i+'-d">Note</label><input id="t-'+v.id+i+'-d" name="td'+i+'" value="'+esc(t.note)+'"></div></div>').join('')+'</div>'
      +'<div class="rowline" style="gap:12px"><button class="btn" type="submit">Save '+esc(v.name)+'</button><button class="btn danger sm" type="button" data-act="svc-del" data-id="'+esc(v.id)+'">Delete service</button></div></form>').join('')+'</div>';
  }else if(admTab==='copy'){
    body=copyHTML();
  }else if(admTab==='cloud'){
    body=cloudHTML();
  }else if(admTab==='settings'){
    const s=db.settings;
    body='<form class="card stack" data-form="settings" style="max-width:760px"><div class="grid2"><div class="field"><label for="s-name">Your name</label><input id="s-name" name="name" value="'+esc(s.name)+'"></div><div class="field"><label for="s-role">Role label</label><input id="s-role" name="role" value="'+esc(s.role)+'"></div></div>'
      +'<div class="field"><label for="s-tag">Hero headline</label><input id="s-tag" name="tagline" value="'+esc(s.tagline)+'"></div><div class="field"><label for="s-sub">Hero sentence</label><textarea id="s-sub" name="sub" style="min-height:80px">'+esc(s.sub)+'</textarea><div class="help">Keep it to one sentence of about 20 words.</div></div>'
      +'<div class="field"><label for="s-bio">About text</label><textarea id="s-bio" name="bio">'+esc(s.bio)+'</textarea></div><div class="field"><label for="s-svct">Services heading</label><input id="s-svct" name="svcTitle" value="'+esc(s.svcTitle||SVC_T)+'"><div class="help">The second sentence shows in gold.</div></div><div class="field"><label for="s-svcl">Services intro</label><textarea id="s-svcl" name="svcLead" style="min-height:80px">'+esc(s.svcLead||SVC_L)+'</textarea></div><div class="field"><label for="s-wa">WhatsApp number (country code, digits only)</label><input id="s-wa" name="whatsapp" value="'+esc(s.whatsapp||'')+'" placeholder="919876543210"></div><div class="field"><label for="s-bk">Booking link (Cal.com or similar)</label><input id="s-bk" name="bookingUrl" value="'+esc(s.bookingUrl||'')+'" placeholder="https://cal.com/your-name"></div><div class="field"><label for="s-upi">UPI ID for payments</label><input id="s-upi" name="upiId" value="'+esc(s.upiId||'')+'" placeholder="name@bank"></div><div class="field"><label for="s-faq">Questions and answers</label><textarea id="s-faq" name="faq" style="min-height:170px">'+esc(s.faq!=null?s.faq:FAQ_D)+'</textarea><div class="help">One per line: Question | Answer</div></div><div class="field"><label for="s-testi">Kind words from clients</label><textarea id="s-testi" name="testi" style="min-height:110px">'+esc(s.testi||'')+'</textarea><div class="help">One per line: Name, role | What they said. Only add real ones. Empty hides the section.</div></div><div class="field"><label for="s-email">Public email (optional)</label><input id="s-email" name="email" type="email" value="'+esc(s.email)+'"></div><div><button class="btn" type="submit">Save site text</button></div></form>';
  }else{
    body='<div class="stack" style="max-width:760px"><div class="card stack"><h2>Backup your content</h2><p style="color:var(--ink-2)">Download your site content (text, services, skills, projects) as a file, or restore from one.</p><div class="rowline"><button class="btn" type="button" data-act="export">Download backup</button><label class="btn ghost" style="cursor:pointer" for="imp">Restore from file</label><input id="imp" class="sr" type="file" accept="application/json" data-change="import"></div></div>'
      +'<div class="card stack"><h2>Reset</h2><p style="color:var(--ink-2)">Restore the starter content. Client accounts and requests are kept.</p><div><button class="btn danger" type="button" data-act="reset">Reset site content</button></div></div>'
      +'<div class="card stack"><h2>Session</h2><button class="btn ghost" type="button" data-act="adm-out" style="width:fit-content">Lock admin</button></div>'
      +'<div class="note">Data in this preview lives in this browser only. A live site that every visitor and client shares needs the Supabase setup described in the README.</div></div>';
  }
  root.innerHTML='<div class="panel-head"><div><h1>Admin</h1><p>Edit what the site shows and manage client requests.</p></div><a class="btn ghost sm" href="#top">View site</a></div>'
    +'<div class="ptabs" role="tablist" aria-label="Admin sections">'+tabs.map(t=>'<button class="ptab" role="tab" type="button" data-act="adm-tab" data-tab="'+t[0]+'" aria-selected="'+(admTab===t[0])+'">'+t[1]+(t[0]==='requests'&&newCount?' ('+newCount+')':'')+'</button>').join('')+'</div>'+body;
}
let admEdit=null;
function admReqDetail(r){
  if(!r)return '';
  const u=db.users.find(x=>x.id===r.userId)||{name:'Unknown',email:''};const sv=svcById(r.svc)||{name:r.svc,tiers:[]};const t=sv.tiers[r.tier]||{name:''};
  return '<div class="req-top"><h2>'+esc(u.name)+'</h2><span class="badge'+(r.status===4?' done':'')+'">'+esc(STATUSES[r.status])+'</span></div><p class="fine"><a href="mailto:'+esc(u.email)+'">'+esc(u.email)+'</a>, sent '+fdate(r.created)+'</p>'
   +'<p><strong>'+esc(sv.name)+' '+esc(t.name)+'</strong>'+(r.budget?', budget '+esc(r.budget):'')+(r.deadline?', wanted by '+esc(r.deadline):'')+'</p><p style="color:var(--ink-2);white-space:pre-wrap;overflow-wrap:anywhere">'+esc(r.brief)+'</p>'
   +'<div class="field"><label for="st-'+esc(r.id)+'">Status</label><select id="st-'+esc(r.id)+'" data-change="status" data-id="'+esc(r.id)+'">'+STATUSES.map((s,i)=>'<option value="'+i+'"'+(i===r.status?' selected':'')+'>'+s+'</option>').join('')+'</select></div>'
   +((r.messages||[]).length?'<div class="msgs" tabindex="0" aria-label="Messages">'+r.messages.map(m=>'<div class="msg '+(m.from==='admin'?'client':'admin')+'">'+esc(m.text)+'<small>'+(m.from==='admin'?'You':esc(u.name))+', '+ftime(m.at)+'</small></div>').join('')+'</div>':'')
   +'<form class="reply" data-form="adm-reply" data-id="'+esc(r.id)+'"><label class="sr" for="ar-'+esc(r.id)+'">Reply</label><input id="ar-'+esc(r.id)+'" name="text" placeholder="Reply to client" maxlength="1000" required><button class="btn sm" type="submit">Send</button></form>'
   +'<div><button class="btn danger sm" type="button" data-act="req-del" data-id="'+esc(r.id)+'">Delete request</button></div>';
}

/* ---------- events ---------- */
function setErr(form,k,m){const e=$('[data-err="'+k+'"]',form);if(e)e.textContent=m;const i=form.elements[k];if(i){i.setAttribute('aria-invalid','true');if(m)i.focus()}}
function clearErr(form){$$('[data-err]',form).forEach(e=>e.textContent='');$$('[aria-invalid]',form).forEach(e=>e.removeAttribute('aria-invalid'))}

document.addEventListener('click',e=>{
  const plan=e.target.closest('[data-plan]');
  if(plan){const [s,t]=plan.dataset.plan.split('|');pendingPlan={svc:s,tier:t};try{sessionStorage.setItem('orch.plan',JSON.stringify(pendingPlan))}catch(x){}accTab='new';return}
  const sv=e.target.closest('[data-svc]');
  if(sv&&sv.closest('.hcard,#svcTabs')){selectSvc(sv.dataset.svc,false);return}
  const a=e.target.closest('[data-act]');if(!a)return;
  const act=a.dataset.act,d=a.dataset;
  switch(act){
   case 'auth-mode':authMode=d.mode;renderAccount();break;
   case 'acc-tab':accTab=d.tab;renderAccount();break;
   case 'signout':db.session.userId=null;if(SB()){localStorage.removeItem('orch.s.c');cSig.c='';db.requests=[]}save();accTab='requests';renderAccount();updateNavAccount();toast('Signed out');break;
   case 'pick-plan':pendingPlan={svc:d.svc,tier:d.tier};accTab='new';renderAccount();break;
   case 'adm-tab':if(d.tab==='requests'&&SB()&&ssGet('a'))cloudSync('a').then(c=>{if(c)renderAdmin()}).catch(()=>{});admTab=d.tab;if(admTab!=='projects')admEdit=null;renderAdmin();break;
   case 'adm-filter':admFilter=d.f;admReq=null;renderAdmin();break;
   case 'cp-group':cpGroup=d.g;$$('[data-cpg]').forEach(x=>{x.hidden=x.dataset.cpg!==d.g});$$('[data-act="cp-group"]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.g===d.g));break;
   case 'cp-reset':{const i=document.getElementById('cp-'+d.k);if(i){i.value=i.dataset.def||'';i.dispatchEvent(new Event('input',{bubbles:true}))}break}
   case 'adm-req':admReq=d.id;renderAdmin();break;
   case 'adm-out':adminAuthed=false;try{sessionStorage.removeItem('orch.admin')}catch(x){}renderAdmin();break;
   case 'proj-edit':admEdit=d.id;renderAdmin();$('#p-title')&&$('#p-title').focus();break;
   case 'proj-new':admEdit=null;renderAdmin();break;
   case 'proj-del':if(confirm('Delete this project?')){db.projects=db.projects.filter(p=>p.id!==d.id);save();admEdit=null;renderAdmin();renderHome();toast('Project deleted')}break;
   case 'sk-del':{const g=db.skills.find(x=>x.id===d.id);if(g){g.items.splice(+d.i,1);save();renderAdmin();renderHome()}break}
   case 'cloud-pub':sbPublish().then(()=>{cloudMsg='Published. Visitors now see your changes.';renderAdmin()}).catch(x=>{cloudMsg=x.message;renderAdmin()});break;
   case 'cloud-inbox':cloudSync('a').then(()=>{cloudMsg='Requests refreshed.';renderAdmin()}).catch(x=>{cloudMsg=x.message;renderAdmin()});break;
   case 'cloud-out':localStorage.removeItem('orch.s.a');cSig.a='';renderAdmin();break;
   case 'svc-add':{const n={id:uid(),name:'New service',short:'A short line about it',blurb:'Describe what you do in this service.',audience:'',proof:'',outcomes:['First thing the client gets'],tiers:[{name:'Starter',price:0,from:false,note:''},{name:'Pro',price:0,from:false,note:''},{name:'Custom',price:0,from:true,note:''}]};db.services.push(n);activeSvc=n.id;save();renderAdmin();renderHome();break}
   case 'svc-del':if(db.services.length>1&&confirm('Delete this service?')){db.services=db.services.filter(x=>x.id!==d.id);if(activeSvc===d.id)activeSvc=db.services[0].id;save();renderAdmin();renderHome()}break;
   case 'sk-delgroup':if(confirm('Delete this skill group?')){db.skills=db.skills.filter(x=>x.id!==d.id);save();renderAdmin();renderHome()}break;
   case 'req-del':if(confirm('Delete this request?')){if(SB()&&ssGet('a'))sbq('a','requests?id=eq.'+encodeURIComponent(d.id),{m:'DELETE'}).catch(()=>toast('Could not delete in the cloud'));db.requests=db.requests.filter(r=>r.id!==d.id);save();admReq=null;renderAdmin();toast('Request deleted')}break;
   case 'export':{const out={v:1,settings:db.settings,services:db.services,skills:db.skills,projects:db.projects};const b=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});const l=document.createElement('a');l.href=URL.createObjectURL(b);l.download='site-content.json';document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(l.href),2000);break}
   case 'reset':if(confirm('Reset all site content to the starter version?')){const f=clone(DEFAULTS);db.settings=f.settings;db.services=f.services;db.skills=f.skills;db.projects=f.projects;save();renderHome();renderAdmin();toast('Site content reset')}break;
  }
});
document.addEventListener('keydown',e=>{
  const t=e.target.closest&&e.target.closest('#svcTabs .tab');if(!t)return;
  const ids=db.services.map(s=>s.id);let i=ids.indexOf(t.dataset.svc);
  if(e.key==='ArrowDown'||e.key==='ArrowRight')i=(i+1)%ids.length;else if(e.key==='ArrowUp'||e.key==='ArrowLeft')i=(i+ids.length-1)%ids.length;else return;
  e.preventDefault();selectSvc(ids[i],true);
});
document.addEventListener('change',e=>{
  const c=e.target.closest('[data-change]');if(!c)return;
  if(c.dataset.change==='req-svc'){pendingPlan={svc:c.value,tier:0};renderAccount();$('#r-svc').focus()}
  else if(c.dataset.change==='status'){const r=db.requests.find(x=>x.id===c.dataset.id);if(r){r.status=+c.value;if(SB()&&ssGet('a'))sbq('a','requests?id=eq.'+encodeURIComponent(r.id),{m:'PATCH',b:{status:r.status}}).then(()=>toast('Status updated')).catch(()=>toast('Could not save to the cloud'));else toast('Status updated');save();renderAdmin()}}
  else if(c.dataset.change==='import'){const f=c.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{const j=JSON.parse(rd.result);if(j.v!==1||!Array.isArray(j.services)||!Array.isArray(j.skills)||!Array.isArray(j.projects))throw 0;db.settings=Object.assign(db.settings,j.settings||{});db.services=j.services;db.skills=j.skills;db.projects=j.projects;save();renderHome();renderAdmin();toast('Backup restored')}catch(x){toast('That file is not a valid backup')}};rd.readAsText(f)}
});
document.addEventListener('submit',async e=>{
  const f=e.target.closest('[data-form]');if(!f)return;e.preventDefault();clearErr(f);
  const fd=Object.fromEntries(new FormData(f).entries());const kind=f.dataset.form;
  if(kind==='auth'){
    const email=(fd.email||'').trim().toLowerCase();let bad=false;
    if(authMode==='up'&&!(fd.name||'').trim()){setErr(f,'name','Enter your name.');bad=true}
    if(!/^\S+@\S+\.\S+$/.test(email)){setErr(f,'email','Enter a valid email address.');bad=true}
    if((fd.password||'').length<8){setErr(f,'password','Use at least 8 characters.');bad=true}
    if(bad)return;
    if(SB()){try{
      const j=authMode==='up'?await sbAuth('c','signup',{email,password:fd.password,data:{name:fd.name.trim().slice(0,60)}}):await sbAuth('c','token?grant_type=password',{email,password:fd.password});
      if(!j.access_token){setErr(f,'email','Check your email to confirm your account, then sign in.');return}
      const U=j.user,id='c:'+U.id;let u=db.users.find(x=>x.id===id);if(!u){u={id,name:(U.user_metadata&&U.user_metadata.name)||(fd.name||'').trim()||email.split('@')[0],email,salt:'',hash:'',created:Date.now()};db.users.push(u)}
      db.session.userId=id;save();await cloudSync('c');toast(authMode==='up'?'Account created':'Signed in')
    }catch(x){setErr(f,'password',x.message);return}
    if(!pendingPlan){try{pendingPlan=JSON.parse(sessionStorage.getItem('orch.plan')||'null')}catch(x){}}
    accTab=pendingPlan?'new':'requests';updateNavAccount();renderAccount();return}
    const ex=db.users.find(u=>u.email===email);
    if(authMode==='up'){
      if(ex){setErr(f,'email','An account with this email already exists. Sign in instead.');return}
      const salt=uid();const u={id:uid(),name:fd.name.trim().slice(0,60),email,salt,hash:await hash(fd.password,salt),created:Date.now()};
      db.users.push(u);db.session.userId=u.id;save();toast('Account created');
    }else{
      if(!ex||ex.hash!==await hash(fd.password,ex.salt)){setErr(f,'password','Email or password is incorrect.');return}
      db.session.userId=ex.id;save();toast('Signed in');
    }
    if(!pendingPlan){try{pendingPlan=JSON.parse(sessionStorage.getItem('orch.plan')||'null')}catch(x){}}
    accTab=pendingPlan?'new':'requests';updateNavAccount();renderAccount();
  }else if(kind==='request'){
    const u=me();if(!u)return;
    if(fd.website)return; /* honeypot: only bots fill this hidden field, so skip silently */
    if((fd.brief||'').trim().length<20){setErr(f,'brief','Add a little more detail, at least 20 characters.');return}
    /* client-side limit: one request per 30 seconds per browser */
    {let last=0;try{last=+localStorage.getItem('orch.lastReq')||0}catch(x){}const dt=Date.now()-last;
     if(dt>=0&&dt<30000){setErr(f,'brief','Please wait about 30 seconds before sending another request.');return}
     try{localStorage.setItem('orch.lastReq',String(Date.now()))}catch(x){}}
    const r={id:uid(),userId:u.id,svc:fd.svc,tier:+fd.tier,brief:fd.brief.trim().slice(0,4000),budget:(fd.budget||'').trim().slice(0,60),deadline:fd.deadline||'',status:0,created:Date.now(),messages:[]};
    {const sv=db.services.find(v=>v.id===fd.svc)||{tiers:[]};
    if(SB()&&ssGet('c')){try{await sbq('c','requests',{m:'POST',b:{data:{svc:fd.svc,tier:+fd.tier,brief:r.brief,budget:r.budget,deadline:r.deadline,name:u.name||'',email:u.email||''}}});await cloudSync('c')}catch(x){setErr(f,'brief','Could not send just now. Please try again.');return}}else{db.requests.push(r);save()}
    notify('request',{name:u.name||'',email:u.email||'',service:sv.name||fd.svc,plan:(sv.tiers[+fd.tier]||{}).name||'',budget:r.budget,deadline:r.deadline,brief:r.brief})}pendingPlan=null;try{sessionStorage.removeItem('orch.plan')}catch(x){}
    accTab='requests';renderAccount();toast('Request sent');
  }else if(kind==='reply'||kind==='adm-reply'){
    const r=db.requests.find(x=>x.id===f.dataset.id);const t=(fd.text||'').trim();if(!r||!t)return;
    {const role=kind==='reply'?'c':'a';if(SB()&&ssGet(role)){try{await sbq(role,'messages',{m:'POST',b:{request_id:r.id,from_admin:kind==='adm-reply',text:t.slice(0,1000)}});await cloudSync(role)}catch(x){toast('Could not send. Try again.');return}}else{(r.messages=r.messages||[]).push({from:kind==='reply'?'client':'admin',text:t.slice(0,1000),at:Date.now()})}}save();if(kind==='reply'){const u=me()||{};notify('message',{email:u.email||'',request_id:r.id,message:t.slice(0,1000)})}
    kind==='reply'?renderAccount():renderAdmin();toast('Message sent');
  }else if(kind==='copy'){
    const c={};[...COPY,...UI].forEach(x=>{const k=x[0],v=(fd[k]||'').trim().slice(0,600),d=(k in COPY_DEF)?COPY_DEF[k]:x[2];if(v&&v!==d)c[k]=v});db.settings.copy=c;
    ['imgHero','imgHeroM','imgAbout','imgCta','imgSky','imgBg'].forEach(k=>{db.settings[k]=(fd[k]||'').trim().slice(0,300)});
    db.settings.legalPrivacy=(fd.legalPrivacy||'').trim()===LEGAL.privacy[1].join('\n')?'':(fd.legalPrivacy||'').trim().slice(0,6000);db.settings.legalTerms=(fd.legalTerms||'').trim()===LEGAL.terms[1].join('\n')?'':(fd.legalTerms||'').trim().slice(0,6000);
    save();renderHome();toast('Saved. Press Publish in Cloud and inbox to show visitors.');renderAdmin()
  }else if(kind==='cloud-login'){
    sbAuth('a','token?grant_type=password',{email:(fd.email||'').trim(),password:fd.password}).then(()=>cloudSync('a')).then(()=>{cloudMsg='';renderAdmin()}).catch(x=>{cloudMsg=x.message;renderAdmin()});
  }else if(kind==='admin-setup'){
    if((fd.pw||'').length<8){setErr(f,'pw','Use at least 8 characters.');return}
    db.adminSalt=uid();db.adminHash=await hash(fd.pw,db.adminSalt);save();adminAuthed=true;try{sessionStorage.setItem('orch.admin','1')}catch(x){}renderAdmin();toast('Admin unlocked');
  }else if(kind==='admin-login'){
    if(await hash(fd.pw||'',db.adminSalt)!==db.adminHash){setErr(f,'pw','Passcode is incorrect.');return}
    adminAuthed=true;try{sessionStorage.setItem('orch.admin','1')}catch(x){}renderAdmin();
  }else if(kind==='project'){
    let bad=false;
    if(!(fd.title||'').trim()){setErr(f,'title','Enter a title.');bad=true}
    if(!(fd.summary||'').trim()){setErr(f,'summary','Enter a short summary.');bad=true}
    if(fd.link&&!/^(https?:\/\/|assets\/)/i.test(fd.link.trim())){setErr(f,'link','Link must start with https:// or assets/');bad=true}
    if(bad)return;
    const p={id:f.dataset.id||uid(),title:fd.title.trim(),tag:(fd.tag||'').trim(),status:(fd.status||'').trim(),link:(fd.link||'').trim(),summary:fd.summary.trim(),embed:safeUrl(fd.embed),image:safeUrl(fd.image)};
    const i=db.projects.findIndex(x=>x.id===p.id);if(i>=0)db.projects[i]=p;else db.projects.push(p);
    save();admEdit=null;renderAdmin();renderHome();toast('Project saved');
  }else if(kind==='skill'){
    const g=db.skills.find(x=>x.id===f.dataset.id);const s=(fd.skill||'').trim();if(g&&s){g.items.push(s.slice(0,60));save();renderAdmin();renderHome()}
  }else if(kind==='skillgroup'){
    const n=(fd.name||'').trim();if(n){db.skills.push({id:uid(),name:n.slice(0,40),items:[]});save();renderAdmin();renderHome()}
  }else if(kind==='service'){
    const v=svcById(f.dataset.id);if(!v)return;
    v.name=(fd.name||v.name).trim();v.short=(fd.short||'').trim();v.blurb=(fd.blurb||'').trim();v.audience=(fd.audience||'').trim();v.proof=(fd.proof||'').trim();v.image=(fd.image||'').trim();
    v.outcomes=(fd.outcomes||'').split('\n').map(x=>x.trim()).filter(Boolean);
    v.tiers=v.tiers.map((t,i)=>({name:(fd['tn'+i]||t.name).trim(),price:Math.max(0,parseInt(String(fd['tp'+i]).replace(/[^0-9]/g,''),10)||0),from:fd['tf'+i]==='1',note:(fd['td'+i]||'').trim()}));
    save();renderHome();renderAdmin();toast('Service saved');
  }else if(kind==='settings'){
    Object.assign(db.settings,{name:(fd.name||'').trim()||'Rumii',role:(fd.role||'').trim(),tagline:(fd.tagline||'').trim(),sub:(fd.sub||'').trim(),bio:(fd.bio||'').trim(),email:(fd.email||'').trim(),svcTitle:(fd.svcTitle||'').trim(),svcLead:(fd.svcLead||'').trim(),whatsapp:(fd.whatsapp||'').replace(/\D/g,'').slice(0,15),bookingUrl:(fd.bookingUrl||'').trim().slice(0,300),upiId:(fd.upiId||'').trim().slice(0,80),faq:(fd.faq||'').slice(0,4000),testi:(fd.testi||'').slice(0,4000)});
    save();renderHome();toast('Site text saved');
  }
});
addEventListener('hashchange',route);

/* ---------- boot ---------- */
try{pendingPlan=JSON.parse(sessionStorage.getItem('orch.plan')||'null')}catch(e){}
renderHome();
sbLoadContent();
route();
window.__site={get db(){return db},STATUSES};
})();

/* ---------- hero effects, embers, parallax ---------- */
(()=>{const R=matchMedia('(prefers-reduced-motion:reduce)').matches,F=matchMedia('(pointer:fine)').matches,root=document.documentElement;
/* headline words rise one by one */
let n=0;(function sp(el){[...el.childNodes].forEach(c=>{if(c.nodeType===3){const f=document.createDocumentFragment();c.textContent.split(/(\s+)/).forEach(w=>{if(!w.trim()){f.append(w);return}const e=document.createElement('span');e.className='w';e.style.setProperty('--i',n++);e.textContent=w;f.append(e)});c.replaceWith(f)}else if(c.nodeType===1)sp(c)})})(document.getElementById('heroTitle'));
/* lantern light + hero parallax */
let mx=innerWidth*.7,my=innerHeight*.35,tx=0,ty=0,cx=0,cy=0;
if(F&&!R){addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;root.style.setProperty('--mx',mx+'px');root.style.setProperty('--my',my+'px');tx=(.5-mx/innerWidth)*26;ty=(.5-my/innerHeight)*16;
 const c=e.target.closest&&e.target.closest('.hcard,.tab,.tier,.sk,.proj');if(c){const r=c.getBoundingClientRect();c.style.setProperty('--cx',e.clientX-r.left+'px');c.style.setProperty('--cy',e.clientY-r.top+'px')}
 const b=e.target.closest&&e.target.closest('.btn');if(b){const r=b.getBoundingClientRect();b.style.transform='translate('+((e.clientX-r.left-r.width/2)*.18)+'px,'+((e.clientY-r.top-r.height/2)*.28)+'px)'}});
 addEventListener('pointerout',e=>{const b=e.target.closest&&e.target.closest('.btn');if(b)b.style.transform=''})}
const pl=document.querySelector('.plate i');
/* embers */
const c=document.getElementById('embers'),x=c.getContext('2d');let W,H;const rs=()=>{W=c.width=innerWidth;H=c.height=innerHeight};rs();addEventListener('resize',rs);
const mk=b=>({x:Math.random()*W,y:b?H+12:Math.random()*H,r:Math.random()*1.7+.5,v:Math.random()*.55+.18,d:Math.random()*6.3,a:Math.random()*.55+.3});
const P=Array.from({length:innerWidth<700?26:56},()=>mk(0));
/* moon scroll progress */
const bar=document.querySelector('.moonprog .bar');const prog=()=>{const m=document.documentElement.scrollHeight-innerHeight;bar.style.strokeDashoffset=144.5*(1-(m>0?scrollY/m:0))};addEventListener('scroll',prog,{passive:true});prog();
(function f(){if(!R){cx+=(tx-cx)*.06;cy+=(ty-cy)*.06;if(pl){pl.style.setProperty('--px',cx+'px');pl.style.setProperty('--py',cy+'px')}}
 if(!R&&!document.hidden){x.clearRect(0,0,W,H);for(const p of P){p.y-=p.v;p.d+=.012;p.x+=Math.sin(p.d)*.35+(mx-W/2)*.00003;if(p.y<-12)Object.assign(p,mk(1));const g=x.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*5);g.addColorStop(0,'rgba(255,205,125,'+p.a+')');g.addColorStop(1,'rgba(255,140,60,0)');x.fillStyle=g;x.beginPath();x.arc(p.x,p.y,p.r*5,0,6.3);x.fill()}}
 requestAnimationFrame(f)})();
})();

/* ---------- admin copy editor and show-more handlers ---------- */
document.addEventListener('input',e=>{const f=e.target.closest&&e.target.closest('form[data-form="copy"]');if(!f)return;const st=f.querySelector('.cp-state');if(st){st.textContent='You have unsaved changes';st.classList.add('dirty')}const t=e.target.closest('[data-thumb]');if(t){const v=e.target.value.trim();t.querySelector('img').src=/^(https?:\/\/|assets\/)/i.test(v)?v:t.dataset.thumb}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-more]');if(!b)return;const m=document.getElementById('more-'+b.dataset.more),o=!m.classList.contains('open');m.classList.toggle('open',o);m.firstElementChild.inert=!o;b.setAttribute('aria-expanded',o);b.firstElementChild.textContent=o?b.dataset.lh:b.dataset.lo;if(o)setTimeout(()=>m.scrollIntoView({behavior:'smooth',block:'nearest'}),400)});
