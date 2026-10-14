/* Mağaza toplama modülü — mevcut mal kabul işlevlerinden bağımsız */
(()=>{
'use strict';
const el=id=>document.getElementById(id), safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let order=null, rows=[], tasks=[], pickerTimer=null, images=[], scanRows=[], voiceOn=true, speechRecognizer=null;
let activePallet=null, palletLines=[], pickerName="", identityReady=false, savingPick=false;
const allowed=()=>['picker','fork','admin'].includes(profile?.role);
const picker=()=>profile?.role==='picker';
const forklift=()=>profile?.role==='fork';
const api=(table,query='',opts={})=>req('/rest/v1/'+table+query,opts);
const say=s=>{if(!voiceOn||!('speechSynthesis' in window))return; speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(s);u.lang='tr-TR';u.rate=.9;speechSynthesis.speak(u)};
const info=s=>{el('pickInfo').textContent=s};
function init(){if(!session||!allowed()){el('pickingModule').classList.add('hidden');return}el('pickingModule').classList.toggle('hidden',profile.role==='admin');el('pickerSection').classList.toggle('hidden',!picker());el('pickControls').classList.toggle('hidden',!picker());el('forkSection').classList.toggle('hidden',!forklift());el('pickingAdmin').classList.add('hidden');if(profile.role==='admin'){loadReport();return}if(picker())loadPickerIdentity();reload();clearInterval(pickerTimer);pickerTimer=setInterval(()=>{if(!document.hidden&&session&&allowed())(profile.role==='admin'?loadReport():reload(true))},8000)}
async function reload(silent=false){try{const [o,t]=await Promise.all([api('picking_orders','?select=*&order=created_at.desc&limit=100'),api('forklift_tasks','?select=*&order=created_at.desc&limit=200')]);tasks=t;el('pickOrders').innerHTML=o.map(x=>`<option value="${safe(x.id)}">${safe(x.store_name)} — ${new Date(x.created_at).toLocaleDateString('tr-TR')}</option>`).join('');if(order&&o.some(x=>x.id===order.id))el('pickOrders').value=order.id;else if(o.length){order=o[0];el('pickOrders').value=order.id}else order=null;if(order)await loadItems();else rows=[];if(picker())await loadPallet();render();if(!silent)info('Mağaza verileri güncellendi.')}catch(e){info('Mağaza verileri yüklenemedi: '+e.message)}}
async function loadItems(){rows=await api('picking_items','?select=*&order=created_at.asc&order=id.asc&order_id=eq.'+encodeURIComponent(order.id)+'&limit=1000')}
function render(){const p=rows.find(x=>x.status!=='completed'&&x.status!=='out_of_stock');el('pickCurrent').innerHTML=!order?'<p>Önce mağaza fişi oluştur.</p>':!p?'<p>Bekleyen ürün kalmadı.</p>':`<div class="product"><div class="muted">Raf: ${safe(p.shelf_code||'Belirtilmedi')}</div><h3>${safe(p.product_name)}</h3><strong>${p.requested_qty} koli isteniyor</strong><p>Toplanan: ${p.picked_qty} • Durum: ${safe(p.status)}</p><div class="bar"><button id="pickDone">✓ Topladım</button><button class="alt" id="pickPartial">Eksik</button><button class="alt" id="pickNotHere">Yerinde yok</button><button class="alt" id="pickSpeak">🔊 Oku</button></div></div>`;
if(picker())renderPallet();
if(p){el('pickDone').onclick=()=>updateItem(p,{picked_qty:p.requested_qty,status:'completed'});el('pickPartial').onclick=()=>{const val=prompt('Kaç koli topladın? (0–'+p.requested_qty+')');if(val===null)return;const n=Number(val);if(!Number.isInteger(n)||n<0||n>=p.requested_qty){alert('İstenen miktardan az, geçerli bir koli sayısı gir.');return}updateItem(p,{picked_qty:n,status:'partial'})};el('pickNotHere').onclick=()=>notHere(p);el('pickSpeak').onclick=()=>say(`${p.shelf_code||'Raf numarası yok'}. ${p.product_name}. ${p.requested_qty} koli al.`)}
const relevant=tasks.filter(t=>rows.some(r=>r.id===t.picking_item_id));el('pickerNotifications').innerHTML=relevant.slice(0,20).map(t=>{const r=rows.find(x=>x.id===t.picking_item_id);return `<div class="entry"><b>${safe(r?.product_name||'Ürün')}</b><p>Forklift durumu: ${safe(({pending:'Bekliyor',accepted:'Alındı',ready:'Ürün hazır',out_of_stock:'Depoda yok'})[t.status]||t.status)}</p></div>`}).join('')||'<p>Henüz forklift talebi yok.</p>';
if(forklift()){el('forkPickingTasks').innerHTML=tasks.filter(t=>['pending','accepted'].includes(t.status)).map(t=>`<div class="entry"><b>Görev ${safe(t.id.slice(0,8))}</b><p>Ürün detayları yükleniyor…</p><div class="bar"><button data-task="${safe(t.id)}" data-state="ready">Ürün hazır</button><button class="alt" data-task="${safe(t.id)}" data-state="out_of_stock">Depoda yok</button></div></div>`).join('')||'<p>Bekleyen forklift görevi yok.</p>';el('forkPickingTasks').querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>answerTask(b.dataset.task,b.dataset.state));hydrateTasks()}
}
async function hydrateTasks(){const ids=tasks.filter(t=>['pending','accepted'].includes(t.status)).map(t=>t.picking_item_id);if(!ids.length)return;try{const all=await api('picking_items','?select=id,shelf_code,product_name,requested_qty&id=in.('+ids.join(',')+')');const map=new Map(all.map(x=>[x.id,x]));el('forkPickingTasks').querySelectorAll('[data-task]').forEach(b=>{const parent=b.closest('.entry'),task=tasks.find(t=>t.id===b.dataset.task),item=map.get(task?.picking_item_id);if(item)parent.querySelector('p').textContent=`Raf ${item.shelf_code||'-'} • ${item.product_name} • ${item.requested_qty} koli`})}catch(e){info('Görev ayrıntısı alınamadı: '+e.message)}}
async function updateItem(item,data){
 if(savingPick)return;
 if(!identityReady){alert('Önce ad soyad kaydet.');return}
 if(!activePallet||activePallet.order_id!==order?.id){alert('Önce bu mağaza için Yeni palet başlat.');return}
 const qty=Number(data.picked_qty);
 if(!Number.isInteger(qty)||qty<1){alert('Palete en az 1 koli eklenmeli. Ürün yoksa Yerinde yok seç.');return}
 savingPick=true;
 try{
  await req('/rest/v1/rpc/record_pallet_pick',{method:'POST',body:{p_pallet_id:activePallet.id,p_item_id:item.id,p_qty:qty,p_status:data.status}});
  await reload(true);say('Kaydedildi. Sonraki ürün.');
  const next=rows.find(x=>!['completed','out_of_stock'].includes(x.status));
  if(next)say(`${next.shelf_code||'Raf numarası yok'}. ${next.product_name}. ${next.requested_qty} koli al.`);
 }catch(e){alert('Koli kaydedilemedi: '+e.message)}finally{savingPick=false}
}
async function loadPickerIdentity(){
 try{
  const list=await api('profiles','?select=full_name&id=eq.'+session.user.id);
  pickerName=(list[0]?.full_name||'').trim();identityReady=!!pickerName;
  el('pickerIdentity').classList.toggle('hidden',identityReady);
  el('pickerSection').classList.toggle('hidden',!identityReady);
  el('pickControls').classList.toggle('hidden',!identityReady);
  el('pickerFullName').value=pickerName;
  el('pickerNameBadge').textContent=pickerName;
 }catch(e){identityReady=false;el('pickerIdentity').classList.remove('hidden');el('pickerNameError').textContent='Önce PALET_PERSONEL_KURULUM.sql dosyasını Supabase SQL Editor’da çalıştırın. '+e.message;el('pickerSection').classList.add('hidden');el('pickControls').classList.add('hidden')}
}
async function savePickerIdentity(){
 const name=el('pickerFullName').value.trim();
 if(name.length<3){el('pickerNameError').textContent='Ad soyad en az 3 karakter olmalı.';return}
 el('pickerNameSave').disabled=true;
 try{await req('/rest/v1/rpc/save_picker_name',{method:'POST',body:{p_name:name}});await loadPickerIdentity();info('Personel adı kaydedildi.')}catch(e){el('pickerNameError').textContent='Kaydedilemedi: '+e.message}finally{el('pickerNameSave').disabled=false}
}
async function loadPallet(){
 const a=await api('picking_pallets','?select=*&picker_id=eq.'+session.user.id+'&status=eq.open&limit=1');
 activePallet=a[0]||null;
 palletLines=activePallet?await api('picking_pallet_lines','?select=qty&pallet_id=eq.'+activePallet.id+'&limit=10000'):[];
}
function renderPallet(){
 const count=palletLines.reduce((sum,l)=>sum+Number(l.qty||0),0);
 const same=activePallet&&activePallet.order_id===order?.id;
 el('palletDetails').innerHTML=activePallet?`<p><b>${same?'Aktif mağaza':'Başka mağazada açık palet'}:</b> ${safe(activePallet.order_id===order?.id?order.store_name:'Önceki mağaza fişi')}</p><p><strong>Palet ${activePallet.pallet_no} • ${count} koli</strong></p>`:'<p>Henüz aktif palet yok. Toplamaya başlamak için yeni palet aç.</p>';
 el('palletStart').disabled=!identityReady||!order||!!activePallet;
 el('palletFinish').disabled=!activePallet||count===0;
 const disabled=!identityReady||!same;
 ['pickDone','pickPartial'].forEach(id=>{const b=el(id);if(b)b.disabled=disabled||savingPick});
}
async function startPallet(){
 if(!order||!identityReady)return;
 try{await req('/rest/v1/rpc/start_picking_pallet',{method:'POST',body:{p_order_id:order.id}});await loadPallet();render();info('Yeni palet açıldı. Kolileri toplamaya başlayabilirsin.')}catch(e){alert('Palet başlatılamadı: '+e.message)}
}
async function finishPallet(){
 if(!activePallet)return;
 const n=palletLines.reduce((a,x)=>a+Number(x.qty||0),0);
 if(!confirm(`Palet ${activePallet.pallet_no}, ${n} koli ile kapatılsın mı? Etiketi palete yapıştırmayı unutma.`))return;
 try{const finished=activePallet.pallet_no;await req('/rest/v1/rpc/finish_picking_pallet',{method:'POST',body:{p_pallet_id:activePallet.id}});await loadPallet();render();info(`Palet ${finished} tamamlandı: ${n} koli. Mevcut etiketi yapıştırabilirsin.`)}catch(e){alert('Palet kapatılamadı: '+e.message)}
}

async function notHere(item){if(!confirm(`${item.product_name} yerinde yok. Forkliftçiye görev gönderilsin mi?`))return;try{const existing=tasks.find(t=>t.picking_item_id===item.id&&['pending','accepted'].includes(t.status));if(existing){alert('Bu ürün için bekleyen görev var.');return}await api('forklift_tasks','',{method:'POST',body:{picking_item_id:item.id,requested_by:session.user.id,status:'pending'}});await api('picking_items','?id=eq.'+item.id,{method:'PATCH',body:{status:'waiting_forklift'}});await reload(true);say('Forkliftçiye görev gönderildi.')}catch(e){alert('Görev gönderilemedi: '+e.message)}}
async function answerTask(id,status){if(!confirm(status==='ready'?'Ürün toplama yerine hazır mı?':'Depoda ürün bulunamadı mı?'))return;try{const t=tasks.find(x=>x.id===id);await api('forklift_tasks','?id=eq.'+id,{method:'PATCH',body:{status,assigned_to:session.user.id,completed_at:new Date().toISOString()}});if(status==='out_of_stock')await api('picking_items','?id=eq.'+t.picking_item_id,{method:'PATCH',body:{status:'out_of_stock',picked_qty:0}});else await api('picking_items','?id=eq.'+t.picking_item_id,{method:'PATCH',body:{status:'pending'}});await reload(true);say('Forklift görevi kaydedildi.')}catch(e){alert('İşlem başarısız: '+e.message+' (ürün durumunu da kontrol edin)')}}
// OCR: read the KOLI column, never infer quantity from the final article code.
function cleanLine(s){return s.replace(/[|¦]/g,' ').replace(/\s+/g,' ').trim()}
function parsePickingLine(raw){
 const line=cleanLine(raw);if(!line||/^(sayfa|tarih|mağaza|magaza|toplam|artikel|poz\.?\s*no|koli\s*içi|top\.?\s*adet|art\.?\s*no)/i.test(line))return null;
 const m=line.match(/^(\d{2,7})\s+(.+)$/);if(!m)return null;
 const shelf=m[1], rest=m[2];
 // Preferred layout: POSITION | ARTICLE | KOLI | KOLI ICI | TOTAL ADET | ART NO.
 // Require arithmetic confirmation if three numeric columns can be recognized.
 const tail=rest.match(/^(.*?)\s+(\d{1,4})\s+(\d{1,4})\s+(\d{1,6})\s+(\d{5,14})\s*$/);
 if(tail&&tail[1].trim()){
  const qty=+tail[2],per=+tail[3],total=+tail[4];
  return {shelf_code:shelf,product_name:tail[1].trim(),requested_qty:qty>0&&qty*per===total?qty:'',review:qty*per!==total?'Koli × koli içi, toplam adede eşit değil. Kontrol et.':'',source:line};
 }
 // OCR can omit the article code; arithmetic still verifies the correct KOLI column.
 const noCode=rest.match(/^(.*?)\s+(\d{1,4})\s+(\d{1,4})\s+(\d{1,6})\s*$/);
 if(noCode&&noCode[1].trim()){
  const qty=+noCode[2],per=+noCode[3],total=+noCode[4];
  return {shelf_code:shelf,product_name:noCode[1].trim(),requested_qty:qty>0&&qty*per===total?qty:'',review:qty*per!==total?'Sayılar tutarsız; koli miktarını elle kontrol et.':'Ürün kodu okunamadı; satırı fişle karşılaştır.',source:line};
 }
 // Never guess which number is the carton count when columns are missing.
 return {shelf_code:shelf,product_name:rest,requested_qty:'',review:'Koli sütunu güvenilir okunamadı. Fişten koli sayısını gir.',source:line};
}
async function preparedImage(file,rotation=0){
 const bmp=await createImageBitmap(file);try{
  const scale=Math.min(2.5,2200/Math.max(bmp.width,bmp.height));
  const w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
  const canvas=document.createElement('canvas'),turn=rotation%180!==0;
  canvas.width=turn?h:w;canvas.height=turn?w:h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(bmp,-w/2,-h/2,w,h);
  const img=ctx.getImageData(0,0,canvas.width,canvas.height),px=img.data;
  for(let i=0;i<px.length;i+=4){const y=.299*px[i]+.587*px[i+1]+.114*px[i+2];const v=Math.max(0,Math.min(255,(y-128)*1.45+148));px[i]=px[i+1]=px[i+2]=v}
  ctx.putImageData(img,0,0);return canvas;
 }finally{bmp.close()}
}
async function readImages(){
 if(!images.length){alert('Önce fotoğraf seç.');return}if(images.length>20){alert('En fazla 20 sayfa.');return}
 el('pickScan').disabled=true;scanRows=[];let uncertain=0,unmatched=0;
 try{
  if(!window.Tesseract)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=res;s.onerror=()=>rej(new Error('OCR kütüphanesi indirilemedi'));document.head.append(s)});
  const worker=await Tesseract.createWorker('tur+eng');
  try{for(let i=0;i<images.length;i++){
   info(`${i+1}/${images.length} sayfa okunuyor…`);
   let best={text:'',score:-1};
   for(const angle of [0,90,270]){
    const canvas=await preparedImage(images[i],angle);const result=await worker.recognize(canvas);canvas.width=0;canvas.height=0;
    const lines=(result.data.text||'').split(/\r?\n/),parsed=lines.map(parsePickingLine).filter(Boolean);
    const score=parsed.filter(x=>x.requested_qty!=='').length*10+parsed.length;
    if(score>best.score)best={text:result.data.text||'',score};
    if(angle===0&&parsed.length>=5&&parsed.filter(x=>x.requested_qty!=='').length/parsed.length>=.8)break;
   }
   for(const raw of best.text.split(/\r?\n/)){
    const parsed=parsePickingLine(raw);
    if(parsed){if(parsed.review)uncertain++;scanRows.push(parsed)}
    else if(/\d/.test(raw)&&/[\p{L}]/u.test(raw)&&!/(tarih|sayfa|mağaza|magaza|toplam|artikel|adres|telefon|sipariş|sevk)/i.test(raw)){unmatched++;scanRows.push({shelf_code:'',product_name:cleanLine(raw),requested_qty:'',review:'Bu satır otomatik ayrıştırılamadı. Raf, ürün ve koli bilgisini fişten kontrol ederek düzelt.',source:raw});}
   }
  }}finally{await worker.terminate()}
  renderScan();info(`${scanRows.length} olası satır listelendi. ${uncertain+unmatched} satır kontrol istiyor. OCR tarafından hiç okunmayan ürünler yine eksik olabilir; fişteki ürünleri tek tek karşılaştır.`);
 }catch(e){info('Okuma hatası: '+e.message+' — ürünleri elle ekleyebilirsin.')}finally{el('pickScan').disabled=false}
}
function renderScan(){el('pickScanRows').innerHTML=scanRows.map((r,i)=>`<div class="grid product"><label>Raf<input data-i="${i}" data-k="shelf_code" value="${safe(r.shelf_code)}"></label><label>Ürün<input data-i="${i}" data-k="product_name" value="${safe(r.product_name)}"></label><label>Koli<input type="number" min="1" data-i="${i}" data-k="requested_qty" value="${r.requested_qty===''?'':Number(r.requested_qty)}" placeholder="Kontrol et"></label><button class="alt" data-remove="${i}">Sil</button>${r.review?`<p class="alert" style="grid-column:1/-1">⚠️ ${safe(r.review)}<br><small>${safe(r.source||'')}</small></p>`:''}</div>`).join('');el('pickScanRows').querySelectorAll('[data-k]').forEach(x=>x.oninput=()=>{const r=scanRows[Number(x.dataset.i)];r[x.dataset.k]=x.dataset.k==='requested_qty'?(x.value===''?'':Number(x.value)):x.value;if(x.dataset.k==='requested_qty'&&x.value!=='')r.review=''});el('pickScanRows').querySelectorAll('[data-remove]').forEach(x=>x.onclick=()=>{scanRows.splice(Number(x.dataset.remove),1);renderScan()})}
async function saveScan(){if(!order){alert('Önce mağaza fişi oluştur.');return}if(!scanRows.length){alert('Ürün ekle.');return}if(scanRows.some(r=>!r.product_name.trim()||!Number.isInteger(Number(r.requested_qty))||Number(r.requested_qty)<1||r.requested_qty==='')){alert('Ürün adı ve koli miktarlarını kontrol et.');return}if(!confirm(`${scanRows.length} satırı ${order.store_name} mağazasına kaydedelim mi? Fişteki TÜM ürünlerin burada olduğundan emin ol.`))return;try{const payload=scanRows.map(r=>({order_id:order.id,shelf_code:r.shelf_code,product_name:r.product_name,requested_qty:Number(r.requested_qty)}));for(let i=0;i<payload.length;i+=100)await api('picking_items','',{method:'POST',body:payload.slice(i,i+100)});scanRows=[];images=[];el('pickFiles').value='';renderScan();await reload(true);info('Ürünler kaydedildi.');say('Ürünler hazır. Toplamaya başlayabilirsiniz.')}catch(e){info('Kaydedilemedi: '+e.message)}}
async function createOrder(){const store=el('pickStore').value.trim();if(!store){alert('Mağaza adını gir.');return}try{const a=await api('picking_orders','',{method:'POST',body:{store_name:store,receipt_number:el('pickReceipt').value.trim()||null,created_by:session.user.id},headers:{Prefer:'return=representation'}});order=a[0];el('pickStore').value='';await reload(true);info('Mağaza fişi oluşturuldu. Şimdi fotoğraf seç.')}catch(e){info(e.message)}}
function listen(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('Bu tarayıcı sesli komut tanımayı desteklemiyor. Butonları kullanabilirsin.');return}const p=rows.find(x=>x.status!=='completed'&&x.status!=='out_of_stock');if(!p)return;if(!identityReady||!activePallet||activePallet.order_id!==order?.id){alert('Önce ad soyad ve aktif paleti hazırla.');return}try{speechRecognizer?.abort();speechRecognizer=new SR();speechRecognizer.lang='tr-TR';speechRecognizer.onresult=e=>{const s=e.results[0][0].transcript.toLocaleLowerCase('tr-TR');info('Duyulan: '+s);if(/yerinde yok|ürün yok/.test(s))notHere(p);else if(/evet|topladım|tamam/.test(s))updateItem(p,{picked_qty:p.requested_qty,status:'completed'});else if(/eksik/.test(s))el('pickPartial')?.click();else info('Komut anlaşılamadı, tekrar dene.')};speechRecognizer.start()}catch(e){info('Mikrofon başlatılamadı: '+e.message)}}
async function loadReport(){
 if(profile?.role!=='admin')return;
 const date=el('reportDate').value||new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
 el('reportInfo').textContent='Rapor yükleniyor…';
 try{
  const data=await api('picking_daily_events',`?select=event_type,qty,actor_id,created_at&created_at=gte.${encodeURIComponent(date+'T00:00:00+03:00')}&created_at=lt.${encodeURIComponent(nextIstanbulDate(date)+'T00:00:00+03:00')}&limit=10000`);
  const totals={picked:0,missing:0,not_here:0,out_of_stock:0};const people={};
  for(const r of data){if(r.event_type in totals)totals[r.event_type]+=Number(r.qty)||0;if(r.event_type==='picked')people[r.actor_id]=(people[r.actor_id]||0)+(Number(r.qty)||0)}
  const pending=await api('forklift_tasks','?select=id&status=in.(pending,accepted)&limit=10000');
  const cards=[['Toplanan koli',totals.picked],['Eksik koli',totals.missing],['Ürün yok bildirimi',totals.not_here],['Depoda yok (forklift)',totals.out_of_stock],['Bekleyen forklift görevi',pending.length]];
  el('reportStats').innerHTML=cards.map(([name,n])=>`<div class="adminstat">${safe(name)}<b>${n}</b></div>`).join('');
  const ids=Object.keys(people);let names={};
  if(ids.length){try{const profiles=await api('profiles',`?select=id,full_name&limit=1000`);for(const p of profiles)names[p.id]=p.full_name||p.id.slice(0,8)}catch{}}
  el('reportPeople').innerHTML=ids.length?'<table class="admin-table"><thead><tr><th>Personel ID</th><th>Toplanan koli</th></tr></thead><tbody>'+ids.map(id=>`<tr><td>${safe(names[id]||id.slice(0,8))}</td><td>${people[id]}</td></tr>`).join('')+'</tbody></table>':'<p>Bugün toplama kaydı bulunmuyor.</p>';
  await loadPalletReport(date);
  el('reportInfo').textContent='Son güncelleme: '+new Date().toLocaleTimeString('tr-TR')+' • 8 saniyede bir yenilenir. Eski işlemler bu rapora aktarılmaz.';
 }catch(e){el('reportInfo').textContent='Rapor yüklenemedi: '+e.message+' (Önce RAPOR_KURULUM.sql dosyasını çalıştır.)'}
}
async function loadPalletReport(date){
 const start=date+'T00:00:00+03:00',end=nextIstanbulDate(date)+'T00:00:00+03:00';
 const pallets=await api('picking_pallets',`?select=id,order_id,picker_id,pallet_no,status,created_at,closed_at&created_at=gte.${encodeURIComponent(start)}&created_at=lt.${encodeURIComponent(end)}&order=created_at.desc&limit=1000`);
 if(!pallets.length){el('reportPallets').innerHTML='<p>Bu tarihte başlatılmış palet yok.</p>';return}
 const [lines,people,orders]=await Promise.all([
  api('picking_pallet_lines','?select=pallet_id,qty&limit=10000'),
  api('profiles','?select=id,full_name&limit=1000'),
  api('picking_orders','?select=id,store_name&limit=1000')
 ]);
 const totals={};for(const l of lines)totals[l.pallet_id]=(totals[l.pallet_id]||0)+Number(l.qty||0);
 const names=Object.fromEntries(people.map(p=>[p.id,p.full_name||p.id.slice(0,8)]));
 const stores=Object.fromEntries(orders.map(o=>[o.id,o.store_name]));
 el('reportPallets').innerHTML='<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>Toplamacı</th><th>Mağaza</th><th>Palet</th><th>Koli</th><th>Durum</th><th>Bitiş</th></tr></thead><tbody>'+pallets.map(p=>`<tr><td>${safe(names[p.picker_id]||p.picker_id.slice(0,8))}</td><td>${safe(stores[p.order_id]||'-')}</td><td>${p.pallet_no}</td><td>${totals[p.id]||0}</td><td>${p.status==='closed'?'Tamamlandı':'Toplanıyor'}</td><td>${p.closed_at?new Date(p.closed_at).toLocaleTimeString('tr-TR'):'-'}</td></tr>`).join('')+'</tbody></table></div>';
}
function nextIstanbulDate(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)}
el('reportDate').value=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
el('reportDate').onchange=loadReport;el('reportRefresh').onclick=loadReport;
el('pickerNameSave').onclick=savePickerIdentity;el('palletStart').onclick=startPallet;el('palletFinish').onclick=finishPallet;
el('pickCreate').onclick=createOrder;el('pickOrders').onchange=async()=>{const id=el('pickOrders').value;order={id,store_name:el('pickOrders').selectedOptions[0]?.textContent||''};await loadItems();render()};el('pickFiles').onchange=e=>{images=[...e.target.files];info(images.length+' fotoğraf seçildi (en fazla 20).')};el('pickScan').onclick=readImages;el('pickAddRow').onclick=()=>{scanRows.push({shelf_code:'',product_name:'',requested_qty:1});renderScan()};el('pickSave').onclick=saveScan;el('pickVoice').onchange=e=>voiceOn=e.target.checked;el('pickListen').onclick=listen;el('pickRefresh').onclick=()=>reload();
const previousBoot=boot;boot=async function(){await previousBoot();if(session&&profile)init()};const oldClear=clearSession;clearSession=function(){clearInterval(pickerTimer);pickerTimer=null;el('pickingModule').classList.add('hidden');oldClear()};if(session&&profile)init();
})();
