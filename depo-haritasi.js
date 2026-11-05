/* AKTİVA Depo Haritası · 04.11.2026
   Yalnızca yönetici düzenler, toplamacı görüntüler. Ürün/sayım/forklift tablolarına yazmaz.
   Ortak harita için Supabase SQL kurulumu gereklidir. Yerel taslak yalnızca o cihazdadır.
*/
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const C=52,MAX_BLOCKS=800,MAX_BYTES=600000,MAX_LOCATION_PRODUCTS=1000,PRODUCT_PAGE_SIZE=25;
const TYPES={select:{label:'Seç'},rack:{label:'Raf',icon:'▥',w:2,h:1},lrack:{label:'L Duvar Rafı',icon:'└',w:4,h:6},aisle:{label:'Koridor',icon:'⇆',w:1,h:3},wall:{label:'Duvar',icon:'▬',w:3,h:1},door:{label:'Kapı',icon:'↪',w:1,h:1},dock:{label:'Peron',icon:'🚚',w:2,h:2},area:{label:'Alan',icon:'▧',w:3,h:2}};
const empty=()=>({version:1,cols:22,rows:14,blocks:[]});
const clone=x=>JSON.parse(JSON.stringify(x));
const text=x=>String(x??'');
const esc=x=>text(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=x=>text(x).trim().toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const bound=(v,min,max)=>Math.max(min,Math.min(max,v));
let layout=empty(),session=null,profile=null,admin=false,tool='select',zoom=1,selected=null,matched=new Set();
let remoteRevision=0,remoteReady=false,remoteUpdated=null,dirty=false,drag=null,writeBusy=false,draftTimer=null;
let quickSaveTimer=null,quickSaveQueued=false; // +/- işlemlerini birleştirerek buluta otomatik kaydet
let draftKey='',locationFilter='',locationPage=1,rackLevelFilter='all',rackPage=1;
let corridorId=null,corridorSlot=null,corridorQuery='',corridorDetailPage=1,pendingMove=null,suppressClickUntil=0;
const SIDES={left:'Sol',right:'Sağ'};
const L_ARMS={vertical:'Dikey kol',horizontal:'Yatay kol'};
const L_LEVELS={lower:'Alt',upper:'Üst'};
const L_ORIENTATIONS={'bottom-right':'┘ Alt köşe sağ','bottom-left':'└ Alt köşe sol','top-right':'┐ Üst köşe sağ','top-left':'┌ Üst köşe sol'};
// Blok yönleri eski JSON ve Supabase haritalarıyla uyumludur (eski kayıtlarda yön otomatik belirlenir).
const DIRECTIONS=['up','right','down','left'];
const DIRECTION_SYMBOLS={up:'↑',right:'→',down:'↓',left:'←'};
const L_CLOCKWISE=['bottom-right','bottom-left','top-left','top-right'];
function blockDirection(b){return DIRECTIONS.includes(b.direction)?b.direction:(b.w>b.h?'right':'up')}
function rotateBlock(id,delta){
 if(!isEditable())return;
 const b=layout.blocks.find(x=>x.id===id);if(!b)return;
 if(b.type==='lrack'){
  const k=L_CLOCKWISE.indexOf(L_ORIENTATIONS[b.orientation]?b.orientation:'bottom-right');
  b.orientation=L_CLOCKWISE[(k+(delta>0?1:3))%4];
  dirtyNow();renderCanvas();renderInspector();search();setMessage('L raf 90° çevrildi. Buluta kaydetmeyi unutma.','success');return;
 }
 const dir=DIRECTIONS[(DIRECTIONS.indexOf(blockDirection(b))+(delta>0?1:3))%4];
 const w=b.h,h=b.w;
 // Dönerken merkez mümkün olduğunca aynı kalır; harita dışına veya başka rafa taşınmaz.
 const centerX=(b.pivot?.cx2??(2*b.x+b.w))/2,centerY=(b.pivot?.cy2??(2*b.y+b.h))/2;
 const bx=Math.round(centerX-w/2),by=Math.round(centerY-h/2);
 const candidates=[{x:bx,y:by}];
 // Kareli ızgarada yarım hücreden doğan kaymayı diğer yuvarlama yönüyle de dene.
 for(const x of [Math.floor(centerX-w/2),Math.ceil(centerX-w/2)])for(const y of [Math.floor(centerY-h/2),Math.ceil(centerY-h/2)]){
  if(!candidates.some(c=>c.x===x&&c.y===y))candidates.push({x,y});
 }
 const found=candidates.find(c=>fits({...b,x:c.x,y:c.y,w,h},b.id));
 if(!found){setMessage('Burada 90° çevirmek için yeterli boşluk yok. Önce koridoru/rafı boş bir yere taşı, sonra çevir.','error');return}
 Object.assign(b,{...found,w,h,direction:dir,pivot:{cx2:Math.round(centerX*2),cy2:Math.round(centerY*2)}});dirtyNow();renderCanvas();renderInspector();search();
 const label=b.type==='aisle'?'Koridor':TYPES[b.type].label;
 setMessage(label+' 90° çevrildi ('+(w>h?'yatay':h>w?'dikey':'kare')+'). Buluta kaydetmeyi unutma.','success');
}
// Kolay ölçü kontrolleri mevcut blok ürünlerini değiştirmeden yalnızca konumu/ölçüyü düzenler.
function renameAisle(b,newLabel){
 if(!isEditable()||!b||b.type!=='aisle')return false;
 const label=text(newLabel).trim();
 if(!label||label.length>75){setMessage('Koridor adı 1–75 karakter olmalı.','error');return false}
 if(layout.blocks.some(x=>x.id!==b.id&&x.type==='aisle'&&norm(x.label)===norm(label))){setMessage('Bu isimde başka bir koridor var. Ayrı bir ad yaz.','error');return false}
 if(b.label!==label){b.label=label;dirtyNow();renderCanvas();renderInspector();search();if(corridorId===b.id)renderCorridor();setMessage('Koridor adı güncellendi. Buluta Kaydet ile yayımla.','success')}
 return true;
}
function resizeAisleQuick(id,dim,delta){
 if(!isEditable()||!['w','h'].includes(dim)||![-1,1].includes(delta))return;
 const b=layout.blocks.find(x=>x.id===id&&x.type==='aisle');if(!b)return;
 const next=b[dim]+delta;if(next<1||next>15){setMessage('Koridor ölçüsü 1–15 kare arasında olmalı.','error');return}
 const proposal={...b,[dim]:next};
 if(!fits(proposal,b.id)){setMessage('Bu yönde boşluk yok. Koridoru taşı veya haritayı genişlet.','error');return}
 const prior=clone(b);b[dim]=next;b.pivot={cx2:b.x*2+b.w,cy2:b.y*2+b.h};
 try{validate(serialize())}catch(err){Object.assign(b,prior);setMessage(err.message,'error');return}
 dirtyNow();renderCanvas();renderInspector();search();scheduleQuickSave();setMessage('Koridor ölçüsü uygulandı; otomatik kaydedilecek.','success');
}
function applyGridSize(cols,rows){
 if(!isEditable())return false;
 if(!Number.isInteger(cols)||cols<10||cols>60||!Number.isInteger(rows)||rows<8||rows>40){setMessage('Harita en az 10×8, en fazla 60×40 kare olmalı.','error');return false}
 if(layout.blocks.some(b=>b.x+b.w>cols||b.y+b.h>rows)){setMessage('Bu kadar küçültemezsin: Kenarda raf/koridor kalıyor. Önce öğeyi taşı.','error');return false}
 if(layout.cols!==cols||layout.rows!==rows){layout.cols=cols;layout.rows=rows;dirtyNow();renderCanvas();scheduleQuickSave();setMessage('Harita ölçüsü uygulandı; otomatik kaydedilecek.','success')}
 $('gridCols').value=layout.cols;$('gridRows').value=layout.rows;
 return true;
}
function renderSelectionToolbar(){
 const bar=$('selectionToolbar');if(!bar)return;
 const b=layout.blocks.find(x=>x.id===selected);
 bar.classList.toggle('is-hidden',!isEditable()||!b);
 if(!b){bar.innerHTML='';return}
 bar.innerHTML=`<strong>${esc(b.label)}</strong><span class="rotate-hint">${b.type==='lrack'?'L raf':b.w>b.h?'Yatay':b.h>b.w?'Dikey':'Kare'} · ${b.type==='lrack'?'Yön ayarlanabilir':DIRECTION_SYMBOLS[blockDirection(b)]}</span><button type="button" class="btn small secondary" data-rotate="-1" title="Sola 90 derece çevir">↶ 90°</button><button type="button" class="btn small secondary" data-rotate="1" title="Sağa 90 derece çevir">↷ 90°</button>${b.type==='aisle'?'<button type="button" class="btn small secondary" data-open-corridor="1">Ürünleri aç</button>':''}`;
}

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
  if(b.type==='aisle')b.sections=Number.isInteger(x.sections)?bound(x.sections,2,60):12;
  if(b.type==='lrack')b.orientation=L_ORIENTATIONS[x.orientation]?x.orientation:'bottom-right';
  else {b.direction=DIRECTIONS.includes(x.direction)?x.direction:(b.w>b.h?'right':'up');b.pivot={cx2:Number.isInteger(x.pivot?.cx2)?x.pivot.cx2:b.x*2+b.w,cy2:Number.isInteger(x.pivot?.cy2)?x.pivot.cy2:b.y*2+b.h}};
  if(b.x<0||b.y<0||b.w<1||b.h<1||b.x+b.w>input.cols||b.y+b.h>input.rows)throw Error('Harita sınırı dışında blok var.');
  if(!Array.isArray(x.products)||x.products.length>MAX_LOCATION_PRODUCTS)throw Error('Bir konumda en fazla '+MAX_LOCATION_PRODUCTS+' ürün bulunabilir.');
  b.products=x.products.map(p=>({code:text(p.code).trim().slice(0,55),name:text(p.name).trim().slice(0,140),...(text(p.shelf).trim()?{shelf:text(p.shelf).trim().slice(0,75)}:{}),...(['left','right'].includes(p.side)&&Number.isInteger(p.section)&&p.section>=1&&p.section<=60?{side:p.side,section:p.section}:{}),...(['vertical','horizontal'].includes(p.arm)?{arm:p.arm}:{}),...(['upper','lower'].includes(p.level)?{level:p.level}:{})})).filter(p=>p.code||p.name);
  if(b.type==='rack'&&b.label){const key=norm(b.label);if(rackNames.has(key))throw Error('Aynı raf numarası iki kez girilmiş: '+b.label);rackNames.add(key)}
  if(blocks.some(old=>isRectOverlap(old,b)))throw Error('Bloklar çakışıyor.');
  blocks.push(b);
 }
 return {version:1,cols:input.cols,rows:input.rows,blocks,...(input.demo?{demo:true}:{})};
}
function createBlock(type,x,y,w=TYPES[type].w,h=TYPES[type].h,label=''){
 const id='b_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
 return {id,type,x,y,w,h,...(type==='aisle'?{sections:12}:{}),...(type==='lrack'?{orientation:'bottom-right'}:{direction:w>h?'right':'up',pivot:{cx2:x*2+w,cy2:y*2+h}}),label:label||{rack:'Yeni Raf',lrack:'L Duvar Rafı',aisle:'Koridor',wall:'Duvar',door:'Kapı',dock:'Peron',area:'Alan'}[type],note:'',products:[]};
}
function serialize(){return {version:1,cols:layout.cols,rows:layout.rows,blocks:layout.blocks.map(b=>clone(b)),...(layout.demo?{demo:true}:{})}}
function localSave(){if(!isEditable())return;try{localStorage.setItem(draftKey,JSON.stringify({layout:serialize(),revision:remoteRevision,updatedAt:Date.now()}))}catch{setMessage('Cihazda yerel taslak saklanamadı. JSON yedeğini indir.','error')}}
// Normal düzenlemeler eski gibi manuel kaydedilir. Yalnızca +/- işlemleri otomatik kayıt sırasına alınır.
function cancelQuickSave(){clearTimeout(quickSaveTimer);quickSaveTimer=null;quickSaveQueued=false}
function dirtyNow(){if(!isEditable())return;cancelQuickSave();dirty=true;clearTimeout(draftTimer);draftTimer=setTimeout(localSave,300);state('Kaydedilmemiş değişiklikler');$('saveState').classList.add('dirty-tag');renderStats()}
function scheduleQuickSave(){
 if(!isEditable()||!dirty)return;
 // Örnek harita gerçek depo verisi olarak gönderilmez.
 if(layout.demo){setMessage('Örnek harita değiştirildi; gerçek harita için önce boş kroki oluştur.','info');return}
 if(!remoteReady){setMessage('Ölçü haritada uygulandı; bulut erişimi yok, yerel taslak korunuyor.','info');return}
 quickSaveQueued=true;clearTimeout(quickSaveTimer);
 quickSaveTimer=setTimeout(flushQuickSave,1200);
 showRemote();
}
async function flushQuickSave(){
 quickSaveTimer=null;
 if(!quickSaveQueued)return;
 if(!isEditable()||!remoteReady||!dirty){quickSaveQueued=false;showRemote();return}
 if(writeBusy)return; // Devam eden kayıt bittikten sonra yeniden sıraya alınır.
 quickSaveQueued=false;
 await saveRemote({automatic:true});
}
function afterSave(){dirty=false;clearTimeout(draftTimer);localStorage.removeItem(draftKey);$('draftBanner').classList.add('is-hidden');$('saveState').classList.remove('dirty-tag');state('Bulutta güncel')}
function updateTool(){document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('modeTip').textContent=tool==='select'?'Bir bloğu seç veya sürükleyerek taşı.':TYPES[tool].label+' eklemek için haritada boş alana dokun.';renderCanvas()}
function updateZoom(next){zoom=bound(Math.round(next*100)/100,.23,1.6);$('zoomLabel').textContent=Math.round(zoom*100)+'%';renderCanvas()}
function fitMap(){const sc=$('mapScroll');if(!sc||!sc.clientWidth)return;const next=Math.min((sc.clientWidth-40)/(layout.cols*C),(sc.clientHeight-40)/(layout.rows*C),1);updateZoom(next);sc.scrollTo({top:0,left:0})}
function renderStats(){const n=layout.blocks.filter(b=>b.type==='rack'||b.type==='lrack').length;const m=layout.blocks.reduce((a,b)=>a+(['rack','aisle','lrack'].includes(b.type)?b.products.length:0),0);const aisles=layout.blocks.filter(b=>b.type==='aisle').length;$('rackCount').textContent=n+' raf · '+aisles+' koridor';$('productCount').textContent=m+' ürün konumu'}
// L rafı tek blok olarak saklıyoruz; iç boşluğa hayali ürün yerleştirmiyoruz.
function lRackShape(b){
 const orientation=L_ORIENTATIONS[b.orientation]?b.orientation:'bottom-right';
 const right=orientation.endsWith('right'),top=orientation.startsWith('top');
 const x=right?85:15,y=top?15:85,otherX=right?15:85,otherY=top?85:15;
 return `<svg class="l-rack-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M${x} ${otherY} V${y} H${otherX}" fill="none" stroke="#9cd7ed" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M${x} ${otherY} V${y} H${otherX}" fill="none" stroke="#235d7c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="l-rack-label">${esc(b.label)}</span><span class="l-rack-sub">L RAF · ALT / ÜST</span>`;
}
function renderCanvas(){
 const inner=$('mapCanvas'),stage=$('mapStage');renderSelectionToolbar();inner.style.width=(layout.cols*C)+'px';inner.style.height=(layout.rows*C)+'px';inner.style.transform=`scale(${zoom})`;stage.style.width=(layout.cols*C*zoom)+'px';stage.style.height=(layout.rows*C*zoom)+'px';
 inner.classList.toggle('edit-mode',isEditable());
 inner.innerHTML=layout.blocks.map(b=>{
  const ic=TYPES[b.type].icon;
  const hasProducts=['rack','aisle','lrack'].includes(b.type);const tooltip=esc(hasProducts?`${b.label} · ${b.products.length} ürün`:b.label);
  return `<div class="block${b.h===1?' compact-block':''}${b.type==='lrack'?' l-rack':''}${b.type==='aisle'&&b.w>b.h?' wide-aisle':''}${b.type==='area'&&norm(b.label)==='ana koridor'?' main-aisle':''}${b.type==='area'&&norm(b.label)==='ana koridor'&&b.w>b.h?' wide-main-aisle':''}${selected===b.id?' selected':''}${matched.has(b.id)?' matched':''}" role="button" tabindex="0" aria-label="${tooltip}" data-id="${esc(b.id)}" data-type="${b.type}" style="left:${b.x*C+3}px;top:${b.y*C+3}px;width:${b.w*C-6}px;height:${b.h*C-6}px">${b.type==='lrack'?lRackShape(b):`<span class="block-icon">${b.type==='aisle'?DIRECTION_SYMBOLS[blockDirection(b)]:ic}</span><span class="block-label">${esc(b.label)}</span>`}${hasProducts&&b.products.length?`<small>${b.products.length} ürün</small>`:''}</div>`
 }).join('');
 renderStats();renderQuickCorridors();
}
function renderQuickCorridors(){const box=$('quickCorridors');if(!box)return;const corridors=layout.blocks.filter(b=>b.type==='aisle');box.innerHTML=corridors.length?`<span class="quick-label">Koridor aç:</span>`+corridors.map(b=>`<button class="quick-corridor" type="button" data-corridor-id="${esc(b.id)}">${esc(b.label)} <small>›</small></button>`).join(''):''}
function scrollToSelected(){const node=[...$('mapCanvas').querySelectorAll('.block')].find(el=>el.dataset.id===selected);if(node){const sc=$('mapScroll');const x=node.offsetLeft*zoom;const y=node.offsetTop*zoom;sc.scrollTo({left:Math.max(0,x-sc.clientWidth/2+80),top:Math.max(0,y-sc.clientHeight/2+80),behavior:'smooth'})}}
function selectBlock(id,{scroll=false,filter=''}={}){if(selected!==id){rackLevelFilter='all';rackPage=1}selected=id;locationFilter=filter;locationPage=1;tool='select';document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool==='select'));renderCanvas();renderInspector();if(scroll)scrollToSelected()}
function parseProductLines(value){
 const out=[],seen=new Set();for(const line of text(value).split(/\r?\n/)){
  const v=line.trim();if(!v)continue;const parts=v.split('|').map(x=>x.trim());
  const code=parts.length>=2?parts[0].slice(0,55):'';
  const name=(parts.length>=2?parts[1]:parts[0]).slice(0,140);
  const shelf=parts.length>=3?parts.slice(2).join('|').slice(0,75):'';
  if(!name&&!code)continue;const key=norm(code+'|'+name+'|'+shelf);
  if(!seen.has(key)){seen.add(key);out.push({code,name,...(shelf?{shelf}:{})})}
 }
 if(out.length>MAX_LOCATION_PRODUCTS)throw Error('Bir konuma en fazla '+MAX_LOCATION_PRODUCTS+' ürün eklenebilir.');return out;
}
function productSummary(b){return b.products.length+' ürün tanımlı';}
function renderLocationProducts(b){
 const box=$('locationProducts');if(!box)return;
 const q=norm(locationFilter);const found=b.products.filter(p=>!q||norm(p.name).includes(q)||norm(p.code).includes(q)||norm(p.shelf).includes(q));
 const end=Math.min(found.length,locationPage*PRODUCT_PAGE_SIZE),visible=found.slice(0,end);
 box.innerHTML=`<p class="location-count">${found.length} ürün gösteriliyor${q?' · '+esc(locationFilter)+' araması':''}</p>`+
 (found.length?`<ul class="products-list compact-products">${visible.map(p=>`<li><span class="product-name">${esc(p.name||p.code)}</span>${p.code?`<small>${esc(p.code)}</small>`:''}${p.side&&p.section?`<span class="shelf-pill">${p.side==='left'?'Sol':'Sağ'} · ${String(p.section).padStart(2,'0')}. bölüm</span>`:''}${p.shelf?`<span class="shelf-pill">Raf ${esc(p.shelf)}</span>`:''}</li>`).join('')}</ul>`:'<p class="muted">Bu aramada ürün bulunamadı.</p>')+
 (end<found.length?`<button class="btn secondary full small" type="button" id="moreLocationProducts">Sonraki ${Math.min(PRODUCT_PAGE_SIZE,found.length-end)} ürünü göster (${end}/${found.length})</button>`:'');
 $('moreLocationProducts')?.addEventListener('click',()=>{locationPage++;renderLocationProducts(b)});
}
function renderLRackInspector(b){
 const t=$('inspectorTitle'),h=$('inspectorBody'),editable=isEditable();
 t.textContent='L duvar rafı';
 const products=b.products.filter(p=>!locationFilter||[p.name,p.code,p.shelf,p.arm&&L_ARMS[p.arm],p.level&&L_LEVELS[p.level]].some(x=>norm(x).includes(norm(locationFilter))));
 const list=products.slice(0,locationPage*PRODUCT_PAGE_SIZE);
 h.innerHTML=`<div class="l-inspector-title"><strong>${esc(b.label)}</strong><span class="pill">L biçimli raf</span></div><p class="muted smalltext">Dikey/yatay kol ve alt/üst kat ayrı kayıtlı. Her bölüme 100+ ürün ekleyebilirsin.</p><div class="l-overview">${['vertical','horizontal'].map(arm=>['upper','lower'].map(level=>`<span>${esc(L_ARMS[arm])} · ${esc(L_LEVELS[level])}: <b>${b.products.filter(p=>p.arm===arm&&p.level===level).length}</b></span>`).join('')).join('')}</div>`+
 (editable?`<form id="lRackSettings" class="l-rack-form"><label for="lRackName">Raf alanının adı</label><input id="lRackName" maxlength="75" required value="${esc(b.label)}"><div class="rotate-fields"><span>L rafı döndür</span><button class="btn small secondary" id="lRotateLeft" type="button">↶ 90°</button><button class="btn small secondary" id="lRotateRight" type="button">↷ 90°</button></div><label for="lRackOrientation">L yönü</label><select id="lRackOrientation">${Object.entries(L_ORIENTATIONS).map(([value,label])=>`<option value="${value}" ${b.orientation===value?'selected':''}>${label}</option>`).join('')}</select><div class="inline-fields"><div><label for="lRackW">Genişlik</label><input type="number" id="lRackW" value="${b.w}" min="3" max="15"></div><div><label for="lRackH">Yükseklik</label><input type="number" id="lRackH" value="${b.h}" min="3" max="15"></div></div><div class="row-actions"><button class="btn primary" type="submit">Rafı Güncelle</button><button id="removeLRack" class="btn secondary" type="button">Rafı Sil</button></div></form>`:'')+
 `<label for="locationFilter">Bu rafta ürün ara</label><input type="search" id="locationFilter" placeholder="Ürün adı, kod veya raf…" value="${esc(locationFilter)}"><p class="location-count">${products.length} ürün · ${b.products.length} toplam</p><ul class="l-products">${list.length?list.map(p=>`<li><strong>${esc(p.name||p.code)}</strong><small>${esc(p.code)} ${p.shelf?' · Raf '+esc(p.shelf):''}</small><span class="shelf-pill">${esc(L_ARMS[p.arm]||'Kol belirtilmedi')} · ${esc(L_LEVELS[p.level]||'Kat belirtilmedi')}</span>${editable?`<button type="button" class="btn small quiet" data-lremove="${b.products.indexOf(p)}">Sil</button>`:''}</li>`).join(''):'<li class="muted">Kayıt yok.</li>'}</ul>`+
 (products.length>list.length?`<button class="btn secondary full small" id="moreLProducts">Diğer ürünleri göster (${list.length}/${products.length})</button>`:'')+
 (editable?`<form id="lAddProduct" class="l-rack-form"><h3>Rafa ürün ekle</h3><label for="lProductName">Ürün adı</label><input id="lProductName" required maxlength="140" placeholder="Ürün adı"><label for="lProductCode">Ürün kodu (isteğe bağlı)</label><input id="lProductCode" maxlength="55" placeholder="Kod"><label for="lProductShelf">Raf numarası (isteğe bağlı)</label><input id="lProductShelf" maxlength="75" placeholder="Örn. 1019"><div class="inline-fields"><div><label for="lProductArm">Raf kolu</label><select id="lProductArm"><option value="vertical">Dikey kol</option><option value="horizontal">Yatay kol</option></select></div><div><label for="lProductLevel">Kat</label><select id="lProductLevel"><option value="lower">Alt</option><option value="upper">Üst</option></select></div></div><button type="submit" class="btn primary full">+ Ürünü Rafa Ekle</button></form>`:'');
 $('locationFilter').addEventListener('input',e=>{locationFilter=e.target.value;locationPage=1;renderLRackInspector(b)});
 $('moreLProducts')?.addEventListener('click',()=>{locationPage++;renderLRackInspector(b)});
 if(!editable)return;
 $('lRotateLeft').addEventListener('click',()=>rotateBlock(b.id,-1));
 $('lRotateRight').addEventListener('click',()=>rotateBlock(b.id,1));
 $('lRackSettings').addEventListener('submit',e=>{e.preventDefault();try{const name=$('lRackName').value.trim(),w=Number($('lRackW').value),hh=Number($('lRackH').value),orientation=$('lRackOrientation').value;if(!name||!L_ORIENTATIONS[orientation]||!Number.isInteger(w)||!Number.isInteger(hh)||w<3||hh<3||w>15||hh>15)throw Error('L raf için ad, yön ve 3–15 hücre arası ölçüler gerekli.');const candidate={...b,w,h:hh};if(!fits(candidate,b.id))throw Error('Yeni L raf boyutu diğer bloklarla çakışıyor veya dışarı taşıyor.');const old=clone(b);Object.assign(b,{label:name,w,h:hh,orientation});try{validate(serialize())}catch(err){Object.assign(b,old);throw err}dirtyNow();renderCanvas();renderInspector();search();setMessage('L raf güncellendi. Buluta kaydetmeyi unutma.','success')}catch(err){setMessage(err.message,'error')}});
 $('removeLRack').addEventListener('click',()=>{if(!confirm('Bu L raf ve ona bağlı '+b.products.length+' ürün konumu silinsin mi? Önce JSON yedeği önerilir.'))return;layout.blocks=layout.blocks.filter(x=>x.id!==b.id);selected=null;locationFilter='';dirtyNow();renderCanvas();renderInspector();search();setMessage('L raf silindi. Henüz buluta kaydedilmedi.','success')});
 $('lAddProduct').addEventListener('submit',e=>{e.preventDefault();const name=$('lProductName').value.trim(),code=$('lProductCode').value.trim(),shelf=$('lProductShelf').value.trim(),arm=$('lProductArm').value,level=$('lProductLevel').value;if(!name||!L_ARMS[arm]||!L_LEVELS[level])return;if(b.products.length>=MAX_LOCATION_PRODUCTS){setMessage('Raf ürün sınırı dolu.','error');return}if(b.products.some(p=>norm(p.name)===norm(name)&&norm(p.code)===norm(code)&&p.arm===arm&&p.level===level&&norm(p.shelf)===norm(shelf))){setMessage('Bu ürün bu raf konumunda zaten var.','error');return}b.products.push({name,code,...(shelf?{shelf}:{}),arm,level});try{validate(serialize())}catch(err){b.products.pop();setMessage(err.message,'error');return}dirtyNow();renderCanvas();renderInspector();search();setMessage('Ürün L duvar rafına eklendi. Kaydetmeyi unutma.','success')});
 h.onclick=e=>{const btn=e.target.closest('[data-lremove]');if(!btn)return;const i=Number(btn.dataset.lremove);if(!b.products[i]||!confirm('Bu ürünün L raf konumu kaldırılsın mı?'))return;b.products.splice(i,1);dirtyNow();renderCanvas();renderInspector();search();};
}
// Düz raf: 100+ ürün, üst / alt kat ayrı konumlar; eski ürünler konumsuz saklanır.
function renderRackInspector(b){
 const h=$('inspectorBody'),editable=isEditable();$('inspectorTitle').textContent='Raf · Alt / Üst';
 const counts={upper:b.products.filter(p=>p.level==='upper').length,lower:b.products.filter(p=>p.level==='lower').length,unknown:b.products.filter(p=>!L_LEVELS[p.level]).length};
 const q=norm(locationFilter);
 const matching=b.products.map((p,i)=>({p,i})).filter(({p})=>(rackLevelFilter==='all'||(rackLevelFilter==='unknown'?!L_LEVELS[p.level]:p.level===rackLevelFilter))&&productMatches(p,q));
 const visible=matching.slice(0,rackPage*PRODUCT_PAGE_SIZE);
 const currentLevel=['upper','lower'].includes(rackLevelFilter)?rackLevelFilter:'lower';
 h.innerHTML=`<div class="rack-summary"><strong>${esc(b.label)}</strong><span class="pill">${b.products.length} ürün</span></div>`+
 `<p class="muted smalltext">Her rafın üst ve alt katına ayrı ayrı 100’den fazla ürün tanımlanabilir. Krokiyi kalabalıklaştırmadan ürünleri arayabilirsin.</p>`+
 `<div class="rack-stack"><button type="button" class="rack-stack-row ${rackLevelFilter==='upper'?'active':''}" data-rack-tab="upper"><span>↑ ÜST KAT</span><b>${counts.upper} ürün</b></button><button type="button" class="rack-stack-row ${rackLevelFilter==='lower'?'active':''}" data-rack-tab="lower"><span>↓ ALT KAT</span><b>${counts.lower} ürün</b></button></div>`+
 `<div class="rack-filter-chips"><button type="button" class="${rackLevelFilter==='all'?'active':''}" data-rack-tab="all">Tümü · ${b.products.length}</button>${counts.unknown?`<button type="button" class="${rackLevelFilter==='unknown'?'active':''}" data-rack-tab="unknown">Konumu belirsiz · ${counts.unknown}</button>`:''}</div>`+
 `<label for="locationFilter">Raf içi ürün ara</label><input type="search" id="locationFilter" autocomplete="off" placeholder="Ürün adı, kod veya raf numarası..." value="${esc(locationFilter)}">`+
 `<p class="location-count">${matching.length} ürün bulundu${q?' · '+esc(locationFilter):''}</p>`+
 `<div class="rack-products">${visible.length?visible.map(({p,i})=>`<div class="rack-product"><div><strong>${esc(p.name||p.code)}</strong>${p.code?`<small>Kod: ${esc(p.code)}</small>`:''}${p.shelf?`<small>Raf: ${esc(p.shelf)}</small>`:''}<span class="shelf-pill">${esc(L_LEVELS[p.level]||'Kat belirtilmedi')}</span></div>${editable?`<div class="rack-product-actions">${p.level!=='upper'?`<button type="button" data-rack-set="upper" data-idx="${i}" title="Üst rafa taşı">↑ Üste</button>`:''}${p.level!=='lower'?`<button type="button" data-rack-set="lower" data-idx="${i}" title="Alt rafa taşı">↓ Alta</button>`:''}<button type="button" data-rack-remove="${i}" class="remove">Sil</button></div>`:''}</div>`).join(''):'<p class="muted">Bu bölümde henüz ürün yok.</p>'}</div>`+
 (visible.length<matching.length?`<button id="rackMore" type="button" class="btn secondary full small">Diğer ${Math.min(PRODUCT_PAGE_SIZE,matching.length-visible.length)} ürünü göster (${visible.length}/${matching.length})</button>`:'')+
 (editable?`<form id="rackAddProduct" class="rack-add-form"><h3>Rafa ürün ekle</h3><label for="rackProductName">Ürün adı</label><input id="rackProductName" required maxlength="140" placeholder="Ürün adı"><label for="rackProductCode">Ürün kodu (isteğe bağlı)</label><input id="rackProductCode" maxlength="55" placeholder="Kod"><label for="rackProductLevel">Hangi katta?</label><select id="rackProductLevel"><option value="lower" ${currentLevel==='lower'?'selected':''}>Alt kat</option><option value="upper" ${currentLevel==='upper'?'selected':''}>Üst kat</option></select><button type="submit" class="btn primary full">+ Ürünü ekle</button><p class="muted smalltext">Çok sayıda ürün için CSV aktarımı da kullanılabilir.</p></form><details class="rack-settings bulk-add"><summary>100+ ürünü topluca yapıştır</summary><form id="rackBulkAdd"><p class="muted smalltext">Her satıra: Ürün kodu | Ürün adı (kod isteğe bağlı). Mevcut ürünler silinmez.</p><label for="rackBulkLevel">Raf katı</label><select id="rackBulkLevel"><option value="lower" ${currentLevel==='lower'?'selected':''}>Alt kat</option><option value="upper" ${currentLevel==='upper'?'selected':''}>Üst kat</option></select><label for="rackBulkText">Ürün listesi</label><textarea id="rackBulkText" rows="5" placeholder="99001 | Ayçiçek Yağı 5 L&#10;99002 | Buono Çikolata"></textarea><button type="submit" class="btn secondary full">Listedeki ürünleri ekle</button></form></details>`:'')+
 (editable?`<details class="rack-settings"><summary>Rafı düzenle / döndür</summary><form id="rackSettings"><label for="rackName">Raf adı / numarası</label><input id="rackName" value="${esc(b.label)}" maxlength="75" required><div class="row-actions"><button class="btn small secondary" type="button" id="rackRotateLeft">↶ 90°</button><button class="btn small secondary" type="button" id="rackRotateRight">↷ 90°</button></div><div class="inline-fields"><div><label for="rackW">Genişlik</label><input id="rackW" type="number" min="1" max="15" value="${b.w}"></div><div><label for="rackH">Yükseklik</label><input id="rackH" type="number" min="1" max="15" value="${b.h}"></div></div><label for="rackNote">Not</label><textarea id="rackNote" maxlength="400">${esc(b.note)}</textarea><button type="submit" class="btn secondary full">Raf ayarlarını kaydet</button><button type="button" id="rackRemove" class="btn quiet full remove">Rafı sil</button></form></details>`:'');
 $('locationFilter').oninput=e=>{locationFilter=e.target.value;rackPage=1;renderRackInspector(b)};
 h.onclick=e=>{
  const tab=e.target.closest('[data-rack-tab]');if(tab){rackLevelFilter=tab.dataset.rackTab;rackPage=1;renderRackInspector(b);return}
  if(e.target.closest('#rackMore')){rackPage++;renderRackInspector(b);return}
  if(!editable)return;
  const set=e.target.closest('[data-rack-set]');if(set){const i=Number(set.dataset.idx),p=b.products[i];if(!p)return;p.level=set.dataset.rackSet;dirtyNow();renderRackInspector(b);renderCanvas();search();setMessage('Ürün yeni katına taşındı. Buluta kaydet.','success');return}
  const rem=e.target.closest('[data-rack-remove]');if(rem){const i=Number(rem.dataset.rackRemove);if(!b.products[i]||!confirm('Bu ürünün raf konumu silinsin mi?'))return;b.products.splice(i,1);dirtyNow();renderRackInspector(b);renderCanvas();search();return}
  if(e.target.closest('#rackRotateLeft')){rotateBlock(b.id,-1);return}if(e.target.closest('#rackRotateRight')){rotateBlock(b.id,1);return}
  if(e.target.closest('#rackRemove')){if(!confirm('Bu raf ve '+b.products.length+' ürün konumu silinsin mi? Önce JSON yedeği önerilir.'))return;layout.blocks=layout.blocks.filter(x=>x.id!==b.id);selected=null;dirtyNow();renderCanvas();renderInspector();search()}
 };
 if(!editable)return;
 $('rackAddProduct').onsubmit=e=>{e.preventDefault();const name=$('rackProductName').value.trim().slice(0,140),code=$('rackProductCode').value.trim().slice(0,55),level=$('rackProductLevel').value;if(!name||!L_LEVELS[level])return;if(b.products.length>=MAX_LOCATION_PRODUCTS){setMessage('Bu rafın ürün sınırı doldu.','error');return}if(b.products.some(p=>norm(p.name)===norm(name)&&norm(p.code)===norm(code)&&p.level===level)){setMessage('Bu ürün bu katta zaten kayıtlı.','error');return}b.products.push({name,code,level});try{validate(serialize())}catch(err){b.products.pop();setMessage(err.message,'error');return}dirtyNow();renderCanvas();renderRackInspector(b);search();setMessage('Ürün '+L_LEVELS[level].toLowerCase()+' rafa eklendi. Buluta kaydet.','success')};
 $('rackBulkAdd').onsubmit=e=>{e.preventDefault();try{const level=$('rackBulkLevel').value;if(!L_LEVELS[level])throw Error('Geçerli raf katı seç.');const additions=parseProductLines($('rackBulkText').value);if(!additions.length)throw Error('En az bir ürün satırı gir.');const original=b.products.length;let count=0,skipped=0;for(const p of additions){if(b.products.some(old=>old.level===level&&norm(old.name)===norm(p.name)&&norm(old.code)===norm(p.code)&&norm(old.shelf)===norm(p.shelf))){skipped++;continue}if(b.products.length>=MAX_LOCATION_PRODUCTS){b.products.length=original;throw Error('Bu rafın ürün sınırı doldu.')}b.products.push({...p,level});count++}try{validate(serialize())}catch(err){b.products.length=original;throw err}dirtyNow();renderCanvas();renderRackInspector(b);search();setMessage(`${count} ürün ${L_LEVELS[level].toLowerCase()} rafa eklendi, ${skipped} tekrar atlandı. Buluta kaydet.`, 'success')}catch(err){setMessage(err.message,'error')}};
 $('rackSettings').onsubmit=e=>{e.preventDefault();try{const label=$('rackName').value.trim(),w=Number($('rackW').value),height=Number($('rackH').value);if(!label||!Number.isInteger(w)||!Number.isInteger(height)||w<1||height<1||w>15||height>15)throw Error('Geçerli raf adı ve ölçü gerekli.');if(layout.blocks.some(x=>x.id!==b.id&&x.type==='rack'&&norm(x.label)===norm(label)))throw Error('Aynı raf numarası var.');if(!fits({...b,w,h:height},b.id))throw Error('Yeni boyut çakışıyor veya harita dışına taşıyor.');const old=clone(b);Object.assign(b,{label,w,h:height,note:$('rackNote').value.trim().slice(0,400),pivot:{cx2:2*b.x+w,cy2:2*b.y+height}});try{validate(serialize())}catch(err){Object.assign(b,old);throw err}dirtyNow();renderCanvas();renderInspector();search();setMessage('Raf güncellendi. Ürünler korundu.','success')}catch(err){setMessage(err.message,'error')}};
}
function renderAisleInspector(b){
 const h=$('inspectorBody'),editable=isEditable();$('inspectorTitle').textContent='Koridor · Sağ / Sol';
 const left=b.products.filter(p=>p.side==='left').length,right=b.products.filter(p=>p.side==='right').length,unplaced=b.products.length-left-right;
 h.innerHTML=`<h3>${esc(b.label)}</h3><p class="muted smalltext">${b.products.length} ürün kayıtlı · Sağ ve sol taraflar ayrı.</p><div class="aisle-counts"><span>← Sol <strong>${left}</strong></span><span>Sağ <strong>${right}</strong> →</span></div>`+
 (editable?`<form id="aisleQuickRename" class="aisle-quick-rename"><label for="aisleQuickName">Koridora isim ver</label><div class="aisle-name-row"><input id="aisleQuickName" maxlength="75" required value="${esc(b.label)}" placeholder="Ör. İçecek Koridoru"><button type="submit" class="btn primary small">Kaydet</button></div></form><div class="aisle-quick-size"><strong>Koridorun yerleşimi</strong><p class="muted smalltext">Eni ve boyu kare kare ayarla; + / − anında uygular ve otomatik kaydeder.</p><div class="aisle-size-fields"><div class="easy-size-field"><span>En (sütun)</span><div class="easy-counter"><button type="button" data-aisle-dim="w" data-delta="-1" aria-label="Koridorun enini azalt">−</button><output>${b.w}</output><button type="button" data-aisle-dim="w" data-delta="1" aria-label="Koridorun enini artır">+</button></div></div><div class="easy-size-field"><span>Boy (satır)</span><div class="easy-counter"><button type="button" data-aisle-dim="h" data-delta="-1" aria-label="Koridorun boyunu azalt">−</button><output>${b.h}</output><button type="button" data-aisle-dim="h" data-delta="1" aria-label="Koridorun boyunu artır">+</button></div></div></div><div class="row-actions"><button class="btn small secondary" id="aisleRotateLeft" type="button">↶ 90°</button><button class="btn small secondary" id="aisleRotateRight" type="button">↷ 90°</button></div></div>`:'')+
 `<button id="aisleOpen" type="button" class="btn primary full">Koridor ürünlerini aç</button>${unplaced?`<p class="muted smalltext">${unplaced} ürünün sağ/sol konumu henüz belirlenmemiş.</p>`:''}`+
 (editable?`<details class="rack-settings"><summary>Koridor notu ve silme</summary><form id="aisleNoteForm"><label for="aisleNote">Not</label><textarea id="aisleNote" maxlength="400">${esc(b.note)}</textarea><button class="btn secondary full" type="submit">Notu kaydet</button><button type="button" id="aisleRemove" class="btn quiet full remove">Koridoru sil</button></form></details>`:'');
 $('aisleOpen').onclick=()=>openCorridor(b.id);
 if(!editable)return;
 $('aisleQuickRename').onsubmit=e=>{e.preventDefault();renameAisle(b,$('aisleQuickName').value)};
 h.onclick=e=>{
   const inc=e.target.closest('[data-aisle-dim]');if(inc){resizeAisleQuick(b.id,inc.dataset.aisleDim,Number(inc.dataset.delta));return}
   if(e.target.closest('#aisleRotateLeft')){rotateBlock(b.id,-1);return}
   if(e.target.closest('#aisleRotateRight')){rotateBlock(b.id,1);return}
   if(e.target.closest('#aisleRemove')){if(!confirm('Bu koridor ve '+b.products.length+' ürün konumu silinsin mi? Önce JSON yedeği indir.'))return;layout.blocks=layout.blocks.filter(x=>x.id!==b.id);selected=null;dirtyNow();renderCanvas();renderInspector();search()}
 };
 $('aisleNoteForm').onsubmit=e=>{e.preventDefault();const note=$('aisleNote').value.trim().slice(0,400);if(b.note!==note){b.note=note;dirtyNow();renderInspector()}setMessage('Koridor notu kaydedildi. Buluta kaydet.','success')};
}

function renderInspector(){
 const b=layout.blocks.find(x=>x.id===selected),t=$('inspectorTitle'),h=$('inspectorBody');
 if(!b){t.textContent='Konum bilgileri';h.innerHTML='<p class="muted">Haritada bir raf veya koridor seç. Ürünleri arayarak listeleyebilirsin.</p>';return}
 if(b.type==='lrack'){renderLRackInspector(b);return}
 if(b.type==='rack'){renderRackInspector(b);return}
 if(b.type==='aisle'){renderAisleInspector(b);return}
 const hasProducts=['rack','aisle','lrack'].includes(b.type);t.textContent=TYPES[b.type].label+' bilgileri';
 if(!isEditable()){
  h.innerHTML=`<h3>${esc(b.label)}</h3><p class="muted">${esc(b.note||'')}</p>`+(hasProducts?`<div class="location-header"><strong>${esc(productSummary(b))}</strong><span class="pill">${esc(TYPES[b.type].label)}</span></div><label for="locationFilter">Bu konumda ürün ara</label><input id="locationFilter" type="search" placeholder="Ürün adı, kod veya raf…" autocomplete="off" value="${esc(locationFilter)}"><div id="locationProducts"></div>`:'');
  if(hasProducts){$('locationFilter').addEventListener('input',e=>{locationFilter=e.target.value;locationPage=1;renderLocationProducts(b)});renderLocationProducts(b)}return;
 }
 h.innerHTML=`<form id="editForm"><label for="editLabel">${b.type==='rack'?'Raf numarası':b.type==='aisle'?'Koridor adı':'Ad / açıklama'}</label><input id="editLabel" name="label" maxlength="75" required value="${esc(b.label)}"><div class="rotate-fields"><span>Yön: <b>${DIRECTION_SYMBOLS[blockDirection(b)]}</b></span><button class="btn small secondary" id="rotateLeft" type="button">↶ Sola 90°</button><button class="btn small secondary" id="rotateRight" type="button">↷ Sağa 90°</button></div><div class="inline-fields"><div><label for="editW">Genişlik (hücre)</label><input id="editW" type="number" min="1" max="15" value="${b.w}"></div><div><label for="editH">Yükseklik (hücre)</label><input id="editH" type="number" min="1" max="15" value="${b.h}"></div></div>${hasProducts?`<details class="product-editor"><summary>Ürünleri düzenle · ${b.products.length} ürün</summary><label for="editProducts">Ürünler (her satıra bir ürün)</label><textarea id="editProducts" spellcheck="false" placeholder="ÜRÜN-KODU | Ürün adı | raf numarası&#10;ÜRÜN-KODU-2 | Başka ürün">${esc(b.products.map(p=>[p.code,p.name,p.shelf||''].join(' | ').replace(/\s*\|\s*$/,'')).join('\n'))}</textarea><p class="muted smalltext">100+ ürün için sol menüdeki CSV aktarımı daha kolaydır. Her satır: Kod | Ürün | Raf (isteğe bağlı).</p></details>`:''}<label for="editNote">Not (isteğe bağlı)</label><textarea id="editNote" maxlength="400" style="min-height:55px">${esc(b.note)}</textarea><div class="row-actions"><button class="btn primary" type="submit">Uygula</button><button class="btn secondary" type="button" id="removeBlock">Sil</button></div></form>`+
 (hasProducts?`<div class="location-header"><strong>${esc(productSummary(b))}</strong></div><label for="locationFilter">Bu konumda ürün ara</label><input id="locationFilter" type="search" placeholder="Ürün adı, kod veya raf…" autocomplete="off" value="${esc(locationFilter)}"><div id="locationProducts"></div>`:'');
 $('rotateLeft').addEventListener('click',()=>rotateBlock(b.id,-1));
 $('rotateRight').addEventListener('click',()=>rotateBlock(b.id,1));
 $('editForm').addEventListener('submit',e=>{e.preventDefault();try{
  const label=$('editLabel').value.trim();const w=Number($('editW').value),hh=Number($('editH').value);
  if(!label)throw Error('Ad veya raf numarası boş olamaz.');
  if(!Number.isInteger(w)||!Number.isInteger(hh)||w<1||hh<1||w>15||hh>15)throw Error('Blok boyutu 1–15 hücre olmalı.');
  if(b.type==='rack'&&layout.blocks.some(x=>x.id!==b.id&&x.type==='rack'&&norm(x.label)===norm(label)))throw Error('Bu raf numarası zaten var.');
  const proposed={...b,w,h:hh};if(!fits(proposed,b.id))throw Error('Blok diğer bloklarla çakışıyor veya harita dışına taşıyor.');
  const products=hasProducts?parseProductLines($('editProducts').value):[];
  if(hasProducts)for(const p of products){const oldPosition=b.products.find(old=>(p.code&&norm(old.code)===norm(p.code))||(norm(old.name)===norm(p.name)&&norm(old.shelf)===norm(p.shelf)));if(oldPosition?.side&&oldPosition?.section){p.side=oldPosition.side;p.section=oldPosition.section}}
  const old=clone(b);b.label=label;b.w=w;b.h=hh;b.pivot={cx2:b.x*2+w,cy2:b.y*2+hh};b.note=$('editNote').value.trim().slice(0,400);if(hasProducts)b.products=products;
  try{validate(serialize())}catch(err){Object.assign(b,old);throw err}dirtyNow();renderCanvas();renderInspector();search();setMessage('Konum güncellendi. Buluta kaydetmeyi unutma.','success');
 }catch(err){setMessage(err.message,'error')}});
 $('removeBlock').addEventListener('click',()=>{if(!confirm(`“${b.label}” silinsin mi?`))return;layout.blocks=layout.blocks.filter(x=>x.id!==b.id);selected=null;locationFilter='';dirtyNow();renderCanvas();renderInspector();search();setMessage('Blok silindi.','success')});
 if(hasProducts){$('locationFilter').addEventListener('input',e=>{locationFilter=e.target.value;locationPage=1;renderLocationProducts(b)});renderLocationProducts(b)}
}


// Koridor yerleşimi: her ürün fiziksel olarak Sol/Sağ ve bölüm numarası ile ilişkilendirilir.
// Eski kayıtların shelf alanı değiştirilmez; henüz yerleştirilmemiş ürünler ayrı görünür.
function corridorBlock(){return layout.blocks.find(b=>b.id===corridorId&&b.type==='aisle')}
function positionText(p){return p.side&&p.section?`${SIDES[p.side]} taraf · ${String(p.section).padStart(2,'0')}. bölüm`:'Konum henüz belirlenmedi'}
function productMatches(p,q){return !q||norm(p.name).includes(q)||norm(p.code).includes(q)||norm(p.shelf).includes(q)}
function openCorridor(id,q=''){
 const b=layout.blocks.find(x=>x.id===id&&x.type==='aisle');if(!b)return;
 corridorId=id;corridorSlot=null;corridorDetailPage=1;pendingMove=null;corridorQuery=q;$('corridorSearch').value=q;
 $('corridorOverlay').classList.remove('is-hidden');document.body.classList.add('corridor-open');
 $('corridorSections').value=b.sections||12;
 $('corridorTitle').textContent=b.label;$('corridorRenameInput').value=b.label;$('corridorRenameForm').classList.add('is-hidden');renderCorridor();
 if(q){const first=b.products.find(p=>p.side&&p.section&&productMatches(p,norm(q)));if(first)corridorSlot={side:first.side,section:first.section};renderCorridor();focusCorridorSlot()}
}
function closeCorridor(){corridorId=null;corridorSlot=null;pendingMove=null;$('corridorOverlay').classList.add('is-hidden');document.body.classList.remove('corridor-open');}
function setCorridorSlot(side,section){
 const b=corridorBlock();if(!b)return;
 if(isEditable()&&pendingMove!==null){
  const p=b.products[pendingMove];if(p){p.side=side;p.section=section;dirtyNow();setMessage(`${p.name||p.code} → ${SIDES[side]} ${section}. bölüm`, 'success')}
  pendingMove=null;
 }
 corridorSlot={side,section};corridorDetailPage=1;renderCorridor();focusCorridorSlot();
}
function corridorProductItem(p,index,{unplaced=false}={}){
 const name=esc(p.name||p.code),place=positionText(p);
 return `<div class="corridor-product" data-product-index="${index}"><div><strong>${name}</strong>${p.code?`<small>${esc(p.code)}</small>`:''}${p.shelf?`<small>Raf: ${esc(p.shelf)}</small>`:''}${unplaced?`<small class="awaiting">${esc(place)}</small>`:''}</div>${isEditable()?`<div class="product-actions">${unplaced?`<button class="btn small secondary" type="button" data-assign="${index}">Buraya koy</button>`:`<button class="btn small quiet" type="button" data-move="${index}" title="Başka bölüme taşı">Taşı</button><button class="btn small quiet remove" type="button" data-unplace="${index}" title="Konumu kaldır">Konumu kaldır</button>`}</div>`:''}</div>`;
}
function renderCorridor(){
 const b=corridorBlock();if(!b)return;const q=norm(corridorQuery),cnt=b.sections||12;
 $('corridorTitle').textContent=b.label;$('corridorSubtitle').textContent=`${b.products.length} ürün · ${cnt} karşılıklı bölüm · Sağ/sol her tarafta 100+ ürün`;
 const left=b.products.filter(p=>p.side==='left').length,right=b.products.filter(p=>p.side==='right').length;
 $('corridorSideCounts').innerHTML=`<span>← SOL <b>${left} ürün</b></span><span>SAĞ → <b>${right} ürün</b></span>`;
 const rows=[];for(let i=cnt;i>=1;i--){
  const slots=['left','right'].map(side=>{
   const items=b.products.filter(p=>p.side===side&&p.section===i),matching=items.filter(p=>productMatches(p,q));
   const active=corridorSlot?.side===side&&corridorSlot.section===i;
   const dim=q&&matching.length===0;const priority=q&&matching.length?[...matching,...items.filter(p=>!productMatches(p,q))]:items;const names=priority.slice(0,2).map(p=>esc(p.name||p.code));
   return `<button type="button" class="lane-slot ${active?'active':''} ${dim?'dim':''} ${q&&matching.length?'hit':''}" data-slot-side="${side}" data-slot-section="${i}" aria-label="${SIDES[side]} ${i}. bölüm, ${items.length} ürün"><span class="slot-heading"><b>${SIDES[side]} ${String(i).padStart(2,'0')}</b><small>${items.length} ürün</small></span><span class="slot-products">${names.length?names.map(n=>`<span>${n}</span>`).join(''):'<i>Ürün ekle / görüntüle</i>'}${items.length>2?`<small>+${items.length-2} ürün daha</small>`:''}</span></button>`;
  });
  rows.push(`<div class="lane-row">${slots[0]}<div class="lane-center"><span>${String(i).padStart(2,'0')}</span></div>${slots[1]}</div>`);
 }
 $('corridorRows').innerHTML=rows.join('');
 const matches=b.products.map((p,i)=>({p,i})).filter(({p})=>q&&productMatches(p,q));
 const sb=$('corridorSearchMatches');sb.classList.toggle('is-hidden',!q);
 sb.innerHTML=q?(matches.length?`<div class="match-label">${matches.length} ürün bulundu · Ürüne dokunarak yerini göster</div>`+matches.slice(0,30).map(({p,i})=>`<button type="button" data-match-index="${i}"><strong>${esc(p.name||p.code)}</strong><span>${esc(positionText(p))}</span></button>`).join('')+(matches.length>30?'<small>İlk 30 sonuç listelendi.</small>':''):'<p>Aradığın ürün bulunamadı.</p>'):'';
 renderCorridorDetail();renderUnplaced();
}
function focusCorridorSlot(){
 const box=$('corridorRows');if(!corridorSlot)return;const slot=[...box.querySelectorAll('.lane-slot')].find(x=>x.dataset.slotSide===corridorSlot.side&&Number(x.dataset.slotSection)===corridorSlot.section);if(!slot)return;const row=slot.closest('.lane-row');const top=row.getBoundingClientRect().top-box.getBoundingClientRect().top+box.scrollTop;box.scrollTop=Math.max(0,top-box.clientHeight/2+row.clientHeight/2);
}
function renderCorridorDetail(){
 const b=corridorBlock(),box=$('corridorDetail');if(!b)return;
 if(!corridorSlot){box.innerHTML=`<div class="detail-placeholder"><span class="placeholder-icon">☞</span><h3>Rafı seç</h3><p>Sol veya sağdaki bir raf bölümüne dokun. Ürünlerini hemen gör.</p><p class="muted">Yöneticiysen bu bölümden ürün de ekleyebilirsin.</p></div>`;return}
 const {side,section}=corridorSlot,items=b.products.map((p,i)=>({p,i})).filter(({p})=>p.side===side&&p.section===section),q=norm(corridorQuery);
 const filtered=q?items.filter(({p})=>productMatches(p,q)):items,visible=filtered.slice(0,corridorDetailPage*PRODUCT_PAGE_SIZE);
 box.innerHTML=`<div class="detail-heading"><div><span class="eyebrow">SEÇİLEN KONUM</span><h3>${SIDES[side]} taraf · ${String(section).padStart(2,'0')}. bölüm</h3><p>${items.length} ürün</p></div></div>`+
 (pendingMove!==null?'<p class="move-hint">Ürünü taşımak için haritadaki hedef raf bölümüne dokun.</p>':'')+
 `<div class="corridor-products">${visible.length?visible.map(({p,i})=>corridorProductItem(p,i)).join(''):(items.length?'<p class="muted">Aramada eşleşen ürün yok.</p>':'<p class="muted">Bu bölümde henüz ürün tanımlanmamış.</p>')}</div>${visible.length<filtered.length?`<button type="button" class="btn secondary full small" id="corridorMoreProducts">Diğer ${Math.min(PRODUCT_PAGE_SIZE,filtered.length-visible.length)} ürünü göster (${visible.length}/${filtered.length})</button>`:''}`+
 (isEditable()?`<form id="corridorAddProduct" class="corridor-add"><h4>Bu bölüme ürün ekle</h4><label for="corridorProductName">Ürün adı</label><input id="corridorProductName" maxlength="140" placeholder="Örn. Ayçiçek Yağı 5 L" required><label for="corridorProductCode">Ürün kodu (isteğe bağlı)</label><input id="corridorProductCode" maxlength="55" placeholder="Ürün kodu"><button type="submit" class="btn primary full">+ Ürünü bu rafa ekle</button></form><details class="bulk-add corridor-bulk"><summary>Bu bölüme 100+ ürün toplu ekle</summary><form id="corridorBulkAdd"><p class="muted smalltext">Kod | Ürün adı şeklinde satır satır yapıştır. Sol/sağ ve bölüm otomatik bağlanır. Önceki ürünler korunur.</p><textarea id="corridorBulkText" rows="5" placeholder="99001 | Ayçiçek Yağı 5 L&#10;99002 | Buono Çikolata"></textarea><button type="submit" class="btn secondary full">Listeyi bu bölüme ekle</button></form></details>`:'');
 if(isEditable())$('corridorAddProduct').addEventListener('submit',e=>{
  e.preventDefault();const name=$('corridorProductName').value.trim(),code=$('corridorProductCode').value.trim();if(!name)return;
  if(b.products.length>=MAX_LOCATION_PRODUCTS){setMessage('Koridor ürün sınırına ulaşıldı.','error');return}
  if(b.products.some(p=>p.side===side&&p.section===section&&norm(p.name)===norm(name)&&norm(p.code)===norm(code))){setMessage('Bu ürün zaten bu bölümde kayıtlı.','error');return}
  b.products.push({name:name.slice(0,140),code:code.slice(0,55),side,section});try{validate(serialize())}catch(err){b.products.pop();setMessage(err.message,'error');return}dirtyNow();renderCanvas();search();renderCorridor();setMessage('Ürün rafa yerleştirildi. Buluta kaydetmeyi unutma.','success');
 });
 if(isEditable())$('corridorBulkAdd').addEventListener('submit',e=>{e.preventDefault();try{const additions=parseProductLines($('corridorBulkText').value);if(!additions.length)throw Error('En az bir ürün gir.');const orig=b.products.length;let added=0,skipped=0;for(const p of additions){if(b.products.some(old=>old.side===side&&old.section===section&&norm(old.name)===norm(p.name)&&norm(old.code)===norm(p.code)&&norm(old.shelf)===norm(p.shelf))){skipped++;continue}if(b.products.length>=MAX_LOCATION_PRODUCTS){b.products.length=orig;throw Error('Bu koridorun ürün sınırı doldu.')}b.products.push({...p,side,section});added++}try{validate(serialize())}catch(err){b.products.length=orig;throw err}dirtyNow();renderCanvas();renderCorridor();search();setMessage(`${added} ürün ${SIDES[side]} ${section}. bölüme eklendi; ${skipped} tekrar atlandı. Buluta kaydet.`, 'success')}catch(err){setMessage(err.message,'error')}});
}
function renderUnplaced(){const b=corridorBlock(),box=$('corridorUnassigned');if(!b)return;
 const q=norm(corridorQuery),unplaced=b.products.map((p,i)=>({p,i})).filter(({p})=>!p.side||!p.section).filter(({p})=>productMatches(p,q));
 box.innerHTML=`<details ${q&&unplaced.length?'open':''}><summary>Konumu henüz belirtilmemiş ürünler <span>${unplaced.length}</span></summary><div class="unplaced-content">${unplaced.length?`<p class="muted">Eski kayıtlar korunuyor. Ürünü seçili raf bölümüne tek dokunuşla yerleştirebilirsin.</p>${unplaced.slice(0,40).map(({p,i})=>corridorProductItem(p,i,{unplaced:true})).join('')}${unplaced.length>40?`<p class="muted">İlk 40 ürün gösteriliyor. Aramayı kullanarak diğerlerini bul.</p>`:''}`:'<p class="muted">Konumsuz ürün bulunmuyor.</p>'}</div></details>`;
}
function bindCorridorEvents(){
 $('closeCorridor').addEventListener('click',closeCorridor);
 $('corridorOverlay').addEventListener('click',e=>{if(e.target.id==='corridorOverlay')closeCorridor()});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&corridorId)closeCorridor()});
 $('corridorSearch').addEventListener('input',e=>{corridorQuery=e.target.value;corridorDetailPage=1;renderCorridor()});
 $('corridorRows').addEventListener('click',e=>{const x=e.target.closest('[data-slot-side]');if(x)setCorridorSlot(x.dataset.slotSide,Number(x.dataset.slotSection))});
 $('corridorSearchMatches').addEventListener('click',e=>{const x=e.target.closest('[data-match-index]');if(!x)return;const p=corridorBlock()?.products[Number(x.dataset.matchIndex)];if(p?.side&&p.section){corridorSlot={side:p.side,section:p.section};renderCorridor();focusCorridorSlot()}else{$('corridorUnassigned').querySelector('details')?.setAttribute('open','');$('corridorUnassigned').scrollIntoView({behavior:'smooth',block:'start'})}});
 $('corridorDetail').addEventListener('click',e=>{if(e.target.closest('#corridorMoreProducts')){corridorDetailPage++;renderCorridorDetail();return}const move=e.target.closest('[data-move]'),unplace=e.target.closest('[data-unplace]');const b=corridorBlock();if(!b||!isEditable())return;
  if(move){pendingMove=Number(move.dataset.move);setMessage('Ürünün taşınacağı yeni raf bölümüne dokun.','info');renderCorridorDetail()}
  if(unplace){const i=Number(unplace.dataset.unplace),p=b.products[i];if(!p||!confirm('Bu ürünün sol/sağ konumu kaldırılsın mı? Ürün kaydı silinmeyecek.'))return;delete p.side;delete p.section;dirtyNow();renderCanvas();search();renderCorridor()}
 });
 $('corridorUnassigned').addEventListener('click',e=>{const btn=e.target.closest('[data-assign]');if(!btn||!isEditable())return;if(!corridorSlot){setMessage('Önce sol veya sağ tarafta bir raf bölümü seç.','error');return}const b=corridorBlock(),p=b?.products[Number(btn.dataset.assign)];if(!p)return;p.side=corridorSlot.side;p.section=corridorSlot.section;dirtyNow();renderCanvas();search();renderCorridor();setMessage('Ürün seçilen bölüme yerleştirildi.','success')});
 function applySections(n){const b=corridorBlock();if(!b||!isEditable())return false;if(!Number.isInteger(n)||n<2||n>60){setMessage('Bölüm sayısı 2 ile 60 arasında olmalı.','error');$('corridorSections').value=b.sections||12;return false}if(b.products.some(p=>p.section>n)){setMessage('Bu bölümde ürün var. Önce diğer bölüme taşı, sonra azalt.','error');$('corridorSections').value=b.sections||12;return false}if(b.sections!==n){b.sections=n;dirtyNow();renderCorridor();scheduleQuickSave();setMessage('Raf bölüm sayısı uygulandı; otomatik kaydedilecek.','success')}$('corridorSections').value=n;return true}
 $('applyCorridorSections').addEventListener('click',()=>applySections(Number($('corridorSections').value)));
 $('corridorSectionsMinus').addEventListener('click',()=>applySections((corridorBlock()?.sections||12)-1));
 $('corridorSectionsPlus').addEventListener('click',()=>applySections((corridorBlock()?.sections||12)+1));
 $('corridorRenameToggle').addEventListener('click',()=>{if(!isEditable())return;const editor=$('corridorRenameForm');editor.classList.toggle('is-hidden');if(!editor.classList.contains('is-hidden')){$('corridorRenameInput').value=corridorBlock()?.label||'';$('corridorRenameInput').focus()}});
 $('corridorRenameForm').addEventListener('submit',e=>{e.preventDefault();if(renameAisle(corridorBlock(),$('corridorRenameInput').value))$('corridorRenameForm').classList.add('is-hidden')});
}

function gridPosition(e){const rect=$('mapCanvas').getBoundingClientRect();return {x:Math.floor((e.clientX-rect.left)/(C*zoom)),y:Math.floor((e.clientY-rect.top)/(C*zoom))}}
function newAt(e){if(!isEditable()||tool==='select')return;const {x,y}=gridPosition(e);const type=tool,b=createBlock(type,x,y);if(layout.blocks.length>=MAX_BLOCKS){setMessage('Harita öğe sınırına ulaşıldı.','error');return}if(!fits(b)){setMessage('Burada yeterli boş alan yok. Başka bir hücre seç.','error');return}layout.blocks.push(b);selected=b.id;tool='select';dirtyNow();updateTool();renderInspector();$('editLabel')?.focus();}
function pointerDown(e){const target=e.target.closest('.block');if(!target)return;if(e.button!==0&&e.pointerType==='mouse')return;const id=target.dataset.id;const b=layout.blocks.find(x=>x.id===id);if(!b)return;selected=b.id;renderInspector();$('mapCanvas').querySelectorAll('.block').forEach(n=>n.classList.toggle('selected',n.dataset.id===b.id));if(!isEditable()||tool!=='select')return;drag={id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,originX:b.x,originY:b.y,moved:false};
 target.setPointerCapture?.(e.pointerId)
}
function pointerMove(e){if(!drag||e.pointerId!==drag.pointerId)return;const target=[...$('mapCanvas').querySelectorAll('.block')].find(x=>x.dataset.id===drag.id);if(!target)return;const dx=(e.clientX-drag.startX)/zoom,dy=(e.clientY-drag.startY)/zoom;if(Math.abs(dx)>5||Math.abs(dy)>5)drag.moved=true;if(!drag.moved)return;target.style.transform=`translate(${dx}px,${dy}px)`;target.style.opacity='.8';}
function pointerUp(e){if(!drag||e.pointerId!==drag.pointerId)return;const d=drag;drag=null;if(!d.moved)return;suppressClickUntil=Date.now()+350;const block=layout.blocks.find(x=>x.id===d.id);if(!block)return;const dx=Math.round((e.clientX-d.startX)/(C*zoom)),dy=Math.round((e.clientY-d.startY)/(C*zoom));if(dx||dy){const target={...block,x:d.originX+dx,y:d.originY+dy};if(fits(target,block.id)){block.x=target.x;block.y=target.y;if(block.pivot){block.pivot.cx2+=2*dx;block.pivot.cy2+=2*dy}dirtyNow();setMessage('Blok taşındı. Kaydedilmemiş değişiklik var.','success')}else{setMessage('O konum dolu veya harita sınırı dışında.','error')}}renderCanvas();renderInspector();}
function search(){
 const q=norm($('searchInput').value),box=$('searchResults');matched.clear();if(!q){box.classList.add('is-hidden');box.innerHTML='';renderCanvas();return}
 const found=layout.blocks.filter(b=>norm(b.label).includes(q)||(['rack','aisle','lrack'].includes(b.type)&&b.products.some(p=>norm(p.code).includes(q)||norm(p.name).includes(q)||norm(p.shelf).includes(q))));
 found.forEach(b=>matched.add(b.id));
 box.innerHTML=found.length?found.slice(0,30).map(b=>{
  const products=['rack','aisle','lrack'].includes(b.type)?b.products.filter(p=>norm(p.code).includes(q)||norm(p.name).includes(q)||norm(p.shelf).includes(q)):[];
  return `<button type="button" class="result" data-result="${esc(b.id)}"><b>${esc(b.label)}</b><span>${products.length?esc(products.slice(0,2).map(p=>(p.name||p.code)+(p.side&&p.section?' · '+SIDES[p.side]+' '+String(p.section).padStart(2,'0'):'')+(p.arm?' · '+L_ARMS[p.arm]+' '+(L_LEVELS[p.level]||''):(p.level?' · '+L_LEVELS[p.level]+' kat':''))).join(' · '))+ (products.length>2?` · +${products.length-2} eşleşme`:''):esc(['rack','aisle','lrack'].includes(b.type)?`${b.products.length} ürün`:TYPES[b.type].label)}<small>${esc(TYPES[b.type].label)} · Haritada göster</small></span></button>`;
 }).join('')+(found.length>30?`<p class="muted">İlk 30 konum gösteriliyor. Aramayı daraltabilirsin.</p>`:''):'<div class="empty-state">Eşleşen raf, koridor veya ürün bulunamadı.</div>';
 box.classList.remove('is-hidden');renderCanvas();
}

function freeSlot(w=2,h=1){for(let y=0;y<=layout.rows-h;y++)for(let x=0;x<=layout.cols-w;x++){if(fits({x,y,w,h}))return{x,y}}return null}
function csvRows(raw){const first=raw.replace(/^\uFEFF/,'');const line=first.split(/\r?\n/,1)[0];const delim=[';',',','\t'].sort((a,b)=>line.split(b).length-line.split(a).length)[0];const out=[],row=[];let cur='',quoted=false;for(let i=0;i<first.length;i++){const ch=first[i];if(ch==='"'){if(quoted&&first[i+1]==='"'){cur+='"';i++}else quoted=!quoted}else if(ch===delim&&!quoted){row.push(cur);cur=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&first[i+1]==='\n')i++;row.push(cur);if(row.some(x=>x.trim()))out.push([...row]);row.length=0;cur=''}else cur+=ch}row.push(cur);if(row.some(x=>x.trim()))out.push(row);return out}
async function importCsv(file){
 if(!file||!isEditable())return;const data=await file.text();if(data.length>2e6)throw Error('CSV en fazla 2 MB olabilir.');
 const lines=csvRows(data);if(!lines.length)throw Error('CSV boş.');
 const first=lines[0].map(norm),hasHeader=first.some(x=>/^(raf(_no)?|raf no|raf numarasi|shelf|koridor(_adi)?|koridor adi|konum|lokasyon|urun_kodu|urun_adi|urun adi|urun kodu|product|malzeme)$/.test(x));
 const cols=hasHeader?first:[];
 const idx=(names,fallback)=>{const j=cols.findIndex(x=>names.some(n=>x===n||x.includes(n)));return j>=0?j:fallback};
 const corridorIdx=cols.findIndex(x=>x==='koridor'||x==='koridor_adi'||x==='koridor adi');
 const locIdx=idx(['konum','lokasyon','raf_no','raf no','shelf','raf'],0);
 const codeIdx=idx(['urun_kodu','urun kodu','barkod','kod','code'],1),nameIdx=idx(['urun_adi','urun adi','product','malzeme'],2);
 const shelfIdx=cols.findIndex((x,i)=>i!==locIdx&&['raf_no','raf no','raf','shelf'].includes(x));
 const typeIdx=cols.findIndex(x=>['tur','tip','konum_tipi'].includes(x));
 const armIdx=cols.findIndex(x=>['kol','raf_kolu','arm'].includes(x));const levelIdx=cols.findIndex(x=>['kat','seviye','level'].includes(x));
   const sideIdx=cols.findIndex(x=>['taraf','sag_sol','sag sol','side'].includes(x));
   const sectionIdx=cols.findIndex(x=>['bolum','bolum_no','bolum no','sira','section'].includes(x));
 const temp=clone(layout);let added=0,created=0,skipped=0,located=0;
 try{
  for(const row of lines.slice(hasHeader?1:0)){
   const rawCorridor=corridorIdx>=0?text(row[corridorIdx]).trim():'';
   const rawLoc=rawCorridor||text(row[locIdx]).trim(),name=text(row[nameIdx]).trim().slice(0,140),code=text(row[codeIdx]).trim().slice(0,55);
   if(!rawLoc||!name){skipped++;continue}
   const typeRaw=typeIdx>=0?norm(row[typeIdx]):'';
   const isCorridor=!!rawCorridor||(typeRaw.includes('koridor')||typeRaw==='aisle')||(!typeRaw&&norm(rawLoc).startsWith('koridor'));
   const type=(typeRaw==='lrack'||typeRaw.includes('l raf')||typeRaw.includes('l duvar'))?'lrack':isCorridor?'aisle':'rack';
   const label=(isCorridor&&type==='aisle'&&!norm(rawLoc).includes('koridor')?'Koridor ':'')+rawLoc.slice(0,75);
   const shelf=(shelfIdx>=0?text(row[shelfIdx]).trim():rawCorridor?text(row[locIdx]).trim():'').slice(0,75);
   let target=layout.blocks.find(b=>b.type===type&&norm(b.label)===norm(label));
   if(!target){const w=type==='aisle'?1:type==='lrack'?4:2,h=type==='aisle'?3:type==='lrack'?6:1,slot=freeSlot(w,h);if(!slot){skipped++;continue}target=createBlock(type,slot.x,slot.y,w,h,label);layout.blocks.push(target);created++}
   if(target.products.length>=MAX_LOCATION_PRODUCTS){skipped++;continue}
   const sideText=sideIdx>=0?norm(row[sideIdx]):'';const side=['sol','left','l'].includes(sideText)?'left':['sag','right','r'].includes(sideText)?'right':null;
   const section=sectionIdx>=0?Number(text(row[sectionIdx]).trim()):NaN;
   const armRaw=armIdx>=0?norm(row[armIdx]):'';const levelRaw=levelIdx>=0?norm(row[levelIdx]):'';const arm=['dikey','vertical','v'].includes(armRaw)?'vertical':['yatay','horizontal','h'].includes(armRaw)?'horizontal':null;const level=['ust','upper','u'].includes(levelRaw)?'upper':['alt','lower','a'].includes(levelRaw)?'lower':null;
   const product={code,name,...(shelf?{shelf}:{}),...(type==='lrack'&&arm?{arm}:{}),...((type==='lrack'||type==='rack')&&level?{level}:{}),...(type==='aisle'&&side&&Number.isInteger(section)&&section>=1&&section<=60?{side,section}:{})};
   if(product.section&&target.sections<product.section)target.sections=product.section;
   const same=(p)=>norm(p.name)===norm(name)&&norm(p.code)===norm(code)&&norm(p.shelf)===norm(shelf);
   const already=target.products.some(p=>same(p)&&p.side===product.side&&p.section===product.section&&p.arm===product.arm&&p.level===product.level);
   if(already){skipped++;continue}
   const waitingExact=type==='aisle'&&product.side?target.products.find(p=>same(p)&&(!p.side||!p.section)):null;
   const candidates=type==='aisle'&&product.side?target.products.filter(p=>!p.side&&norm(p.name)===norm(name)&&norm(p.code)===norm(code)):[];
   const waiting=waitingExact||(candidates.length===1?candidates[0]:null);
   if(waiting){waiting.side=product.side;waiting.section=product.section;located++}
   else{target.products.push(product);added++}
  }
  validate(layout);dirtyNow();renderCanvas();renderInspector();search();setMessage(`CSV işlendi: ${created} konum oluşturuldu, ${added} ürün eklendi, ${located} ürün rafa yerleştirildi, ${skipped} satır atlandı.`, 'success');
 }catch(e){layout=temp;renderCanvas();renderInspector();search();throw e}
}

function downloadBackup(){const data=JSON.stringify(serialize(),null,2);const blob=new Blob([data],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='aktiva-depo-haritasi-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
function showRemote(){state(!remoteReady?'SQL kurulumu gerekli':writeBusy?'Buluta kaydediliyor…':quickSaveQueued?'Değişiklik uygulandı · otomatik kaydedilecek':dirty?'Kaydedilmemiş değişiklikler':remoteRevision?'Bulutta güncel':'Yeni harita');$('lastSaved').textContent=remoteRevision?'Sunucu kayıt zamanı: '+prettyDate(remoteUpdated):remoteReady?'Henüz paylaşılan harita yok':'Sunucuda tablo bulunamadı — SQL kurulumunu yap.';$('saveMap').disabled=!remoteReady||writeBusy}
function findDraft(){try{const raw=localStorage.getItem(draftKey);if(!raw)return null;const d=JSON.parse(raw);return {layout:validate(d.layout),revision:d.revision,updatedAt:d.updatedAt}}catch{return null}}
function draftPrompt(){if(!isEditable())return;const d=findDraft();$('draftBanner').classList.toggle('is-hidden',!d);}
async function readRemote({fresh=false}={}){
 cancelQuickSave();
 try{
  const rows=await api('/rest/v1/ak_depo_haritasi?select=data,revision,updated_at&id=eq.ana-depo&limit=1');
  remoteReady=true;remoteRevision=rows[0]?.revision||0;remoteUpdated=rows[0]?.updated_at||null;
  layout=rows[0]?validate(rows[0].data):empty();selected=null;dirty=false;
  if(!fresh)draftPrompt();else $('draftBanner').classList.add('is-hidden');
  $('gridCols').value=layout.cols;$('gridRows').value=layout.rows;
  showRemote();renderCanvas();renderInspector();search();requestAnimationFrame(()=>{if(!matchMedia('(max-width:720px)').matches)fitMap()});return true;
 }catch(e){
  if(isInstalledError(e)){
   remoteReady=false;remoteRevision=0;remoteUpdated=null;layout=empty();
   if(isEditable()){const d=findDraft();if(d){layout=d.layout;dirty=true}setMessage('Supabase harita tablosu henüz kurulu değil. Yönetici yerel taslak hazırlayıp JSON indirebilir. Ortak kullanım için SQL dosyasını kur.','error')}
   else setMessage('Depo haritası henüz sunucuda kurulmamış. Yönetici SQL kurulumunu tamamlayınca görünecek.','error');
  }else{setMessage('Harita sunucudan okunamadı: '+e.message+'. Mevcut haritayı yanlışlıkla değiştirmemek için kaydetme kapalı.','error');remoteReady=false;layout=empty();const d=findDraft();if(isEditable()&&d){layout=d.layout;dirty=true}}
  showRemote();renderCanvas();renderInspector();return false;
 }
}
async function saveRemote({automatic=false}={}){if(!isEditable())return;if(!automatic)cancelQuickSave();if(!remoteReady){setMessage('Önce AKTIVA_DEPO_HARITASI_KURULUM.sql dosyasını Supabase SQL Editor’da çalıştır. Yerel çizimin korunuyor.','error');return}if(writeBusy)return;
 let payload;try{payload=validate(serialize());if(payload.demo)throw Error('Örnek kroki gerçek depo haritası olarak kaydedilemez. Önce “Boş krokiyle başla” deyip gerçek raflarını çiz.')}catch(e){setMessage('Kaydedilemedi: '+e.message,'error');return}
 const savingSnapshot=JSON.stringify(payload);writeBusy=true;showRemote();try{
  const rows=await api('/rest/v1/rpc/ak_depo_haritasi_kaydet',{method:'POST',body:{p_data:payload,p_expected_revision:remoteRevision}});
  const row=Array.isArray(rows)?rows[0]:rows;if(!row||typeof row.revision!=='number')throw Error('Sunucu kayıt onayı gelmedi.');
  remoteRevision=row.revision;remoteUpdated=row.updated_at;if(JSON.stringify(validate(serialize()))===savingSnapshot){afterSave();setMessage(automatic?'Ölçü değişikliği otomatik kaydedildi.':'Depo haritası kaydedildi. Toplamacılar güncel haritayı açabilir.','success')}else{dirty=true;localSave();setMessage('Kayıt sırasında yeni düzenleme yapıldı. Yeni değişiklik için kayıt bekleniyor.','info')}showRemote();
 }catch(e){setMessage((automatic?'Otomatik kayıt başarısız: ':'Harita kaydedilemedi: ')+e.message+'. Yerel taslak korunuyor; Buluta Kaydet ile tekrar deneyebilirsin.','error');localSave()}finally{writeBusy=false;if(quickSaveQueued&&dirty&&remoteReady){clearTimeout(quickSaveTimer);quickSaveTimer=setTimeout(flushQuickSave,1200)}showRemote()}
}
// Kullanıcının krokisine göre başlangıç yerleşimi. Yalnızca açık onay ile uygulanır.
function createWarehouseTemplate(){
 if(!isEditable())return;
 if(layout.blocks.length&&!confirm('Mevcut ekrandaki krokinin yerine 5 bölgeli boş depo şablonu açılsın mı? Kayıtlı ürünler silinmez, ancak değişiklikleri buluta kaydedersen mevcut haritanın üzerine yazılır. Önce JSON yedeği almanı öneririz.'))return;
 const t={version:1,cols:26,rows:20,blocks:[]};
 const put=(type,x,y,w,h,label,extra={})=>{const b=createBlock(type,x,y,w,h,label);Object.assign(b,extra);t.blocks.push(b);return b};
 put('lrack',0,3,4,10,'Sol Dış L Raf',{orientation:'bottom-right'});
 put('rack',0,15,4,2,'Sol Dış Raf');
 for(let k=0;k<4;k++){put('aisle',6,1+k*4,5,2,'Sol '+(k+1)+'. Koridor',{sections:12});put('aisle',15,1+k*4,5,2,'Sağ '+(k+1)+'. Koridor',{sections:12})}
 put('area',12,1,2,16,'Ana Koridor');
 for(let k=0;k<4;k++)put('rack',22,1+k*4,2,2,'Sağ Dış Raf '+(k+1));
 // Her şablon kullanıcı tarafından gerçek raf konumlarına göre doldurulacak.
 layout=validate(t);selected=null;locationFilter='';dirtyNow();$('gridCols').value=layout.cols;$('gridRows').value=layout.rows;renderCanvas();renderInspector();search();requestAnimationFrame(()=>{if(!matchMedia('(max-width:720px)').matches)fitMap()});setMessage('5 bölgeli boş depo şablonu açıldı. L rafın yönünü ve ürünlerin gerçek konumlarını tanımlayıp buluta kaydet.','success');
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

/* V3.4: Harita konumu ayrı; barkod kaydı yalnızca yöneticinin açık onayıyla merkezi katalog RPC üzerinden yapılır. */
let mapCatalog=[],mapCatalogRemote=false,mapCatalogLoaded=false,mapCatalogPromise=null;
let mapBarcodeChosen=null,mapBarcodeAdded=[],mapBarcodeTimer=null;
let mapBarcodePending='',mapBarcodeDecisionBusy=false;
let mapBarcodeStream=null,mapBarcodeControls=null,mapBarcodeReader=null,mapBarcodeDetector=null,mapBarcodeFrame=null,mapBarcodeActive=false,mapBarcodeGeneration=0,mapBarcodeLastSeen='';
function mapBarcodeStatus(message,kind='info'){
 const box=$('mapBarcodeFeedback');if(!box)return;box.textContent=message;box.dataset.kind=kind;
}
function mapBarcodeOpen(blockId=null){
 if(!isEditable())return;
 const blocks=layout.blocks.filter(b=>['aisle','rack','lrack'].includes(b.type));
 if(!blocks.length){setMessage('Önce en az bir koridor veya raf çiz.','error');return}
 // Koridorun açık detay penceresinden de başlatılabilir.
 const previousCorridorSlot=corridorSlot?{...corridorSlot}:null;
 if(corridorId&&$('corridorOverlay')&&!$('corridorOverlay').classList.contains('is-hidden'))closeCorridor();
 $('mapBarcodeModal').classList.remove('is-hidden');document.body.classList.add('map-barcode-open');
 const select=$('mapBarcodeBlock');select.innerHTML=blocks.map(b=>`<option value="${esc(b.id)}">${esc(b.label)} · ${b.type==='aisle'?'Koridor':b.type==='lrack'?'L Raf':'Raf'}</option>`).join('');
 const initial=blocks.find(b=>b.id===(blockId||selected))||blocks[0];select.value=initial.id;
 if(initial.type==='aisle'&&previousCorridorSlot){$('mapBarcodeSide').value=previousCorridorSlot.side;$('mapBarcodeSection').dataset.preferred=String(previousCorridorSlot.section)}
 mapBarcodeChosen=null;mapBarcodePending='';mapBarcodeDecisionBusy=false;mapBarcodeAdded=[];$('mapBarcodeLookup').value='';$('mapBarcodeMatches').innerHTML='';mapBarcodeStatus('');mapBarcodePendingDisplay();
 mapBarcodeRenderChosen();mapBarcodeRenderHistory();mapBarcodeTargetChanged();
 mapBarcodeLoadCatalog();
}
function mapBarcodeClose(){
 if(mapBarcodeDecisionBusy)return;
 mapBarcodeGeneration++;mapBarcodeStopCamera();
 $('mapBarcodeModal').classList.add('is-hidden');document.body.classList.remove('map-barcode-open');
 $('mapBarcodeLookup').value='';mapBarcodeChosen=null;mapBarcodePending='';mapBarcodeDecisionBusy=false;mapBarcodePendingDisplay();
}
function mapBarcodeTarget(){
 const b=layout.blocks.find(x=>x.id===$('mapBarcodeBlock').value&&['aisle','rack','lrack'].includes(x.type));if(!b)return null;
 if(b.type==='aisle')return {b,side:$('mapBarcodeSide').value,section:Number($('mapBarcodeSection').value)};
 if(b.type==='rack')return {b,level:$('mapBarcodeRackLevel').value,shelf:$('mapBarcodeShelf').value.trim().slice(0,75)};
 return {b,arm:$('mapBarcodeArm').value,level:$('mapBarcodeLLevel').value};
}
function mapBarcodeTargetLabel(t){
 if(!t)return 'Konum seçilmedi';
 if(t.b.type==='aisle')return `${t.b.label} · ${t.side==='left'?'Sol':'Sağ'} · ${String(t.section).padStart(2,'0')}. bölüm`;
 if(t.b.type==='lrack')return `${t.b.label} · ${L_ARMS[t.arm]} · ${L_LEVELS[t.level]}`;
 return `${t.b.label} · ${L_LEVELS[t.level]}${t.shelf?' · Raf '+t.shelf:''}`;
}
function mapBarcodeTargetChanged(){
 const t=mapBarcodeTarget(),b=t?.b;
 ['mapBarcodeAisleFields','mapBarcodeRackFields','mapBarcodeLRackFields'].forEach(x=>$(x).classList.add('is-hidden'));
 if(!b){$('mapBarcodeTargetHint').textContent='Önce koridor veya raf seç.';return}
 if(b.type==='aisle'){
  $('mapBarcodeAisleFields').classList.remove('is-hidden');
  const sec=$('mapBarcodeSection'),prev=Number(sec.dataset.preferred||sec.value)||1;
  sec.innerHTML=Array.from({length:b.sections||12},(_,i)=>`<option value="${i+1}">${String(i+1).padStart(2,'0')}. bölüm</option>`).join('');sec.value=String(Math.min(b.sections||12,prev));delete sec.dataset.preferred;
 }else if(b.type==='rack'){$('mapBarcodeRackFields').classList.remove('is-hidden')}
 else{$('mapBarcodeLRackFields').classList.remove('is-hidden')}
 const target=mapBarcodeTarget();$('mapBarcodeTargetHint').textContent='Seçili konum: '+mapBarcodeTargetLabel(target);
}
async function mapBarcodeLoadCatalog(force=false){
 if(mapCatalogLoaded&&!force){mapBarcodeCatalogNotice();return}
 if(mapCatalogPromise)return mapCatalogPromise;
 const p=(async()=>{
  $('mapBarcodeCatalogStatus').textContent='Excel ürün kataloğu yükleniyor…';
  // Basılı katalog eski ürünlerin adlarını çevrimdışı aramak içindir; barkodların tek kaynağı Supabase tablosudur.
  let staticRows=[];try{const r=await fetch('./aktiva-urunler.json',{cache:'no-store'});if(r.ok){const list=await r.json();if(Array.isArray(list))staticRows=list}}catch(e){console.warn('Katalog dosyası alınamadı',e)}
  let remote=[];let remoteError='';
  try{const records=await api('/rest/v1/aktiva_excel_catalog?select=code,name,position,pack,barcode&order=code.asc&limit=10000');if(Array.isArray(records)){remote=records;mapCatalogRemote=true}else throw Error('Katalog yanıtı geçersiz')}catch(e){mapCatalogRemote=false;remoteError=e.message}
  const byCode=new Map();for(const p of staticRows)if(p?.code&&p?.name)byCode.set(String(p.code).trim(),p);
  for(const p of remote)if(p?.code&&p?.name)byCode.set(String(p.code).trim(),p);
  mapCatalog=Array.from(byCode.values()).map(p=>({code:text(p.code).trim(),name:text(p.name).trim(),barcode:text(p.barcode).trim(),position:text(p.position).trim(),pack:p.pack}));
  mapCatalogLoaded=true;mapBarcodeCatalogNotice(remoteError);
  if($('mapBarcodeLookup').value.trim())mapBarcodeSearch();
 })().finally(()=>{if(mapCatalogPromise===p)mapCatalogPromise=null});
 mapCatalogPromise=p;return p;
}
function mapBarcodeCatalogNotice(error=''){
 const c=$('mapBarcodeCatalogStatus');if(!c)return;
 c.textContent=mapCatalogRemote?`${mapCatalog.length} ürün · Excel kataloğu güncel. Barkod eşleştirmeleri kullanılabilir.`:`${mapCatalog.length} yerel ürün · ${error?'Canlı katalog okunamadı: '+error+'. ':''}Barkod eşleştirmesi için çevrimiçi katalog gerekli; ürün kodu/adıyla arayabilirsin.`;
}
function mapBarcodeMatchesQuery(p,q){const term=norm(q);return norm(p.name).includes(term)||norm(p.code).includes(term)||norm(p.position).includes(term)||p.barcode===q.trim()}
function mapBarcodeSearch(){
 const raw=$('mapBarcodeLookup').value.trim(),box=$('mapBarcodeMatches');
 if(!raw){box.innerHTML='<p class="muted smalltext">Ürün adı, ürün kodu veya barkod arayabilirsin.</p>';return}
 if(!mapCatalogLoaded){box.innerHTML='<p class="muted">Katalog yükleniyor…</p>';return}
 const found=mapCatalog.filter(p=>mapBarcodeMatchesQuery(p,raw)).slice(0,15);
 box.innerHTML=found.length?found.map(p=>`<button type="button" class="map-barcode-match" data-map-code="${esc(p.code)}"><strong>${esc(p.name)}</strong><small>Kod: ${esc(p.code)}${p.position?' · Excel pozisyonu: '+esc(p.position):''}</small></button>`).join(''):`<p class="map-barcode-notfound">${mapBarcodePending?'Barkod kayıtlı değil. Ürünü adı veya koduyla arayıp seçtiğinde barkodu kaydetme onayı gösterilecek.':'“'+esc(raw)+'” katalogda bulunamadı. Önce ürünün adını veya kodunu kontrol et.'}</p>`;
}
function mapBarcodePendingDisplay(){
 const box=$('mapBarcodePendingInfo');if(!box)return;
 box.classList.toggle('is-hidden',!mapBarcodePending);
 $('mapBarcodePendingLabel').textContent=mapBarcodePending?'Okutulan / girilen barkod: '+mapBarcodePending:'';
}
function mapBarcodePick(p){
 if(!p||mapBarcodeDecisionBusy)return;
 mapBarcodeChosen=p;
 // Okutulan eşleşmeyen barkod, ürün seçilince kaybolmaz; onay gelene dek bekletilir.
 if(!mapBarcodePending)$('mapBarcodeLookup').value=p.barcode||p.code;
 $('mapBarcodeMatches').innerHTML='';mapBarcodeRenderChosen();
 mapBarcodeStatus(mapBarcodePending?'Barkod bilgisini kontrol et ve kaydetme tercihini seç.':'Ürünü ve hedef konumu kontrol edip ekle.','info');
}
function mapBarcodeRenderChosen(){
 const box=$('mapBarcodeChosen'),p=mapBarcodeChosen;
 const dec=$('mapBarcodeDecision'),pending=mapBarcodePending;
 $('mapBarcodeAdd').disabled=!p||!!pending||mapBarcodeDecisionBusy;
 box.innerHTML=p?`<div class="map-barcode-confirm"><span class="map-barcode-ok">✓ Katalogda bulundu</span><strong>${esc(p.name)}</strong><small>Ürün kodu: ${esc(p.code)}</small><small>Excel pozisyonu: ${esc(p.position||'Belirtilmemiş')}${p.pack?' · Koli içi: '+esc(p.pack):''}</small><small>Mevcut barkod: ${esc(p.barcode||'Tanımlanmamış')}</small></div>`:'<p class="muted">Kamerayla okutulan veya listeden seçilen ürün burada görünecek.</p>';
 if(!p||!pending){dec.classList.add('is-hidden');return}
 dec.classList.remove('is-hidden');
 const owner=mapCatalog.find(x=>x.code!==p.code&&x.barcode===pending);
 const same=p.barcode===pending;
 $('mapBarcodeDecisionTitle').textContent=owner?'Barkod başka üründe kayıtlı':same?'Barkod zaten kayıtlı':p.barcode?'Barkod farklı — değiştirmek ister misiniz?':'Barkod kayıtlı değil — kaydetmek ister misiniz?';
 $('mapBarcodeDecisionText').textContent=owner?`Bu barkod “${owner.name}” (Kod: ${owner.code}) ürününe kayıtlı. Başka bir ürüne aktarılamaz.`:same?'Bu barkod seçilen ürüne zaten tanımlı.':'Seçilen ürün: '+p.name+' (Kod: '+p.code+'). '+(p.barcode?'Mevcut barkod: '+p.barcode+'. Yeni barkod: '+pending+'. Kaydedersen eski barkodun yerine yenisi geçer.':'Yeni barkod: '+pending+'. Bu ürüne barkod kaydedilsin mi?');
 const action=$('mapBarcodeDecisionSave');action.disabled=mapBarcodeDecisionBusy||!!owner||same||!mapCatalogRemote||!/^[0-9]{6,20}$/.test(pending);
 action.textContent=mapBarcodeDecisionBusy?'Kaydediliyor…':p.barcode?'Evet, Barkodu Değiştir':'Evet, Barkodu Kaydet';
 $('mapBarcodeDecisionSkip').disabled=mapBarcodeDecisionBusy;
 $('mapBarcodeForget').disabled=mapBarcodeDecisionBusy;
 if(!mapCatalogRemote&&!owner&&!same)$('mapBarcodeDecisionText').textContent+=' Canlı kataloğa erişim yok; barkod kaydedilemez, sadece konuma ekleme yapılabilir.';
 if(!/^[0-9]{6,20}$/.test(pending)&&!owner&&!same)$('mapBarcodeDecisionText').textContent+=' Barkod kaydı için 6–20 rakam gerekir.';
}
function mapBarcodeBusyUI(value){
 // RPC sırasında yanlışlıkla başka ürün seçilip kayıt sonucunun karışmasını önle.
 for(const id of ['mapBarcodeLookup','mapBarcodeFind','mapBarcodeStart','mapBarcodeClose','mapBarcodeDone','mapBarcodeBlock']){
  const element=$(id);if(element)element.disabled=value;
 }
}
async function mapBarcodeSaveConfirmed(){
 const p=mapBarcodeChosen,value=mapBarcodePending;
 if(!isEditable()||!p||!value||mapBarcodeDecisionBusy||!mapCatalogRemote)return;
 if(!/^[0-9]{6,20}$/.test(value))return mapBarcodeStatus('Barkod 6–20 rakam olmalı.','error');
 const pack=Number(p.pack);
 if(!Number.isSafeInteger(pack)||pack<1)return mapBarcodeStatus('Bu ürünün koli içi adedi geçersiz; önce Mal Kabul kataloğundan düzelt.','error');
 mapBarcodeDecisionBusy=true;mapBarcodeBusyUI(true);mapBarcodeRenderChosen();
 let rpcAccepted=false;
 try{
  // Güncel durumu yeniden oku. Yanlış veya eş zamanlı güncellenmiş barkodları ezme.
  const existing=await api('/rest/v1/aktiva_excel_catalog?select=code,name,position,pack,barcode&code=eq.'+encodeURIComponent(p.code)+'&limit=2');
  if(!Array.isArray(existing)||existing.length!==1)throw Error('Bu ürün ortak katalogda bulunamadı; önce Excel ürün kataloğuna ekleyin.');
  const current=existing[0];
  if(text(current.barcode).trim()!==text(p.barcode).trim()){
   mapBarcodeChosen={...p,barcode:text(current.barcode).trim()};
   throw Error('Bu ürünün barkodu başka bir cihazda değişmiş. Yeni bilgiyi kontrol ederek tekrar onaylayın.');
  }
  const other=await api('/rest/v1/aktiva_excel_catalog?select=code,name,barcode&barcode=eq.'+encodeURIComponent(value)+'&limit=3');
  if(!Array.isArray(other))throw Error('Barkodun başka ürüne bağlı olup olmadığı denetlenemedi.');
  if(other.some(x=>text(x.code)!==p.code))throw Error('Bu barkod başka bir ürüne tanımlı. Başka ürünün barkodu değiştirilemez.');
  // Mal Kabul'ün mevcut barkod kayıt fonksiyonu; sunucudaki yetkilendirme geçerlidir.
  const currentPack=Number(current.pack);
  if(!Number.isSafeInteger(currentPack)||currentPack<1)throw Error('Katalogdaki koli içi miktar geçersiz.');
  await api('/rest/v1/rpc/aktiva_set_product_barcode',{method:'POST',body:{p_code:p.code,p_name:text(current.name),p_position:text(current.position),p_pack:currentPack,p_barcode:value}});
  rpcAccepted=true;
  // Katalog kaydının gerçekten güncellendiğini doğrula.
  const verify=await api('/rest/v1/aktiva_excel_catalog?select=code,name,position,pack,barcode&code=eq.'+encodeURIComponent(p.code)+'&limit=1');
  if(!Array.isArray(verify)||verify[0]?.barcode!==value)throw Error('Sunucu yeni barkodu doğrulamadı. Ürün Kataloğu bölümünden kontrol edin.');
  mapBarcodeChosen={...p,...verify[0],barcode:value};
  mapCatalog=mapCatalog.map(x=>x.code===p.code?{...x,barcode:value}:x);
  mapBarcodePending='';mapBarcodePendingDisplay();
  mapBarcodeStatus('✓ Barkod ortak ürün kataloğuna kaydedildi. Ürünü şimdi seçili konuma ekleyebilirsin.','success');
 }catch(e){mapBarcodeStatus(rpcAccepted?'Barkod kaydı gönderildi ancak sunucudan doğrulanamadı. Yeniden kaydetmeden önce Mal Kabul / Ürün Kataloğu bölümünden kontrol et. Ayrıntı: '+e.message:'Barkod kaydedilemedi: '+e.message,'error')}
 finally{mapBarcodeDecisionBusy=false;mapBarcodeBusyUI(false);mapBarcodeRenderChosen()}
}
function mapBarcodeSkip(){
 if(!mapBarcodeChosen||mapBarcodeDecisionBusy)return;
 mapBarcodePending='';mapBarcodePendingDisplay();mapBarcodeRenderChosen();
 mapBarcodeStatus('Barkod kataloğa kaydedilmedi. Ürünü yalnızca seçilen harita konumuna ekleyebilirsin.','info');
}
function mapBarcodeRenderHistory(){
 $('mapBarcodeAddedCount').textContent=String(mapBarcodeAdded.length);
 $('mapBarcodeAddedList').innerHTML=mapBarcodeAdded.length?mapBarcodeAdded.slice(-6).reverse().map(p=>`<div class="map-barcode-added"><strong>${esc(p.name)}</strong><small>${esc(p.target)}</small></div>`).join(''):'<p class="muted">Henüz ürün eklenmedi.</p>';
}
function mapBarcodeAdd(){
 if(!isEditable()||!mapBarcodeChosen||mapBarcodePending||mapBarcodeDecisionBusy)return;
 const t=mapBarcodeTarget(),p=mapBarcodeChosen;if(!t){mapBarcodeStatus('Geçerli bir koridor veya raf seç.','error');return}
 const {b}=t;
 if(b.products.length>=MAX_LOCATION_PRODUCTS){mapBarcodeStatus('Bu rafın veya koridorun kapasitesi doldu.','error');return}
 const item={code:p.code.slice(0,55),name:p.name.slice(0,140)};
 if(b.type==='aisle'){if(!SIDES[t.side]||!Number.isInteger(t.section)||t.section<1||t.section>(b.sections||12)){mapBarcodeStatus('Sol/sağ bölüm geçersiz.','error');return}Object.assign(item,{side:t.side,section:t.section})}
 if(b.type==='rack'){if(!L_LEVELS[t.level])return mapBarcodeStatus('Alt/üst raf seç.','error');item.level=t.level;if(t.shelf)item.shelf=t.shelf}
 if(b.type==='lrack'){if(!L_ARMS[t.arm]||!L_LEVELS[t.level])return mapBarcodeStatus('L raf kolu ve katını seç.','error');Object.assign(item,{arm:t.arm,level:t.level})}
 const duplicates=b.products.some(old=>{
  if(item.code&&norm(old.code)!==norm(item.code))return false;
  if(!item.code&&norm(old.name)!==norm(item.name))return false;
  if(b.type==='aisle')return old.side===item.side&&old.section===item.section;
  if(b.type==='lrack')return old.arm===item.arm&&old.level===item.level;
  return old.level===item.level&&norm(old.shelf)===norm(item.shelf);
 });
 if(duplicates){mapBarcodeStatus('Bu ürün seçilen konumda zaten var; tekrar eklenmedi. Başka bir ürün okutabilirsin.','info');return}
 b.products.push(item);
 try{validate(serialize())}catch(e){b.products.pop();mapBarcodeStatus('Ürün eklenemedi: '+e.message,'error');return}
 mapBarcodeAdded.push({name:p.name,target:mapBarcodeTargetLabel(t)});mapBarcodeRenderHistory();mapBarcodeChosen=null;mapBarcodePending='';mapBarcodePendingDisplay();mapBarcodeRenderChosen();$('mapBarcodeLookup').value='';$('mapBarcodeMatches').innerHTML='';
 dirtyNow();renderCanvas();renderInspector();search();
 mapBarcodeStatus('✓ Ürün '+mapBarcodeTargetLabel(t)+' konumuna eklendi. Başka ürün okutabilir veya bitirip Buluta Kaydet diyebilirsin.','success');
}
async function mapBarcodeDetected(raw){
 if(mapBarcodeDecisionBusy)return;
 const value=text(raw).trim();if(!value||value.length>100)return;
 mapBarcodeStopCamera();$('mapBarcodeLookup').value=value;
 mapBarcodePending='';mapBarcodeChosen=null;mapBarcodePendingDisplay();mapBarcodeRenderChosen();
 if(!mapCatalogLoaded){
  mapBarcodeStatus('Barkod okundu. Katalog kontrol ediliyor…','info');
  try{await mapBarcodeLoadCatalog();if(!$('mapBarcodeModal').classList.contains('is-hidden'))return mapBarcodeDetected(value)}
  catch(e){mapBarcodeStatus('Katalog açılamadı: '+e.message,'error')}return;
 }
 // Ürün kodu ile bulunan kaydı barkodla karıştırma: kod eşleşmesi barkod kaydı değiştirmez.
 const exact=mapCatalog.filter(p=>p.barcode===value||p.code===value);
 if(exact.length===1){mapBarcodePick(exact[0]);mapBarcodeStatus('✓ Ürün barkod/kod eşleşmesi bulundu. Konumu kontrol et.','success');return}
 if(exact.length>1){mapBarcodeSearch();mapBarcodeStatus('Birden fazla eşleşme var. Doğru ürünü listeden seç.','error');return}
 mapBarcodePending=value;mapBarcodePendingDisplay();
 $('mapBarcodeLookup').value='';mapBarcodeSearch();
 mapBarcodeStatus('Barkod kayıtlı değil. Ürünü adı veya koduyla ara, seç; sonra kaydetme onayı çıkacak.','info');
}
function mapBarcodeStopCamera(){
 mapBarcodeActive=false;
 if(mapBarcodeFrame){cancelAnimationFrame(mapBarcodeFrame);mapBarcodeFrame=null}
 if(mapBarcodeControls){try{mapBarcodeControls.stop()}catch{}mapBarcodeControls=null}
 if(mapBarcodeStream){for(const tr of mapBarcodeStream.getTracks())tr.stop();mapBarcodeStream=null}
 const video=$('mapBarcodeVideo');if(video){try{video.pause()}catch{}video.srcObject=null}
 $('mapBarcodeCameraWrap')?.classList.add('is-hidden');$('mapBarcodeStop')?.classList.add('is-hidden');$('mapBarcodeStart').disabled=false;
}
async function mapBarcodeLoadZXing(){
 if(window.ZXingBrowser?.BrowserMultiFormatReader)return window.ZXingBrowser;
 const scripts=[...document.scripts],old=scripts.find(s=>s.dataset.mapZxing==='1');if(old){if(window.ZXingBrowser?.BrowserMultiFormatReader)return window.ZXingBrowser;old.remove()}
 await new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.dataset.mapZxing='1';sc.src='https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js';sc.onload=resolve;sc.onerror=()=>reject(Error('Barkod okuyucu indirilemedi; internet bağlantını kontrol et.'));document.head.append(sc)});
 if(!window.ZXingBrowser?.BrowserMultiFormatReader)throw Error('Barkod okuyucu yüklenemedi.');return window.ZXingBrowser;
}
async function mapBarcodeStartCamera(){
 if(!isEditable())return;
 if(mapBarcodeActive)return;
 const token=++mapBarcodeGeneration;
 $('mapBarcodeStart').disabled=true;
 mapBarcodeStatus('Kamera hazırlanıyor…','info');
 const valid=()=>mapBarcodeGeneration===token&&!$('mapBarcodeModal').classList.contains('is-hidden');
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Kamera için HTTPS ve kamera izni gerekli. Elle barkod girebilirsin.');
  const video=$('mapBarcodeVideo');$('mapBarcodeCameraWrap').classList.remove('is-hidden');$('mapBarcodeStop').classList.remove('is-hidden');
  mapBarcodeActive=true;
  if(typeof window.BarcodeDetector==='function'){
   let detector=null;try{detector=new BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','upc_a','upc_e','itf']})}catch{}
   if(detector){
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});if(!valid()){stream.getTracks().forEach(t=>t.stop());return}
    mapBarcodeStream=stream;video.srcObject=stream;await video.play();if(!valid())return;
    mapBarcodeDetector=detector;mapBarcodeStatus('Kamerayı barkoda tut.','info');
    let busy=false;
    const tick=async()=>{
     if(!mapBarcodeActive||!valid())return;
     if(!busy&&video.readyState>=2){busy=true;try{const hits=await detector.detect(video);if(hits.length){mapBarcodeDetected(hits[0].rawValue);return}}catch{}finally{busy=false}}
     mapBarcodeFrame=requestAnimationFrame(tick);
    };mapBarcodeFrame=requestAnimationFrame(tick);return;
   }
  }
  // Daha önce Mal Kabul'de kullanılan ZXing kütüphanesiyle aynı fallback.
  const ZXing=await mapBarcodeLoadZXing();if(!valid())return;
  mapBarcodeReader=new ZXing.BrowserMultiFormatReader();
  const controls=await mapBarcodeReader.decodeFromVideoDevice(undefined,video,(result)=>{if(!mapBarcodeActive||!valid()||!result)return;const value=result.getText?.()||String(result.text||'');if(value)mapBarcodeDetected(value)});
  if(!valid()||!mapBarcodeActive){try{controls.stop()}catch{}mapBarcodeStopCamera();return}
  mapBarcodeControls=controls;
  mapBarcodeStatus('Kamerayı barkoda tut.','info');
 }catch(e){mapBarcodeStopCamera();if(valid())mapBarcodeStatus('Kamera açılamadı: '+e.message+' Barkodu elle yazabilir veya ürünü arayabilirsin.','error')}
 finally{if(!mapBarcodeActive)$('mapBarcodeStart').disabled=false}
}
function mapBarcodeBind(){
 $('mapBarcodeOpen').addEventListener('click',()=>mapBarcodeOpen());
 $('mapBarcodeOpenCorridor').addEventListener('click',()=>mapBarcodeOpen(corridorId));
 $('mapBarcodeClose').addEventListener('click',mapBarcodeClose);
 $('mapBarcodeDone').addEventListener('click',mapBarcodeClose);
 $('mapBarcodeModal').addEventListener('click',e=>{if(e.target.id==='mapBarcodeModal')mapBarcodeClose()});
 $('mapBarcodeBlock').addEventListener('change',()=>{mapBarcodeTargetChanged()});
 ['mapBarcodeSide','mapBarcodeSection','mapBarcodeRackLevel','mapBarcodeRackLevel','mapBarcodeShelf','mapBarcodeArm','mapBarcodeLLevel'].forEach(id=>$(id).addEventListener('change',mapBarcodeTargetChanged));
 $('mapBarcodeLookup').addEventListener('input',()=>{mapBarcodeChosen=null;mapBarcodeRenderChosen();clearTimeout(mapBarcodeTimer);mapBarcodeTimer=setTimeout(mapBarcodeSearch,160)});
 $('mapBarcodeFind').addEventListener('click',()=>{const q=$('mapBarcodeLookup').value.trim();if(!mapBarcodePending&&/^[0-9]{6,20}$/.test(q))mapBarcodeDetected(q);else mapBarcodeSearch()});
 $('mapBarcodeLookup').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('mapBarcodeFind').click()}});
 $('mapBarcodeMatches').addEventListener('click',e=>{const b=e.target.closest('[data-map-code]');if(b)mapBarcodePick(mapCatalog.find(p=>p.code===b.dataset.mapCode))});
 $('mapBarcodeAdd').addEventListener('click',mapBarcodeAdd);
 $('mapBarcodeDecisionSave').addEventListener('click',mapBarcodeSaveConfirmed);
 $('mapBarcodeDecisionSkip').addEventListener('click',mapBarcodeSkip);
 $('mapBarcodeForget').addEventListener('click',()=>{if(mapBarcodeDecisionBusy)return;mapBarcodePending='';mapBarcodePendingDisplay();mapBarcodeRenderChosen();mapBarcodeStatus('Barkod eşleştirmesi iptal edildi.','info')});
 $('mapBarcodeStart').addEventListener('click',mapBarcodeStartCamera);
 $('mapBarcodeStop').addEventListener('click',()=>{mapBarcodeGeneration++;mapBarcodeStopCamera()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){mapBarcodeGeneration++;mapBarcodeStopCamera()}});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('mapBarcodeModal').classList.contains('is-hidden'))mapBarcodeClose()});
}

function bind(){
 mapBarcodeBind();
 bindCorridorEvents();
 $('corridorRotateLeft').addEventListener('click',()=>rotateBlock(corridorId,-1));
 $('corridorRotateRight').addEventListener('click',()=>rotateBlock(corridorId,1));
 $('selectionToolbar').addEventListener('click',e=>{const button=e.target.closest('[data-rotate]');if(button){rotateBlock(selected,Number(button.dataset.rotate));return}if(e.target.closest('[data-open-corridor]'))openCorridor(selected)});
 $('quickCorridors').addEventListener('click',e=>{const btn=e.target.closest('[data-corridor-id]');if(btn){selectBlock(btn.dataset.corridorId);openCorridor(btn.dataset.corridorId)}});
 $('toolList').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(!b||!isEditable())return;tool=b.dataset.tool;updateTool()});
 $('mapCanvas').addEventListener('click',e=>{const b=e.target.closest('.block');if(b){if(Date.now()<suppressClickUntil)return;selectBlock(b.dataset.id);const block=layout.blocks.find(x=>x.id===b.dataset.id);if(block?.type==='aisle')openCorridor(block.id);return}newAt(e)});
 $('mapCanvas').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('block')){e.preventDefault();selectBlock(e.target.dataset.id)}});
 $('mapCanvas').addEventListener('pointerdown',pointerDown);$('mapCanvas').addEventListener('pointermove',pointerMove);$('mapCanvas').addEventListener('pointerup',pointerUp);$('mapCanvas').addEventListener('pointercancel',pointerUp);
 $('searchInput').addEventListener('input',search);$('clearSearch').addEventListener('click',()=>{$('searchInput').value='';search();$('searchInput').focus()});$('searchResults').addEventListener('click',e=>{const b=e.target.closest('[data-result]');if(!b)return;selectBlock(b.dataset.result,{scroll:true,filter:$('searchInput').value});const block=layout.blocks.find(x=>x.id===b.dataset.result);if(block?.type==='aisle')openCorridor(block.id,$('searchInput').value)});
 $('zoomOut').addEventListener('click',()=>updateZoom(zoom-.1));$('zoomIn').addEventListener('click',()=>updateZoom(zoom+.1));$('zoomFit').addEventListener('click',fitMap);
 $('resizeMap').addEventListener('click',()=>applyGridSize(Number($('gridCols').value),Number($('gridRows').value)));
 document.querySelector('.map-size-easy').addEventListener('click',e=>{const step=e.target.closest('[data-grid-dim]');if(!step||!isEditable())return;const dim=step.dataset.gridDim,delta=Number(step.dataset.gridDelta);if(!['cols','rows'].includes(dim)||![-1,1].includes(delta))return;applyGridSize(layout.cols+(dim==='cols'?delta:0),layout.rows+(dim==='rows'?delta:0))});
 $('warehouseTemplate').addEventListener('click',createWarehouseTemplate);
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
