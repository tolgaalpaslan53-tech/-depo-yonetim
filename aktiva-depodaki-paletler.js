/* AKTİVA · Palet Envanteri — manuel giriş/çıkış ve hareket geçmişi, 2026-11-02.
 * Var olan irsaliye kaydı aynen okunur. Başlangıç stoğu bilinmediğinden gösterilen
 * rakamlar KAYITLI HAREKET NETİDİR, gerçek mevcut stok değildir.
 * Palet İade ve forkliftçi push kodlarına dokunulmaz.
 */
(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('tr-TR');
const signed=n=>(n>0?'+':'')+fmt(n);
const date=s=>s?new Date(s).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'short',timeStyle:'short'}):'—';
const role=()=>document.body?.dataset?.role;
const authorized=()=>['count','admin'].includes(role());
const TAM=['9900351','9900353','9900355','9900360','9900022','9900369','9900363'];
const YARIM=['9900352','9900354','9900356','9900362','9900023','9900370','9900364'];
const reference={
 '9900351':['BİRPAL','tam'],'9900352':['BİRPAL','yarim'],
 '9900353':['PCS','tam'],'9900354':['PCS','yarim'],
 '9900355':['PRESTİJ','tam'],'9900356':['PRESTİJ','yarim'],
 '9900360':['P.GLOBAL','tam'],'9900362':['P.GLOBAL','yarim'],
 '9900022':['PALEX','tam'],'9900023':['PALEX','yarim'],
 '9900369':['RENTAPAL','tam'],'9900370':['RENTAPAL','yarim'],
 '9900363':['TEDARİKÇİ','tam'],'9900364':['TEDARİKÇİ','yarim']
};
const label=x=>x==='tam'?'Tam Palet (EUR)':x==='yarim'?'Yarım Palet (DUS)':'Diğer Palet';
function group(x){
 if(x.kind==='kasa')return 'kasa';
 const code=String(x.code||'').trim();
 if(TAM.includes(code))return 'tam';
 if(YARIM.includes(code))return 'yarim';
 const norm=String(x.name||'').toLocaleUpperCase('tr-TR').replace(/İ/g,'I').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(/DUSSELDORF|DUSSLDORF|60\s*[X×*]\s*80/.test(norm))return 'yarim';
 if(/\bEURO\b|80\s*[X×*]\s*120/.test(norm))return 'tam';
 return 'diger';
}
let deliveries=[],manual=[],tab='inventory',kind='palet',query='',loading=false,saving=false,loadError='',message='';
let action='giris',type='tam',selectedCode='9900022',pending=null;
const panel=()=>document.getElementById('akdp-overlay');
const content=()=>panel()?.querySelector('#akdp-content');
function allRows(){
 const rows=[];
 for(const d of deliveries){
  for(const x of (Array.isArray(d.satirlar)?d.satirlar:[])){
   const qty=Number(x.quantity);if(!Number.isSafeInteger(qty)||qty<=0)continue;
   const kind=x.kind==='kasa'?'kasa':'palet', code=String(x.code||'').trim(),name=String(x.name||'');
   rows.push({id:'irsaliye:'+d.delivery_id+':'+(code||name),kind,code,name,type:group({kind,code,name}),amount:qty,source:'İrsaliye',date:d.kayit_tarihi,user:'Otomatik irsaliye',reason:'İrsaliye girişi',note:'',reversible:false});
  }
 }
 for(const x of manual){
  rows.push({id:x.id,kind:'palet',code:String(x.code),name:String(x.name),type:x.palet_sinifi,amount:Number(x.miktar),source:x.islem==='duzeltme'?'Ters kayıt':'Manuel '+(x.islem==='giris'?'giriş':'çıkış'),date:x.kayit_tarihi,user:x.kaydeden_adi||'Personel',reason:x.neden,note:x.aciklama||'',reversible:x.islem!=='duzeltme',reversed:!!manual.find(v=>v.duzeltilen_hareket_id===x.id)});
 }
 return rows.sort((a,b)=>new Date(b.date)-new Date(a.date));
}
function stats(rows){
 let entry=0,exit=0,caseTotal=0,tam=0,yarim=0;
 const types=new Map();
 for(const r of rows){
  const k=r.kind+'|'+(r.code||r.name.toLocaleUpperCase('tr-TR'));
  if(!types.has(k))types.set(k,{kind:r.kind,code:r.code,name:r.name,type:r.type,entry:0,exit:0,net:0,latest:r.date,events:0});
  const g=types.get(k);g.entry+=Math.max(0,r.amount);g.exit+=Math.max(0,-r.amount);g.net+=r.amount;g.events++;
  if(r.date>g.latest)g.latest=r.date;
  if(r.kind==='kasa')caseTotal+=r.amount;
  else{entry+=Math.max(0,r.amount);exit+=Math.max(0,-r.amount);if(r.type==='tam')tam+=r.amount;if(r.type==='yarim')yarim+=r.amount;}
 }
 return {entry,exit,net:entry-exit,caseTotal,tam,yarim,groups:[...types.values()]};
}
function style(){if(document.getElementById('akdp-style'))return;
 const s=document.createElement('style');s.id='akdp-style';s.textContent=`
.akdp-overlay[hidden]{display:none!important}.akdp-overlay{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:12px;background:#070b11ce;box-sizing:border-box}
.akdp-overlay,.akdp-overlay *{box-sizing:border-box}.akdp-panel{width:min(100%,760px);max-height:94dvh;overflow:auto;overscroll-behavior:contain;background:#121d2b;color:#edf3fb;border:1px solid #3d4e63;border-radius:20px;box-shadow:0 25px 85px #000a;padding:20px;font-family:system-ui,-apple-system,sans-serif}
.akdp-header{display:flex;align-items:start;justify-content:space-between;gap:12px;margin-bottom:12px}.akdp-eyebrow{color:#d3a0aa;font-size:11px;letter-spacing:.1em;font-weight:800}.akdp-header h2{font-size:24px;line-height:1.25;margin:4px 0;color:white}.akdp-lead{font-size:12px;line-height:1.5;color:#b8c6d8;margin:5px 0}.akdp-close{background:#2a3c50!important;color:white!important;border:1px solid #536780!important;border-radius:11px!important;width:43px!important;height:43px!important;min-width:43px!important;font-size:22px!important;padding:0!important}
.akdp-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:15px 0}.akdp-nav button{padding:12px 5px!important;background:#23364b!important;border:1px solid #50617a!important;color:#d4e0ee!important;border-radius:11px!important;font-size:12px!important;font-weight:700!important}.akdp-nav button[aria-selected=true]{background:#a8293b!important;color:#fff!important;border-color:#d25b6a!important}
.akdp-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0 16px}.akdp-stat,.akdp-type-card{background:#1d3042;border:1px solid #43566f;border-radius:13px;padding:12px;min-width:0}.akdp-stat small,.akdp-type-card small{display:block;color:#b5c4d6;font-size:11px}.akdp-stat strong,.akdp-type-card strong{display:block;margin-top:5px;font-size:24px;color:white;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.akdp-type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.akdp-type-head{font-size:13px;color:#d9e6f4;font-weight:750;margin:13px 0 7px}
.akdp-switch{display:flex;gap:8px;margin:14px 0}.akdp-switch button{background:#25374b!important;color:#dce9f7!important;border:1px solid #546984!important;border-radius:10px!important;padding:9px 13px!important}.akdp-switch button[aria-pressed=true]{background:#a8293b!important;color:#fff!important}
.akdp-search,.akdp-form input,.akdp-form select,.akdp-form textarea{display:block;width:100%;background:#0d1a2a!important;color:white!important;border:1px solid #526880!important;border-radius:11px!important;padding:12px!important;font-size:16px!important;min-height:46px!important}.akdp-search::placeholder,.akdp-form input::placeholder,.akdp-form textarea::placeholder{color:#b2bdcc}.akdp-search{margin-bottom:12px}.akdp-form{display:grid;gap:13px}.akdp-form fieldset{border:0;padding:0;margin:0;min-width:0}.akdp-form legend,.akdp-form label{display:block;font-size:13px;color:#dce6f3;font-weight:700;margin-bottom:5px}.akdp-form label small{font-weight:400;color:#aabbcd}.akdp-choice{display:flex;flex-wrap:wrap;gap:7px}.akdp-choice button{background:#293b50!important;color:#dfecfb!important;border:1px solid #53677f!important;border-radius:10px!important;padding:11px 12px!important;flex:1;min-width:95px}.akdp-choice button[aria-pressed=true]{background:#a8293b!important;color:white!important;border-color:#e16a7b!important}.akdp-form input,.akdp-form select,.akdp-form textarea{margin-top:5px}.akdp-form textarea{min-height:76px!important;resize:vertical}
.akdp-primary{background:#cc0d32!important;color:#fff!important;border:1px solid #ec4a6e!important;border-radius:11px!important;padding:13px 17px!important;font-weight:800!important}.akdp-secondary{background:#253b53!important;color:#e8f3ff!important;border:1px solid #526d87!important;border-radius:11px!important;padding:11px 14px!important}.akdp-primary:disabled,.akdp-secondary:disabled{opacity:.55;cursor:wait}.akdp-actions{display:flex;flex-wrap:wrap;gap:9px;margin:13px 0}.akdp-actions>*{flex:1}.akdp-list{display:grid;gap:9px}.akdp-item{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#1b2c3e;border:1px solid #3c536c;border-radius:12px;padding:12px}.akdp-item>div:first-child{min-width:0}.akdp-item strong{font-size:14px;color:white;display:block;overflow-wrap:anywhere}.akdp-item small{font-size:11px;color:#bac9db;display:block;margin-top:4px;line-height:1.45}.akdp-amount{text-align:right;flex-shrink:0;color:white;font-size:21px;font-weight:800;font-variant-numeric:tabular-nums}.akdp-amount small{font-weight:400}.akdp-positive{color:#7bd9b1!important}.akdp-negative{color:#f4a2aa!important}
.akdp-note{padding:12px;color:#ccd6e3;background:#203048;border-left:3px solid #d69b55;border-radius:9px;font-size:12px;line-height:1.6;margin:14px 0}.akdp-alert{padding:11px;border:1px solid #a94d65;background:#422330;color:#fff;border-radius:10px;font-size:13px;margin:10px 0}.akdp-success{border-color:#397d6d!important;background:#173c37!important}.akdp-empty{text-align:center;color:#bac8d9;padding:25px 8px}.akdp-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:13px}.akdp-history small{margin-bottom:5px}.akdp-reverse{border:1px solid #a8606b!important;background:#46303c!important;color:white!important;padding:7px 11px!important;border-radius:8px!important;font-size:12px!important;margin-top:6px}
body.akdp-scroll-lock{overflow:hidden!important}@media(max-width:500px){.akdp-overlay{align-items:flex-end;padding:0}.akdp-panel{width:100%;max-height:96dvh;border-radius:20px 20px 0 0;padding:17px 14px max(16px,env(safe-area-inset-bottom))}.akdp-stat{padding:9px}.akdp-stat strong{font-size:20px}.akdp-item{padding:11px}.akdp-nav button{font-size:11px}}
`;document.head.appendChild(s)}
function render(){const root=content();if(!root)return;
 if(loading){root.innerHTML='<p class="akdp-empty">Palet kayıtları yükleniyor…</p>';return;}
 const rows=allRows(),s=stats(rows);
 let html=`<nav class="akdp-nav" aria-label="Palet Envanteri bölümleri"><button data-view="inventory" aria-selected="${tab==='inventory'}">Envanter</button><button data-view="manual" aria-selected="${tab==='manual'}">+ Manuel İşlem</button><button data-view="history" aria-selected="${tab==='history'}">Hareket Geçmişi</button></nav>`;
 if(loadError){root.innerHTML=html+'<p class="akdp-alert" role="alert">Kayıtlar alınamadı: '+esc(loadError)+'</p><button type="button" class="akdp-secondary" data-action="refresh">Yeniden Dene</button>';bind(root);return;}
 if(message)html+='<p class="akdp-alert '+(message.startsWith('✓')?'akdp-success':'')+'" role="status">'+esc(message)+'</p>';
 if(tab==='inventory'){
  html+=`<div class="akdp-summary"><div class="akdp-stat"><small>Palet girişleri</small><strong>${fmt(s.entry)}</strong></div><div class="akdp-stat"><small>Palet çıkışları</small><strong>${fmt(s.exit)}</strong></div><div class="akdp-stat"><small>Kayıtlı net</small><strong>${signed(s.net)}</strong></div></div>
   <h3 class="akdp-type-head">Palet türüne göre kayıtlı hareket neti</h3><div class="akdp-type-grid"><div class="akdp-type-card"><small>Tam Palet (EUR)</small><strong>${signed(s.tam)}</strong><small>80 × 120 cm</small></div><div class="akdp-type-card"><small>Yarım Palet (DUS)</small><strong>${signed(s.yarim)}</strong><small>60 × 80 cm</small></div></div>
   <div class="akdp-switch"><button data-kind="palet" aria-pressed="${kind==='palet'}">Paletler</button><button data-kind="kasa" aria-pressed="${kind==='kasa'}">Kasalar / Box</button></div>
   <input class="akdp-search" id="akdp-search" type="search" aria-label="Kod veya tür ara" placeholder="Kod veya tür ara" autocomplete="off" value="${esc(query)}">
   <div class="akdp-list">`;
  const groups=s.groups.filter(x=>x.kind===kind && (x.code+' '+x.name+' '+label(x.type)).toLocaleLowerCase('tr-TR').includes(query)).sort((a,b)=>b.net-a.net||a.name.localeCompare(b.name,'tr'));
  html+=groups.length?groups.map(x=>`<div class="akdp-item"><div><strong>${esc(x.kind==='kasa'?x.name:label(x.type))}</strong><small>${esc(x.name)}</small><small>Kod: ${esc(x.code||'Bilinmiyor')} · Giriş ${fmt(x.entry)} · Çıkış ${fmt(x.exit)} · ${fmt(x.events)} hareket</small></div><div class="akdp-amount ${x.net<0?'akdp-negative':''}">${signed(x.net)}<small>kayıtlı net</small></div></div>`).join(''):'<p class="akdp-empty">Bu türde kayıt bulunmuyor.</p>';
  html+='</div><p class="akdp-note"><strong>Önemli:</strong> Başlangıç stoğu henüz girilmedi. Bu rakamlar yalnızca kaydedilen irsaliye ve manuel giriş/çıkışların netidir, depodaki kesin mevcut palet sayısı değildir. Palet İade çıkışları henüz otomatik işlenmiyor.</p>';
 }
 if(tab==='manual'){
  const options=Object.entries(reference).filter(([k,x])=>x[1]===type).map(([code,x])=>`<option value="${code}" ${code===selectedCode?'selected':''}>${esc(x[0])} · ${code}</option>`).join('');
  html+=`<form id="akdp-manual" class="akdp-form"><fieldset><legend>İşlem türü</legend><div class="akdp-choice"><button type="button" data-operation="giris" aria-pressed="${action==='giris'}">+ Palet Girişi</button><button type="button" data-operation="cikis" aria-pressed="${action==='cikis'}">− Palet Çıkışı</button><button type="button" disabled title="Sayım başlangıç stoğu belirlenince açılacak">Sayım Düzeltmesi (sonra)</button></div></fieldset>
  <fieldset><legend>Palet türü</legend><div class="akdp-choice"><button type="button" data-type="tam" aria-pressed="${type==='tam'}">Tam Palet (EUR)</button><button type="button" data-type="yarim" aria-pressed="${type==='yarim'}">Yarım Palet (DUS)</button></div></fieldset>
  <div><label for="akdp-code">Palet markası / kodu</label><select id="akdp-code" name="code" required>${options}<option value="other" ${selectedCode==='other'?'selected':''}>Diğer / yeni palet kodu</option></select></div>
  <div id="akdp-other" ${selectedCode==='other'?'':'hidden'}><label for="akdp-custom-code">Yeni palet kodu (7 rakam)<input id="akdp-custom-code" name="customCode" inputmode="numeric" pattern="[0-9]{7}" maxlength="7" placeholder="Örn. 9900123"></label><label for="akdp-custom-name">Palet adı / marka<input id="akdp-custom-name" name="customName" maxlength="160" placeholder="Örn. EURO PALET YENİ MARKA"></label></div>
  <div><label for="akdp-qty">Miktar (adet)</label><input id="akdp-qty" name="qty" required type="number" inputmode="numeric" step="1" min="1" max="999999" placeholder="Örn. 10"></div>
  <div><label for="akdp-reason">İşlem nedeni</label><select id="akdp-reason" name="reason" required><option value="">Neden seçin</option><option value="İrsaliyede bulunmayan giriş">İrsaliyede bulunmayan giriş</option><option value="Kayıt dışı palet hareketi">Kayıt dışı palet hareketi</option><option value="İade / teslim">İade / teslim</option><option value="Diğer">Diğer</option></select></div>
  <div><label for="akdp-note">Açıklama <small>(isteğe bağlı)</small></label><textarea id="akdp-note" name="note" maxlength="500" rows="3" placeholder="İşleme ilişkin kısa not"></textarea></div>
  <p class="akdp-note">İşlemi yapan personel ve tarih/saat otomatik kaydedilir. Daha önce irsaliyeden eklenen paletleri ikinci kez manuel eklemeyin. Hatalı kayıtlar geçmişten silinmez; ters hareketle düzeltilir.</p>
  <button class="akdp-primary" type="submit" ${saving?'disabled':''}>${saving?'Kaydediliyor…':'İşlemi Kaydet'}</button></form>`;
 }
 if(tab==='history'){
  html+='<div class="akdp-actions"><button class="akdp-secondary" data-action="export">Excel Raporu (.xlsx)</button><button class="akdp-secondary" data-action="refresh">↻ Yenile</button></div><div class="akdp-list akdp-history">';
  html+=rows.length?rows.slice(0,150).map(x=>`<div class="akdp-item"><div><strong>${esc(x.source)} · ${esc(x.kind==='kasa'?'Kasa / Box':label(x.type))}</strong><small>${esc(x.name)} · ${esc(x.code||'Kod yok')}</small><small>${esc(date(x.date))} · ${esc(x.user)} · ${esc(x.reason)}</small>${x.note?`<small>${esc(x.note)}</small>`:''}${x.reversed?'<small>↩ Bu işlem düzeltildi.</small>':''}${x.reversible&&!x.reversed?`<button class="akdp-reverse" type="button" data-reverse="${esc(x.id)}">↩ İşlemi Geri Al</button>`:''}</div><div class="akdp-amount ${x.amount<0?'akdp-negative':'akdp-positive'}">${signed(x.amount)}<small>adet</small></div></div>`).join(''):'<p class="akdp-empty">Henüz hareket kaydı bulunmuyor.</p>';
  if(rows.length>150)html+='<p class="akdp-note">Ekranda son 150 hareket gösterilir; Excel raporuna bütün kayıtlı hareketler dahil edilir.</p>';
  html+='</div><p class="akdp-note">İrsaliye hareketleri bu listede yalnızca görüntülenir. Manuel işlem hataları, silme yerine ters kayıtla düzeltilir.</p>';
 }
 if(tab!=='history')html+='<div class="akdp-footer"><button type="button" class="akdp-secondary" data-action="refresh">↻ Kayıtları Yenile</button></div>';
 root.innerHTML=html;bind(root);
}
function bind(root){
 root.querySelectorAll('[data-view]').forEach(x=>x.addEventListener('click',()=>{tab=x.dataset.view;message='';query='';render()}));
 root.querySelectorAll('[data-kind]').forEach(x=>x.addEventListener('click',()=>{kind=x.dataset.kind;query='';render()}));
 root.querySelector('#akdp-search')?.addEventListener('input',e=>{query=e.target.value.toLocaleLowerCase('tr-TR');const pos=e.target.selectionStart;render();const n=content()?.querySelector('#akdp-search');n?.focus();try{n?.setSelectionRange(pos,pos)}catch{}});
 root.querySelectorAll('[data-operation]').forEach(x=>x.addEventListener('click',()=>{action=x.dataset.operation;render()}));
 root.querySelectorAll('[data-type]').forEach(x=>x.addEventListener('click',()=>{type=x.dataset.type;selectedCode=type==='tam'?'9900022':'9900023';render()}));
 root.querySelector('#akdp-code')?.addEventListener('change',e=>{selectedCode=e.target.value;const other=root.querySelector('#akdp-other');if(other)other.hidden=selectedCode!=='other'});
 root.querySelector('#akdp-manual')?.addEventListener('submit',saveManual);
 root.querySelectorAll('[data-reverse]').forEach(x=>x.addEventListener('click',()=>reverseManual(x.dataset.reverse)));
 root.querySelectorAll('[data-action="refresh"]').forEach(x=>x.addEventListener('click',load));
 root.querySelector('[data-action="export"]')?.addEventListener('click',exportExcel);
}
async function paginate(path){const arr=[];for(let offset=0;offset<50000;offset+=1000){const qs=path+(path.includes('?')?'&':'?')+'limit=1000&offset='+offset;const a=await req(qs);if(!Array.isArray(a))throw Error('Supabase beklenmeyen yanıt verdi.');arr.push(...a);if(a.length<1000)return arr;}throw Error('Kayıt sınırı aşıldı; eksik toplam gösterilmedi.');}
async function load(){if(loading||saving)return;loading=true;loadError='';render();try{
 const [invoice,ledger]=await Promise.all([
  paginate('/rest/v1/ak_depo_ambalaj_girisleri?select=delivery_id,satirlar,kayit_tarihi&order=kayit_tarihi.desc'),
  paginate('/rest/v1/ak_depo_palet_hareketleri?select=id,request_id,code,name,palet_sinifi,islem,miktar,neden,aciklama,kaydeden_adi,kayit_tarihi,duzeltilen_hareket_id&order=kayit_tarihi.desc')
 ]);deliveries=invoice;manual=ledger;message='';
 }catch(e){deliveries=[];manual=[];loadError=e.message||String(e);if(/404|does not exist|PGRST205|schema cache|relation .* not found/i.test(loadError))loadError='Yeni manuel palet SQL kurulumunu Supabase SQL Editor bölümünde çalıştırın.';}
 finally{loading=false;render()}}
const requestId=()=>typeof crypto?.randomUUID==='function'?crypto.randomUUID():null;
async function saveManual(e){e.preventDefault();if(saving)return;
 const f=e.currentTarget,qty=Number(f.elements.namedItem('qty').value),reason=f.elements.namedItem('reason').value,note=f.elements.namedItem('note').value.trim();
 const other=selectedCode==='other',code=other?f.elements.namedItem('customCode').value.trim():selectedCode;
 const name=other?f.elements.namedItem('customName').value.trim():`${label(type)} · ${reference[code]?.[0]||'Palet'}`;
 if(!/^\d{7}$/.test(code)||name.length<3||name.length>160||!Number.isSafeInteger(qty)||qty<1||qty>999999||!reason){message='Palet kodu, miktar ve nedeni kontrol edin.';render();return;}
 const payload={p_code:code,p_name:name,p_palet_sinifi:type,p_islem:action,p_miktar:qty,p_neden:reason,p_aciklama:note};
 const signature=JSON.stringify(payload);const id=pending?.signature===signature?pending.id:requestId();if(!id){message='Güvenli işlem kimliği üretilemedi. Tarayıcıyı güncelleyin.';render();return;}
 pending={signature,id};if(!confirm(`${label(type)} · ${code}\n${action==='giris'?'+':'−'}${fmt(qty)} adet\n\nBu manuel hareket kaydedilsin mi?`))return;
 saving=true;render();try{
  await req('/rest/v1/rpc/ak_depo_palet_manuel_kaydet',{method:'POST',body:{p_request_id:id,...payload}});
  pending=null;tab='inventory';message='✓ Manuel palet hareketi kaydedildi.';saving=false;
  await load();message='✓ Manuel palet hareketi kaydedildi.';render();
 }catch(err){saving=false;message='Kayıt sonucu doğrulanamadı: '+err.message+' Aynı işlemi tekrar girmeden önce Hareket Geçmişi’ni kontrol edin.';render()}
}
async function reverseManual(id){if(saving)return;const src=manual.find(r=>r.id===id);if(!src||src.islem==='duzeltme')return;
 const reason=prompt('Bu manuel hareket neden geri alınıyor? (en az 5 karakter)');if(reason===null)return;
 const trimmed=reason.trim();if(trimmed.length<5||trimmed.length>300){message='Geri alma nedeni 5-300 karakter olmalıdır.';render();return;}
 if(!confirm('Bu manuel hareket silinmeyecek; miktarı ters yönde kaydeden bir düzeltme hareketi oluşturulacak. Devam edilsin mi?'))return;
 const idempotency=requestId();if(!idempotency){message='Güvenli işlem kimliği üretilemedi.';render();return;}
 saving=true;render();try{await req('/rest/v1/rpc/ak_depo_palet_manuel_geri_al',{method:'POST',body:{p_request_id:idempotency,p_hareket_id:id,p_neden:trimmed}});saving=false;await load();tab='history';message='✓ Ters hareket kaydedildi. Orijinal işlem geçmişte korunuyor.';render()}
 catch(e){saving=false;message='Geri alma sonucu doğrulanamadı: '+e.message+'. Aynı işlemi yeniden denemeden önce geçmişi yenileyin.';render()}
}
async function exportExcel(){if(loadError||loading||saving)return;
 const button=content()?.querySelector('[data-action="export"]');if(button){button.disabled=true;button.textContent='Excel hazırlanıyor…';}
 try{
  if(!window.ExcelJS){await new Promise((resolve,reject)=>{const el=document.createElement('script');el.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';el.onload=resolve;el.onerror=()=>reject(Error('Excel kütüphanesi yüklenemedi; internet bağlantısını kontrol edin.'));document.head.appendChild(el)})}
  const ExcelJS=window.ExcelJS;if(!ExcelJS)throw Error('Excel kütüphanesi bulunamadı.');
  const wb=new ExcelJS.Workbook();wb.creator='AKTİVA';wb.created=new Date();
  const summary=stats(allRows()),sheet=wb.addWorksheet('Envanter Özeti');
  sheet.addRow(['AKTİVA · PALET ENVANTERİ — KAYITLI HAREKET RAPORU']);sheet.mergeCells('A1:F1');
  sheet.addRow(['Başlangıç stoğu tanımlı değil; bu rapor GERÇEK DEPO MEVCUDU değildir.']);sheet.mergeCells('A2:F2');
  sheet.addRow(['Tür','Palet Kodu','Palet / Marka','Toplam Giriş','Toplam Çıkış','Kayıtlı Net']);
  for(const x of summary.groups.sort((a,b)=>a.kind.localeCompare(b.kind)||a.code.localeCompare(b.code)))sheet.addRow([x.kind==='kasa'?'Kasa / Box':label(x.type),x.code,x.name,x.entry,x.exit,x.net]);
  const movements=wb.addWorksheet('Hareket Geçmişi');movements.addRow(['Tarih / Saat','Kaynak','Tür','Kod','Palet / Marka','Giriş (+)','Çıkış (-)','Net','Personel','Neden','Açıklama']);
  for(const x of allRows())movements.addRow([date(x.date),x.source,x.kind==='kasa'?'Kasa / Box':label(x.type),x.code,x.name,Math.max(x.amount,0),Math.max(-x.amount,0),x.amount,x.user,x.reason,x.note]);
  for(const sh of [sheet,movements]){
   sh.views=[{state:'frozen',ySplit:sh===sheet?3:1}];sh.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};sh.pageMargins={left:.3,right:.3,top:.5,bottom:.5,header:.2,footer:.2};
   sh.columns=(sh===sheet?[26,17,45,18,18,18]:[22,22,22,15,46,15,15,14,25,30,40]).map(width=>({width}));
   const head=sh===sheet?3:1;const hr=sh.getRow(head);hr.height=32;hr.font={bold:true,color:{argb:'FFFFFFFF'}};hr.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF172B45'}};hr.alignment={vertical:'middle',wrapText:true};
   for(let i=head+1;i<=sh.rowCount;i++){const r=sh.getRow(i);if(i%2===0)r.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F4F8'}};r.alignment={vertical:'middle',wrapText:true}}
   sh.autoFilter={from:{row:head,column:1},to:{row:Math.max(head,sh.rowCount),column:sh.columnCount}};
  }
  sheet.getRow(1).font={bold:true,size:15,color:{argb:'FF233F5C'}};sheet.getRow(2).font={italic:true,color:{argb:'FF9E602E'}};
  const bytes=await wb.xlsx.writeBuffer();const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='AKTIVA_Palet_Envanteri_'+new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'})+'.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(e){message='Excel oluşturulamadı: '+e.message;render()}
 finally{const b=content()?.querySelector('[data-action="export"]');if(b){b.disabled=false;b.textContent='Excel Raporu (.xlsx)'}}
}
function close(){panel()?.remove();document.body.classList.remove('akdp-scroll-lock')}
function open(){if(!authorized()||panel())return;style();tab='inventory';kind='palet';query='';message='';loadError='';
 const el=document.createElement('div');el.className='akdp-overlay';el.id='akdp-overlay';el.innerHTML='<section class="akdp-panel" role="dialog" aria-modal="true" aria-labelledby="akdp-title"><header class="akdp-header"><div><small class="akdp-eyebrow">AKTİVA · MAL KABUL</small><h2 id="akdp-title">Depodaki Paletler</h2><p class="akdp-lead">Otomatik irsaliye girişleri, manuel palet işlemleri ve hareket geçmişi.</p></div><button class="akdp-close" type="button" aria-label="Kapat">×</button></header><div id="akdp-content" aria-live="polite"></div></section>';
 el.addEventListener('click',e=>{if(e.target===el)close()});el.querySelector('.akdp-close').addEventListener('click',close);el.addEventListener('keydown',e=>{if(e.key==='Escape'){close();e.stopPropagation()}});
 document.body.appendChild(el);document.body.classList.add('akdp-scroll-lock');el.querySelector('.akdp-close').focus();load();
}
window.AKTIVA_OPEN_DEPODAKI_PALETLER=open;
})();
