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

/* AKTIVA Mal Kabul V2: forklift ana ekraninin yerlesim dili; yalnizca count ana sayfasi. */
body[data-role="count"] #aktivaCountUI{max-width:none!important;width:100%!important;margin:0!important;padding:0!important;background:transparent!important;overflow:visible!important;color:#f6f9ff}
body[data-role="count"] #aktivaCountUI.ak-v2-home{display:block!important;min-height:100dvh;position:relative;isolation:isolate}
body[data-role="count"] #aktivaCountUI.ak-v2-home:before{content:"";position:fixed;inset:0;z-index:-1;background:linear-gradient(90deg,#061322dd,#061322a8),url('forklift-depo-arkaplan.webp') center/cover;filter:blur(8px);transform:scale(1.04);pointer-events:none}
#aktivaCountUI .ak-v2-shell{display:grid;grid-template-columns:150px minmax(0,1fr);min-height:100dvh}
#aktivaCountUI .ak-v2-side{background:#061421ee;border-right:1px solid #37546b;padding:16px 7px;display:flex;flex-direction:column;gap:18px;align-items:center}
#aktivaCountUI .ak-v2-logo{width:100%;max-width:125px;border-radius:17px;object-fit:contain;box-shadow:0 10px 25px #0006}
#aktivaCountUI .ak-v2-sidehome{background:#ffd138!important;color:#101b29!important;border:0!important;border-radius:13px!important;min-height:110px;width:100%;font-size:16px;font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
#aktivaCountUI .ak-v2-sidehome span{font-size:30px}
#aktivaCountUI .ak-v2-main{min-width:0;padding:20px clamp(10px,2.4vw,34px) 44px}
#aktivaCountUI .ak-v2-top{display:flex;align-items:center;gap:10px;margin-bottom:23px}
#aktivaCountUI .ak-v2-person{flex:1;min-width:0;border:1px solid #426b88;border-radius:16px;background:#061b30dc;padding:12px 15px;display:flex;gap:12px;align-items:center}
#aktivaCountUI .ak-v2-person-icon{font-size:27px}
#aktivaCountUI .ak-v2-person strong{display:block;overflow-wrap:anywhere;font-size:15px}
#aktivaCountUI .ak-v2-person small{display:block;color:#b3c4d8;font-size:12px}
#aktivaCountUI .ak-v2-topbtn{border:1px solid #416e90!important;border-radius:13px!important;background:#102b43!important;color:white!important;padding:12px!important;min-width:44px;font-size:21px}
#aktivaCountUI .ak-v2-title{font-size:clamp(23px,3vw,34px);margin:0 0 28px;color:#fff;font-weight:850}
#aktivaCountUI .ak-v2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
#aktivaCountUI .ak-v2-card{min-width:0;min-height:185px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;background:linear-gradient(145deg,#193b54f5,#0a1b2ff5)!important;border:1px solid #40799e!important;border-bottom:6px solid #ffcf30!important;border-radius:20px!important;color:#fff!important;padding:16px 8px!important;text-align:center;box-shadow:0 12px 25px #0005}
#aktivaCountUI .ak-v2-card .ak-v2-ico{font-size:42px;line-height:1.1;color:#ffce30}
#aktivaCountUI .ak-v2-card strong{font-size:clamp(14px,2.4vw,19px);line-height:1.28}
#aktivaCountUI .ak-v2-card .ak-v2-arrow{font-size:26px;color:#ffcf30;font-weight:900}
#aktivaCountUI .ak-v2-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:30px}
#aktivaCountUI .ak-v2-stat,#aktivaCountUI .ak-v2-last{border:1px solid #416783;border-radius:18px;background:#071d32e8;color:white;padding:18px;min-width:0}
#aktivaCountUI .ak-v2-stat strong{font-size:29px;color:#ffce30;display:block;margin-top:8px}
#aktivaCountUI .ak-v2-stat small{color:#c0cddd}
#aktivaCountUI .ak-v2-last{margin-top:13px;display:flex;flex-direction:column;gap:12px}
#aktivaCountUI .ak-v2-lastline{border-top:1px solid #42637c;padding-top:13px;display:flex;align-items:center;gap:10px}
#aktivaCountUI .ak-v2-lastline b{border-left:3px solid #ffce30;padding-left:10px;flex:1;min-width:0;overflow-wrap:anywhere}
#aktivaCountUI .ak-v2-lastline small{color:#b8c7d9}
#aktivaCountUI .ak-v2-shortcuts{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
#aktivaCountUI .ak-v2-shortcuts button{background:#142f46!important;border:1px solid #4c7593!important;color:white!important;border-radius:12px!important;padding:12px!important;font-weight:700}
#aktivaCountUI.ak-v2-home>.ak-successes{display:none!important}
#aktivaCountUI.ak-v2-home>#ac-open,#aktivaCountUI.ak-v2-home>#ak-seven-launch{display:none!important}
@media(max-width:560px){#aktivaCountUI .ak-v2-shell{grid-template-columns:82px minmax(0,1fr)}#aktivaCountUI .ak-v2-side{padding:12px 5px}#aktivaCountUI .ak-v2-logo{border-radius:11px}#aktivaCountUI .ak-v2-sidehome{font-size:11px;min-height:90px}#aktivaCountUI .ak-v2-sidehome span{font-size:24px}#aktivaCountUI .ak-v2-main{padding:15px 9px 35px}#aktivaCountUI .ak-v2-card{min-height:165px;gap:11px;padding:12px 5px!important;border-radius:17px!important}#aktivaCountUI .ak-v2-card .ak-v2-ico{font-size:35px}#aktivaCountUI .ak-v2-title{font-size:23px;margin-bottom:22px}#aktivaCountUI .ak-v2-stat{padding:12px}#aktivaCountUI .ak-v2-stat strong{font-size:24px}#aktivaCountUI .ak-v2-last{padding:13px}#aktivaCountUI .ak-v2-person{padding:9px}#aktivaCountUI .ak-v2-topbtn{padding:9px!important;min-width:36px}#aktivaCountUI .ak-v2-top{gap:6px}}
`;document.head.appendChild(style)}
function toast(t){msg=t;render();}
async function notifyForkliftAfterCount(product, delivery){
 const base=String(window.MK_CONFIG?.url||localStorage.getItem('mk_supabase_url')||'').replace(/\/$/,'');
 const key=window.MK_CONFIG?.key||'';
 if(!base||!key||!session?.access_token)throw Error('Supabase bağlantısı veya oturum eksik');
 const res=await fetch(base+'/functions/v1/send-push',{
  method:'POST',headers:{'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+session.access_token},
  body:JSON.stringify({event:'count_completed',delivery_id:delivery?.id||product.delivery_id,vehicle:delivery?.vehicle||'',supplier:delivery?.supplier||'',product_id:product.id,title:'AKTİVA • Yeni sayım',body:(product.name||'Ürün')+' sayımı tamamlandı. Forklift ekibi kontrol edebilir.'})
 });
 const raw=await res.text();let data;try{data=JSON.parse(raw)}catch{data=null}
 if(!res.ok||data?.error||data?.success===false)throw Error(String(data?.error||data?.message||raw||'Sunucu hatası').slice(0,160)+' ('+res.status+')');
 return data;
}

function build(){installStyle();if($a('aktivaCountUI'))return;const el=document.createElement('section');el.id='aktivaCountUI';el.className='hidden';$a('app').insertBefore(el,$a('message'));}
function nav(to){if(to==='list')shipmentDate=today();
view=to;opened=null;editId=null;msg='';render();}
function options(arr,q){if(!q?.trim())return '';return [...arr].filter(x=>x.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))&&x.toLocaleLowerCase('tr')!==q.toLocaleLowerCase('tr')).slice(0,5).map(x=>`<button type="button" class="ak-suggestion" data-suggest="${safe(x)}">${safe(x)}</button>`).join('')}
function summary(){const day=today(),me=session?.user?.id;const mine=dlist().filter(d=>d.created_by===me&&dateOf(d.arrived_at)===day);const counted=plist().filter(p=>p.counted_by===me&&p.count_completed&&dateOf(p.counted_at)===day);return {shipments:mine.length,products:counted.length,pallets:counted.reduce((a,p)=>a+Number(p.pallet_count||0),0)}}
function countInfo(p){const expected=Number(p.expected||0),received=Number(p.received||0),damaged=Number(p.damaged||0),missing=Math.max(0,expected-received),excess=Math.max(0,received-expected),sound=Math.max(0,received-damaged);return {expected,received,damaged,missing,excess,sound};}
function message(s){if(!s.products)return 'Yeni bir gün, yeni fırsatlar.';if(s.products>=10)return 'Bugün büyük emek verdin, teşekkürler!';if(s.products>=3)return 'Güzel ilerliyorsun, emeğine sağlık!';return 'İyi bir başlangıç yaptın!'}
function render(){build();const el=container();el.classList.toggle('hidden',!logged());el.classList.toggle('ak-v2-home',logged()&&view==='home');if(!logged())return;
const me=profile?.full_name||'Personel', stats=summary();firmNames=new Set([...firmNames,...dlist().map(d=>d.supplier).filter(Boolean)]);productNames=new Set([...productNames,...plist().map(p=>p.name).filter(Boolean)]);
let html='';
if(view==='home'){
 const day=today(), todays=dlist().filter(d=>dateOf(d.arrived_at)===day), pal=todays.reduce((sum,d)=>sum+Number(d.pallets||0),0), finished=todays.filter(d=>d.status==='done').length;
 const latest=[...dlist()].sort((a,b)=>new Date(b.arrived_at||0)-new Date(a.arrived_at||0))[0];
 const lastText=latest?safe(latest.supplier||latest.vehicle||'Sevkiyat'):'Henüz sevkiyat yok';
 const lastTime=latest?timeOf(latest.arrived_at):'';
 html=`<div class="ak-v2-shell"><aside class="ak-v2-side"><img class="ak-v2-logo" src="aktiva-logo.png" alt="AKTİVA"><button class="ak-v2-sidehome" id="ak-v2-home"><span>⌂</span>Anasayfa</button></aside><main class="ak-v2-main"><div class="ak-v2-top"><div class="ak-v2-person"><span class="ak-v2-person-icon">♙</span><div><strong>${safe(me)}</strong><small>Mal Kabul Personeli</small></div></div><button class="ak-v2-topbtn" id="ak-v2-refresh" aria-label="Yenile">↻</button><button class="ak-v2-topbtn" id="ak-logout" aria-label="Çıkış">⇥</button></div><h2 class="ak-v2-title">Mal Kabul Operasyonu</h2><div class="ak-v2-grid"><button class="ak-v2-card" id="ak-list"><span class="ak-v2-ico">🚚</span><strong>Mal Kabul<br>İşlemleri</strong><span class="ak-v2-arrow">❯</span></button><button class="ak-v2-card" id="ak-v2-barcode"><span class="ak-v2-ico">▥</span><strong>Barkod<br>İşlemleri</strong><span class="ak-v2-arrow">❯</span></button><button class="ak-v2-card" id="ak-v2-catalog"><span class="ak-v2-ico">▣</span><strong>Ürün<br>Kataloğu</strong><span class="ak-v2-arrow">❯</span></button><button class="ak-v2-card" id="ak-asn"><span class="ak-v2-ico">▤</span><strong>İrsaliye<br>İşlemleri</strong><span class="ak-v2-arrow">❯</span></button></div><div class="ak-v2-stats"><div class="ak-v2-stat"><b>Bugün Gelen</b><strong>${pal}</strong><small>Palet</small></div><div class="ak-v2-stat"><b>Tamamlanan Sayım</b><strong>${finished}</strong><small>Sevkiyat</small></div></div><div class="ak-v2-last"><b>Son İşlem</b><div class="ak-v2-lastline"><span style="font-size:27px">▣</span><b>${lastText}</b><small>${safe(lastTime)}</small></div></div><div class="ak-v2-shortcuts"><button id="ak-new">＋ Yeni Sevkiyat</button></div></main></div>`;
}else html=`<div class="ak-user"><span class="ak-avatar">♙</span><div style="flex:1;min-width:0"><small>Hoş geldin</small><strong>${safe(me)}</strong><small>Mal Kabul Personeli</small></div><button type="button" id="ak-logout" class="ak-outline" style="flex-shrink:0;padding:9px 12px;font-size:12px">Çıkış Yap</button></div>`;
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
  if(opened===d.id){
   const done=ps.filter(p=>p.count_completed).length;
   const shipment=d;
   const totals=ps.reduce((a,p)=>{const x=countInfo(p);a.expected+=x.expected;if(p.count_completed){a.received+=x.received;a.missing+=x.missing;a.excess+=x.excess;a.damaged+=x.damaged;}return a;},{expected:0,received:0,missing:0,excess:0,damaged:0});
   html+=`<div class="ak-count-summary"><strong>İrsaliye / Sayım Karşılaştırması</strong><div class="ak-count-grid"><span>Beklenen <b>${totals.expected}</b></span><span>Sayılan <b>${totals.received}</b></span><span>Eksik <b>${totals.missing}</b></span><span>Fazla <b>${totals.excess}</b></span><span>Hasarlı <b>${totals.damaged}</b></span></div><small>${done}/${ps.length} ürün sayıldı</small><div class="ak-progress"><i style="width:${ps.length?Math.round(done*100/ps.length):0}%"></i></div><label>Ürün ara<input type="search" id="ak-product-filter" placeholder="Ürün adı" value="${safe(productSearch)}"></label><div class="ak-filter-actions"><button type="button" data-filter="all">Tümü</button><button type="button" data-filter="pending">Sayılmayan</button><button type="button" data-filter="done">Sayılan</button></div></div>`;
   if(ps.length&&done===ps.length){
    html+=`<div class="ak-finish-panel" style="padding:12px;background:#152b21;border:1px solid #32794f;border-radius:12px;margin:12px 0"><strong>${d.status==='done'?'✓ Sevkiyat sayımı tamamlandı':'Tüm ürünler sayıldı'}</strong><p style="font-size:12px;margin:8px 0">${d.status==='done'?'Forklift bildirim işlemi tamamlandı veya denendi.':'Forkliftçiye tek bildirim göndermek için sevkiyatı bitirin.'}</p>${d.status==='done'?'':`<button type="button" class="ak-submit" data-finish-delivery="${safe(d.id)}" style="width:100%">✓ Sevkiyat Sayımını Bitir ve Bildir</button>`}</div>`;
   }
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
el.querySelector('#ak-v2-home')?.addEventListener('click',()=>nav('home'));
el.querySelector('#ak-v2-refresh')?.addEventListener('click',async()=>{try{await sync(true);toast('Veriler yenilendi.')}catch(e){toast('Yenileme hatası: '+e.message)}});
el.querySelector('#ak-v2-barcode')?.addEventListener('click',()=>{const launch=el.querySelector('#ak-seven-launch');if(launch){launch.click();const tools=el.querySelector('#ak-seven-tools');if(tools){tools.style.display='block';tools.scrollIntoView({behavior:'smooth',block:'start'})}}else toast('Barkod araçları yükleniyor, tekrar deneyin.')});
el.querySelector('#ak-v2-catalog')?.addEventListener('click',()=>{const launch=el.querySelector('#ac-open');if(launch)launch.click();else toast('Ürün kataloğu henüz yüklenmedi.')});

el.querySelector('#ak-all-dates')?.addEventListener('click',()=>{shipmentDate='';render()});el.querySelector('#ak-date-filter')?.addEventListener('change',e=>{shipmentDate=e.target.value;opened=null;editId=null;render()});
el.querySelector('#ak-shipment-search')?.addEventListener('input',e=>{shipmentSearch=e.target.value;opened=null;editId=null;const pos=e.target.selectionStart;render();const field=el.querySelector('#ak-shipment-search');field?.focus();try{field?.setSelectionRange(pos,pos)}catch(_){}});
el.querySelector('#ak-asn')?.addEventListener('click',()=>{nav('asn');loadAsn()});el.querySelector('#ak-new')?.addEventListener('click',()=>nav('create'));el.querySelector('#ak-list')?.addEventListener('click',()=>nav('list'));el.querySelector('#ak-back')?.addEventListener('click',()=>nav('home'));
el.querySelector('#ak-asn-search')?.addEventListener('input',e=>{asnQuery=e.target.value;asnOpened=null;const pos=e.target.selectionStart;render();const input=el.querySelector('#ak-asn-search');input?.focus();try{input?.setSelectionRange(pos,pos)}catch(_){}});
el.querySelectorAll('[data-asn-open]').forEach(b=>b.onclick=()=>{asnOpened=asnOpened===b.dataset.asnOpen?null:b.dataset.asnOpen;render()});
el.querySelectorAll('[data-asn-import]').forEach(b=>b.onclick=async()=>{if(asnBusy)return;const a=asnRecords.find(x=>x.id===b.dataset.asnImport);if(!a)return;asnBusy=true;try{if(a.delivery_id){shipmentDate='';shipmentSearch=a.plate||a.supplier;await sync(true);opened=a.delivery_id;view='list';toast('Mevcut sayım kaydı açıldı.');return;}
 const result=await req('/rest/v1/rpc/aktiva_import_supplier_shipment',{method:'POST',body:{shipment_id:a.id}});const id=result?.delivery_id||result;if(!id)throw Error('Sayım kaydı alınamadı');await sync(true);shipmentDate='';shipmentSearch=a.plate||a.supplier;opened=id;view='list';toast('Sevkiyat sayım ekranına aktarıldı.');}catch(e){toast('Aktarma hatası: '+e.message)}finally{asnBusy=false}});
el.querySelector('#ak-product-filter')?.addEventListener('input',e=>{productSearch=e.target.value;render();const input=el.querySelector('#ak-product-filter');input?.focus()});el.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{productFilter=b.dataset.filter;render()});
el.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{opened=opened===b.dataset.open?null:b.dataset.open;editId=null;productFilter='all';productSearch='';render()});
el.querySelectorAll('[data-finish-delivery]').forEach(b=>b.onclick=async()=>{
 const id=b.dataset.finishDelivery;
 if(!navigator.onLine){toast('İnternet bağlantısı gerekli.');return}
 if(!confirm('Sevkiyatın bütün sayımı tamamlandı. Forkliftçiye bir kez bildirim gönderilsin mi?'))return;
 b.disabled=true;
 try{
  await sync(true);
  const products=plist().filter(p=>p.delivery_id===id);
  if(!products.length||products.some(p=>!p.count_completed))throw Error('Henüz sayılmamış ürün var.');
  const before=dlist().find(d=>d.id===id);
  if(before?.status==='done'){toast('Bu sevkiyat zaten tamamlandı; ikinci bildirim gönderilmedi.');return}
  const changed=await req('/rest/v1/deliveries?id=eq.'+encodeURIComponent(id)+'&status=eq.open',{method:'PATCH',body:{status:'done'},headers:{Prefer:'return=representation'}});
  if(!Array.isArray(changed)||changed.length!==1){await sync(true);toast('Sevkiyat zaten tamamlanmış veya güncellenemedi. Tekrar bildirim gönderilmedi.');return}
  await sync(true);
  try{
   const result=await notifyForkliftAfterCount(products[products.length-1],before);
   const sent=Number(result?.sent||0),total=Number(result?.total||0);
   toast(sent>0?'✓ Sevkiyat tamamlandı · '+sent+' cihaza bildirim gönderildi.':'✓ Sevkiyat tamamlandı · Bildirim ulaşmadı (0/'+total+' cihaz). '+String(result?.errors?.[0]||'Abonelikleri kontrol edin.').slice(0,100));
  }catch(error){toast('✓ Sevkiyat tamamlandı · Bildirim hatası: '+error.message)}
 }catch(error){toast('Tamamlama hatası: '+error.message)}finally{b.disabled=false}
});
el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{editId=b.dataset.edit;render()});el.querySelector('#ak-cancel')?.addEventListener('click',()=>{editId=null;render()});
el.querySelectorAll('[data-editform]').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const p=plist().find(x=>x.id===f.dataset.editform);if(!p)return;const actual=Number(f.elements.actual.value),a=Number(f.elements.pallets.value),dam=Number(f.elements.damaged.value);if(!Number.isSafeInteger(actual)||actual<0||!Number.isSafeInteger(a)||a<0||!Number.isSafeInteger(dam)||dam<0||dam>actual){toast('Miktarları kontrol et.');return}try{await req('/rest/v1/products?id=eq.'+encodeURIComponent(p.id),{method:'PATCH',body:{received:actual,pallet_count:a,damaged:dam,count_note:f.elements.count_note.value.trim(),counted_by:session.user.id,count_completed:true,counted_at:new Date().toISOString()}});const d=p.delivery_id;await sync(true);const ps=plist().filter(x=>x.delivery_id===d&&!x.count_completed);productFilter='all';productSearch='';editId=ps.length?ps[0].id:null;
toast('Sayım kaydedildi.'+(editId?' Sonraki ürün açıldı.':' Tüm ürünler sayıldı; sevkiyatı tamamlayabilirsiniz.'))}catch(err){toast(err.message)}});
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
