/* AKTIVA vNext - add-on for existing receiving UI. No destructive schema changes. */
(()=>{'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='aktiva_count_offline_v1',draftKey='aktiva_count_draft_v1', timeKey='aktiva_count_times_v1';
const get=(k,def)=>{try{return JSON.parse(localStorage.getItem(k))??def}catch{return def}};
const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const role=()=>document.body.dataset.role==='count';const me=()=>window.session?.user?.id || (typeof session!=='undefined'?session?.user?.id:null);
const list=()=>typeof items!=='undefined'?items:[];const ds=()=>typeof deliveries!=='undefined'?deliveries:[];
const currentId=()=>{const form=$('[data-editform]');return form?.dataset.editform||null};
const stamp=()=>new Date().toISOString();let syncing=false,rendering=false,scanStream=null,scannerTimer=null;
let barcodePanelExpanded=false;

function banner(message,error=false){let b=$('#ak-seven-message');if(!b)return;b.textContent=message;b.style.color=error?'#ffb4b4':'#c9f6d3'}
function times(){return get(timeKey,{})}function markStart(id){if(!id)return;let t=times();if(!t[id]){t[id]={start:stamp(),end:null};set(timeKey,t)}}
function markEnd(id){if(!id)return;let t=times();if(t[id]&&!t[id].end){t[id].end=stamp();set(timeKey,t)}}
function duration(id){const t=times()[id];if(!t)return 'Başlamadı';const mins=Math.max(0,Math.round((new Date(t.end||Date.now())-new Date(t.start))/60000));return mins+' dk'+(t.end?' · Bitti':' · Devam ediyor')}
function download(name,text,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function report(){const id=$('[data-open]')?.dataset.open;const all=ds();const selected=all.find(d=>d.id===id)||all[0];if(!selected){banner('Rapor için sevkiyat kaydı bulunamadı.',true);return}const rows=list().filter(p=>p.delivery_id===selected.id);const lines=[['AKTİVA MAL KABUL SAYIM RAPORU'],['Tedarikçi',selected.supplier],['Plaka',selected.vehicle],['İrsaliye',selected.invoice],['Başlangıç',times()[selected.id]?.start||''],['Bitiş',times()[selected.id]?.end||''],['Süre',duration(selected.id)],[],['Ürün','Kod','Barkod','Koli içi adet','Beklenen koli','Sayılan koli','Eksik','Fazla','Hasarlı','Palet','Sayım tamamlandı','Not']];for(const p of rows){const expected=Number(p.expected||0),received=Number(p.received||0);lines.push([p.name,p.sku||'',p.barcode||'',p.units_per_carton||'',expected,received,Math.max(0,expected-received),Math.max(0,received-expected),p.damaged||0,p.pallet_count||0,p.count_completed?'Evet':'Hayır',p.count_note||''])}const csv='\ufeff'+lines.map(r=>r.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');download('AKTIVA_sayim_'+new Date().toISOString().slice(0,10)+'.csv',csv);banner('Ayrıntılı rapor indirildi.');}
async function loadCatalog(q){if(!q||q.length<2)return[];try{return await req('/rest/v1/aktiva_product_catalog?select=name,sku,barcode,units_per_carton&or=(name.ilike.*'+encodeURIComponent(q)+'*,sku.ilike.*'+encodeURIComponent(q)+'*,barcode.ilike.*'+encodeURIComponent(q)+'*)&limit=12')}catch{return[]}}
function draftSave(){if(!role())return;const data={};for(const id of ['ak-firm','ak-plate','ak-product','ak-cartons','ak-pallets']){const el=$('#'+id);if(el)data[id]=el.value}const form=$('[data-editform]');if(form){data.edit={id:form.dataset.editform,actual:form.elements.actual?.value,damaged:form.elements.damaged?.value,pallets:form.elements.pallets?.value,count_note:form.elements.count_note?.value}}set(draftKey,data)}
function draftRestore(){const data=get(draftKey,{});for(const [id,value]of Object.entries(data)){if(id==='edit')continue;const el=$('#'+id);if(el&&document.activeElement!==el&&!el.value&&value)el.value=value}const f=$('[data-editform]');if(f&&data.edit?.id===f.dataset.editform&&!f.dataset.draftRestored){for(const field of ['actual','damaged','pallets','count_note'])if(f.elements[field]&&data.edit[field]!=null)f.elements[field].value=data.edit[field];f.dataset.draftRestored='1'}}
function queue(){return get(key,[])}function pendingCount(){return queue().length}
async function sendSave(op){return req('/rest/v1/rpc/aktiva_safe_count',{method:'POST',body:{p_product_id:op.id,p_expected_version:op.version,p_received:op.received,p_damaged:op.damaged,p_pallets:op.pallets,p_note:op.note,p_client_id:op.clientId}})}
// Send push only after the secure count RPC has succeeded.
async function notifyForkliftSecure(product){
 const delivery=ds().find(d=>d.id===product.delivery_id);
 const result=await req('/functions/v1/send-push',{method:'POST',body:{
  event:'count_completed',product_id:product.id,delivery_id:product.delivery_id,
  vehicle:delivery?.vehicle||'',supplier:delivery?.supplier||''
 }});
 if(result?.success!==true)throw Error(result?.error||result?.message||'Sunucu bildirimi onaylamadı');
 return result;
}
async function flush(){if(syncing||!navigator.onLine||!me())return;syncing=true;try{let q=queue();for(const op of [...q]){try{await sendSave(op);q=q.filter(x=>x.clientId!==op.clientId);set(key,q)}catch(e){banner('Bekleyen kayıt: '+e.message,true);break}}if(!q.length){banner('Tüm çevrimdışı kayıtlar sunucuya aktarıldı.');if(typeof sync==='function')await sync(true)}}finally{syncing=false;updateStatus()}}
function updateStatus(){const x=$('#ak-seven-queue');if(x)x.textContent=(navigator.onLine?'Çevrimiçi':'Çevrimdışı')+' · Bekleyen kayıt: '+pendingCount()}
// Capture submit before original handler. This replaces direct PATCH with version-checked RPC.
document.addEventListener('submit',async e=>{if(!role()||!e.target.matches('[data-editform]'))return;const f=e.target,p=list().find(x=>x.id===f.dataset.editform);if(!p)return;e.preventDefault();e.stopImmediatePropagation();const received=Number(f.elements.actual?.value),damaged=Number(f.elements.damaged?.value),pallets=Number(f.elements.pallets?.value);if(![received,damaged,pallets].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=999999)||damaged>received){banner('Koli, hasar ve palet miktarlarını kontrol edin.',true);return}const op={id:p.id,version:Number(p.aktiva_version||0),received,damaged,pallets,note:String(f.elements.count_note?.value||'').trim().slice(0,500),clientId:crypto.randomUUID(),user:me(),created:stamp()};markStart(p.delivery_id);const button=f.querySelector('button[type=submit]');if(button)button.disabled=true;try{if(!navigator.onLine)throw Error('Çevrimdışı');await sendSave(op);localStorage.removeItem(draftKey);
 if(typeof sync==='function')await sync(true);
 banner('✓ Ürün sayımı kaydedildi. Tüm ürünler bitince sevkiyatı tamamlayın.');}catch(err){if(!navigator.onLine||/fetch|network|failed to fetch/i.test(err.message)){const q=queue();q.push(op);set(key,q);banner('İnternet yok: sayım bu cihazda sıraya alındı. Çıkış yapmadan senkronize edin.')}else{banner('Kayıt reddedildi: '+err.message+' · Veriyi kontrol edip yenileyin.',true)}}finally{if(button)button.disabled=false;updateStatus()}},true);
function enhance(){if(!role())return;const root=$('#aktivaCountUI');if(!root||root.classList.contains('hidden'))return;if(!$('#ak-seven-tools')){const panel=document.createElement('section');panel.id='ak-seven-tools';panel.style.cssText='background:#1c1f24;color:white;border:1px solid #434750;border-radius:14px;padding:13px;margin:8px 0';panel.innerHTML='<strong>📦 AKTİVA · Ürün Barkod Tanıtımı</strong><p id="ak-seven-queue" style="color:#cbd5e1;margin:8px 0"></p><div style="display:flex;flex-wrap:wrap;gap:7px"><button type="button" id="ak-seven-sync">↻ Bekleyenleri gönder</button><button type="button" id="ak-seven-report">📄 Ayrıntılı CSV raporu</button><button type="button" id="ak-seven-scan">▥ Barkod okut</button></div><p id="ak-seven-message" style="font-size:12px;margin:8px 0"></p><div id="ak-seven-scanner" style="display:none"><video autoplay playsinline muted style="width:100%;max-height:240px"></video><label>Barkod elle giriş<input id="ak-seven-code" placeholder="Barkod numarası"></label><button type="button" id="ak-seven-code-apply">Kodu kullan</button><button type="button" id="ak-seven-stop">Kamerayı kapat</button></div><div id="ak-seven-catalog" style="font-size:12px;margin-top:8px"></div>';panel.style.display='none';root.prepend(panel);$('#ak-seven-sync').onclick=flush;$('#ak-seven-report').onclick=report;$('#ak-seven-scan').onclick=startScanner;updateStatus()}
// Panels and navigation are separate: show tool launcher only on home.
 const home=!!root.querySelector('#ak-new');
 if(!home)barcodePanelExpanded=false;
 let launch=root.querySelector('#ak-seven-launch');
 if(home&&!launch){
  launch=document.createElement('button');launch.type='button';launch.id='ak-seven-launch';
  launch.style.cssText='display:block;width:100%;margin:10px 0;background:#242b36;color:#fff;padding:15px;border:1px solid #485466;border-radius:12px;font-size:16px;font-weight:700;text-align:left';
  root.prepend(launch);
  launch.onclick=()=>{barcodePanelExpanded=!barcodePanelExpanded;enhance()};
 }
 if(launch){launch.style.display=home?'block':'none';if(launch.textContent!==(barcodePanelExpanded?'▾ ':'▸ ')+'Barkod Tanımlama ve Sayım Araçları')launch.textContent=(barcodePanelExpanded?'▾ ':'▸ ')+'Barkod Tanımlama ve Sayım Araçları';launch.setAttribute('aria-expanded',String(barcodePanelExpanded));}
 const tools=root.querySelector('#ak-seven-tools');if(tools)tools.style.display=home&&barcodePanelExpanded?'block':'none';
 const f=$('[data-editform]');if(f){const p=list().find(x=>x.id===f.dataset.editform);if(p){markStart(p.delivery_id);if(!f.querySelector('.ak-seven-details')){const box=document.createElement('div');box.className='ak-seven-details';box.style.cssText='padding:9px;border:1px solid #51545b;border-radius:9px;font-size:12px';box.textContent='Sayım süresi: '+duration(p.delivery_id)+' · Koli içi: '+(p.units_per_carton||'Katalogda yok')+' adet · Versiyon: '+(p.aktiva_version||0);f.prepend(box)}draftRestore()}}
if($('#ak-form')){draftRestore();const product=$('#ak-product');if(product&&!product.dataset.catalogHook){product.dataset.catalogHook='1';product.addEventListener('input',async()=>{const value=product.value;const results=await loadCatalog(value);if(!product.isConnected||product.value!==value)return;const el=$('#ak-seven-catalog');if(el)el.innerHTML=results.map(x=>'<button type="button" data-catalog="'+esc(x.name)+'" data-code="'+esc(x.barcode||'')+'" style="display:block;margin:4px 0;background:#343b45">'+esc(x.name)+' · '+Number(x.units_per_carton||1)+' adet/koli</button>').join('');el?.querySelectorAll('[data-catalog]').forEach(b=>b.onclick=()=>{product.value=b.dataset.catalog;product.dispatchEvent(new Event('input',{bubbles:true}));el.innerHTML=''})})}}
root.querySelectorAll('[data-open]').forEach(b=>{if(!b.dataset.sevenBound){b.dataset.sevenBound='1';b.addEventListener('click',()=>markStart(b.dataset.open))}});
root.querySelectorAll('[data-edit]').forEach(b=>{if(!b.dataset.sevenBound){b.dataset.sevenBound='1';b.addEventListener('click',()=>{const p=list().find(x=>x.id===b.dataset.edit);if(p)markStart(p.delivery_id)})}});
const opened=root.querySelector('.ak-count-summary');if(opened&&!opened.querySelector('.ak-seven-timing')){const div=document.createElement('p');div.className='ak-seven-timing';div.style.color='#d1d5db';div.textContent='Sayım süresi: '+duration(list().find(x=>x.id===currentId())?.delivery_id);opened.append(div)}
}
let scanPurpose='catalog';
function applyCode(code){code=String(code||'').trim();if(!code)return;stopScanner();banner('✓ Barkod başarıyla okundu: '+code);if(scanPurpose==='shipment'&&typeof window.AKTIVA_miniBarcodeHandler==='function' && window.AKTIVA_miniBarcodeHandler(code)===true)return;if(window.AKTIVA_openBarcodeMatch){Promise.resolve(window.AKTIVA_openBarcodeMatch(code)).catch(err=>banner('Eşleştirme ekranı açılamadı: '+err.message,true));return;}const p=list().find(x=>x.barcode===code||x.sku===code);if(p){const search=$('#ak-product-filter');if(search){search.value=p.name;search.dispatchEvent(new Event('input',{bubbles:true}))}banner('Barkod eşleşti: '+p.name)}else{const product=$('#ak-product');if(product){product.value=code;product.dispatchEvent(new Event('input',{bubbles:true}))}banner('Barkod okundu: '+code+' · Ürün eşleşmesini kontrol edin.')}stopScanner()}
let zxingReader=null,zxingControls=null,scannerActive=false,scannerLoading=null,scanGeneration=0;
function loadZXing(){
 if(window.ZXingBrowser?.BrowserMultiFormatReader)return Promise.resolve(window.ZXingBrowser);
 if(scannerLoading)return scannerLoading;
 scannerLoading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
  script.async=true;
  script.onload=()=>window.ZXingBrowser?.BrowserMultiFormatReader?resolve(window.ZXingBrowser):reject(Error('ZXing Browser yüklenemedi'));
  script.onerror=()=>reject(Error('Barkod kütüphanesi indirilemedi; internet bağlantısını kontrol edin'));
  document.head.appendChild(script);
 }).catch(err=>{scannerLoading=null;throw err});
 return scannerLoading;
}
function scannerBox(){
 let box=document.getElementById('ak-seven-scanner-overlay');
 if(box)return box;
 box=document.createElement('section');box.id='ak-seven-scanner-overlay';
 box.setAttribute('role','dialog');box.setAttribute('aria-label','Barkod okuyucu');
 box.style.cssText='display:none;position:fixed;inset:0;z-index:2147483000;background:rgba(7,11,17,.97);padding:calc(env(safe-area-inset-top, 0px) + 24px) 16px calc(env(safe-area-inset-bottom, 0px) + 24px);color:#fff;overflow-y:auto';
 box.innerHTML='<div style="max-width:520px;margin:auto"><h2 style="margin:0 0 12px">Barkod Okut</h2><video autoplay playsinline muted style="width:100%;max-height:55vh;object-fit:contain;background:#111;border-radius:14px"></video><p id="ak-scanner-status" role="status">Kamerayı barkoda doğrultun.</p><label style="display:block;margin:12px 0">Barkodu elle girin<input id="ak-scanner-code" inputmode="numeric" autocomplete="off" style="display:block;width:100%;padding:12px;font-size:18px;border-radius:9px;color:#111;background:white" placeholder="Barkod numarası"></label><button type="button" id="ak-scanner-apply" style="padding:12px;margin-right:8px">Kodu kullan</button><button type="button" id="ak-scanner-close" style="padding:12px">Kapat</button></div>';
 document.body.appendChild(box);
 box.querySelector('#ak-scanner-close').onclick=()=>stopScanner();
 box.querySelector('#ak-scanner-apply').onclick=()=>applyCode(box.querySelector('#ak-scanner-code').value);
 return box;
}
function scanMessage(message,error=false){const x=document.getElementById('ak-scanner-status');if(x){x.textContent=message;x.style.color=error?'#ffb4b4':'#c9f6d3'}banner(message,error)}
async function startScanner(purpose='catalog'){scanPurpose=purpose==='shipment'?'shipment':'catalog';
 const box=scannerBox();if(scannerActive)return;
 const generation=++scanGeneration;
 scannerActive=true;box.style.display='block';
 const video=box.querySelector('video');
 const valid=()=>scannerActive&&scanGeneration===generation;
 try{
  if(typeof window.BarcodeDetector==='function' && navigator.mediaDevices?.getUserMedia){
   let detector=null;
   try{detector=new window.BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','qr_code','upc_a','upc_e','itf']})}catch(_){detector=null}
   if(detector){
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(!valid()){stream.getTracks().forEach(t=>t.stop());return}
    scanStream=stream;video.srcObject=stream;await video.play();
    if(!valid())return;
    scanMessage('Kamerayı barkoda doğrultun.');
    let busy=false;
    scannerTimer=setInterval(async()=>{if(!valid()||busy||video.readyState<2)return;busy=true;try{const codes=await detector.detect(video);if(codes[0]&&valid())applyCode(codes[0].rawValue)}catch(_){}finally{busy=false}},400);
    return;
   }
  }
  const ZXing=await loadZXing();if(!valid())return;
  zxingReader=new ZXing.BrowserMultiFormatReader();
  scanMessage('Kamera başlatılıyor...');
  // @zxing/browser returns camera controls and delivers scans via callback.
  const controls=await zxingReader.decodeFromVideoDevice(undefined,video,(result,err)=>{
   if(!valid())return;
   if(result){applyCode(result.getText());return}
   if(err){
    // ZXing reports an undecodable frame as an exception on every scan cycle.
    // These are expected until a barcode enters the camera view.
    const name=String(err.name||'');
    const message=String(err.message||'');
    const expected=['NotFoundException','ChecksumException','FormatException'].includes(name)
      || /No MultiFormat Readers were able to detect the code|No code detected|not found|checksum|format exception/i.test(message);
    if(!expected)scanMessage('Okuyucu hatası: '+message+' · Elle giriş yapabilirsiniz.',true);
   }
  });
  if(!valid()){controls.stop();return}
  zxingControls=controls;
  scanMessage('Kamerayı barkoda doğrultun.');
 }catch(err){
  if(valid())scanMessage('Okuyucu başlatılamadı: '+err.message+' · Elle giriş yapabilirsiniz.',true);
  if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null}
 }
}
function stopScanner(hide=true){
 scannerActive=false;++scanGeneration;
 if(scannerTimer)clearInterval(scannerTimer);scannerTimer=null;
 if(zxingControls){try{zxingControls.stop()}catch(_){}zxingControls=null}
 zxingReader=null;
 if(scanStream)scanStream.getTracks().forEach(t=>t.stop());scanStream=null;
 const box=document.getElementById('ak-seven-scanner-overlay');
 if(box){const video=box.querySelector('video');if(video){try{video.pause()}catch(_){}video.srcObject=null}if(hide)box.style.display='none'}
}
window.AKTIVA_startBarcodeScanner=startScanner;
let last='';const observer=new MutationObserver(()=>{if(rendering)return;rendering=true;try{enhance()}finally{rendering=false}});window.addEventListener('load',()=>{const root=$('#app');if(root)observer.observe(root,{subtree:true,childList:true});enhance();setInterval(()=>{if(role()){updateStatus();if(navigator.onLine&&pendingCount())flush()}},12000)});document.addEventListener('input',e=>{if(role()&&(e.target.closest('#ak-form')||e.target.closest('[data-editform]')))draftSave()},true);window.addEventListener('online',flush);window.addEventListener('beforeunload',stopScanner);
})();
