/* AKTİVA - Yeni Sevkiyat Kaydı / Akıllı İrsaliye Okuma V4
 * Fotoğraflar kullanıcı cihazında Tesseract.js ile çözümlenir. Otomatik veritabanı kaydı YOK.
 */
(()=>{'use strict';
 const byId=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let files=[],catalog=[],busy=false,working=false,worker=null,objectUrls=[],parsed=null,rotation=0;
 let loadingPromise=null;
 const clean=s=>String(s||'').toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]/g,'');
 function attachButton(){
  const form=byId('ak-form');if(!form||form.querySelector('#ak-waybill-start'))return;
  const products=[...form.querySelectorAll('h3')].find(h=>h.textContent.trim()==='Ürün Listesi');if(!products)return;
  const btn=document.createElement('button');btn.type='button';btn.id='ak-waybill-start';btn.className='ak-waybill-entry';
  btn.innerHTML='<span class="akw-entry-icon" aria-hidden="true">▤</span><span><strong>İrsaliye Fotoğrafından Toplu Ürün Ekle</strong><small>Firma, irsaliye no, plaka, palet ve ürünleri tara · Önce kontrol et</small></span><span aria-hidden="true">›</span>';
  products.before(btn);btn.onclick=open;
 }
 let observer;function observe(){attachButton();observer=new MutationObserver(attachButton);const root=byId('aktivaCountUI');if(root)observer.observe(root,{subtree:true,childList:true});else{const inter=new MutationObserver(()=>{if(byId('aktivaCountUI')){inter.disconnect();observe()}});inter.observe(document.body,{childList:true,subtree:true})}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
 function status(s,type=''){const t=byId('akw-status');if(t){t.textContent=s;t.dataset.type=type}}
 function close(){if(busy){status('Fotoğraf işlenirken pencereyi kapatmak için işlemin bitmesini bekleyin.','warn');return;}const dlg=byId('akw-overlay');if(dlg)dlg.remove();objectUrls.forEach(u=>URL.revokeObjectURL(u));objectUrls=[];files=[];parsed=null;rotation=0;document.body.classList.remove('akw-open')}
 function open(){if(byId('akw-overlay'))return;
  const dlg=document.createElement('div');dlg.id='akw-overlay';dlg.className='akw-overlay';dlg.innerHTML=`<section class="akw-dialog" role="dialog" aria-modal="true" aria-labelledby="akw-title"><header class="akw-head"><div><small>MAL KABUL • BELGE OKUMA</small><h2 id="akw-title">Akıllı İrsaliye Tarama</h2></div><button type="button" id="akw-close" aria-label="Kapat">×</button></header><div class="akw-body"><p class="akw-muted">Belge üzerinde yazıların olduğu bölüm otomatik büyütülür; alanlar farklı köşelerde olsa da aranır. Birden fazla sayfayı da galeriden yükleyebilirsiniz.</p><div class="akw-actions"><label class="akw-upload"><span>📷 Fotoğraf Çek</span><input type="file" accept="image/*" capture="environment" id="akw-camera"></label><label class="akw-upload alt"><span>🖼 Galeriden Yükle</span><input type="file" accept="image/*" multiple id="akw-gallery"></label></div><p class="akw-small">En fazla 3 fotoğraf, her biri en fazla 12 MB. Destek: JPG, PNG, WebP; cihaz açabiliyorsa HEIC.</p><div id="akw-thumbs" class="akw-thumbs"></div><div class="akw-actions"><label>Fotoğraf yönü<select id="akw-rotate"><option value="0">Normal</option><option value="90">90° sağa döndür</option><option value="270">90° sola döndür</option><option value="180">Ters çevir</option></select></label><button id="akw-read" type="button">Fotoğrafları Oku</button></div><p id="akw-status" role="status" aria-live="polite"></p><div id="akw-review" hidden><div class="akw-section"><h3>Algılanan belge bilgileri</h3><div class="akw-grid"><label>Gönderen firma <small id="akw-supplier-confidence"></small><input id="akw-supplier" maxlength="150" placeholder="Firma bulunamadı, yazın"></label><label>İrsaliye numarası <small id="akw-invoice-confidence"></small><input id="akw-invoice" maxlength="100" placeholder="İrsaliye no bulunamadı, yazın"></label><label>Araç plakası <small id="akw-plate-confidence"></small><input id="akw-plate" maxlength="20" autocomplete="off" placeholder="Örn. 48 ABC 123"></label><label>Toplam palet sayısı <small id="akw-pallets-confidence"></small><input id="akw-total-pallets" type="number" min="0" step="1" max="999999" placeholder="Belgede bulunamadı"></label></div><p class="akw-small" id="akw-pallet-candidate" hidden></p><p class="akw-small">Plaka, belgenin farklı bölümlerinden aranır. Çekici/dorse plakalarını ve alıcı/gönderen firmayı kontrol edin. Toplam palet sayısı, ürün başına palet sayısından farklı olabilir.</p></div><div class="akw-section"><div class="akw-row"><h3>Olası ürünler <span id="akw-count"></span></h3><button type="button" id="akw-add">+ Satır Ekle</button></div><div id="akw-rows" class="akw-rows"></div><p class="akw-small">İrsaliyede “adet” yazıyorsa bunu koliye çevirmiyoruz. Özellikle katlanır kasa gibi ürünler adet olarak gelebilir. Koli ve palet alanlarını kontrol edin. İrsaliyede yalnızca toplam palet varsa, birden fazla ürüne otomatik dağıtılmaz. Her ürünün palet payını kontrol edin.</p></div><p id="akw-pal-check" class="akw-pal-check" role="status"></p><details class="akw-raw"><summary>Okunan metni gör / düzelt ve yeniden çözümle</summary><textarea id="akw-raw" rows="8" placeholder="İrsaliye metnini buraya yapıştırabilirsiniz"></textarea><button type="button" id="akw-reparse">Metinden Tekrar Algıla</button></details><label class="akw-approve"><input type="checkbox" id="akw-approve"><span>Firma, irsaliye no, plaka, toplam palet ve ürün bilgilerini kontrol ettim.</span></label><button id="akw-transfer" type="button" class="akw-transfer">Kontrol Ettim · Ürünleri Sevkiyata Ekle</button><p class="akw-small">Bu işlem yalnızca açık sevkiyat formunu doldurur. Veritabanına kayıt için ayrıca “Sevkiyatı Kaydet” seçilir.</p></div><details class="akw-raw"><summary>Fotoğraf okunmazsa metni elle yapıştır</summary><textarea id="akw-manual" rows="5" placeholder="Metni buraya yapıştırın. Örn. İrsaliye No: ABC2026000001234..."></textarea><button id="akw-fromtext" type="button">Metni Analiz Et</button></details></div></section>`;
  document.body.append(dlg);document.body.classList.add('akw-open');
  dlg.querySelector('#akw-close').onclick=close;dlg.addEventListener('click',e=>{if(e.target===dlg)close()});
  dlg.querySelector('#akw-camera').onchange=e=>addFiles(e.target.files);
  dlg.querySelector('#akw-gallery').onchange=e=>addFiles(e.target.files);
  dlg.querySelector('#akw-rotate').onchange=e=>{rotation=Number(e.target.value)||0};
  dlg.querySelector('#akw-read').onclick=readImages;
  dlg.querySelector('#akw-fromtext').onclick=()=>parseText(byId('akw-manual').value);
  dlg.querySelector('#akw-reparse').onclick=()=>parseText(byId('akw-raw').value);
  dlg.querySelector('#akw-add').onclick=()=>addRow({name:'',sku:'',cartons:null,rawAmount:null,unit:'unknown',pallets:0,review:true});
  dlg.querySelector('#akw-transfer').onclick=transfer;
  dlg.querySelector('#akw-total-pallets').addEventListener('input', updatePalletSummary);
  dlg.querySelector('#akw-approve').onchange=()=>status('Doğrulama seçildi; aktarım için ilgili butona basın.');
  loadCatalog().catch(()=>{});
  byId('akw-camera').focus();
 }
 function addFiles(list){
  if(busy)return;
  const available=[...list||[]];for(const f of available){
   if(files.length>=3){status('En fazla üç sayfa eklenebilir.','warn');break}
   if(!f.type.startsWith('image/')&&!/\.(heic|heif|jpg|jpeg|png|webp)$/i.test(f.name)){status('Yalnızca fotoğraf ekleyin.','warn');continue}
   if(f.size>12*1024*1024){status('Bir fotoğraf 12 MB sınırını aşıyor: '+f.name,'warn');continue}files.push(f)
  }renderPreviews();byId('akw-camera').value='';byId('akw-gallery').value='';
 }
 function renderPreviews(){objectUrls.forEach(u=>URL.revokeObjectURL(u));objectUrls=[];const host=byId('akw-thumbs');if(!host)return;host.innerHTML='';
  files.forEach((f,i)=>{const url=URL.createObjectURL(f);objectUrls.push(url);const item=document.createElement('div');item.className='akw-thumb';item.innerHTML=`<img alt="Sayfa ${i+1}" src="${url}"><button type="button" aria-label="Fotoğrafı kaldır">×</button><small>${i+1}. sayfa</small>`;item.querySelector('button').onclick=()=>{files.splice(i,1);renderPreviews()};host.append(item)})}
 function loadCatalog(){if(loadingPromise)return loadingPromise;loadingPromise=fetch('./aktiva-urunler.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Katalog yüklenemedi');return r.json()}).then(rows=>{catalog=Array.isArray(rows)?rows:[];return catalog}).catch(e=>{loadingPromise=null;return []});return loadingPromise}
 function norm(str){return clean(str).replace(/\b(?:GR|GRAM|KG|ML|LT|G|L)\b/g,'')}
 function matchCatalog(name,sku){if(!catalog.length)return null;
  if(sku){const exact=catalog.find(p=>String(p.code||'')===String(sku));if(exact)return {item:exact,confidence:'kod eşleşti'}}
  const n=norm(name);if(n.length<5)return null;
  const exact=catalog.find(p=>norm(p.name)===n);if(exact)return {item:exact,confidence:'ürün adı eşleşti'};
  // OCR'da bir iki harf hatası olabilir. Eşleşmeler sadece tavsiye edilir, otomatik kabul edilmez.
  const words=n.match(/[A-ZÇĞİÖŞÜ0-9]{3,}/g)||[];if(words.length<2)return null;
  const results=catalog.map(p=>{const w=norm(p.name).match(/[A-ZÇĞİÖŞÜ0-9]{3,}/g)||[];const common=words.filter(x=>w.includes(x)).length;return {item:p,score:2*common/(words.length+w.length||1)}}).filter(x=>x.score>=.78).sort((a,b)=>b.score-a.score);
  return results[0]&&results[0].score>=.9?{item:results[0].item,confidence:'benzer isim (kontrol edin)'}:null
 }
 function addRow(row){const host=byId('akw-rows');if(!host)return;
  const i=host.children.length;const el=document.createElement('section');el.className='akw-product';el.dataset.sourceUnit=row.unit||'unknown';el.dataset.rawAmount=row.rawAmount??'';
  const suggestion=matchCatalog(row.name,row.sku),exact=suggestion&&suggestion.confidence!=='benzer isim (kontrol edin)';
  el.innerHTML=`<div class="akw-row"><strong>Ürün ${i+1}</strong><button type="button" class="akw-delete" aria-label="Satırı kaldır">Sil</button></div><label>Ürün adı<input class="akw-name" value="${esc(exact?suggestion.item.name:row.name)}" maxlength="200" placeholder="Ürün adı"></label><div class="akw-triple"><label>Ürün kodu<input class="akw-sku" value="${esc(exact?suggestion.item.code:row.sku||'')}" maxlength="80" placeholder="Kod"></label><label>Koli<input class="akw-cartons" type="number" min="1" max="999999" step="1" value="${row.cartons??''}" placeholder="Kontrol et"></label><label>Palet<input class="akw-pallets" type="number" min="0" max="999999" step="1" value="${Number(row.pallets)||0}"></label></div><div class="akw-row"><small class="akw-review">${row.unit==='adet'?'İrsaliyede '+row.rawAmount+' adet okundu; koli sayısını kontrol edin.':row.unit==='unknown'?'Miktarın birimi net değil; koli sayısını girin.':row.review?'Ürün satırını ve birimi kontrol edin.':'Miktar okundu; kontrol edin.'}</small></div>${suggestion?`<p class="akw-catalog"><button type="button" class="akw-match">Katalog: ${esc(suggestion.item.name)}</button><small>${esc(suggestion.confidence)}</small></p>`:''}`;
  el.querySelector('.akw-delete').onclick=()=>{el.remove();updateCount();updatePalletSummary()};
  el.querySelector('.akw-pallets').addEventListener('input',updatePalletSummary);
  if(suggestion){el.querySelector('.akw-match').onclick=()=>{el.querySelector('.akw-name').value=suggestion.item.name;el.querySelector('.akw-sku').value=suggestion.item.code;el.querySelector('.akw-review').textContent='Katalog ürününü seçtiniz; koli miktarını yine kontrol edin.'}}
  host.append(el);updateCount();updatePalletSummary();
 }
 function updateCount(){const t=byId('akw-count');if(t)t.textContent='('+byId('akw-rows').children.length+')'}
 function updatePalletSummary(){
  const host=byId('akw-pal-check'),totalInput=byId('akw-total-pallets'),rows=byId('akw-rows');
  if(!host||!totalInput||!rows)return;
  const entered=totalInput.value.trim(),values=[...rows.querySelectorAll('.akw-pallets')].map(i=>Number(i.value||0));
  if(entered===''){host.textContent='İrsaliyede toplam palet bulunamazsa ürünlerdeki palet sayılarını elle kontrol edin.';host.dataset.type='neutral';return}
  const total=Number(entered),sum=values.reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(total)||total<0){host.textContent='Toplam palet geçerli bir sayı olmalıdır.';host.dataset.type='warn';return}
  if(sum===total){host.textContent='✓ Ürünlerin palet toplamı ('+sum+') ile irsaliye toplamı eşleşiyor.';host.dataset.type='ok'}
  else{host.textContent='İrsaliye toplamı '+total+' palet · Ürünlere dağıtılan '+sum+' palet · Kalan fark '+(total-sum)+'. Ürün paletlerini kontrol edin.';host.dataset.type='warn'}
 }
 function showParse(result){parsed=result;byId('akw-review').hidden=false;
  byId('akw-supplier').value=result.supplier||'';byId('akw-invoice').value=result.invoice||'';
  byId('akw-plate').value=result.plate||'';if(result.plateHint)byId('akw-plate').placeholder='Şüpheli OCR: '+result.plateHint+' (kontrol et)';byId('akw-total-pallets').value=result.totalPallets??'';
  byId('akw-supplier-confidence').textContent='Algılama: '+result.confidence.supplier;byId('akw-invoice-confidence').textContent='Algılama: '+result.confidence.invoice;
  byId('akw-plate-confidence').textContent='Algılama: '+result.confidence.plate;byId('akw-pallets-confidence').textContent='Algılama: '+result.confidence.pallets;
  const candidate=byId('akw-pallet-candidate');
  if(candidate){
   candidate.replaceChildren();candidate.hidden=!result.palletSuggestion||result.totalPallets!==null;
   if(!candidate.hidden){const hint=document.createElement('span');hint.textContent='İrsaliyede "'+result.palletSuggestion.source+'" için '+result.palletSuggestion.value+' adet görünüyor. Bu ürünün adedi, taşıma paleti toplamı olmayabilir. ';
    const use=document.createElement('button');use.type='button';use.textContent=result.palletSuggestion.value+' paleti toplam olarak kullan';use.className='akw-use-candidate';use.onclick=()=>{byId('akw-total-pallets').value=result.palletSuggestion.value;candidate.hidden=true;updatePalletSummary()};candidate.append(hint,use);
   }
  }
  byId('akw-rows').innerHTML='';result.rows.forEach(addRow);updatePalletSummary();byId('akw-approve').checked=false;
  byId('akw-raw').value=result.raw||'';
  const text=(result.rows.length?result.rows.length+' olası ürün bulundu. ':'Otomatik ürün satırı bulunamadı. Metni kontrol edip satır ekleyebilirsiniz. ')+result.notes.join(' ');
  status(text,result.rows.some(x=>x.review)||!result.rows.length?'warn':'ok');
 }
 function parseText(text){const parser=window.AKTIVA_WAYBILL_PARSE;if(!parser||typeof parser.parse!=='function'){status('İrsaliye ayrıştırıcısı bulunamadı. Sayfayı yenileyin.','error');return}if(!String(text||'').trim()){status('Önce bir metin yazın veya fotoğraf okuyun.','warn');return}showParse(parser.parse(text));byId('akw-review').scrollIntoView({behavior:'smooth',block:'start'})}
 async function ensureTesseract(){if(window.Tesseract)return window.Tesseract;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(Error('OCR kütüphanesi indirilemedi. İnternet bağlantısını kontrol edin.'));document.head.append(script)});return window.Tesseract}
 // Sayfanın geniş boş kalan kısmı OCR'ı zayıflatır. Yazı satırlarının yoğun
 // olduğu alanı otomatik tespit edip büyüterek okutuyoruz. Başka yerleşimlerde
 // tam fotoğrafı yedek olarak koruyoruz.
 function detectTextRegion(canvas){
  const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d',{willReadFrequently:true});
  const src=ctx.getImageData(0,0,w,h).data,counts=[];
  const stepx=Math.max(3,Math.round(w/390)),stepy=Math.max(3,Math.round(h/720));
  const left=Math.round(w*.02),right=Math.round(w*.98),length=Math.ceil((right-left)/stepx);
  for(let y=Math.round(h*.02);y<Math.round(h*.98);y+=stepy){let dark=0;
   for(let x=left;x<right;x+=stepx){const i=(y*w+x)*4;if(.299*src[i]+.587*src[i+1]+.114*src[i+2]<145)dark++}
   const ratio=dark/length;
   // Dökümandaki yazıları ara; masa/zemin gibi geniş koyu alanları dışla.
   if(ratio>.012&&ratio<.43)counts.push({y,ratio});
  }
  if(counts.length<14)return null;
  const clusters=[];let group=[];
  for(const entry of counts){if(group.length&&entry.y-group[group.length-1].y>Math.max(60,Math.round(h*.055))){clusters.push(group);group=[]}group.push(entry)}
  if(group.length)clusters.push(group);
  clusters.sort((a,b)=>b.length-a.length);
  const best=clusters[0];if(!best||best.length<14)return null;
  const first=best[0].y,last=best[best.length-1].y;
  const pad=Math.max(35,Math.round(h*.04)),top=Math.max(0,first-pad),bottom=Math.min(h,last+pad);
  const regionH=bottom-top;
  // Büyük bölgeyse kırpmaya gerek yok. Çok küçük bölgeyse de yanlış seçim olabilir.
  if(regionH>h*.84||regionH<h*.12)return null;
  return {top,bottom};
 }
 // Fotoğrafta tablonun yatay çizgileri varsa o bölgeyi ayrı okumak,
 // "Mal / Miktar / Miktar Birimi" satırlarını kaçırmayı azaltır.
 // Yerleşimi sabitlemiyoruz: satır çizgilerini sayfanın tamamında arıyoruz.
 function detectTableRegion(canvas){
  const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d',{willReadFrequently:true});
  const pix=ctx.getImageData(0,0,w,h).data,firstX=Math.round(w*.05),lastX=Math.round(w*.95);
  const sx=Math.max(3,Math.round(w/540)),sy=Math.max(2,Math.round(h/1000));
  let hits=[];
  for(let y=Math.round(h*.10);y<Math.round(h*.93);y+=sy){let dark=0,all=0;
   for(let x=firstX;x<lastX;x+=sx){const i=(y*w+x)*4;const lum=.299*pix[i]+.587*pix[i+1]+.114*pix[i+2];if(lum<175)dark++;all++}
   if(dark/Math.max(1,all)>.425)hits.push({y,ratio:dark/all});
  }
  if(hits.length<3)return null;
  const runs=[];for(const it of hits){const last=runs[runs.length-1];if(last&&it.y-last.end<sy*4){last.end=it.y;last.weight=Math.max(last.weight,it.ratio)}else runs.push({start:it.y,end:it.y,weight:it.ratio})}
  let best=null;const maxGap=Math.max(35,Math.round(h*.077));
  for(let a=0;a<runs.length;a++){
   for(let b=a+2;b<runs.length;b++){
    if(runs[b].start-runs[a].start>h*.35)break;
    let good=true;for(let k=a+1;k<=b;k++)if(runs[k].start-runs[k-1].end>maxGap){good=false;break}
    if(!good)break;
    const extent=runs[b].end-runs[a].start,span=b-a+1;if(extent<h*.023)continue;
    const score=span*5 + runs.slice(a,b+1).reduce((v,x)=>v+x.weight,0) + (runs[a].start>h*.25?2:0);
    if(!best||score>best.score)best={score,top:runs[a].start,bottom:runs[b].end};
   }
  }
  if(!best)return null;
  const pad=Math.max(26,Math.round(h*.023));return {top:Math.max(0,best.top-pad),bottom:Math.min(h,best.bottom+pad)};
 }
 function canvasBlob(canvas){return new Promise((res,rej)=>canvas.toBlob(blob=>blob?res(blob):rej(Error('Görüntü dönüştürülemedi')),'image/png'))}
 async function loadPhoto(file,angle){
  const url=URL.createObjectURL(file);let img;
  try{img=await new Promise((resolve,reject)=>{const photo=new Image();photo.onload=()=>resolve(photo);photo.onerror=()=>reject(Error('Fotoğraf açılamadı. JPG veya PNG deneyin.'));photo.src=url})}
  finally{URL.revokeObjectURL(url)}
  let max=2700,scale=Math.min(2.3,max/Math.max(img.naturalWidth,img.naturalHeight));
  const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
  if(w*h>11000000)throw Error('Fotoğraf çok büyük. Daha küçük bir görüntü seçin.');
  const rotated=angle===90||angle===270,canvas=document.createElement('canvas');canvas.width=rotated?h:w;canvas.height=rotated?w:h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Görüntü hazırlanamadı');
  ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/180);
  ctx.fillStyle='#fff';ctx.fillRect(-w/2,-h/2,w,h);ctx.drawImage(img,-w/2,-h/2,w,h);
  // Önce renklide yazı bölgesini bul, sonra OCR için gri/kontrast düzenle.
  const bounds=detectTextRegion(canvas),tableBounds=detectTableRegion(canvas),fullCanvas=canvas;
  function enhance(source,top=0,bottom=source.height,targetWidth=0){
   const height=bottom-top,ratio=targetWidth?Math.min(2.7,targetWidth/source.width):1;
   const target=document.createElement('canvas');target.width=Math.round(source.width*ratio);target.height=Math.round(height*ratio);
   if(target.width*target.height>9500000)throw Error('Görüntü hazırlama sınırı aşıldı');
   const out=target.getContext('2d',{willReadFrequently:true});out.imageSmoothingEnabled=true;out.imageSmoothingQuality='high';
   out.drawImage(source,0,top,source.width,height,0,0,target.width,target.height);
   const img=out.getImageData(0,0,target.width,target.height),px=img.data;
   for(let i=0;i<px.length;i+=4){const g=.299*px[i]+.587*px[i+1]+.114*px[i+2];const v=Math.max(0,Math.min(255,(g-128)*1.38+148));px[i]=px[i+1]=px[i+2]=v}
   out.putImageData(img,0,0);return target;
  }
  const focused=bounds?enhance(fullCanvas,bounds.top,bounds.bottom,Math.min(2450,Math.round(fullCanvas.width*2.05))):enhance(fullCanvas);
  const primary=await canvasBlob(focused);
  const tableCanvas=tableBounds?enhance(fullCanvas,tableBounds.top,tableBounds.bottom,Math.min(4000,Math.round(fullCanvas.width*1.7))):null;
  const table=tableCanvas?await canvasBlob(tableCanvas):null;
  // Yedek tam görüntü yalnızca yeterli bilgi bulunamazsa okutulur.
  return {primary,table,full:bounds?await canvasBlob(enhance(fullCanvas)):null,focused:!!bounds,width:focused.width,height:focused.height};
 }
 async function readImages(){if(busy)return;if(!files.length){status('Önce irsaliye fotoğrafı ekleyin.','warn');return}
  busy=true;byId('akw-read').disabled=true;byId('akw-close').disabled=true;status('Türkçe ve İngilizce belge okuma hazırlanıyor. İlk kullanımda internet gerekir.');
  try{
   const tess=await ensureTesseract(),all=[];
   worker=await tess.createWorker('tur+eng',1,{logger:m=>{if(m.status==='recognizing text')status('Belge okunuyor: %'+Math.round((m.progress||0)*100))}});
   await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:tess.PSM?.AUTO||'3',user_defined_dpi:'300'});
   for(let i=0;i<files.length;i++){
    status('Fotoğraf '+(i+1)+'/'+files.length+' için metin alanı aranıyor...');
    const picture=await loadPhoto(files[i],rotation);
    status('Fotoğraf '+(i+1)+'/'+files.length+' büyütülmüş metin alanı okunuyor...');
    let words=(await worker.recognize(picture.primary)).data.text||'';
    // Tablo başlıkları veya miktarlar eksik olsa bile tablo bölgesi ayrıca
    // okunur: ilk sonuçta yalnızca bir ürün gelmesi yeterli sayılmaz.
    if(picture.table){
     status('Fotoğraf '+(i+1)+' için ürün tablosu yakından okunuyor...');
     await worker.setParameters({tessedit_pageseg_mode:tess.PSM?.SINGLE_BLOCK||'6'});
     const productText=(await worker.recognize(picture.table)).data.text||'';
     await worker.setParameters({tessedit_pageseg_mode:tess.PSM?.AUTO||'3'});
     if(productText.trim())words+='\n'+productText;
    }
    let first=window.AKTIVA_WAYBILL_PARSE?.parse(words);
    // Düzene bağlı kalmadan 2x2 örtüşen bölgeleri tek tek tarar. Özellikle
    // sağ sütundaki belge no, tablo miktarı ve alt kutudaki plaka için.
    if(!first?.supplier||!first?.invoice||!first?.plate||!first?.rows?.length||!picture.table){
     await worker.setParameters({tessedit_pageseg_mode:tess.PSM?.SINGLE_BLOCK||'6'});
     const fw=picture.width,fh=picture.height;
     const tiles=[
      {left:0,top:0,width:Math.round(fw*.66),height:Math.round(fh*.61)},
      {left:Math.round(fw*.34),top:0,width:fw-Math.round(fw*.34),height:Math.round(fh*.61)},
      {left:0,top:Math.round(fh*.38),width:Math.round(fw*.66),height:fh-Math.round(fh*.38)},
      {left:Math.round(fw*.34),top:Math.round(fh*.38),width:fw-Math.round(fw*.34),height:fh-Math.round(fh*.38)}
     ];
     for(let k=0;k<tiles.length;k++){
      status('Fotoğraf '+(i+1)+' için detay taraması '+(k+1)+'/4');
      const extra=(await worker.recognize(picture.primary,{rectangle:tiles[k]})).data.text||'';
      if(extra.trim())words+='\n'+extra;
      const chk=window.AKTIVA_WAYBILL_PARSE?.parse(words);
      if(chk?.supplier&&chk?.invoice&&chk?.plate&&chk?.rows?.length&&(picture.table||k>=2))break;
     }
     await worker.setParameters({tessedit_pageseg_mode:tess.PSM?.AUTO||'3'});
    }
    // Kontrastlı odakta hâlâ alan eksikse tam belgeden seyrek yazıları oku.
    first=window.AKTIVA_WAYBILL_PARSE?.parse(words);
    if(picture.full&&(!first?.supplier||!first?.plate||!first?.rows?.length||!first?.invoice)){
     status('Okunamayan alanlar için belgenin tamamı kontrol ediliyor...');
     await worker.setParameters({tessedit_pageseg_mode:tess.PSM?.SPARSE_TEXT||'11'});
     const extra=(await worker.recognize(picture.full)).data.text||'';
     await worker.setParameters({tessedit_pageseg_mode:tess.PSM?.AUTO||'3'});
     words+='\n'+extra;
    }
    all.push(words);
   }
   parseText(all.join('\n'));
  }catch(e){status('Belge okunamadı: '+e.message+'. Fotoğrafı daha yakından çekebilir veya metin alanından düzeltebilirsiniz.','error')}
  finally{if(worker){try{await worker.terminate()}catch(_){ }worker=null}busy=false;byId('akw-read')&&(byId('akw-read').disabled=false);byId('akw-close')&&(byId('akw-close').disabled=false)}
 }
 function transfer(){if(busy)return;if(!byId('akw-approve').checked){status('Önce kontrol onay kutusunu işaretleyin.','warn');return}
  const rows=[...byId('akw-rows').children].map(el=>({name:el.querySelector('.akw-name').value.trim(),sku:el.querySelector('.akw-sku').value.trim(),cartons:Number(el.querySelector('.akw-cartons').value),pallets:Number(el.querySelector('.akw-pallets').value),emptyCartons:el.querySelector('.akw-cartons').value.trim()==='',sourceUnit:el.dataset.sourceUnit,sourceAmount:el.dataset.rawAmount}));
  if(!rows.length){status('Önce en az bir ürün satırı ekleyin.','warn');return}
  if(rows.some(r=>!r.name||r.name.length>200||r.sku.length>80||r.emptyCartons||!Number.isSafeInteger(r.cartons)||r.cartons<=0||r.cartons>999999||!Number.isSafeInteger(r.pallets)||r.pallets<0||r.pallets>999999)){status('Ürün adı, koli ve palet alanlarını kontrol edin. Eksik koli alanı bırakılamaz.','error');return}
  const pieces=rows.filter(r=>r.sourceUnit==='adet');
  if(pieces.length&&!confirm('Dikkat: '+pieces.length+' ürün irsaliyede ADET cinsinden yazıyor. Girilen değerlerin KOLİ karşılıklarını gerçekten kontrol ettiniz mi? Adet miktarını doğrudan koli kabul etmeyin.'))return;
  const company=byId('akw-supplier').value.trim(),invoice=byId('akw-invoice').value.trim(),plate=byId('akw-plate').value.trim().toLocaleUpperCase('tr-TR'),totalRaw=byId('akw-total-pallets').value.trim();
  if(!company){status('Gönderen firma boş bırakılamaz.','error');return}
  if(plate&&(!/^(?:0[1-9]|[1-7]\d|8[01])\s*[A-Z]{1,3}\s*\d{2,5}$/.test(plate))){status('Plakayı kontrol edin. Örneğin 48 ABC 123 biçiminde yazın.','warn');return}
  if(totalRaw!==''){
   const total=Number(totalRaw),allocated=rows.reduce((acc,r)=>acc+r.pallets,0);
   if(!Number.isSafeInteger(total)||total<0||total>999999){status('Toplam palet sayısı geçersiz.','error');return}
   if(allocated!==total){status('İrsaliyede toplam '+total+' palet yazıyor; ürünlere dağıtılan '+allocated+' palet. Aktarmadan önce ürün paletlerini eşleştirin.','warn');updatePalletSummary();return}
  }
  if(rows.some(r=>r.pallets===0)&&!confirm('Bazı ürünlerin palet sayısı 0. İrsaliyede palet bilgisi bulunmamış olabilir. Bu şekilde aktarılsın mı?'))return;
  if(!confirm(rows.length+' ürün Yeni Sevkiyat formuna eklenecek. Var olan ürünler ve bilgiler korunacak; aynı kod veya isimdeki tekrarlar atlanacak. Devam edilsin mi?'))return;
  try{
   const field=byId('ak-firm'),inv=byId('ak-invoice'),plateField=byId('ak-plate');const existingName=field?.value.trim()||'',existingInvoice=inv?.value.trim()||'',existingPlate=plateField?.value.trim()||'';
   if(existingName&&clean(existingName)!==clean(company)&&!confirm('Formda zaten bir firma adı var: '+existingName+'. Fotoğraftaki firma ile değiştirilsin mi?')){status('İşlem iptal edildi. Dilerseniz fotoğraftan okunan firma adını düzenleyin.','warn');return}
   if(existingInvoice&&invoice&&clean(existingInvoice)!==clean(invoice)&&!confirm('Formdaki irsaliye numarası değiştirilsin mi?')){status('İşlem iptal edildi.','warn');return}
   if(existingPlate&&plate&&clean(existingPlate)!==clean(plate)&&!confirm('Formdaki plaka '+existingPlate+' yerine fotoğraftan okunan '+plate+' yazılsın mı?')){status('İşlem iptal edildi.','warn');return}
   const fn=window.AKTIVA_applyWaybillResult;if(typeof fn!=='function')throw Error('Yeni Sevkiyat formu aktif değil');
   const result=fn({supplier:company,invoice:invoice||existingInvoice,plate:plate||existingPlate,products:rows});close();
   const form=byId('ak-form');if(form)form.scrollIntoView({behavior:'smooth',block:'start'});
   if(result.skipped)console.info('AKTİVA OCR: yinelenen ürünler atlandı',result.skipped);
  }catch(e){status('Aktarım yapılamadı: '+e.message,'error')}
 }
})();
