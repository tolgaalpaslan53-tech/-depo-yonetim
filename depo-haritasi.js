/* AKTİVA Depo Haritası · 04.11.2026
   Yalnızca yönetici düzenler, toplamacı görüntüler. Ürün/sayım/forklift tablolarına yazmaz.
   Ortak harita için Supabase SQL kurulumu gereklidir. Yerel taslak yalnızca o cihazdadır.
*/
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const C=52,MAX_BLOCKS=800,MAX_BYTES=600000,DEMO_FLAG='demo';
const TYPES={select:{label:'Seç'},rack:{label:'Raf',icon:'▥',w:2,h:1},aisle:{label:'Koridor',icon:'⇆',w:1,h:3},wall:{label:'Duvar',icon:'▬',w:3,h:1},door:{label:'Kapı',icon:'↪',w:1,h:1},dock:{label:'Peron',icon:'🚚',w:2,h:2},area:{label:'Alan',icon:'▧',w:3,h:2}};
const empty=()=>({version:1,cols:22,rows:14,blocks:[]});
const clone=x=>JSON.parse(JSON.stringify(x));
const text=x=>String(x??'');
const esc=x=>text(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=x=>text(x).trim().toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const bound=(v,min,max)=>Math.max(min,Math.min(max,v));
let layout=empty(),session=null,profile=null,admin=false,tool='select',zoom=1,selected=null,matched=new Set();
let remoteRevision=0,remoteReady=false,remoteUpdated=null,dirty=false,drag=null,writeBusy=false,draftTimer=null;
let draftKey='';
const config=()=>({url:text(window.MK_CONFIG?.url).replace(/\/+$/,''),key:text(window.MK_CONFIG?.key)});
const setMessage=(msg,kind='info')=>{$('message').textContent=msg;$('message').dataset.kind=kind};
const state=msg=>{$('saveState').textContent=msg};
const prettyDate=d=>d?new Date(d).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'Henüz sunucu kaydı yok';
function decodeError(body,status){return body?.message||body?.error_description||body?.error||`HTTP ${status}`}
async function api(path,{method='GET',body,headers={}}={},retry=true){
 const cfg=config();if(!cfg.url.startsWith('https://')||!cfg.key)throw Error('Supabase bağlantı ayarları bulunamadı.');
 const h={apikey:cfg.key,...headers};if(session?.access_token)h.Authorization='Bearer '+session.access_token;
 if(body!==undefined)h['Content-Type']='application/json';
 let r;
 try{r=await fetch(cfg.url+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)})}catch{throw Error('Sunucuya erişilemiyor. İnternet bağlantını kontrol et.')} 
 if(r.status===401&&retry&&session?.refresh_token){
   const rr=await fetch(cfg.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
   if(rr.ok){session=await rr.json();localStorage.setItem('mk_session',JSON.stringify(session));return api(path,{method,body,headers},false)}
 }
 const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null}catch{data={message:raw.slice(0,150)}}
 if(!r.ok){const err=Error(decodeError(data,r.status));err.status=r.status;err.code=data?.code;throw err}
 return data;
}
function isInstalledError(e){return e.status===404||e.code==='42P01'||e.code==='PGRST205'||e.code==='PGRST202'}
function isEditable(){return admin&&!!session?.user?.id}
function gate(msg){$('gateText').textContent=msg;$('authGate').classList.remove('is-hidden');$('workspace').classList.add('is-hidden')}
function isRectOverlap(a,b){return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h}
function fits(b,ignoreId=null){return b.x>=0&&b.y>=0&&b.w>=1&&b.h>=1&&b.x+b.w<=layout.cols&&b.y+b.h<=layout.rows&&layout.blocks.every(q=>q.id===ignoreId||!isRectOverlap(q,b))}
function validate(input){
 if(!input||typeof input!=='object')throw Error('Harita biçimi geçersiz.');
 if(input.version!==1||!Number.isInteger(input.cols)||!Number.isInteger(input.rows)||input.cols<10||input.cols>60||input.rows<8||input.rows>40)throw Error('Harita ölçüsü veya sürümü geçersiz.');
 if(!Array.isArray(input.blocks)||input.blocks.length>MAX_BLOCKS)throw Error('Çok fazla harita öğesi var.');
 if(new TextEncoder().encode(JSON.stringify(input)).length>MAX_BYTES)throw Error('Harita çok büyük (en fazla 600 KB).');
 const ids=new Set(),blocks=[],rackNames=new Set();
 for(const x of input.blocks){
  if(!x||!TYPES[x.type]||x.type==='select'||!Number.isInteger(x.x)||!Number.isInteger(x.y)||!Number.isInteger(x.w)||!Number.isInteger(x.h)||typeof x.id!=='string'||x.id.length>70||!x.id||ids.has(x.id))throw Error('Bozuk veya tekrarlanan blok bilgisi var.');
  ids.add(x.id);
  const b={id:x.id,type:x.type,x:x.x,y:x.y,w:x.w,h:x.h,label:text(x.label).trim().slice(0,75),note:text(x.note).slice(0,400),products:[]};
  if(b.x<0||b.y<0||b.w<1||b.h<1||b.x+b.w>input.cols||b.y+b.h>input.rows)throw Error('Harita sınırı dışında blok var.');
  if(!Array.isArray(x.products)||x.products.length>150)throw Error('Bir rafta çok fazla ürün var.');
  b.products=x.products.map(p=>({code:text(p.code).trim().slice(0,55),name:text(p.name).trim().slice(0,140)})).filter(p=>p.code||p.name);
  if(b.type==='rack'&&b.label){const key=norm(b.label);if(rackNames.has(key))throw Error('Aynı raf numarası iki kez girilmiş: '+b.label);rackNames.add(key)}
  if(blocks.some(old=>isRectOverlap(old,b)))throw Error('Bloklar çakışıyor.');
  blocks.push(b);
 }
 return {version:1,cols:input.cols,rows:input.rows,blocks,...(input.demo?{demo:true}:{})};
}
function createBlock(type,x,y,w=TYPES[type].w,h=TYPES[type].h,label=''){
 const id='b_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
 return {id,type,x,y,w,h,label:label||{rack:'Yeni Raf',aisle:'Koridor',wall:'Duvar',door:'Kapı',dock:'Peron',area:'Alan'}[type],note:'',products:[]};
}
function serialize(){return {version:1,cols:layout.cols,rows:layout.rows,blocks:layout.blocks.map(b=>clone(b)),...(layout.demo?{demo:true}:{})}}
function localSave(){if(!isEditable())return;try{localStorage.setItem(draftKey,JSON.stringify({layout:serialize(),revision:remoteRevision,updatedAt:Date.now()}))}catch{setMessage('Cihazda yerel taslak saklanamadı. JSON yedeğini indir.','error')}}
function dirtyNow(){if(!isEditable())return;dirty=true;clearTimeout(draftTimer);draftTimer=setTimeout(localSave,300);state('Kaydedilmemiş değişiklikler');$('saveState').classList.add('dirty-tag');renderStats()}
function afterSave(){dirty=false;clearTimeout(draftTimer);localStorage.removeItem(draftKey);$('draftBanner').classList.add('is-hidden');$('saveState').classList.remove('dirty-tag');state('Bulutta güncel')}
function updateTool(){document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('modeTip').textContent=tool==='select'?'Bir bloğu seç veya sürükleyerek taşı.':TYPES[tool].label+' eklemek için haritada boş alana dokun.';renderCanvas()}
function updateZoom(next){zoom=bound(Math.round(next*10)/10,.35,1.6);$('zoomLabel').textContent=Math.round(zoom*100)+'%';renderCanvas()}
function renderStats(){const n=layout.blocks.filter(b=>b.type==='rack').length;const m=layout.blocks.reduce((a,b)=>a+(b.type==='rack'?b.products.length:0),0);$('rackCount').textContent=n+' raf';$('productCount').textContent=m+' ürün konumu'}
function renderCanvas(){
 const inner=$('mapCanvas'),stage=$('mapStage');inner.style.width=(layout.cols*C)+'px';inner.style.height=(layout.rows*C)+'px';inner.style.transform=`scale(${zoom})`;stage.style.width=(layout.cols*C*zoom)+'px';stage.style.height=(layout.rows*C*zoom)+'px';
 inner.classList.toggle('edit-mode',isEditable());
 inner.innerHTML=layout.blocks.map(b=>{
  const ic=TYPES[b.type].icon;
  const tooltip=esc(b.type==='rack'?`${b.label} · ${b.products.length} ürün`:b.label);
  return `<div class="block${b.h===1?' compact-block':''}${selected===b.id?' selected':''}${matched.has(b.id)?' matched':''}" role="button" tabindex="0" aria-label="${tooltip}" data-id="${esc(b.id)}" data-type="${b.type}" style="left:${b.x*C+3}px;top:${b.y*C+3}px;width:${b.w*C-6}px;height:${b.h*C-6}px"><span class="block-icon">${ic}</span><span class="block-label">${esc(b.label)}</span>${b.type==='rack'&&b.products.length?`<small>${b.products.length} ürün</small>`:''}</div>`
 }).join('');
 renderStats();
}
function scrollToSelected(){const node=[...$('mapCanvas').querySelectorAll('.block')].find(el=>el.dataset.id===selected);if(node){const sc=$('mapScroll');const x=node.offsetLeft*zoom;const y=node.offsetTop*zoom;sc.scrollTo({left:Math.max(0,x-sc.clientWidth/2+80),top:Math.max(0,y-sc.clientHeight/2+80),behavior:'smooth'})}}
function selectBlock(id,{scroll=false}={}){selected=id;tool='select';document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool==='select'));renderCanvas();renderInspector();if(scroll)scrollToSelected()}
function parseProductLines(value){const out=[],seen=new Set();for(const line of text(value).split(/\r?\n/)){const s=line.trim();if(!s)continue;let code='',name='';const sep=s.indexOf('|');if(sep>=0){code=s.slice(0,sep).trim();name=s.slice(sep+1).trim()}else{name=s}if(!name&&!code)continue;code=code.slice(0,55);name=name.slice(0,140);const key=norm(code+'|'+name);if(!seen.has(key)){seen.add(key);out.push({code,name})}}if(out.length>150)throw Error('Bir rafta en fazla 150 ürün olabilir.');return out}
function renderInspector(){
 const b=layout.blocks.find(x=>x.id===selected),t=$('inspectorTitle'),h=$('inspectorBody');
 if(!b){t.textContent='Raf bilgileri';h.innerHTML='<p class="muted">Haritada bir rafa dokun. Raf numarası ve ürün bilgileri burada görünecek.</p>';return}
 t.textContent=TYPES[b.type].label+' bilgileri';
 if(!isEditable()){
  h.innerHTML=`<h3>${esc(b.label)}</h3><p class="muted">${esc(b.note||'')}</p>`+(b.type==='rack'?`<h3>Bu raftaki ürünler <span class="pill">${b.products.length}</span></h3>${b.products.length?`<ul class="products-list">${b.products.map(p=>`<li>${esc(p.name||p.code)}${p.code?` <span class="muted">(${esc(p.code)})</span>`:''}</li>`).join('')}</ul>`:'<p class="muted">Henüz ürün tanımlanmamış.</p>'}`:'');return
 }
 h.innerHTML=`<form id="editForm"><label for="editLabel">${b.type==='rack'?'Raf numarası':'Ad / açıklama'}</label><input id="editLabel" name="label" maxlength="75" required value="${esc(b.label)}"><div class="inline-fields"><div><label for="editW">Genişlik (hücre)</label><input id="editW" type="number" min="1" max="15" value="${b.w}"></div><div><label for="editH">Yükseklik (hücre)</label><input id="editH" type="number" min="1" max="15" value="${b.h}"></div></div>${b.type==='rack'?`<label for="editProducts">Raftaki ürünler</label><textarea id="editProducts" placeholder="ÜRÜN-KODU | Ürün adı&#10;ÜRÜN-KODU-2 | Başka ürün">${esc(b.products.map(p=>[p.code,p.name].filter(Boolean).join(' | ')).join('\n'))}</textarea><p class="muted smalltext">Her satıra bir ürün. Kod zorunlu değil. Bir rafa birden fazla ürün eklenebilir.</p>`:''}<label for="editNote">Not (isteğe bağlı)</label><textarea id="editNote" maxlength="400" style="min-height:55px">${esc(b.note)}</textarea><div class="row-actions"><button class="btn primary" type="submit">Uygula</button><button class="btn secondary" type="button" id="removeBlock">Sil</button></div></form>`;
 $('editForm').addEventListener('submit',e=>{e.preventDefault();try{
  const label=$('editLabel').value.trim();const w=Number($('editW').value),hh=Number($('editH').value);
  if(!label)throw Error('Ad/raf numarası boş olamaz.');
  if(!Number.isInteger(w)||!Number.isInteger(hh)||w<1||hh<1||w>15||hh>15)throw Error('Blok boyutu 1–15 hücre olmalı.');
  if(b.type==='rack'&&layout.blocks.some(x=>x.id!==b.id&&x.type==='rack'&&norm(x.label)===norm(label)))throw Error('Bu raf numarası zaten var.');
  const proposed={...b,w,h:hh};if(!fits(proposed,b.id))throw Error('Blok bu boyutta diğer bloklarla çakışıyor veya harita dışına taşıyor.');
  b.label=label;b.w=w;b.h=hh;b.note=$('editNote').value.trim().slice(0,400);if(b.type==='rack')b.products=parseProductLines($('editProducts').value);
  dirtyNow();renderCanvas();renderInspector();setMessage('Blok güncellendi. Buluta kaydetmeyi unutma.','success');
 }catch(err){setMessage(err.message,'error')}});
 $('removeBlock').addEventListener('click',()=>{if(!confirm(`“${b.label}” silinsin mi?`))return;layout.blocks=layout.blocks.filter(x=>x.id!==b.id);selected=null;dirtyNow();renderCanvas();renderInspector();setMessage('Blok silindi.','success')});
}
function gridPosition(e){const rect=$('mapCanvas').getBoundingClientRect();return {x:Math.floor((e.clientX-rect.left)/(C*zoom)),y:Math.floor((e.clientY-rect.top)/(C*zoom))}}
function newAt(e){if(!isEditable()||tool==='select')return;const {x,y}=gridPosition(e);const type=tool,b=createBlock(type,x,y);if(layout.blocks.length>=MAX_BLOCKS){setMessage('Harita öğe sınırına ulaşıldı.','error');return}if(!fits(b)){setMessage('Burada yeterli boş alan yok. Başka bir hücre seç.','error');return}layout.blocks.push(b);selected=b.id;tool='select';dirtyNow();updateTool();renderInspector();$('editLabel')?.focus();}
function pointerDown(e){const target=e.target.closest('.block');if(!target)return;if(e.button!==0&&e.pointerType==='mouse')return;const id=target.dataset.id;const b=layout.blocks.find(x=>x.id===id);if(!b)return;selected=b.id;renderInspector();$('mapCanvas').querySelectorAll('.block').forEach(n=>n.classList.toggle('selected',n.dataset.id===b.id));if(!isEditable()||tool!=='select')return;drag={id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,originX:b.x,originY:b.y,moved:false};
 target.setPointerCapture?.(e.pointerId)
}
function pointerMove(e){if(!drag||e.pointerId!==drag.pointerId)return;const target=[...$('mapCanvas').querySelectorAll('.block')].find(x=>x.dataset.id===drag.id);if(!target)return;const dx=(e.clientX-drag.startX)/zoom,dy=(e.clientY-drag.startY)/zoom;if(Math.abs(dx)>5||Math.abs(dy)>5)drag.moved=true;if(!drag.moved)return;target.style.transform=`translate(${dx}px,${dy}px)`;target.style.opacity='.8';}
function pointerUp(e){if(!drag||e.pointerId!==drag.pointerId)return;const d=drag;drag=null;if(!d.moved)return;const block=layout.blocks.find(x=>x.id===d.id);if(!block)return;const dx=Math.round((e.clientX-d.startX)/(C*zoom)),dy=Math.round((e.clientY-d.startY)/(C*zoom));if(dx||dy){const target={...block,x:d.originX+dx,y:d.originY+dy};if(fits(target,block.id)){block.x=target.x;block.y=target.y;dirtyNow();setMessage('Blok taşındı. Kaydedilmemiş değişiklik var.','success')}else{setMessage('O konum dolu veya harita sınırı dışında.','error')}}renderCanvas();renderInspector();}
function search(){const q=norm($('searchInput').value),box=$('searchResults');matched.clear();if(!q){box.classList.add('is-hidden');box.innerHTML='';renderCanvas();return}
 const found=layout.blocks.filter(b=>norm(b.label).includes(q)||(b.type==='rack'&&b.products.some(p=>norm(p.code).includes(q)||norm(p.name).includes(q))));for(const b of found)matched.add(b.id);
 box.innerHTML=found.length?found.slice(0,30).map(b=>`<button type="button" class="result" data-result="${esc(b.id)}"><b>${esc(b.label)}</b><span>${b.type==='rack'?esc(b.products.filter(p=>norm(p.code).includes(q)||norm(p.name).includes(q)).map(p=>p.name||p.code).join(' · ')||`${b.products.length} ürün`):esc(TYPES[b.type].label)}<small>${esc(TYPES[b.type].label)} · Haritada göster</small></span></button>`).join(''):'<div class="empty-state">Eşleşen raf veya ürün bulunamadı.</div>';
 box.classList.remove('is-hidden');renderCanvas();}
function freeSlot(w=2,h=1){for(let y=0;y<=layout.rows-h;y++)for(let x=0;x<=layout.cols-w;x++){if(fits({x,y,w,h}))return{x,y}}return null}
function csvRows(raw){const first=raw.replace(/^\uFEFF/,'');const line=first.split(/\r?\n/,1)[0];const delim=[';',',','\t'].sort((a,b)=>line.split(b).length-line.split(a).length)[0];const out=[],row=[];let cur='',quoted=false;for(let i=0;i<first.length;i++){const ch=first[i];if(ch==='"'){if(quoted&&first[i+1]==='"'){cur+='"';i++}else quoted=!quoted}else if(ch===delim&&!quoted){row.push(cur);cur=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&first[i+1]==='\n')i++;row.push(cur);if(row.some(x=>x.trim()))out.push([...row]);row.length=0;cur=''}else cur+=ch}row.push(cur);if(row.some(x=>x.trim()))out.push(row);return out}
async function importCsv(file){if(!file||!isEditable())return;const data=await file.text();if(data.length>2e6)throw Error('CSV en fazla 2 MB olabilir.');const lines=csvRows(data);if(!lines.length)throw Error('CSV boş.');const first=lines[0].map(norm);const hasHeader=first.some(x=>x.includes('raf')||x.includes('shelf'));const cols=hasHeader?first:[];
 const idx=(names,fallback)=>{const j=cols.findIndex(x=>names.some(n=>x===n||x.includes(n)));return j>=0?j:fallback};
 const ridx=idx(['raf','shelf','lokasyon'],0),cidx=idx(['kod','code','barkod'],1),nidx=idx(['urun adi','urun adı','urun_adi','product','malzeme'],2);
 const items=lines.slice(hasHeader?1:0),temp=clone(layout);let added=0,created=0,skipped=0;let current=layout;
 try{for(const row of items){const shelf=text(row[ridx]).trim().slice(0,75);const name=text(row[nidx]).trim().slice(0,140);const code=text(row[cidx]).trim().slice(0,55);if(!shelf||!name){skipped++;continue}let rack=current.blocks.find(b=>b.type==='rack'&&norm(b.label)===norm(shelf));if(!rack){const slot=freeSlot(2,1);if(!slot){skipped++;continue}rack=createBlock('rack',slot.x,slot.y,2,1,shelf);current.blocks.push(rack);created++}
 if(rack.products.length>=150){skipped++;continue}if(!rack.products.some(p=>norm(p.name)===norm(name)&&norm(p.code)===norm(code))){rack.products.push({code,name});added++}}
  validate(current);dirtyNow();renderCanvas();renderInspector();setMessage(`CSV işlendi: ${created} raf oluşturuldu, ${added} ürün eklendi, ${skipped} satır atlandı.`, 'success');
 }catch(e){layout=temp;renderCanvas();renderInspector();throw e}
}
function downloadBackup(){const data=JSON.stringify(serialize(),null,2);const blob=new Blob([data],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='aktiva-depo-haritasi-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
function showRemote(){state(!remoteReady?'SQL kurulumu gerekli':dirty?'Kaydedilmemiş değişiklikler':remoteRevision?'Bulutta güncel':'Yeni harita');$('lastSaved').textContent=remoteRevision?'Sunucu kayıt zamanı: '+prettyDate(remoteUpdated):remoteReady?'Henüz paylaşılan harita yok':'Sunucuda tablo bulunamadı — SQL kurulumunu yap.';$('saveMap').disabled=!remoteReady||writeBusy}
function findDraft(){try{const raw=localStorage.getItem(draftKey);if(!raw)return null;const d=JSON.parse(raw);return {layout:validate(d.layout),revision:d.revision,updatedAt:d.updatedAt}}catch{return null}}
function draftPrompt(){if(!isEditable())return;const d=findDraft();$('draftBanner').classList.toggle('is-hidden',!d);}
async function readRemote({fresh=false}={}){
 try{
  const rows=await api('/rest/v1/ak_depo_haritasi?select=data,revision,updated_at&id=eq.ana-depo&limit=1');
  remoteReady=true;remoteRevision=rows[0]?.revision||0;remoteUpdated=rows[0]?.updated_at||null;
  layout=rows[0]?validate(rows[0].data):empty();selected=null;dirty=false;
  if(!fresh)draftPrompt();else $('draftBanner').classList.add('is-hidden');
  $('gridCols').value=layout.cols;$('gridRows').value=layout.rows;
  showRemote();renderCanvas();renderInspector();search();return true;
 }catch(e){
  if(isInstalledError(e)){
   remoteReady=false;remoteRevision=0;remoteUpdated=null;layout=empty();
   if(isEditable()){const d=findDraft();if(d){layout=d.layout;dirty=true}setMessage('Supabase harita tablosu henüz kurulu değil. Yönetici yerel taslak hazırlayıp JSON indirebilir. Ortak kullanım için SQL dosyasını kur.','error')}
   else setMessage('Depo haritası henüz sunucuda kurulmamış. Yönetici SQL kurulumunu tamamlayınca görünecek.','error');
  }else{setMessage('Harita sunucudan okunamadı: '+e.message+'. Mevcut haritayı yanlışlıkla değiştirmemek için kaydetme kapalı.','error');remoteReady=false;layout=empty();const d=findDraft();if(isEditable()&&d){layout=d.layout;dirty=true}}
  showRemote();renderCanvas();renderInspector();return false;
 }
}
async function saveRemote(){if(!isEditable())return;if(!remoteReady){setMessage('Önce AKTIVA_DEPO_HARITASI_KURULUM.sql dosyasını Supabase SQL Editor’da çalıştır. Yerel çizimin korunuyor.','error');return}if(writeBusy)return;
 let payload;try{payload=validate(serialize());if(payload.demo)throw Error('Örnek kroki gerçek depo haritası olarak kaydedilemez. Önce “Boş krokiyle başla” deyip gerçek raflarını çiz.')}catch(e){setMessage('Kaydedilemedi: '+e.message,'error');return}
 const savingSnapshot=JSON.stringify(payload);writeBusy=true;showRemote();try{
  const rows=await api('/rest/v1/rpc/ak_depo_haritasi_kaydet',{method:'POST',body:{p_data:payload,p_expected_revision:remoteRevision}});
  const row=Array.isArray(rows)?rows[0]:rows;if(!row||typeof row.revision!=='number')throw Error('Sunucu kayıt onayı gelmedi.');
  remoteRevision=row.revision;remoteUpdated=row.updated_at;if(JSON.stringify(serialize())===savingSnapshot){afterSave();setMessage('Depo haritası kaydedildi. Toplamacılar güncel haritayı açabilir.','success')}else{dirty=true;localSave();setMessage('Kayıt tamamlandı ancak kaydetme sırasında yeni düzenleme yapıldı. Bu değişiklikleri tekrar kaydet.','info')}showRemote();
 }catch(e){setMessage('Harita kaydedilemedi: '+e.message+'. Yerel taslak korunuyor. Gerekirse JSON yedeği indir.','error');localSave()}finally{writeBusy=false;showRemote()}
}
function createDemo(){if(!isEditable())return;if(layout.blocks.length&&!confirm('Mevcut ekrandaki çizim örnek krokisiyle değiştirilsin mi? Kaydedilmemiş çizimi önce JSON olarak indir.'))return;
 layout=empty();layout.blocks=[
 createBlock('rack',2,2,2,1,'1019'),createBlock('rack',2,4,2,1,'1020'),createBlock('rack',2,6,2,1,'1021'),
 createBlock('rack',7,2,2,1,'2045'),createBlock('rack',7,4,2,1,'2046'),
 createBlock('rack',12,2,2,1,'3050'),createBlock('rack',12,4,2,1,'3051'),
 createBlock('aisle',5,1,1,8,'Koridor A'),createBlock('aisle',10,1,1,8,'Koridor B'),
 createBlock('dock',4,11,2,2,'Peron 1'),createBlock('dock',8,11,2,2,'Peron 2'),createBlock('door',6,11,1,1,'Giriş')];
 const a=layout.blocks.find(b=>b.label==='1019');a.products=[{code:'UR-001',name:'Ayçiçek Yağı 5 L'}];
 const b=layout.blocks.find(b=>b.label==='2045');b.products=[{code:'UR-002',name:'Buono Çikolata'}];
 const c=layout.blocks.find(b=>b.label==='3050');c.products=[{code:'UR-003',name:'Makarna'}];
 layout.demo=true;selected=null;dirtyNow();renderCanvas();renderInspector();setMessage('Örnek kroki açıldı. Bu temsili çizim buluta kaydedilemez; gerçek rafları çizmek için “Boş krokiyle başla”yı kullan.','success');
}
function bind(){
 $('toolList').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(!b||!isEditable())return;tool=b.dataset.tool;updateTool()});
 $('mapCanvas').addEventListener('click',e=>{const b=e.target.closest('.block');if(b){selectBlock(b.dataset.id);return}newAt(e)});
 $('mapCanvas').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('block')){e.preventDefault();selectBlock(e.target.dataset.id)}});
 $('mapCanvas').addEventListener('pointerdown',pointerDown);$('mapCanvas').addEventListener('pointermove',pointerMove);$('mapCanvas').addEventListener('pointerup',pointerUp);$('mapCanvas').addEventListener('pointercancel',pointerUp);
 $('searchInput').addEventListener('input',search);$('clearSearch').addEventListener('click',()=>{$('searchInput').value='';search();$('searchInput').focus()});$('searchResults').addEventListener('click',e=>{const b=e.target.closest('[data-result]');if(!b)return;selectBlock(b.dataset.result,{scroll:true})});
 $('zoomOut').addEventListener('click',()=>updateZoom(zoom-.1));$('zoomIn').addEventListener('click',()=>updateZoom(zoom+.1));$('zoomFit').addEventListener('click',()=>{const sc=$('mapScroll');updateZoom(Math.min((sc.clientWidth-34)/(layout.cols*C),(sc.clientHeight-34)/(layout.rows*C),1));sc.scrollTo({top:0,left:0,behavior:'smooth'})});
 $('resizeMap').addEventListener('click',()=>{if(!isEditable())return;const cols=Number($('gridCols').value),rows=Number($('gridRows').value);if(!Number.isInteger(cols)||cols<10||cols>60||!Number.isInteger(rows)||rows<8||rows>40){setMessage('Harita en az 10×8, en çok 60×40 hücre olmalı.','error');return}if(layout.blocks.some(b=>b.x+b.w>cols||b.y+b.h>rows)){setMessage('Bazı bloklar yeni ölçülerin dışında kalıyor. Önce blokları taşı.','error');return}layout.cols=cols;layout.rows=rows;dirtyNow();renderCanvas();setMessage('Harita ölçüsü değiştirildi.','success')});
 $('demoMap').addEventListener('click',createDemo);
 $('clearMap').addEventListener('click',()=>{if(!confirm('Yeni, boş depo krokisi başlatılsın mı? Mevcut kaydedilmemiş değişiklikleri önce JSON olarak dışa aktar.'))return;layout=empty();selected=null;dirtyNow();renderCanvas();renderInspector();showRemote();setMessage('Boş harita açıldı. Gerçek rafları ekleyebilirsin.','success')});
 $('exportMap').addEventListener('click',downloadBackup);
 $('importMap').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file||!isEditable())return;try{if(file.size>MAX_BYTES)throw Error('JSON dosyası çok büyük.');const data=validate(JSON.parse(await file.text()));if(!confirm('Mevcut taslağın yerine bu harita açılsın mı?'))return;layout=data;selected=null;dirtyNow();renderCanvas();renderInspector();$('gridCols').value=layout.cols;$('gridRows').value=layout.rows;setMessage('JSON haritası açıldı. Buluta kaydetmeyi unutma.','success')}catch(err){setMessage('JSON aktarılamadı: '+err.message,'error')}});
 $('importCsv').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{await importCsv(file)}catch(err){setMessage('CSV aktarılamadı: '+err.message,'error')}});
 $('saveMap').addEventListener('click',saveRemote);
 $('reloadMap').addEventListener('click',()=>{if(dirty&&!confirm('Kaydedilmemiş değişiklikler var. Sunucudan yeniden yüklemek için onayla.'))return;readRemote({fresh:true})});
 $('restoreDraft').addEventListener('click',()=>{const d=findDraft();if(!d)return;layout=d.layout;selected=null;dirty=true;renderCanvas();renderInspector();$('draftBanner').classList.add('is-hidden');$('gridCols').value=layout.cols;$('gridRows').value=layout.rows;showRemote();setMessage('Yerel taslak açıldı. Buluta kaydedene kadar diğer cihazlarda görünmez.','success')});
 $('discardDraft').addEventListener('click',()=>{if(!confirm('Bu cihazdaki eski taslak silinsin mi?'))return;localStorage.removeItem(draftKey);$('draftBanner').classList.add('is-hidden')});
 window.addEventListener('beforeunload',()=>{if(dirty)localSave()});
}
async function init(){
 bind();const stored=localStorage.getItem('mk_session')||sessionStorage.getItem('mk_session');if(!stored){gate('Önce AKTİVA ana ekranından giriş yap.');return}
 try{session=JSON.parse(stored);if(!session?.access_token||!session?.user?.id)throw Error('Oturum eksik.');
  const userId=session.user.id;const rows=await api('/rest/v1/profiles?select=id,role,full_name&id=eq.'+encodeURIComponent(userId)+'&limit=1');profile=rows?.[0];if(!profile||!['admin','picker'].includes(profile.role))throw Error('Bu bölüm yalnızca yönetici ve toplamacı hesapları içindir.');
  admin=profile.role==='admin';draftKey='ak_depo_harita_taslak_v1_'+userId;
  document.body.classList.toggle('viewer',!admin);$('roleBadge').textContent=admin?'Yönetici · Düzenleme':'Toplamacı · Görüntüleme';$('authGate').classList.add('is-hidden');$('workspace').classList.remove('is-hidden');if(window.matchMedia('(max-width: 720px)').matches)zoom=.8;updateZoom(zoom);
  if(admin){$('saveMap').disabled=true;setMessage('Yeni haritayı çizebilir veya örnek krokide araçları deneyebilirsin.')}else{setMessage('Ürün adı, ürün kodu veya raf numarası yazarak haritadaki yerini bul.','success')}
  await readRemote();
 }catch(e){gate('Depo haritası açılamadı: '+e.message+' Giriş yaptıysan oturumunu yenile.')}
}
init();
})();
