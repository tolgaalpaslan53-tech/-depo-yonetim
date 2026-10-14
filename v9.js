(()=>{'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s?new Date(s).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'short',timeStyle:'short'}):'—';
const day=s=>new Date(s).toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
const qty=h=>(Number(h||0)/2).toLocaleString('tr-TR',{maximumFractionDigits:1});
let tasks=[],moves=[],holds=[],holdMoves=[],events=[],users=[],refreshing=false,tab='active',selected=null,interval,historyState={};
const role=()=>profile?.role, own=()=>session?.user?.id;
const api=async(path,opts)=>req('/rest/v1/'+path,opts);
const action=async(name,id=null,data={})=>req('/rest/v1/rpc/v9_action',{method:'POST',body:{p_action:name,p_task:id,p_data:data}});
const sum=id=>moves.filter(m=>m.task_id===id).reduce((n,m)=>n+m.halves,0);
const name=id=>users.find(u=>u.id===id)?.full_name||'Personel';
const active=t=>!t.shipping_finished_at;
const row=t=>`<div class="v9entry"><b>${E(t.store)}</b> <span class="v9pill">Peron ${E(t.dock)}</span><div class="small">Açılış: ${date(t.created_at)} • Toplamacı: ${E(name(t.picker_id))}</div><div class="small">Toplama bitişi: ${date(t.picking_finished_at)} • Taşıma bitişi: ${date(t.moving_finished_at)}</div><div class="small">Taşınan: <b>${qty(sum(t.id))} palet</b> • Yüklenen: ${qty(t.loaded_halves)} • Sevkiyat: ${t.shipping_finished_at?'Tamamlandı':t.shipping_started_at?'Başladı':'Bekliyor'}</div><button type="button" class="alt" data-task="${t.id}">İşlemleri aç</button></div>`;
const msg=s=>{document.getElementById('v9Message').textContent=s};
async function load(){if(!session||!profile||refreshing)return;refreshing=true;try{
 const base=[api('v9_store_tasks?select=*&order=created_at.desc&limit=1000'),api('v9_moves?select=*&order=created_at.desc&limit=5000'),api('profiles?select=id,full_name&limit=1000')];
 if(['count','fork','admin'].includes(role()))base.push(api('v9_receiving_hold?select=*&order=created_at.desc&limit=1000'),api('v9_hold_moves?select=*&order=created_at.desc&limit=3000'));
 if(role()==='admin')base.push(api('v9_events?select=*&order=created_at.desc&limit=1000'));
 const data=await Promise.all(base);[tasks,moves,users]=data;if(['count','fork','admin'].includes(role()))[holds,holdMoves]=data.slice(3,5);if(role()==='admin')events=data[5];render();
 }catch(ex){msg('V9 kurulum veya bağlantı hatası: '+ex.message)}finally{refreshing=false}}
function render(){const root=document.getElementById('v9Body');if(!root)return;
 const fields=['v9From','v9To','v9StoreFilter','v9DockFilter','v9PersonFilter'];
 if(tab==='history')fields.forEach(id=>{const el=document.getElementById(id);if(el)historyState[id]=el.value});
 const activeEl=document.activeElement;const typing=activeEl&&root.contains(activeEl)&&['INPUT','TEXTAREA','SELECT'].includes(activeEl.tagName);
 if(typing)return;
 let html='<div class="v9tabs"><button data-tab="active">Aktif mağazalar</button><button data-tab="history">Tarih / geçmiş</button>';
 if(['count','fork','admin'].includes(role()))html+='<button data-tab="hold">Mal kabul bekleyen</button>';
 if(role()==='admin')html+='<button data-tab="audit">Yönetici</button>';
 html+='</div>';
 if(tab==='active'){
  if(role()==='picker')html+='<h3>Mağaza toplama başlat</h3><form id="v9Create"><div class="grid"><label>Mağaza adı<input name="store" required maxlength="120"></label><label>Size söylenen peron<input name="dock" required maxlength="30"></label></div><button>Toplamaya Başla</button></form>';
  html+='<h3>Aktif ve bekleyen mağazalar</h3><input id="v9Search" placeholder="Mağaza / peron ara" value="'+E(document.getElementById('v9Search')?.value||'')+'"><div id="v9List"></div>';
 }else if(tab==='history'){
  html+='<h3>Günlük / geçmiş palet hareketleri</h3><div class="grid"><label>Başlangıç<input type="date" id="v9From"></label><label>Bitiş<input type="date" id="v9To"></label><label>Mağaza<input id="v9StoreFilter" placeholder="Tümü"></label><label>Peron<input id="v9DockFilter" placeholder="Tümü"></label><label>Personel<select id="v9PersonFilter"><option value="">Tümü</option>'+users.map(u=>`<option value="${E(u.id)}">${E(u.full_name)}</option>`).join('')+'</select></label></div><div class="bar"><button type="button" data-range="today">Bugün</button><button type="button" data-range="yesterday">Dün</button><button type="button" data-range="week">Son 7 gün</button><button type="button" data-range="month">Son 30 gün</button><button type="button" id="v9Export">CSV / Excel</button></div><div id="v9History"></div>';
 }else if(tab==='hold'){
  html+='<h3>Mal kabulde bekleyen palet</h3>'+(role()==='admin'?'':'<form id="v9Hold"><div class="grid"><label>Ürün<input name="product" required></label><label>Konum<input name="location" required></label><label>Palet miktarı<input type="number" min="0.5" step="0.5" name="qty" required></label><label>Bekleme nedeni<input name="reason"></label></div><button>Bekleyen paleti kaydet</button></form>')+'<div id="v9Holds"></div>';
 }else if(tab==='audit')html+='<h3>Yönetici — işlem geçmişi</h3><div id="v9Audit"></div>';
 html+='<div id="v9Detail"></div>';root.innerHTML=html;
 root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;selected=null;render()});
 const create=root.querySelector('#v9Create');if(create)create.onsubmit=async ev=>{ev.preventDefault();const f=new FormData(create);await execute('create',null,{store:f.get('store'),dock:f.get('dock')})};
 const search=root.querySelector('#v9Search');if(search){search.oninput=drawList;drawList()}
 if(tab==='history'){
  const now=day(new Date());root.querySelector('#v9From').value=historyState.v9From||now;root.querySelector('#v9To').value=historyState.v9To||now;for(const id of ['v9StoreFilter','v9DockFilter','v9PersonFilter'])root.querySelector('#'+id).value=historyState[id]||'';
  root.querySelectorAll('#v9From,#v9To,#v9StoreFilter,#v9DockFilter,#v9PersonFilter').forEach(x=>x.oninput=()=>{historyState[x.id]=x.value;drawHistory()});
  root.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{const offset={today:0,yesterday:1,week:6,month:29}[b.dataset.range];const d=new Date();d.setDate(d.getDate()-offset);root.querySelector('#v9From').value=day(d);root.querySelector('#v9To').value=b.dataset.range==='yesterday'?day(d):now;historyState.v9From=root.querySelector('#v9From').value;historyState.v9To=root.querySelector('#v9To').value;drawHistory()});
  root.querySelector('#v9Export').onclick=exportCsv;drawHistory();
 }
 if(tab==='hold'){if(root.querySelector('#v9Hold'))root.querySelector('#v9Hold').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);await execute('hold_create',null,{product:f.get('product'),location:f.get('location'),reason:f.get('reason'),halves:Math.round(Number(f.get('qty'))*2)})};drawHolds()}
 if(tab==='audit')root.querySelector('#v9Audit').innerHTML=events.map(e=>`<div class="v9entry">${date(e.created_at)} • ${E(name(e.actor_id))} • ${E(e.event)} • ${E(tasks.find(t=>t.id===e.task_id)?.store||'')} • ${E(JSON.stringify(e.details))}</div>`).join('')||'Kayıt yok';
 if(selected)detail(selected);
}
function drawList(){const s=document.getElementById('v9Search');if(!s)return;const q=s.value.toLocaleLowerCase('tr-TR');const filtered=tasks.filter(t=>active(t)&&(t.store+' '+t.dock).toLocaleLowerCase('tr-TR').includes(q)).sort((a,b)=>a.dock.localeCompare(b.dock,'tr',{numeric:true})||a.dock_order-b.dock_order);document.getElementById('v9List').innerHTML=filtered.map(row).join('')||'<p>Aktif mağaza bulunamadı.</p>';document.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>{selected=b.dataset.task;detail(selected)})}
function detail(id){const t=tasks.find(t=>t.id===id),el=document.getElementById('v9Detail');if(!t||!el)return;const total=sum(id);const previous=tasks.filter(x=>x.dock===t.dock&&x.dock_order<t.dock_order&&!x.shipping_finished_at&&!x.moving_finished_at);let h=`<div class="v9detail"><h3>${E(t.store)} — Peron ${E(t.dock)}</h3><p>Açılış: ${date(t.created_at)} • Toplamacı: ${E(name(t.picker_id))}<br>Toplama bitişi: ${date(t.picking_finished_at)}<br>Taşıma bitişi: ${date(t.moving_finished_at)}<br>Sevkiyat başlangıcı: ${date(t.shipping_started_at)}<br>Sevkiyat bitişi: ${date(t.shipping_finished_at)}</p><h2>${qty(total)} palet taşındı</h2>`;
 if(previous.length)h+='<p class="v9warning">⚠️ Bu peronda önceki mağazanın taşıması tamamlanmadı: '+previous.map(x=>E(x.store)).join(', ')+'</p>';
 if(t.shipping_started_at&&!t.shipping_finished_at)h+='<p class="v9warning">⚠️ Sevkiyat başladı. Taşıma yapılırsa yükleme sayısını kontrol edin.</p>';
 if(role()==='picker'&&!t.picking_finished_at&&t.picker_id===own())h+='<button data-action="pick_done">Mağaza Toplaması Bitti</button> ';
 if(role()==='mover'&&!t.shipping_finished_at){h+='<button data-move="2">+1 Palet</button> <button data-move="1">+0,5 Palet</button> <button class="alt" data-action="undo">Son Kendi İşlemimi Geri Al</button> ';if(!t.moving_finished_at)h+='<button data-action="move_done">Taşıma Tamamlandı</button> '}
 if(role()==='shipping'&&!t.shipping_finished_at){if(!t.shipping_started_at)h+='<button data-action="ship_start">Sevkiyata Başla</button>';else h+=`<label>Gerçek yüklenen palet<input type="number" id="v9Loaded" min="0" step="0.5" value="${t.loaded_halves/2}"></label><p>Fark: ${qty(t.loaded_halves-total)} palet</p><button data-action="ship_load">Yüklenen Miktarı Kaydet</button> <button data-action="ship_done">Sevkiyat Tamamlandı</button>`}
 
 h+='<h4>Palet hareket geçmişi</h4>'+moves.filter(m=>m.task_id===id).map(m=>`<div class="small">${date(m.created_at)} • ${E(name(m.actor_id))} • ${m.halves>0?'+':''}${qty(m.halves)} palet${m.undo_of?' (geri alma)':''}</div>`).join('')+'</div>';el.innerHTML=h;
 el.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>execute('move',id,{halves:Number(b.dataset.move),request_id:crypto.randomUUID()}));
 el.querySelectorAll('[data-action]').forEach(b=>b.onclick=async()=>{const a=b.dataset.action;let data={};if(a==='ship_load')data={halves:Math.round(Number(el.querySelector('#v9Loaded').value)*2)};if(a==='dock_change')data={dock:el.querySelector('#v9DockNew').value};if(['ship_done','move_done','pick_done','undo'].includes(a)&&!confirm('İşlem onaylansın mı?'))return;await execute(a,id,data)});
 
}
async function execute(a,id,data){const buttons=[...document.querySelectorAll('#v9Body button')];buttons.forEach(b=>b.disabled=true);try{await action(a,id,data);msg('İşlem kaydedildi.');await load()}catch(ex){msg('Hata: '+ex.message)}finally{buttons.forEach(b=>b.disabled=false)}}
function historyRows(){const from=document.getElementById('v9From')?.value,to=document.getElementById('v9To')?.value,store=document.getElementById('v9StoreFilter')?.value.toLocaleLowerCase('tr-TR'),dock=document.getElementById('v9DockFilter')?.value.toLocaleLowerCase('tr-TR'),person=document.getElementById('v9PersonFilter')?.value;return moves.filter(m=>{const t=tasks.find(t=>t.id===m.task_id);if(!t)return false;const d=day(m.created_at);return (!from||d>=from)&&(!to||d<=to)&&(!store||t.store.toLocaleLowerCase('tr-TR').includes(store))&&(!dock||t.dock.toLocaleLowerCase('tr-TR').includes(dock))&&(!person||m.actor_id===person)}).map(m=>{const t=tasks.find(t=>t.id===m.task_id);return [date(m.created_at),t.store,t.dock,name(m.actor_id),qty(m.halves),t.id]})}
function drawHistory(){const el=document.getElementById('v9History');if(!el)return;const rows=historyRows();el.innerHTML='<p><b>'+qty(rows.reduce((s,r)=>s+Math.round(Number(r[4].replace(',','.'))*2),0))+' palet</b> net hareket • '+rows.length+' işlem</p>'+rows.map(r=>`<div class="v9entry">${r.slice(0,5).map(E).join(' • ')}</div>`).join('')}
function exportCsv(){const rows=[['Tarih','Mağaza','Peron','Personel','Palet','İş numarası'],...historyRows()];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='v9-palet-hareketleri.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function drawHolds(){const el=document.getElementById('v9Holds');if(!el)return;el.innerHTML=holds.map(h=>{const used=holdMoves.filter(m=>m.hold_id===h.id).reduce((n,m)=>n+m.halves,0),remaining=h.initial_halves-used;return `<div class="v9entry"><b>${E(h.product)}</b> • ${E(h.location)} • ${qty(remaining)} palet kaldı<div class="small">${E(h.reason)} • ${date(h.created_at)} • ${E(name(h.created_by))}</div>${remaining>0&&role()!=='admin'?`<button data-hold="${h.id}" data-halves="1">0,5 içeri al</button> <button data-hold="${h.id}" data-halves="2" ${remaining<2?'disabled':''}>1 içeri al</button>`:''}</div>`}).join('');el.querySelectorAll('[data-hold]').forEach(b=>b.onclick=()=>execute('hold_move',b.dataset.hold,{halves:Number(b.dataset.halves)}))}
function init(){if(!session||!profile)return;let panel=document.getElementById('v9Panel');if(!panel){panel=document.createElement('section');panel.id='v9Panel';panel.className='card';panel.innerHTML='<h2>📦 Peron Takip</h2><p id="v9Message" class="small"></p><button id="v9Reload" class="alt">↻ V9 Yenile</button><div id="v9Body"></div>';document.getElementById('app').appendChild(panel);document.getElementById('v9Reload').onclick=load;}panel.classList.toggle('hidden',role()==='count'||role()==='fork');if(role()!=='count'&&role()!=='fork')load();clearInterval(interval);interval=setInterval(()=>{if(!document.hidden&&!panel.contains(document.activeElement))load()},12000)}
const old=boot;boot=async function(){await old();init()};if(session&&profile)init();
})();
