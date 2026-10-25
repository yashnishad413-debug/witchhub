/*
 * SUPABASE KEY NOTICE
 * The Supabase key in this file (SB_KEY) is the publishable (anon) key. It is safe to be
 * public because all access is enforced by Row Level Security (see supabase.sql).
 * Never put the service_role key in this file.
 */
'use strict';
/* ---- cloud (Supabase) : leave empty to stay in browser-only mode ---- */
const SB_URL='https://ogqvxkubcthphrvmfixe.supabase.co',SB_KEY='sb_publishable_SzR3qITqYM-w_bm3IIjVxg_mmDABFlB';
const SB=()=>!!(SB_URL&&SB_KEY);
const ssGet=k=>{try{return JSON.parse(localStorage.getItem('orch.s.'+k)||'null')}catch(x){return null}};
function ssPut(k,j){const t={access:j.access_token,refresh:j.refresh_token,exp:j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600)};localStorage.setItem('orch.s.'+k,JSON.stringify(t));return t}
async function ssTok(k){let t=ssGet(k);if(!t)return '';if(t.exp-Date.now()/1000<90){try{const r=await fetch(SB_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:t.refresh})});if(!r.ok)throw 0;t=ssPut(k,await r.json())}catch(x){localStorage.removeItem('orch.s.'+k);return ''}}return t.access}
async function sbAuth(k,path,body){const r=await fetch(SB_URL+'/auth/v1/'+path,{method:'POST',headers:{apikey:SB_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error_description||j.msg||j.message||'Something went wrong');if(j.access_token)ssPut(k,j);return j}
async function sbq(k,path,o){o=o||{};const tk=k?await ssTok(k):'';const r=await fetch(SB_URL+'/rest/v1/'+path,{method:o.m||'GET',headers:Object.assign({apikey:SB_KEY,'Content-Type':'application/json'},tk?{Authorization:'Bearer '+tk}:{},o.h||{}),body:o.b?JSON.stringify(o.b):undefined});if(!r.ok)throw new Error('Cloud error '+r.status);const t=await r.text();return t?JSON.parse(t):null}
/* ---------- storage upload (admin pictures) ---------- */
async function upImg(file){if(!SB())throw new Error('Connect the cloud first. See the README.');if(!ssGet('a'))throw new Error('Sign in under Cloud and inbox first.');
  if(!/^image\/(png|jpe?g|webp|gif)$/.test(file.type))throw new Error('Please choose a PNG, JPG, WEBP or GIF picture.');
  let blob=file,ext=file.type.split('/')[1].replace('jpeg','jpg');
  if(file.type!=='image/gif'){try{const bm=await createImageBitmap(file),k=Math.min(1,2400/bm.width),c=document.createElement('canvas');c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);c.getContext('2d').drawImage(bm,0,0,c.width,c.height);const b=await new Promise(r=>c.toBlob(r,'image/webp',.86));if(b){blob=b;ext='webp'}}catch(x){}}
  if(blob.size>5*1024*1024)throw new Error('That picture is over 5 MB. Please choose a smaller one.');
  const name=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)+'.'+ext,tk=await ssTok('a');
  const r=await fetch(SB_URL+'/storage/v1/object/site-images/'+name,{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+tk,'Content-Type':blob.type||'application/octet-stream'},body:blob});
  if(!r.ok)throw new Error('Upload failed ('+r.status+'). Did you run the picture storage SQL?');
  return SB_URL+'/storage/v1/object/public/site-images/'+name}
