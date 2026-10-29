/* AKTİVA - Yeni Sevkiyat Kaydı / Akıllı İrsaliye Okuma
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
  btn.innerHTML='<span class="akw-entry-icon" aria-hidden="true">▤</span><span><strong>İrsaliye Fotoğrafından Toplu Ürün Ekle</strong><small>Firma, irsaliye no ve ürünleri tara · Önce kontrol et</small></span><span aria-hidden="true">›</span>';
  products.before(btn);btn.onclick=open;
 }
 let observer;function observe(){attachButton();observer=new MutationObserver(attachButton);const root=byId('aktivaCountUI');if(root)observer.observe(root,{subtree:true,childList:true});else{const inter=new MutationObserver(()=>{if(byId('aktivaCountUI')){inter.disconnect();observe()}});inter.observe(document.body,{childList:true,subtree:true})}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
 function status(s,type=''){const t=byId('akw-status');if(t){t.textContent=s;t.dataset.type=type}}
 function close(){if(busy){status('Fotoğraf işlenirken pencereyi kapatmak için işlemin bitmesini bekleyin.','warn');return;}const dlg=byId('akw-overlay');if(dlg)dlg.remove();objectUrls.forEach(u=>URL.revokeObjectURL(u));objectUrls=[];files=[];parsed=null;rotation=0;document.body.classList.remove('akw-open')}
 function open(){if(byId('akw-overlay'))return;
  const dlg=document.createElement('div');dlg.id='akw-overlay';dlg.className='akw-overlay';dlg.innerHTML=`<section class="akw-dialog" role="dialog" aria-modal="true" aria-labelledby="akw-title"><header class="akw-head"><div><small>MAL KABUL • BELGE OKUMA</small><h2 id="akw-title">Akıllı İrsaliye Tarama</h2></div><button type="button" id="akw-close" aria-label="Kapat">×</button></header><div class="akw-body"><p class="akw-muted">Belgenin tamamını çekin; bilgiler farklı köşelerde olsa da aranır. Birden fazla sayfayı da ekleyebilirsiniz.</p><div class="akw-actions"><label class="akw-upload"><span>📷 Fotoğraf Çek</span><input type="file" accept="image/*" capture="environment" id="akw-camera"></label><label class="akw-upload alt"><span>▧ Galeriden Seç</span><input type="file" accept="image/*" multiple id="akw-gallery"></label></div><p class="akw-small">En fazla 3 fotoğraf, her biri en fazla 12 MB. Destek: JPG, PNG, WebP; cihaz açabiliyorsa HEIC.</p><div id="akw-thumbs" class="akw-thumbs"></div><div class="akw-actions"><label>Fotoğraf yönü<select id="akw-rotate"><option value="0">Normal</option><option value="90">90° sağa döndür</option><option value="270">90° sola döndür</option><option value="180">Ters çevir</option></select></label><button id="akw-read" type="button">Fotoğrafları Oku</button></div><p id="akw-status" role="status" aria-live="polite"></p><div id="akw-review" hidden><div class="akw-section"><h3>Algılanan belge bilgileri</h3><div class="akw-grid"><label>Gönderen firma <small id="akw-supplier-confidence"></small><input id="akw-supplier" maxlength="150" placeholder="Firma bulunamadı, yazın"></label><label>İrsaliye numarası <small id="akw-invoice-confidence"></small><input id="akw-invoice" maxlength="100" placeholder="İrsaliye no bulunamadı, yazın"></label></div><p class="akw-small">Alıcı firma ile gönderen firmayı karıştırmamak için kontrol edin.</p></div><div class="akw-section"><div class="akw-row"><h3>Olası ürünler <span id="akw-count"></span></h3><button type="button" id="akw-add">+ Satır Ekle</button></div><div id="akw-rows" class="akw-rows"></div><p class="akw-small">İrsaliyede “adet” yazıyorsa bunu koliye çevirmiyoruz. Koli ve palet alanlarını kontrol edin. Palet bilgisi bulunamazsa 0 önerilir; gerçek miktarı gerekirse düzeltin.</p></div><details class="akw-raw"><summary>Okunan metni gör / düzelt ve yeniden çözümle</summary><textarea id="akw-raw" rows="8" placeholder="İrsaliye metnini buraya yapıştırabilirsiniz"></textarea><button type="button" id="akw-reparse">Metinden Tekrar Algıla</button></details><label class="akw-approve"><input type="checkbox" id="akw-approve"><span>Firma, irsaliye numarası, ürün adları, koli ve palet sayılarını kontrol ettim.</span></label><button id="akw-transfer" type="button" class="akw-transfer">Kontrol Ettim · Ürünleri Sevkiyata Ekle</button><p class="akw-small">Bu işlem yalnızca açık sevkiyat formunu doldurur. Veritabanına kayıt için ayrıca “Sevkiyatı Kaydet” seçilir.</p></div><details class="akw-raw"><summary>Fotoğraf okunmazsa metni elle yapıştır</summary><textarea id="akw-manual" rows="5" placeholder="Metni buraya yapıştırın. Örn. İrsaliye No: ABC2026000001234..."></textarea><button id="akw-fromtext" type="button">Metni Analiz Et</button></details></div></section>`;
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
  const i=host.children.length;const el=document.createElement('section');el.className='akw-product';
  const suggestion=matchCatalog(row.name,row.sku),exact=suggestion&&suggestion.confidence!=='benzer isim (kontrol edin)';
  el.innerHTML=`<div class="akw-row"><strong>Ürün ${i+1}</strong><button type="button" class="akw-delete" aria-label="Satırı kaldır">Sil</button></div><label>Ürün adı<input class="akw-name" value="${esc(exact?suggestion.item.name:row.name)}" maxlength="200" placeholder="Ürün adı"></label><div class="akw-triple"><label>Ürün kodu<input class="akw-sku" value="${esc(exact?suggestion.item.code:row.sku||'')}" maxlength="80" placeholder="Kod"></label><label>Koli<input class="akw-cartons" type="number" min="1" max="999999" step="1" value="${row.cartons??''}" placeholder="Kontrol et"></label><label>Palet<input class="akw-pallets" type="number" min="0" max="999999" step="1" value="${Number(row.pallets)||0}"></label></div><div class="akw-row"><small class="akw-review">${row.unit==='adet'?'İrsaliyede '+row.rawAmount+' adet okundu; koli sayısını kontrol edin.':row.unit==='unknown'?'Miktarın birimi net değil; koli sayısını girin.':row.review?'Ürün satırını ve birimi kontrol edin.':'Miktar okundu; kontrol edin.'}</small></div>${suggestion?`<p class="akw-catalog"><button type="button" class="akw-match">Katalog: ${esc(suggestion.item.name)}</button><small>${esc(suggestion.confidence)}</small></p>`:''}`;
  el.querySelector('.akw-delete').onclick=()=>{el.remove();updateCount()};
  if(suggestion){el.querySelector('.akw-match').onclick=()=>{el.querySelector('.akw-name').value=suggestion.item.name;el.querySelector('.akw-sku').value=suggestion.item.code;el.querySelector('.akw-review').textContent='Katalog ürününü seçtiniz; koli miktarını yine kontrol edin.'}}
  host.append(el);updateCount();
 }
 function updateCount(){const t=byId('akw-count');if(t)t.textContent='('+byId('akw-rows').children.length+')'}
 function showParse(result){parsed=result;byId('akw-review').hidden=false;
  byId('akw-supplier').value=result.supplier||'';byId('akw-invoice').value=result.invoice||'';
  byId('akw-supplier-confidence').textContent='Algılama: '+result.confidence.supplier;byId('akw-invoice-confidence').textContent='Algılama: '+result.confidence.invoice;
  byId('akw-rows').innerHTML='';result.rows.forEach(addRow);byId('akw-approve').checked=false;
  byId('akw-raw').value=result.raw||'';
  const text=result.rows.length?result.rows.length+' olası ürün bulundu. '+result.notes.join(' '):'Otomatik ürün satırı bulunamadı. Metni kontrol edip satır ekleyebilirsiniz.';
  status(text,result.rows.some(x=>x.review)||!result.rows.length?'warn':'ok');
 }
 function parseText(text){const parser=window.AKTIVA_WAYBILL_PARSE;if(!parser||typeof parser.parse!=='function'){status('İrsaliye ayrıştırıcısı bulunamadı. Sayfayı yenileyin.','error');return}if(!String(text||'').trim()){status('Önce bir metin yazın veya fotoğraf okuyun.','warn');return}showParse(parser.parse(text));byId('akw-review').scrollIntoView({behavior:'smooth',block:'start'})}
 async function ensureTesseract(){if(window.Tesseract)return window.Tesseract;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(Error('OCR kütüphanesi indirilemedi. İnternet bağlantısını kontrol edin.'));document.head.append(script)});return window.Tesseract}
 function loadPhoto(file,angle){return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{
   URL.revokeObjectURL(url);
   const max=2400,scale=Math.min(3,max/Math.max(img.naturalWidth,img.naturalHeight));const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
   if(w*h>9500000){reject(Error('Görüntü boyutu çok yüksek. Daha düşük çözünürlükte fotoğraf seçin.'));return}
   const rotated=angle===90||angle===270,canvas=document.createElement('canvas');canvas.width=rotated?h:w;canvas.height=rotated?w:h;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx){reject(Error('Fotoğraf işlenemedi'));return}
   ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/180);ctx.fillStyle='#fff';ctx.fillRect(-w/2,-h/2,w,h);ctx.drawImage(img,-w/2,-h/2,w,h);
   // Orta kontrast düzeltme: OCR'ın harflerle arka planı ayırmasını kolaylaştırır.
   const data=ctx.getImageData(0,0,canvas.width,canvas.height),pix=data.data;
   for(let i=0;i<pix.length;i+=4){const lum=.299*pix[i]+.587*pix[i+1]+.114*pix[i+2];const v=Math.max(0,Math.min(255,(lum-128)*1.28+140));pix[i]=pix[i+1]=pix[i+2]=v}
   ctx.putImageData(data,0,0);canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Görüntü dönüştürülemedi')),'image/jpeg',.91)
  };img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Fotoğraf açılamadı. JPG veya PNG deneyin.'))};img.src=url
 })}
 async function readImages(){if(busy)return;if(!files.length){status('Önce irsaliye fotoğrafı ekleyin.','warn');return}
  busy=true;byId('akw-read').disabled=true;byId('akw-close').disabled=true;status('Türkçe + İngilizce OCR hazırlanıyor. İlk kullanımda internet gereklidir.');
  try{
   const tess=await ensureTesseract(),all=[];
   worker=await tess.createWorker('tur+eng',1,{logger:m=>{if(m.status==='recognizing text')status('Metin okunuyor: %'+Math.round((m.progress||0)*100))}});
   await worker.setParameters({preserve_interword_spaces:'1'});
   for(let i=0;i<files.length;i++){
    status('Fotoğraf '+(i+1)+'/'+files.length+' hazırlanıyor...');const blob=await loadPhoto(files[i],rotation);
    status('Fotoğraf '+(i+1)+'/'+files.length+' okunuyor...');const data=(await worker.recognize(blob)).data;
    all.push(data.text||'');
   }
   parseText(all.join('\n'));
  }catch(e){status('Okuma tamamlanamadı: '+e.message+' Metni elle yapıştırabilir veya tekrar deneyebilirsiniz.','error')}
  finally{if(worker){try{await worker.terminate()}catch(_){ }worker=null}busy=false;byId('akw-read')&&(byId('akw-read').disabled=false);byId('akw-close')&&(byId('akw-close').disabled=false)}
 }
 function transfer(){if(busy)return;if(!byId('akw-approve').checked){status('Önce kontrol onay kutusunu işaretleyin.','warn');return}
  const rows=[...byId('akw-rows').children].map(el=>({name:el.querySelector('.akw-name').value.trim(),sku:el.querySelector('.akw-sku').value.trim(),cartons:Number(el.querySelector('.akw-cartons').value),pallets:Number(el.querySelector('.akw-pallets').value),emptyCartons:el.querySelector('.akw-cartons').value.trim()===''}));
  if(!rows.length){status('Önce en az bir ürün satırı ekleyin.','warn');return}
  if(rows.some(r=>!r.name||r.name.length>200||r.sku.length>80||r.emptyCartons||!Number.isSafeInteger(r.cartons)||r.cartons<=0||r.cartons>999999||!Number.isSafeInteger(r.pallets)||r.pallets<0||r.pallets>999999)){status('Ürün adı, koli ve palet alanlarını kontrol edin. Eksik koli alanı bırakılamaz.','error');return}
  const company=byId('akw-supplier').value.trim(),invoice=byId('akw-invoice').value.trim();if(!company){status('Gönderen firma boş bırakılamaz.','error');return}
  if(rows.some(r=>r.pallets===0)&&!confirm('Bazı ürünlerin palet sayısı 0. İrsaliyede palet bilgisi bulunmamış olabilir. Bu şekilde aktarılsın mı?'))return;
  if(!confirm(rows.length+' ürün Yeni Sevkiyat formuna eklenecek. Var olan ürünler ve bilgiler korunacak; aynı kod veya isimdeki tekrarlar atlanacak. Devam edilsin mi?'))return;
  try{
   const field=byId('ak-firm'),inv=byId('ak-invoice');const existingName=field?.value.trim()||'',existingInvoice=inv?.value.trim()||'';
   if(existingName&&clean(existingName)!==clean(company)&&!confirm('Formda zaten bir firma adı var: '+existingName+'. Fotoğraftaki firma ile değiştirilsin mi?')){status('İşlem iptal edildi. Dilerseniz fotoğraftan okunan firma adını düzenleyin.','warn');return}
   if(existingInvoice&&invoice&&clean(existingInvoice)!==clean(invoice)&&!confirm('Formdaki irsaliye numarası değiştirilsin mi?')){status('İşlem iptal edildi.','warn');return}
   const fn=window.AKTIVA_applyWaybillResult;if(typeof fn!=='function')throw Error('Yeni Sevkiyat formu aktif değil');
   const result=fn({supplier:company,invoice:invoice||existingInvoice,products:rows});close();
   const form=byId('ak-form');if(form)form.scrollIntoView({behavior:'smooth',block:'start'});
   if(result.skipped)console.info('AKTİVA OCR: yinelenen ürünler atlandı',result.skipped);
  }catch(e){status('Aktarım yapılamadı: '+e.message,'error')}
 }
})();
