/* AKTİVA · sade forklift operasyon ekranı / mevcut veritabanı işlemleri korunur */
(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const role=()=>document.body.dataset.role;
const ds=()=>typeof deliveries!=='undefined'?deliveries:[];
const ps=()=>typeof items!=='undefined'?items:[];
const fmt=s=>s?new Date(s).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',hour12:false}):'—';
const key=s=>String(s||'').toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]/g,'');
let progress=[],moves=[],catalog=[],catalogState='loading',catalogError='',catalogSynced='',catalogSource='supabase',view='home',filter='waiting',expanded=null,loaded=false,busy=false,lastCount=-1,alertOn=false,search='',message='',showCount=40,localCatalog=[],staffNames={},movementSearch='',movementLimit=50,historyError='';
const moved=p=>moves.filter(m=>m.product_id===p.id).reduce((a,m)=>a+Number(m.qty||0),0);
const left=p=>Math.max(0,Number(p.pallet_count||0)-moved(p));
const remainingRows=()=>ps().filter(p=>Number(p.pallet_count||0)>0&&left(p)>0);
const totalRemaining=()=>remainingRows().reduce((n,p)=>n+left(p),0);
const productsOf=d=>ps().filter(p=>p.delivery_id===d.id);
const status=d=>{const p=progress.find(x=>x.delivery_id===d.id);return p?.finished_at?'done':p?.started_at?'active':'waiting'};
const info=d=>{const arr=productsOf(d);return {n:arr.length,cartons:arr.reduce((n,p)=>n+Number(p.expected||0),0),pallets:arr.reduce((n,p)=>n+Number(p.pallet_count||0),0),remaining:arr.reduce((n,p)=>n+left(p),0)}};
const todayIstanbul=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const movementDate=v=>v?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v)):'';
const myMoves=()=>moves.filter(m=>String(m.placed_by||'').toLowerCase()===String(session?.user?.id||'').toLowerCase());
const todaysMoves=()=>myMoves().filter(m=>movementDate(m.placed_at)===todayIstanbul());
const lastMyMove=()=>[...myMoves()].sort((a,b)=>new Date(b.placed_at)-new Date(a.placed_at))[0];
const catalogFor=p=>catalog.find(x=>key(x.code)===key(p.sku)&&key(p.sku))||catalog.find(x=>key(x.name)===key(p.name));
function root(){let el=$('#ak-fork-host');if(!el){el=document.createElement('section');el.id='ak-fork-host';const app=$('#app');if(app)app.insertBefore(el,app.firstChild)}if(el&&role()==='count'&&el.parentElement!==document.body)document.body.appendChild(el);if(el&&role()==='fork'&&$('#app')&&el.parentElement!==$('#app'))$('#app').insertBefore(el,$('#app').firstChild);return el}
function styles(){if($('#ak-fork-new-style'))return;const st=document.createElement('style');st.id='ak-fork-new-style';st.textContent=`body[data-role="fork"] #app > :not(#ak-fork-host){display:none!important}body[data-role="fork"] #ak-fork-host{display:block!important}#ak-fork-host{background:#111721;color:#f6f8fb;border-radius:17px;padding:15px;margin:12px 0;border:1px solid #323d4d;font:15px system-ui,sans-serif}#ak-fork-host *{box-sizing:border-box}#ak-fork-host button{border:0;border-radius:11px;background:#c81027;color:#fff;padding:12px 15px;font:inherit;font-weight:650;cursor:pointer}#ak-fork-host button:disabled{opacity:.6}#ak-fork-host button.af-quiet{background:#2b3544;color:#edf2f8;border:1px solid #48576c}#ak-fork-host .af-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:15px}#ak-fork-host .af-head>.af-bar{display:flex;flex-wrap:nowrap;flex-shrink:0;gap:7px}#ak-fork-host .af-head>.af-bar button{padding:10px 9px;white-space:nowrap;font-size:13px}#ak-fork-host .af-head>div:first-child{min-width:0;flex:1}#ak-fork-host .af-head h2{overflow-wrap:anywhere}@media(max-width:380px){#ak-fork-host .af-head{flex-wrap:wrap}#ak-fork-host .af-head>.af-bar{width:100%}#ak-fork-host .af-head>.af-bar button{flex:1}}#ak-fork-host .af-head h2{color:#fff;margin:4px 0;font-size:21px}#ak-fork-host .af-sub{font-size:12px;color:#a8b8c9}#ak-fork-host .af-home{display:grid;gap:11px}#ak-fork-host .af-nav{display:flex;align-items:center;text-align:left;width:100%;gap:14px;min-height:84px;padding:16px;border-radius:15px;background:#243043;color:#fff}#ak-fork-host .af-nav.primary{background:#cb1029}#ak-fork-host .af-nav .af-ico{font-size:25px}#ak-fork-host .af-nav small{display:block;font-size:12px;color:#ccd4df;font-weight:400;margin-top:5px}#ak-fork-host .af-nav .af-arrow{margin-left:auto}#ak-fork-host .af-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0 15px}#ak-fork-host .af-stat{background:#253144;border-radius:11px;padding:12px}#ak-fork-host .af-stat small{display:block;color:#b2c0d0}#ak-fork-host .af-stat strong{display:block;font-size:26px;margin-top:5px}#ak-fork-host .af-card{border:1px solid #43536a;background:#222e40;border-radius:13px;padding:14px;margin:11px 0}#ak-fork-host .af-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}#ak-fork-host .af-title{font-size:16px;font-weight:750}#ak-fork-host .af-dim{color:#b3c1d1;font-size:13px;line-height:1.55}#ak-fork-host .af-status{font-size:12px;border-radius:20px;padding:5px 9px;background:#574325;color:#ffe2ab}#ak-fork-host .af-status.active{background:#1d425e;color:#bbecff}#ak-fork-host .af-status.done{background:#1d4c39;color:#c6f6df}#ak-fork-host .af-pills{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}#ak-fork-host .af-pills button{background:#2d394a;padding:9px 13px}#ak-fork-host .af-pills button.on{background:#bd1027}#ak-fork-host .af-inside{border-top:1px solid #445369;margin-top:12px;padding-top:12px}#ak-fork-host .af-info{padding:10px;border-radius:9px;background:#2d3b4d;margin:9px 0}#ak-fork-host input{width:100%;padding:13px;background:#1a2534;color:#fff;border:1px solid #59697c;border-radius:10px;font-size:16px}#ak-fork-host .af-search{margin:11px 0}#ak-fork-host .af-empty{padding:20px 8px;text-align:center;color:#a7b7c8}#ak-fork-host .af-green{color:#b3ffca}#ak-fork-host .af-note{background:#2a3748;padding:11px;border-radius:10px;color:#d5e2ef;font-size:13px}#ak-fork-host .af-back{margin:0 0 14px}@media(min-width:750px){#ak-fork-host{max-width:840px;margin:15px auto}}`;document.head.append(st)}
const staffLabel=id=>staffNames[String(id||'').toLowerCase()]||((typeof session!=='undefined'&&session?.user?.id===id&&typeof profile!=='undefined'&&profile?.full_name)?profile.full_name:'Ad soyad bulunamadı');
function historyRows(){return [...moves].sort((a,b)=>new Date(b.placed_at)-new Date(a.placed_at));}
function historyMarkup(){const all=historyRows();const q=key(movementSearch);const found=all.filter(m=>{const p=ps().find(x=>x.id===m.product_id),d=ds().find(x=>x.id===m.delivery_id);return !q||[p?.name,p?.sku,d?.supplier,d?.vehicle,staffLabel(m.placed_by)].some(v=>key(v).includes(q));});let html='';
html+=`<div class="af-stat" style="margin:12px 0"><small>Görüntülenen yerleştirme hareketi</small><strong>${found.length}</strong></div><input id="af-history-search" type="search" autocomplete="off" placeholder="Ürün, firma veya personel ara" value="${esc(movementSearch)}"><div id="af-history-results">`;
for(const m of found.slice(0,movementLimit)){const p=ps().find(x=>x.id===m.product_id),d=ds().find(x=>x.id===m.delivery_id);html+=`<div class="af-card"><div class="af-bar"><strong>${esc(p?.name||'Ürün bilgisi bulunamadı')}</strong><strong class="af-green">${Number(m.qty)||0} palet</strong></div><div class="af-dim">${esc(d?.supplier||'Firma bilinmiyor')}</div><div class="af-dim">Yerleştiren: ${esc(staffLabel(m.placed_by))}</div><div class="af-dim">Tarih ve saat: ${esc(fmt(m.placed_at))}</div></div>`;}
if(!found.length)html+='<p class="af-empty">Yerleştirme kaydı bulunamadı.</p>';
html+='</div>';if(found.length>movementLimit)html+=`<button class="af-quiet" id="af-history-more" style="width:100%">Daha Fazla Göster (${movementLimit}/${found.length})</button>`;
if(all.length>=10000)html+='<p class="af-note">Çok eski yerleştirmeler liste sınırının dışında kalabilir.</p>';
return html;
}
function updateHistoryOnly(){const box=$('#af-history-body');if(box)box.innerHTML=historyMarkup();bindHistory();}
function bindHistory(){const search=$('#af-history-search');if(search)search.oninput=e=>{movementSearch=e.target.value;movementLimit=50;const temp=document.createElement('div');temp.innerHTML=historyMarkup();const current=$('#af-history-results'),updated=temp.querySelector('#af-history-results');if(current&&updated)current.innerHTML=updated.innerHTML;const button=$('#af-history-more');if(button){const count=historyRows().filter(m=>{const p=ps().find(x=>x.id===m.product_id),d=ds().find(x=>x.id===m.delivery_id),q=key(movementSearch);return !q||[p?.name,p?.sku,d?.supplier,d?.vehicle,staffLabel(m.placed_by)].some(v=>key(v).includes(q))}).length;button.style.display=count>movementLimit?'block':'none';button.textContent=`Daha Fazla Göster (${Math.min(movementLimit,count)}/${count})`;}};const more=$('#af-history-more');if(more)more.onclick=()=>{movementLimit+=50;updateHistoryOnly()};}
async function loadStaffNames(){
 if(typeof req!=='function'||typeof session==='undefined'||!session)return;
 // profiles listesi RLS ile kısıtlanabilir. Yalnızca yerleştirme yapan
 // personelin adını döndüren yetkili RPC kullanılır.
 try{
  const rows=await req('/rest/v1/rpc/aktiva_placement_staff_names',{method:'POST',body:{}});
  if(Array.isArray(rows))for(const p of rows){if(p.id&&p.full_name)staffNames[String(p.id).toLowerCase()]=p.full_name.trim();}
 }catch(e){
  // Eski kurulumlarda RPC henüz oluşturulmamışsa mevcut yetkili liste
  // sorgusunu dene. Başarısızlık kayıtları değiştirmez.
  try{
   const rows=await req('/rest/v1/profiles?select=id,full_name&limit=1000');
   if(Array.isArray(rows))for(const p of rows){if(p.id&&p.full_name)staffNames[String(p.id).toLowerCase()]=p.full_name.trim();}
  }catch(inner){console.warn('AKTİVA personel isim sorgusu:',inner.message);}
 }
 if(view==='placement-history')updateHistoryOnly();
}
function position(p){const x=catalogFor(p);return x?`<strong>Peron / Pozisyon: ${esc(x.position||'Tanımlanmamış')}</strong><span class="af-dim"> · Koli içi: ${esc(x.pack??'—')}</span>`:'<span class="af-dim">Peron bilgisi katalogda bulunamadı</span>'}
function dashboardIcon(name){const icons={"clipboard": "<rect x=\"6\" y=\"4\" width=\"12\" height=\"17\" rx=\"2\"/><path d=\"M9 4.5V3h6v1.5M9 10h6M9 14h5M9 18h4\"/><circle cx=\"18\" cy=\"18\" r=\"4\" fill=\"#ffd02e\" stroke=\"#ffd02e\"/><path d=\"M16.5 18h3\" stroke=\"#12263a\"/>", "pallet": "<path d=\"M3 20h18M4 17h16v3H4zM5 10h6v7H5zM13 10h6v7h-6zM9 3h6v7H9z\"/><path d=\"M4 20h16\" stroke=\"#ffd02e\" stroke-width=\"2.5\"/>", "pin": "<path d=\"M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z\"/><circle cx=\"12\" cy=\"10\" r=\"2.5\"/><ellipse cx=\"12\" cy=\"21\" rx=\"8\" ry=\"1.5\" stroke=\"#ffd02e\"/>", "chart": "<path d=\"M3 21h18M5 19v-5h3v5M11 19V9h3v10M17 19V4h3v15\"/><path d=\"M11 19V14M17 19v-6\" stroke=\"#ffd02e\" stroke-width=\"3\"/>", "box": "<path d=\"m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10M8 4.2l9 5\"/>"};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||""}</svg>`;}
function render(){const r=role(),el=root();if(view==='positions'&&document.activeElement?.id==='af-search'){drawSearch();return;}if(!['fork','count'].includes(r)){el.style.display='none';return}styles();el.style.display='block';const isFork=r==='fork';if(!isFork&&!['remaining','placement-history'].includes(view))view='remaining';const title=view==='home'?'Forklift Operasyonu':view==='shipments'?'Sevkiyat İşlemleri':view==='remaining'?'Mal Kabulde Bekleyen Paletler':view==='history'?'İşlem Geçmişi':view==='reports'?'Raporlar':view==='placement-history'?'Palet Yerleştirme Geçmişi':'Ürün Peronları';let html=isFork?`<div class="af-head afv-top"><div class="afv-person"><span class="afv-person-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/></svg></span><div><strong>${esc(profile?.full_name||session?.user?.user_metadata?.full_name||'Personel')}</strong><small>Forklift Personeli</small></div></div><div class="afv-tools"><button type="button" class="af-quiet afv-tool" data-af="refresh" aria-label="Yenile" title="Yenile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 12-3L20 12M4 12l2.5 6a7 7 0 0 0 12-3"/></svg></button><button type="button" class="af-quiet afv-tool" data-af="logout" aria-label="Çıkış" title="Çıkış"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 4H5v16h5M14 7l5 5-5 5M9 12h10"/></svg></button></div></div><h2 class="afv-page-heading">${title}</h2>`:`<div class="af-head"><div><div class="af-sub">AKTİVA · Mal Kabul Takibi</div><h2>${title}</h2></div><div class="af-bar"><button class="af-quiet" data-af="refresh">↻ Yenile</button><button class="af-quiet" data-af="close-count">✕ Kapat</button></div></div>`;
if(isFork){
  const entries=[['home','⌂','Anasayfa']];
  const active=view==='placement-history'?'history':view;
  const sidebar=entries.map(([id,ico,label])=>`<button type="button" class="afv-menu ${active===id?'selected':''}" data-view="${id}"><span class="afv-icon">${ico}</span><span>${label}</span></button>`).join('');
  html=`<div class="afv-shell"><nav class="afv-sidebar" aria-label="Forkliftçi menüsü"><div class="afv-side-brand"><img class="afv-real-logo" src="aktiva-forklift-logo.png" alt="AKTİVA"></div>${sidebar}</nav><div class="afv-main">${html}`;
}
if(isFork&&view!=='home')html+='<button class="af-quiet af-back" data-af="back">← Ana Ekran</button>';
if(view==='reports'){
const daily=todaysMoves(),mine=myMoves(),dates=[...new Set(mine.map(m=>movementDate(m.placed_at)))];const total=mine.reduce((a,m)=>a+Number(m.qty||0),0);
html+=`<div class="afv-report-tabs"><button class="on" type="button">Bugün</button><button class="af-quiet" data-view="history" type="button">İşlem Geçmişi →</button></div><div class="afv-report-grid"><div class="afv-report-stat"><small>Bugünkü İşlemlerim</small><strong>${daily.length}</strong><span>Taşıma hareketi</span></div><div class="afv-report-stat"><small>Bugün Taşınan</small><strong>${daily.reduce((a,m)=>a+Number(m.qty||0),0)}</strong><span>Palet</span></div><div class="afv-report-stat"><small>Toplam İşlemim</small><strong>${mine.length}</strong><span>Kayıt</span></div><div class="afv-report-stat"><small>Toplam Taşınan</small><strong>${total}</strong><span>Palet</span></div></div><h3 class="afv-section-title">Son Taşıma Hareketleri</h3>`;
const recent=[...mine].sort((a,b)=>new Date(b.placed_at)-new Date(a.placed_at)).slice(0,8);if(!recent.length)html+='<p class="af-empty">Henüz işlem kaydı bulunmuyor.</p>';for(const m of recent){const p=ps().find(x=>x.id===m.product_id);html+=`<div class="afv-activity"><span class="afv-activity-icon">${dashboardIcon('box')}</span><div><strong>${esc(p?.name||'Ürün')}</strong><small>${Number(m.qty||0)} palet</small></div><time>${esc(fmt(m.placed_at))}</time></div>`;}
}else if(view==='home'){
const last=lastMyMove(),p=last?ps().find(x=>x.id===last.product_id):null;
const clockTime=v=>v?new Date(v).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'}):'—';
const lastLine=last?`<div class="afv-last-row"><span class="afv-last-box" aria-hidden="true">${dashboardIcon('box')}</span><div class="afv-last-detail"><span class="afv-last-product">${esc(p?.name||'Ürün')}</span><span class="afv-last-meta">${Number(last.qty)||0} palet</span></div><span class="afv-last-clock">${esc(clockTime(last.placed_at))}</span></div>`:'<span class="afv-last-meta">Henüz işlem bulunmuyor</span>';
html+=`<div class="afv-cards"><button class="afv-card" data-view="shipments"><span class="afv-card-icon">${dashboardIcon('clipboard')}</span><strong>Taşıma Emirleri</strong><span class="afv-arrow">›</span></button><button class="afv-card" data-view="remaining"><span class="afv-card-icon">${dashboardIcon('pallet')}</span><strong>Stok Taşıma</strong><span class="afv-arrow">›</span></button><button class="afv-card" data-view="positions"><span class="afv-card-icon">${dashboardIcon('pin')}</span><strong>Lokasyon İşlemleri</strong><span class="afv-arrow">›</span></button><button class="afv-card" data-view="reports"><span class="afv-card-icon">${dashboardIcon('chart')}</span><strong>Raporlar</strong><span class="afv-arrow">›</span></button></div><div class="afv-dashboard-stats"><div class="afv-summary"><span>Mal Kabulde Bekleyen</span><strong>${totalRemaining()}</strong><small>Palet</small></div><div class="afv-summary"><span>Bugün Taşınan</span><strong>${todaysMoves().length}</strong><small>Taşıma işlemi</small></div><div class="afv-summary afv-latest"><span>Son İşlem</span><div class="afv-last-content">${lastLine}</div></div></div>`;
}else if(view==='placement-history'){
html+='<div id="af-history-body">'+historyMarkup()+'</div>';
}else if(view==='positions'){
html+=`<div class="af-note">Ürün adını yazın; eşleşen ürünlerin güncel peronlarını görün. Liste arama yapınca açılır.</div><div id="af-catalog-status" class="af-dim" style="margin-top:12px"></div><button class="af-quiet" type="button" data-af="catalogrefresh" style="margin-top:8px">↻ Güncel Ürün Listesini Getir</button><input class="af-search" type="search" id="af-search" placeholder="Ürün adını yazın (ör. makarna)" value="${esc(search)}"><div id="af-results"></div><button class="af-quiet" style="display:none;width:100%;margin-top:12px" type="button" id="af-more">Daha Fazla Ürün Göster</button>`;
}else if(view==='remaining'){
let arr=remainingRows();html+=`<div class="af-stat"><small>Mal Kabulde bekleyen toplam</small><strong>${totalRemaining()} palet</strong></div>`;
if(!isFork)html+='<button type="button" class="af-quiet" data-view="placement-history" style="margin:12px 0;width:100%">📋 Palet Yerleştirme Geçmişini Gör</button>';if(arr.length===0)html+='<p class="af-empty">Bekleyen palet bulunmuyor.</p>';
for(const p of arr){const d=ds().find(x=>x.id===p.delivery_id);html+=`<div class="af-card"><div class="af-bar"><span class="af-title">${esc(p.name)}</span><strong>${left(p)} palet kaldı</strong></div><p class="af-dim">${esc(d?.supplier||'Firma bilinmiyor')} · ${fmt(d?.created_at||d?.arrived_at)}</p><p class="af-dim">Ürün kodu: ${esc(p.sku||catalogFor(p)?.code||'—')}</p><div>${position(p)}</div><p class="af-dim">Gelen: ${Number(p.pallet_count||0)} · Yerleştirilen: ${moved(p)} · Kalan: ${left(p)}</p>${isFork?`<button data-place="${esc(p.id)}">Palet Yerleştir</button>`:''}</div>`}
}else{
const history=view==='history';const arr=[...ds()].sort((a,b)=>new Date(b.created_at||b.arrived_at)-new Date(a.created_at||a.arrived_at));
if(!history)html+=`<div class="afv-section-hint">Sevkiyat durumuna göre filtreleyin</div><div class="af-pills">${[['waiting','Bekleyen'],['active','İşlemde'],['all','Tümü']].map(([k,v])=>`<button data-filter="${k}" class="${filter===k?'on':''}">${v}</button>`).join('')}</div>`;
const shown=arr.filter(d=>history?status(d)==='done':(filter==='all'?status(d)!=='done':status(d)===filter)).slice(0,100);
if(!shown.length)html+='<p class="af-empty">Bu bölümde sevkiyat bulunmuyor.</p>';
for(const d of shown){const s=info(d),state=status(d),pr=progress.find(x=>x.delivery_id===d.id);html+=`<div class="af-card"><div class="af-bar"><span class="af-title">${esc(d.supplier||'Firma belirtilmedi')}</span><span class="af-status ${state}">${state==='waiting'?'Bekliyor':state==='active'?'İşlemde':'Tamamlandı'}</span></div><div class="af-dim">Oluşturulma: ${fmt(d.created_at||d.arrived_at)}</div><div class="af-dim">${!d.vehicle||d.vehicle==='-'?'Plaka girilmedi':'Plaka: '+esc(d.vehicle)}</div><p>${s.n} ürün · ${s.cartons} koli · ${s.pallets} palet</p><button class="af-quiet" data-detail="${esc(d.id)}">${expanded===d.id?'Detayı Gizle':'Ürünleri ve Saatleri Gör'}</button>`;
if(expanded===d.id){html+=`<div class="af-inside"><div class="af-info af-dim">Başlangıç: ${fmt(pr?.started_at)} · Bitiş: ${fmt(pr?.finished_at)}${pr?.started_at&&pr?.finished_at?' · Süre: '+Math.round((new Date(pr.finished_at)-new Date(pr.started_at))/60000)+' dk':''}</div>`;
for(const p of productsOf(d))html+=`<div class="af-inside"><div class="af-title">${esc(p.name)}</div><div class="af-dim">Ürün kodu: ${esc(p.sku||catalogFor(p)?.code||'—')}</div><div>${position(p)}</div><div class="af-dim">${Number(p.expected||0)} koli · ${Number(p.pallet_count||0)} palet · Yerleştirilen ${moved(p)} · Kalan ${left(p)}</div>${isFork&&left(p)>0&&!history?`<button data-place="${esc(p.id)}" style="margin-top:8px">Palet Yerleştir</button>`:''}</div>`;
if(isFork&&!history){if(state==='waiting')html+=`<button data-action="start" data-delivery="${esc(d.id)}">İşleme Başladım</button>`;if(state==='active')html+=`<button data-action="finish" data-delivery="${esc(d.id)}">İşlemi Tamamladım</button>`;}html+='</div>';}html+='</div>'}
}
if(message)html+=`<p class="af-note" id="af-message" role="status">${esc(message)}</p>`;
if(isFork)html+='</div></div>';el.innerHTML=html;
el.querySelector('[data-af="refresh"]')?.addEventListener('click',()=>{load();loadCatalog();loadStaffNames()});el.querySelector('[data-af="catalogrefresh"]')?.addEventListener('click',()=>loadCatalog(true));el.querySelector('[data-af="logout"]')?.addEventListener('click',()=>$('#logout')?.click());el.querySelector('[data-af="close-count"]')?.addEventListener('click',()=>{el.classList.remove('af-count-visible');el.style.removeProperty('display');document.body.style.overflow='';});el.querySelector('[data-af="back"]')?.addEventListener('click',()=>{view='home';expanded=null;render()});el.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;expanded=null;message='';showCount=40;render();if(view==='positions')loadCatalog(true)});el.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;expanded=null;render()});el.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>{expanded=expanded===b.dataset.detail?null:b.dataset.detail;render()});el.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>place(b.dataset.place));el.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.delivery,b.dataset.action));el.querySelector('#af-search')?.addEventListener('input',e=>{search=e.target.value;showCount=40;drawSearch()});el.querySelector('#af-more')?.addEventListener('click',()=>{showCount+=40;drawSearch()});drawSearch();updateCatalogStatus();bindHistory();
}
function updateCatalogStatus(){
 const node=$('#af-catalog-status');if(!node)return;
 if(catalogState==='loading')node.textContent='Ürün listesi yükleniyor…';
 else if(catalogState==='error')node.textContent=`${catalog.length} ürün · Supabase erişim hatası: ${catalogError}. Yerel katalog varsa sadece yedek olarak gösterilir.`;
 else if(catalogState==='empty')node.textContent='Ortak katalogda ürün yok. Mal Kabul personeli Excel yükleyip Onayla ve Kaydet demeli.';
 else node.textContent=`Toplam ${catalog.length} ürün · ${catalogSource==='supabase'?'Supabase ortak kataloğu':'Yerel başlangıç kataloğu (güncelliği doğrulanmadı)'} · Kontrol: ${catalogSynced||'—'}`;
}
function drawSearch(){const node=$('#af-results');if(!node)return;updateCatalogStatus();const more=$('#af-more');if(!more)return;
 if(catalogState==='loading'&&!catalog.length){node.innerHTML='<p class="af-empty">Ürünler yükleniyor…</p>';more.style.display='none';return}
 const q=key(search);if(!q){node.innerHTML='<p class="af-empty">Peronunu öğrenmek istediğiniz ürünün adını yazın.</p>';more.style.display='none';return;}const found=catalog.filter(p=>key(p.name).includes(q));
 const visible=found.slice(0,showCount);
 node.innerHTML=visible.length?visible.map(p=>`<div class="af-card"><div class="af-title">${esc(p.name)}</div><div class="af-dim">Ürün kodu: ${esc(p.code)}</div><div style="padding:9px 0"><strong>📍 Yerleştirme peronu: ${esc(p.position||'Tanımlanmamış')}</strong></div><div class="af-dim">Koli içi: ${esc(p.pack??'—')} adet</div></div>`).join(''):'<p class="af-empty">'+(catalog.length?'Aradığınız ürün bulunamadı.':'Ürün kataloğunda henüz kayıt yok.')+'</p>';
 more.style.display=found.length>showCount?'block':'none';more.textContent=`Daha Fazla Ürün Göster (${Math.min(showCount,found.length)} / ${found.length})`;
}
async function loadLocalCatalog(){
 try{const r=await fetch('aktiva-urunler.json',{cache:'no-store'});if(!r.ok)throw Error('Yerel liste alınamadı');const data=await r.json();if(Array.isArray(data))localCatalog=data.filter(p=>p.code&&p.name).map(p=>({code:String(p.code),name:p.name,position:p.position||'',pack:p.pack??null,barcode:p.barcode||''}));}catch(e){console.warn('AKTİVA yerel ürün listesi:',e.message)}
}
let catalogBusy=false;
async function loadCatalog(force=false){
 if(catalogBusy||!['fork','count'].includes(role()))return;
 catalogBusy=true;catalogState=catalog.length?'ready':'loading';updateCatalogStatus();
 try{
  if(!localCatalog.length)await loadLocalCatalog();
  let all=[];let ok=false;let error='';
  if(typeof req==='function'&&typeof session!=='undefined'&&session){
   try{
    let offset=0;const limit=500;
    while(true){
     const page=await req('/rest/v1/aktiva_excel_catalog?select=code,name,position,pack,barcode&order=code.asc&limit='+limit+'&offset='+offset);
     if(!Array.isArray(page))throw Error('Ürün listesi yanıtı geçersiz');
     all.push(...page);if(page.length<limit)break;offset+=limit;
     if(offset>=200000)throw Error('Katalog 200.000 ürünü aştı');
    }
    ok=true;
   }catch(e){error=String(e.message||e)}
  }else error='Oturum veya sunucu bağlantısı hazır değil';
  // Supabase'de kayıt varsa tek doğruluk kaynağı odur; eski yerel peronlarla karıştırma.
  const byCode=new Map((ok&&all.length?[]:localCatalog).map(p=>[key(p.code),p]));
  for(const p of all)if(p.code&&p.name)byCode.set(key(p.code),p);
  catalog=[...byCode.values()].sort((a,b)=>String(a.position||'').localeCompare(String(b.position||''),'tr-TR',{numeric:true}));
  catalogSource=ok&&all.length?'supabase':'local';
  catalogState=!catalog.length?(error?'error':'empty'):(error?'error':'ready');
  catalogError=error;catalogSynced=new Date().toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'});
 }catch(e){catalogState='error';catalogError=String(e.message||e)}
 finally{catalogBusy=false;updateCatalogStatus();if(view==='positions')drawSearch();else if(document.activeElement?.tagName!=='INPUT')render()}
}
async function load(){if(busy||!['fork','count'].includes(role())||typeof req!=='function'||typeof session==='undefined'||!session)return;busy=true;try{const [p,m]=await Promise.all([req('/rest/v1/aktiva_forklift_progress?select=*&limit=2000'),req('/rest/v1/aktiva_pallet_placements?select=*&limit=10000')]);progress=p;moves=m;loaded=true;message='';const pending=ds().filter(d=>status(d)==='waiting').length;if(role()==='fork'&&lastCount>=0&&pending>lastCount&&alertOn){try{const ctx=new(window.AudioContext||window.webkitAudioContext)(),o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=730;o.start();g.gain.setValueAtTime(.09,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.35);o.stop(ctx.currentTime+.36)}catch(_){}}lastCount=pending;if(view==='placement-history'){updateHistoryOnly()}else render()}catch(e){message='Operasyon verileri yüklenemedi: '+e.message;render()}finally{busy=false}}
async function place(id){if(role()!=='fork')return;const p=ps().find(x=>x.id===id);if(!p)return;const raw=prompt(`${p.name}\nMal Kabulde ${left(p)} palet var.\nKaç palet yerleştirdiniz?`,'1');if(raw===null)return;const n=Number(raw);if(!Number.isSafeInteger(n)||n<1||n>left(p)){alert('1 ile kalan miktar arasında tam sayı girin.');return}if(!confirm(`${p.name} için ${n} palet yerleştirildi olarak kaydedilsin mi?`))return;try{await req('/rest/v1/rpc/aktiva_place_pallets',{method:'POST',body:{p_product_id:id,p_qty:n}});await load()}catch(e){alert('Palet kaydı yapılamadı: '+e.message)}}
async function action(id,kind){if(role()!=='fork')return;if(kind==='finish'&&!confirm('Forklift işlemi tamamlansın mı? Yerleştirilmemiş paletler bekleyen listesinde kalır.'))return;try{await req('/rest/v1/rpc/aktiva_fork_action',{method:'POST',body:{p_delivery_id:id,p_action:kind}});await load()}catch(e){alert('Kayıt yapılamadı: '+e.message)}}
// Mal Kabul ana ekranı: takip sayfaları, sevkiyat girişinden ayrı açılır.
function countLaunchers(){
 if(role()!=='count')return;
 const ui=$('#aktivaCountUI');if(!ui||ui.classList.contains('hidden'))return;
 const header=ui.querySelector('.ak-user');if(!header||!ui.querySelector('#ak-new')||ui.querySelector('#ak-count-pallet-links'))return;
 const box=document.createElement('div');box.id='ak-count-pallet-links';
 box.innerHTML='<button type="button" data-count-panel="remaining">📦 Mal Kabulde Bekleyen Paletler</button><button type="button" data-count-panel="placement-history">📋 Palet Yerleştirme Geçmişi</button>';
 header.insertAdjacentElement('afterend',box);
 box.querySelectorAll('[data-count-panel]').forEach(b=>b.addEventListener('click',()=>{
  view=b.dataset.countPanel;expanded=null;movementSearch='';movementLimit=50;
  const pane=root();document.body.appendChild(pane);pane.classList.add('af-count-visible');document.body.style.overflow='hidden';
  render();pane.style.setProperty('display','block','important');load();loadStaffNames();
 }));
}
function installCountUI(){
 if($('#ak-count-fork-integration'))return;
 const sheet=document.createElement('style');sheet.id='ak-count-fork-integration';
 sheet.textContent='body[data-role="count"] #ak-fork-host:not(.af-count-visible){display:none!important}body[data-role="count"] #ak-fork-host.af-count-visible{display:block!important;position:fixed!important;inset:0!important;z-index:2147482000!important;overflow-y:auto!important;overscroll-behavior:contain;background:#111722!important;margin:0!important;padding:calc(env(safe-area-inset-top, 0px) + 14px) 15px calc(env(safe-area-inset-bottom, 0px) + 24px)!important;border:0!important;border-radius:0!important}#ak-count-pallet-links{display:grid;grid-template-columns:1fr;gap:9px;margin:12px 0}#ak-count-pallet-links button{padding:14px;text-align:left;border:1px solid #39475a;background:#202b3b;color:#fff;border-radius:12px;font-size:14px;font-weight:650;min-height:52px}';
 document.head.appendChild(sheet);
 const app=$('#app');if(app){new MutationObserver(()=>countLaunchers()).observe(app,{childList:true,subtree:true});countLaunchers()}
}
window.addEventListener('aktiva:catalog-updated',()=>loadCatalog(true));window.addEventListener('load',()=>{root();installCountUI();render();setInterval(()=>{if(!document.hidden&&['fork','count'].includes(role()))load()},8000);setInterval(()=>{if(!document.hidden&&['fork','count'].includes(role()))loadCatalog()},20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&['fork','count'].includes(role()))loadCatalog(true)});window.addEventListener('online',()=>loadCatalog(true));document.addEventListener('click',()=>{alertOn=true},{once:true});setTimeout(()=>{load();loadCatalog();loadStaffNames()},1000)});
})();
