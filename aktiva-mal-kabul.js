/* AKTİVA: Mal Kabul sade mobil arayüz. Mevcut Supabase oturumunu ve tablolarını kullanır. */
(()=>{'use strict';
const $a=id=>document.getElementById(id), safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let scannedProduct=null;
window.AKTIVA_setShipmentScannedProduct=(p)=>{scannedProduct=p?{name:String(p.name||''),sku:String(p.code||''),barcode:String(p.barcode||''),units_per_carton:Number(p.pack)||null}:null;};
let view='home',lines=[],editId=null,opened=null,firmNames=new Set(),productNames=new Set(),msg='',draftName='',draftFirm='',draftPlate='',shipmentDate='',shipmentSearch='',productFilter='all',productSearch='',countStarted={},pendingSaves={},asnQuery='',asnRecords=[],asnError='',asnOpened=null,asnBusy=false;
const searchKey=s=>String(s||'').toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]/g,'');
const stamp=s=>s?new Date(s).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'-';
async function loadAsn(){if(!logged())return;try{asnRecords=await req('/rest/v1/aktiva_supplier_shipments?select=*&order=created_at.desc&limit=500');asnError='';}catch(e){asnError='Tedarikçi kayıtları yüklenemedi: '+e.message;asnRecords=[];}render();}
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
const displayDate=s=>s?String(s).split('-').reverse().join('/') : '';
const timeOf=s=>s?new Date(s).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'';
shipmentDate=today();
let lastToday=shipmentDate;
const dateOf=s=>s?new Date(s).toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'}):'';
const dlist=()=>typeof deliveries==='undefined'?[]:deliveries;
const plist=()=>typeof items==='undefined'?[]:items;
const logged=()=>typeof profile!=='undefined'&&profile?.role==='count'&&typeof session!=='undefined'&&!!session;
const container=()=> $a('aktivaCountUI');
function installStyle(){if($a('ak-professional-style'))return;const style=document.createElement('style');style.id='ak-professional-style';style.textContent=`
/* Üst bölüm sırası: personel bilgisi > ürün kataloğu > barkod araçları > ana işlemler. */
#aktivaCountUI:not(.hidden){display:flex;flex-direction:column}
#aktivaCountUI > .ak-user{order:-30}
#aktivaCountUI > #ac-open{order:-20}
#aktivaCountUI > #ak-seven-tools{order:-10}
#aktivaCountUI,#aktivaCountUI *{box-sizing:border-box}#aktivaCountUI{min-width:0;max-width:100%;overflow-x:hidden}#aktivaCountUI .ak-user{min-width:0}#aktivaCountUI .ak-user .ak-outline{max-width:96px;white-space:normal}#aktivaCountUI .ak-count-summary{padding:12px;border-top:1px solid #454954;background:#181e2a}#aktivaCountUI .ak-count-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:10px 0}#aktivaCountUI .ak-count-grid span{font-size:12px;background:#252b35;border-radius:9px;padding:8px}#aktivaCountUI .ak-count-grid b{display:block;font-size:17px}#aktivaCountUI .ak-progress{height:8px;background:#343b45;border-radius:12px;overflow:hidden;margin:10px 0}#aktivaCountUI .ak-progress i{display:block;height:100%;background:#d52337}#aktivaCountUI .ak-filter-actions{display:flex;gap:6px;flex-wrap:wrap}#aktivaCountUI .ak-filter-actions button{background:#343b45;color:white;padding:8px 10px}#aktivaCountUI .ak-diff{color:#ffadb7}#aktivaCountUI .ak-filter-card{background:#181e2a;border:1px solid #303743;border-radius:16px;padding:15px;display:grid;gap:9px;min-width:0;margin:12px 0 16px;box-sizing:border-box}
#aktivaCountUI .ak-filter-card label{font-size:13px;font-weight:650;color:#d6dce6;margin:0}
#aktivaCountUI .ak-filter-card input{display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box;border:1px solid #424a58;border-radius:11px;background:#101722;color:#fff;padding:13px 12px;font-size:16px;margin:0 0 5px;min-height:47px;color-scheme:dark}
#aktivaCountUI .ak-date-wrap{position:relative;width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow:hidden;border:1px solid #424a58;border-radius:11px;background:#101722;min-height:49px;display:flex;align-items:center;padding:0 13px}
#aktivaCountUI .ak-date-display{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;font-size:16px;color:#fff;pointer-events:none}
#aktivaCountUI .ak-date-wrap input[type=date]{position:absolute;inset:0;width:100%;height:100%;min-height:0;max-width:100%;margin:0;padding:0;border:0;opacity:0;cursor:pointer;z-index:2}
#aktivaCountUI .ak-date-wrap:focus-within{outline:2px solid #dc3049;outline-offset:1px}
#aktivaCountUI .ak-filter-card input:focus{outline:2px solid #dc3049;outline-offset:1px}
#aktivaCountUI .ak-filter-card input::placeholder{color:#9da5b3}
#aktivaCountUI .ak-list-count{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:13px 0;color:#fff;font-size:15px}
#aktivaCountUI .ak-list-count span{background:#2a303c;color:#e3e6ed;border-radius:18px;padding:5px 10px;font-size:12px;white-space:nowrap}
#aktivaCountUI .ak-shipment-pro{background:#181e2a;border:1px solid #303743;border-radius:14px;overflow:hidden;margin:9px 0;padding:0;min-width:0}
#aktivaCountUI .ak-shipment-pro .ak-shipment-head{width:100%;max-width:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;gap:9px;text-align:left;padding:14px;background:transparent;border:0;color:#fff}
#aktivaCountUI .ak-ship-title{font-size:15px;font-weight:700;overflow-wrap:anywhere}
#aktivaCountUI .ak-ship-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#c5ccd7;font-size:13px;flex-wrap:wrap}
#aktivaCountUI .ak-ship-detail{color:#929cab;font-size:12px}
#aktivaCountUI .ak-empty{text-align:center;color:#b3bac6;padding:22px 8px}
`;document.head.appendChild(style)}
function toast(t){msg=t;render();}
let akSendingDelivery=null;
async function notifyForkliftAfterCount(delivery, products){
 const base=String(window.MK_CONFIG?.url||localStorage.getItem('mk_supabase_url')||'').replace(/\/$/,'');
 const key=window.MK_CONFIG?.key||'';
 if(!base||!key||!session?.access_token)throw Error('Supabase bağlantısı veya oturum eksik');
 const res=await fetch(base+'/functions/v1/send-push',{
  method:'POST',headers:{'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+session.access_token},
  body:JSON.stringify({event:'count_completed',delivery_id:delivery.id,vehicle:delivery.vehicle||'',supplier:delivery.supplier||'',title:'AKTİVA • Sevkiyat sayımı tamamlandı',body:(delivery.supplier||'Yeni sevkiyat')+' · '+products.length+' ürünün sayımı tamamlandı. Forklift ekibi kontrol edebilir.'})
 });
 const raw=await res.text();let data;try{data=JSON.parse(raw)}catch{data=null}
 if(!res.ok||data?.error||data?.success===false)throw Error(String(data?.error||data?.message||raw||'Sunucu hatası').slice(0,160)+' ('+res.status+')');
 if(data?.sent===0||data?.sent_count===0||data?.delivered===0)throw Error('Bildirim gönderilecek kayıtlı cihaz bulunamadı.');
 return data;
}

function build(){installStyle();if($a('aktivaCountUI'))return;const el=document.createElement('section');el.id='aktivaCountUI';el.className='hidden';$a('app').insertBefore(el,$a('message'));}
window.addEventListener('aktiva:open-create',()=>{if(logged())nav('create')});
function nav(to){if(to==='list')shipmentDate=today();
view=to;opened=null;editId=null;msg='';render();}
function options(arr,q){if(!q?.trim())return '';return [...arr].filter(x=>x.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))&&x.toLocaleLowerCase('tr')!==q.toLocaleLowerCase('tr')).slice(0,5).map(x=>`<button type="button" class="ak-suggestion" data-suggest="${safe(x)}">${safe(x)}</button>`).join('')}
function summary(){const day=today(),me=session?.user?.id;const mine=dlist().filter(d=>d.created_by===me&&dateOf(d.arrived_at)===day);const counted=plist().filter(p=>p.counted_by===me&&p.count_completed&&dateOf(p.counted_at)===day);return {shipments:mine.length,products:counted.length,pallets:counted.reduce((a,p)=>a+Number(p.pallet_count||0),0)}}
function countInfo(p){const expected=Number(p.expected||0),received=Number(p.received||0),damaged=Number(p.damaged||0),missing=Math.max(0,expected-received),excess=Math.max(0,received-expected),sound=Math.max(0,received-damaged);return {expected,received,damaged,missing,excess,sound};}
function message(s){if(!s.products)return 'Yeni bir gün, yeni fırsatlar.';if(s.products>=10)return 'Bugün büyük emek verdin, teşekkürler!';if(s.products>=3)return 'Güzel ilerliyorsun, emeğine sağlık!';return 'İyi bir başlangıç yaptın!'}
function render(){build();const el=container();el.classList.toggle('hidden',!logged());if(!logged())return;
const me=profile?.full_name||'Personel', stats=summary();firmNames=new Set([...firmNames,...dlist().map(d=>d.supplier).filter(Boolean)]);productNames=new Set([...productNames,...plist().map(p=>p.name).filter(Boolean)]);
let html=`<div class="ak-user"><span class="ak-avatar">♙</span><div style="flex:1;min-width:0"><small>Hoş geldin</small><strong>${safe(me)}</strong><small>Mal Kabul Personeli</small></div><button type="button" id="ak-logout" class="ak-outline" style="flex-shrink:0;padding:9px 12px;font-size:12px">Çıkış Yap</button></div>`;
if(view==='home')html+=`<button class="ak-tile ak-primary" id="ak-new"><span class="ak-tile-icon">▣</span><strong>Yeni Sevkiyat Kaydı</strong></button><button class="ak-tile" id="ak-asn"><span class="ak-tile-icon">▣</span><strong>Tedarikçi Sevkiyatları</strong><small>Plaka, firma veya irsaliye ile ara</small></button><button class="ak-tile" id="ak-list"><span class="ak-tile-icon">▤</span><strong>Kaydedilen Sevkiyatlar</strong></button>`;
if(view==='asn'){
 html+=`<div class="ak-heading"><h2>Tedarikçi Sevkiyatları</h2><button class="ak-back" id="ak-back">Geri</button></div><div class="ak-filter-card"><label>Tek akıllı arama</label><input id="ak-asn-search" type="search" autocomplete="off" placeholder="Plaka, firma, irsaliye veya AKT numarası" value="${safe(asnQuery)}"><small>Sevkiyatlar tır gelene kadar kayıtlı kalır.</small></div>`;
 if(asnError)html+=`<p class="ak-message">${safe(asnError)}. Önce AKTIVA_SQL_TEDARIKCI.sql dosyasını Supabase SQL Editor'de çalıştırın.</p>`;
 const results=asnQuery.trim()?asnRecords.filter(x=>[x.plate,x.supplier,x.invoice,x.reference].some(v=>searchKey(v).includes(searchKey(asnQuery)))):[];
 html+=`<div class="ak-list-count"><strong>Arama sonuçları</strong><span>${results.length} kayıt</span></div>`;
 for(const d of results){const lines=Array.isArray(d.lines)?d.lines:[];const total=lines.reduce((n,x)=>n+Number(x.cartons||0),0);const pallets=lines.reduce((n,x)=>n+Number(x.pallets||0),0);
 html+=`<div class="ak-shipment ak-shipment-pro"><button class="ak-shipment-head" data-asn-open="${safe(d.id)}"><strong>${safe(d.supplier)}</strong><small>${safe(d.plate)} · ${safe(d.invoice||'İrsaliye yok')}</small><small>Kayıt: ${safe(stamp(d.created_at))} · ${safe(d.reference)}</small><small>${lines.length} ürün · ${total} koli · ${pallets} palet</small></button>`;
 if(asnOpened===d.id){html+=`<div class="ak-asn-detail">${lines.map(x=>`<div class="ak-product"><strong>${safe(x.name)}</strong><small>${Number(x.cartons||0)} koli · ${Number(x.pallets||0)} palet</small></div>`).join('')}<button class="ak-submit" data-asn-import="${safe(d.id)}" ${asnBusy?'disabled':''}>${d.delivery_id?'Mevcut Sayımı Aç':'Mal Kabul Sayımına Aktar'}</button></div>`;}
 html+='</div>';
 }
 if(asnQuery.trim()&&!results.length&&!asnError)html+='<p class="ak-empty">Eşleşen sevkiyat bulunamadı. Firma adı veya irsaliye numarasıyla da arayabilirsiniz.</p>';
}
if(view==='create')html+=`<div class="ak-heading"><h2>Yeni Sevkiyat</h2><button class="ak-back" id="ak-back">Geri</button></div><form id="ak-form"><label>Gönderen firma *<input id="ak-firm" autocomplete="off" required maxlength="150" placeholder="Firma adı" value="${safe(draftFirm)}"></label><div id="ak-firm-suggestions" class="ak-suggestions"></div><label>Plaka (isteğe bağlı)<input id="ak-plate" maxlength="80" placeholder="48 ABC 123" value="${safe(draftPlate)}"></label><h3>Ürün Listesi</h3><div id="ak-lines">${lines.map((p,i)=>`<div class="ak-line"><div><strong>${safe(p.name)}</strong><small>${p.cartons} koli · ${p.pallets} palet${p.sku?' · Kod: '+safe(p.sku):''}${p.units_per_carton?' · Koli içi: '+p.units_per_carton+' adet':''}</small></div><button type="button" class="ak-remove" data-remove="${i}">Sil</button></div>`).join('')}</div><label>Ürün adı<input id="ak-product" autocomplete="off" maxlength="200" placeholder="Ürün adı" value="${safe(draftName)}"></label><div id="ak-product-suggestions" class="ak-suggestions"></div><div class="ak-two"><label>Kaç koli?<input id="ak-cartons" type="number" min="1" step="1" placeholder="120"></label><label>Kaç palet?<input id="ak-pallets" type="number" min="1" step="1" placeholder="3"></label></div><button type="button" class="ak-outline" id="ak-add">+ Listeye Ürün Ekle</button><button type="submit" class="ak-submit" id="ak-save">Sevkiyatı Kaydet</button></form>`;
if(view==='list'){
 html+=`<div class="ak-heading"><h2>Kaydedilen Sevkiyatlar</h2><button class="ak-back" id="ak-back">Geri</button></div><div class="ak-filter-card"><label for="ak-date-filter">Sevkiyat tarihi</label><div class="ak-date-wrap"><span class="ak-date-display"><span id="ak-date-text">${safe(displayDate(shipmentDate))}</span><span aria-hidden="true">▦</span></span><input type="date" id="ak-date-filter" aria-label="Sevkiyat tarihi seç" value="${safe(shipmentDate)}"></div><button type="button" class="ak-outline" id="ak-all-dates">Tüm Tarihler</button><label for="ak-shipment-search">Sevkiyat ara</label><input type="search" id="ak-shipment-search" autocomplete="off" placeholder="Plaka, firma, irsaliye veya kayıt no" value="${safe(shipmentSearch)}"></div>`;
 const filtered=dlist().filter(d=>(!shipmentDate||dateOf(d.arrived_at)===shipmentDate)&&[d.supplier,d.vehicle,d.invoice,d.id].some(v=>searchKey(v).includes(searchKey(shipmentSearch)))).sort((a,b)=>new Date(b.arrived_at)-new Date(a.arrived_at));
 html+=`<div class="ak-list-count"><strong>Sevkiyat Kayıtları</strong><span>${filtered.length} kayıt</span></div>`;
 for(const d of filtered){
  const ps=plist().filter(p=>p.delivery_id===d.id);
  html+=`<div class="ak-shipment ak-shipment-pro"><button class="ak-shipment-head" data-open="${safe(d.id)}"><span class="ak-ship-title">🚚 &nbsp;${safe(d.supplier)}</span><span class="ak-ship-meta"><span>${safe(d.vehicle||'Plakasız')}</span><span>◷ ${safe(timeOf(d.arrived_at))}</span></span><span class="ak-ship-detail">${ps.length} ürün · ${safe(displayDate(dateOf(d.arrived_at)))}</span></button>`;
  if(ps.length&&ps.every(p=>p.count_completed===true||p.count_completed===1||p.count_completed==='true')){
   html+=`<div class="ak-count-summary"><strong>✓ ${safe(d.supplier)} — Tüm ürünler sayıldı</strong><p>Forkliftçi sevkiyatı görüntüleyebilir. Telefon bildirimi isteğe bağlıdır.</p><button type="button" class="ak-submit" data-notify-fork="${safe(d.id)}" ${akSendingDelivery===d.id?'disabled':''}>🔔 Forkliftçiye Bildirim Gönder</button></div>`;
  }
  if(opened===d.id){
   const done=ps.filter(p=>p.count_completed).length;
   const totals=ps.reduce((a,p)=>{const x=countInfo(p);a.expected+=x.expected;if(p.count_completed){a.received+=x.received;a.missing+=x.missing;a.excess+=x.excess;a.damaged+=x.damaged;}return a;},{expected:0,received:0,missing:0,excess:0,damaged:0});
   html+=`<div class="ak-count-summary"><strong>İrsaliye / Sayım Karşılaştırması</strong><div class="ak-count-grid"><span>Beklenen <b>${totals.expected}</b></span><span>Sayılan <b>${totals.received}</b></span><span>Eksik <b>${totals.missing}</b></span><span>Fazla <b>${totals.excess}</b></span><span>Hasarlı <b>${totals.damaged}</b></span></div><small>${done}/${ps.length} ürün sayıldı</small><div class="ak-progress"><i style="width:${ps.length?Math.round(done*100/ps.length):0}%"></i></div><label>Ürün ara<input type="search" id="ak-product-filter" placeholder="Ürün adı" value="${safe(productSearch)}"></label><div class="ak-filter-actions"><button type="button" data-filter="all">Tümü</button><button type="button" data-filter="pending">Sayılmayan</button><button type="button" data-filter="done">Sayılan</button></div></div>`;
   for(const p of ps.filter(p=>(productFilter==='all'||(productFilter==='done'?p.count_completed:!p.count_completed))&&searchKey(p.name).includes(searchKey(productSearch)))){ 
    html+=`<div class="ak-product"><strong>${safe(p.name)}</strong><small>İrsaliye: ${Number(p.expected||0)} koli · Sayılan: ${p.count_completed?Number(p.received||0):'—'} koli · ${Number(p.pallet_count||0)} palet</small>${p.count_completed?`<small class="ak-diff">Eksik: ${countInfo(p).missing} · Fazla: ${countInfo(p).excess} · Hasarlı: ${countInfo(p).damaged} · Sağlam: ${countInfo(p).sound}</small>`:''}<div class="ak-complete"><span>${p.count_completed?'✓ Sayımı Tamamlandı':'Bekliyor'}</span><button type="button" data-edit="${safe(p.id)}">${p.count_completed?'Düzenle':'Sayımı Tamamla'}</button></div>`;
    if(editId===p.id)html+=`<form class="ak-edit-form" data-editform="${safe(p.id)}"><label>Gerçek gelen koli<input name="actual" type="number" min="0" step="1" value="${p.count_completed?Number(p.received||0):Number(p.expected||0)}" required></label><label>Hasarlı koli<input name="damaged" type="number" min="0" step="1" value="${Number(p.damaged||0)}" required></label><label>Sayım notu<input name="count_note" maxlength="500" placeholder="Açıklama (isteğe bağlı)" value="${safe(p.count_note||'')}"></label><label>Gerçek palet sayısı<input name="pallets" type="number" min="0" step="1" value="${Number(p.pallet_count||0)}" required></label><div class="ak-two"><button type="button" class="ak-outline" id="ak-cancel">İptal</button><button type="submit" class="ak-submit">Kaydet</button></div></form>`;
    html+='</div>';
   }

  }
  html+='</div>';
 }
 if(!filtered.length)html+='<p class="ak-empty">Bu tarihte aramanızla eşleşen sevkiyat bulunamadı.</p>';
}

html+=`<div class="ak-successes"><div class="ak-success-title">★ Günlük Başarıların <span>${new Date().toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'})}</span></div><div class="ak-metrics"><div><strong>${stats.shipments}</strong><small>Sevkiyat</small></div><div><strong>${stats.products}</strong><small>Ürün</small></div><div><strong>${stats.pallets}</strong><small>Palet</small></div></div><p>${message(stats)}</p></div>`;
if(msg)html+=`<p class="ak-message" role="status">${safe(msg)}</p>`;el.innerHTML=html;
el.querySelector('#ak-logout')?.addEventListener('click',()=>{if(confirm('Oturumdan çıkış yapılsın mı?'))$a('logout')?.click()});
el.querySelector('#ak-all-dates')?.addEventListener('click',()=>{shipmentDate='';render()});el.querySelector('#ak-date-filter')?.addEventListener('change',e=>{shipmentDate=e.target.value;opened=null;editId=null;render()});
el.querySelector('#ak-shipment-search')?.addEventListener('input',e=>{shipmentSearch=e.target.value;opened=null;editId=null;const pos=e.target.selectionStart;render();const field=el.querySelector('#ak-shipment-search');field?.focus();try{field?.setSelectionRange(pos,pos)}catch(_){}});
el.querySelector('#ak-asn')?.addEventListener('click',()=>{nav('asn');loadAsn()});el.querySelector('#ak-new')?.addEventListener('click',()=>nav('create'));el.querySelector('#ak-list')?.addEventListener('click',()=>nav('list'));el.querySelector('#ak-back')?.addEventListener('click',()=>nav('home'));
el.querySelector('#ak-asn-search')?.addEventListener('input',e=>{asnQuery=e.target.value;asnOpened=null;const pos=e.target.selectionStart;render();const input=el.querySelector('#ak-asn-search');input?.focus();try{input?.setSelectionRange(pos,pos)}catch(_){}});
el.querySelectorAll('[data-asn-open]').forEach(b=>b.onclick=()=>{asnOpened=asnOpened===b.dataset.asnOpen?null:b.dataset.asnOpen;render()});
el.querySelectorAll('[data-asn-import]').forEach(b=>b.onclick=async()=>{if(asnBusy)return;const a=asnRecords.find(x=>x.id===b.dataset.asnImport);if(!a)return;asnBusy=true;try{if(a.delivery_id){shipmentDate='';shipmentSearch=a.plate||a.supplier;await sync(true);opened=a.delivery_id;view='list';toast('Mevcut sayım kaydı açıldı.');return;}
 const result=await req('/rest/v1/rpc/aktiva_import_supplier_shipment',{method:'POST',body:{shipment_id:a.id}});const id=result?.delivery_id||result;if(!id)throw Error('Sayım kaydı alınamadı');await sync(true);shipmentDate='';shipmentSearch=a.plate||a.supplier;opened=id;view='list';toast('Sevkiyat sayım ekranına aktarıldı.');}catch(e){toast('Aktarma hatası: '+e.message)}finally{asnBusy=false}});
el.querySelector('#ak-product-filter')?.addEventListener('input',e=>{productSearch=e.target.value;render();const input=el.querySelector('#ak-product-filter');input?.focus()});el.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{productFilter=b.dataset.filter;render()});
el.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{opened=opened===b.dataset.open?null:b.dataset.open;editId=null;productFilter='all';productSearch='';render()});
el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{editId=b.dataset.edit;render()});el.querySelector('#ak-cancel')?.addEventListener('click',()=>{editId=null;render()});
el.querySelectorAll('[data-editform]').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const p=plist().find(x=>x.id===f.dataset.editform);if(!p)return;const actual=Number(f.elements.actual.value),a=Number(f.elements.pallets.value),dam=Number(f.elements.damaged.value);if(!Number.isSafeInteger(actual)||actual<0||!Number.isSafeInteger(a)||a<0||!Number.isSafeInteger(dam)||dam<0||dam>actual){toast('Miktarları kontrol et.');return}try{await req('/rest/v1/products?id=eq.'+encodeURIComponent(p.id),{method:'PATCH',body:{received:actual,pallet_count:a,damaged:dam,count_note:f.elements.count_note.value.trim(),counted_by:session.user.id,count_completed:true,counted_at:new Date().toISOString()}});const d=p.delivery_id;await sync(true);const ps=plist().filter(x=>x.delivery_id===d&&!x.count_completed);productFilter='all';productSearch='';editId=ps.length?ps[0].id:null;
toast('Sayım kaydedildi.'+(editId?' Sonraki ürün açıldı.':' Tüm ürünler sayıldı; isterseniz forkliftçiye bildirim gönderebilirsiniz.'))}catch(err){toast(err.message)}});
el.querySelectorAll('[data-notify-fork]').forEach(b=>b.onclick=async()=>{
 const id=b.dataset.notifyFork;if(akSendingDelivery)return;
 const delivery=dlist().find(x=>x.id===id),products=plist().filter(x=>x.delivery_id===id);
 if(!delivery||!products.length||products.some(x=>!(x.count_completed===true||x.count_completed===1||x.count_completed==='true'))){toast('Önce sevkiyattaki bütün ürünlerin sayımını tamamlayın.');return}
 akSendingDelivery=id;b.disabled=true;
 try{await notifyForkliftAfterCount(delivery,products);toast('Forkliftçiye bildirim isteği gönderildi. Telefon teslimini kontrol edin.')}catch(err){toast('Bildirim gönderilemedi: '+err.message)}finally{akSendingDelivery=null}
});
el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{lines.splice(Number(b.dataset.remove),1);render()});
const fi=el.querySelector('#ak-firm'),pr=el.querySelector('#ak-product');if(fi){fi.oninput=()=>{draftFirm=fi.value;el.querySelector('#ak-firm-suggestions').innerHTML=options(firmNames,fi.value);bindSuggest('firm')};fi.dispatchEvent(new Event('input'))}if(pr){pr.oninput=()=>{if(scannedProduct&&pr.value.trim()!==scannedProduct.name)scannedProduct=null;draftName=pr.value;el.querySelector('#ak-product-suggestions').innerHTML=options(productNames,pr.value);bindSuggest('product')};pr.dispatchEvent(new Event('input'))}
el.querySelector('#ak-add')?.addEventListener('click',()=>{const n=pr.value.trim(),c=Number(el.querySelector('#ak-cartons').value),p=Number(el.querySelector('#ak-pallets').value);if(!n||!Number.isSafeInteger(c)||c<=0||!Number.isSafeInteger(p)||p<=0){toast('Ürün adı, koli ve palet sayılarını kontrol et.');return}draftFirm=fi.value;draftPlate=el.querySelector('#ak-plate').value;lines.push({name:n,cartons:c,pallets:p,sku:scannedProduct?.name===n?scannedProduct.sku:'',barcode:scannedProduct?.name===n?scannedProduct.barcode:'',units_per_carton:scannedProduct?.name===n?scannedProduct.units_per_carton:null});scannedProduct=null;draftName='';render()});
el.querySelector('#ak-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=fi.value.trim(),plate=el.querySelector('#ak-plate').value.trim();if(!f||!lines.length){toast('Firma ve en az bir ürün gir.');return}const b=el.querySelector('#ak-save');b.disabled=true;try{const now=new Date().toISOString(),obj={created_by:session.user.id,vehicle:plate||'-',supplier:f,invoice:'-',arrived_at:now,pallets:lines.reduce((a,p)=>a+p.pallets,0),cartons:lines.reduce((a,p)=>a+p.cartons,0),status:'open'};const ds=await req('/rest/v1/deliveries',{method:'POST',body:obj,headers:{Prefer:'return=representation'}});const id=ds?.[0]?.id;if(!id)throw Error('Sevkiyat kaydı oluşturuldu ancak ürün bağlantısı alınamadı.');const rows=lines.map(p=>({counted_by:session.user.id,delivery_id:id,name:p.name,sku:p.sku||'',expected:p.cartons,received:0,count_completed:false,damaged:0,returned:0,pallet_count:p.pallets}));await req('/rest/v1/products',{method:'POST',body:rows,headers:{Prefer:'return=minimal'}});lines=[];draftName='';draftFirm='';draftPlate='';await sync(true);opened=id;view='list';toast('Sevkiyat kaydedildi.')}catch(err){toast('Kayıt hatası: '+err.message)}finally{b.disabled=false}});
}
function bindSuggest(type){const root=container(),id=type==='firm'?'ak-firm':'ak-product';root.querySelectorAll(`#ak-${type}-suggestions [data-suggest]`).forEach(b=>b.onclick=()=>{root.querySelector('#'+id).value=b.dataset.suggest;if(type==='firm')draftFirm=b.dataset.suggest;else draftName=b.dataset.suggest;root.querySelector(`#ak-${type}-suggestions`).innerHTML=''})}
const oldRender=typeof render==='function'?render:null;
// Ana uygulamanın yenileme ve oturum akışına müdahale etmeden, veriler yenilendiğinde ekranı güncelle.
const observe=new MutationObserver(()=>{if(!logged())container()?.classList.add('hidden');else if(container()?.classList.contains('hidden'))render()});
window.addEventListener('load',()=>{build();observe.observe($a('app'),{attributes:true,attributeFilter:['class']});setInterval(()=>{const currentDay=today();if(currentDay!==lastToday){if(shipmentDate===lastToday)shipmentDate=currentDay;lastToday=currentDay;}if(logged()&&!document.hidden&&view!=='create'&&editId===null&&!container()?.contains(document.activeElement))render()},10000);render()});
})();
