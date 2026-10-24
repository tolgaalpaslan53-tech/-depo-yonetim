/* AKTİVA Sevkiyat Ön Kayıt - bağımsız ek modül; forklift/push kodu değiştirilmez. */
(()=>{'use strict';
 const $=s=>document.querySelector(s), E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let lastRole='',timer=0,loaded=false,editId=null,source='all',lastHost=null,productDraft=[],counting=null,countIndex=0,countBusy=false,activeProduct=0,catalogProducts=[]; 
 const allowed=()=>typeof profile!=='undefined' && ['pre_receiving','count','admin'].includes(profile?.role);
 const active=()=>typeof session!=='undefined'&&!!session?.access_token&&allowed();
 const base=()=>typeof cfg!=='undefined'?cfg:null;
 async function api(path,opt={}){
   if(!active()||!base()?.url||!base()?.key)throw Error('Yetkili oturum bulunamadı.');
   const h={'apikey':cfg.key,'Authorization':'Bearer '+session.access_token,...(opt.headers||{})};
   if(opt.json!==undefined)h['Content-Type']='application/json';
   const r=await fetch(cfg.url+path,{method:opt.method||'GET',headers:h,body:opt.json===undefined?opt.body:JSON.stringify(opt.json)});
   const t=await r.text();let v;try{v=JSON.parse(t)}catch{v=t}
   if(!r.ok)throw Error(v?.message||v?.error||('İstek başarısız: '+r.status));return v;
 }
 const stamp=t=>t?new Date(t).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'—';
 const elapsedText=(start,end)=>{
   const a=Date.parse(start||''),b=end?Date.parse(end):Date.now();
   if(!Number.isFinite(a)||!Number.isFinite(b))return '—';
   const total=Math.max(0,Math.floor((b-a)/60000));
   return (Math.floor(total/1440)?Math.floor(total/1440)+' gün ':'')+Math.floor(total%1440/60)+' sa '+(total%60)+' dk';
 };
 const normalized=v=>String(v||'').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g,' ');
 const similarRecord=(records,row,except)=>records.find(r=>{
   if(r.id===except||r.status==='cancelled')return false;
   if(!normalized(row.plate)||normalized(r.plate)!==normalized(row.plate))return false;
   const invoice=normalized(row.waybill_number),oldInvoice=normalized(r.waybill_number);
   if(invoice && oldInvoice)return invoice===oldInvoice && normalized(r.company)===normalized(row.company);
   return normalized(r.company)===normalized(row.company) && (!invoice||!oldInvoice);
 });

 const table='ak_sevkiyat_on_kayit';
 const recordNo=r=>'DK-'+String((r.created_at||'').slice(0,4)||new Date().getFullYear())+'-'+String(r.id||'').replace(/-/g,'').slice(0,10).toUpperCase();
 const localInput=t=>{if(!t)return '';const d=new Date(t);if(!Number.isFinite(d.getTime()))return '';return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(' ','T')};
 const parseLocal=v=>v?new Date(v).toISOString():null;
 const recordedArrival=r=>r.arrival_at||r.created_at;
 // Türkiye sabit UTC+03:00: manuel girilen saat cihazın saat diliminden etkilenmez.
 const manualTime=raw=>{if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(raw||''))return null;const d=new Date(raw+':00+03:00');return Number.isFinite(d.getTime())&&localInput(d.toISOString())===raw?d.toISOString():null};
 const requestTime=(caption,defaultTime)=>{const entered=prompt(caption+'\nTürkiye saati (YYYY-AA-GG SS:DD):',localInput(defaultTime||new Date().toISOString()).replace('T',' '));if(entered===null)return null;const timestamp=manualTime(entered.trim().replace(' ','T'));if(!timestamp){alert('Geçerli tarih ve saat girin. Örnek: 2026-10-24 15:30');return null}return timestamp};
 const canEditRecord=r=>r.created_by===session?.user?.id&&document.body.dataset.role==='pre_receiving';

 const fmtMinutes=n=>Number.isFinite(n)?Math.round(n)+' dk':'—';
 const duration=(a,b)=>a&&b?Math.max(0,(Date.parse(b)-Date.parse(a))/60000):null;
 const statusText=r=>r.status==='cancelled'?'İptal edildi':r.departed_at?'Çıkış yaptı':r.status==='completed'?'Tamamlandı':r.status==='counting'?'Sayım devam ediyor':r.status==='at_dock'?'Perona Gönderildi':'Bekliyor';

 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function markup(){return `<section id="ak-pre-receiving"><div class="akpr-head"><div><h1>📋 AKTİVA · Danışma</h1><small>Danışma Personeli</small></div><button type="button" class="akpr-btn" id="akpr-logout">Çıkış</button></div>
 <div class="akpr-grid"><div class="akpr-card"><div class="akpr-muted">Bugünkü Ön Kayıt</div><div class="akpr-stat" id="akpr-total">—</div></div><div class="akpr-card"><div class="akpr-muted">Toplam Bekleyen Ön Kayıt</div><div class="akpr-stat" id="akpr-pending">—</div></div></div>
 <nav class="akpr-home-nav" id="akpr-home-nav" aria-label="Sevkiyat işlemleri"><button type="button" id="akpr-open-new" class="akpr-nav-card"><span class="akpr-nav-icon" aria-hidden="true">＋</span><strong>Yeni Araç Kaydı</strong><small>Gelen aracın ve irsaliyenin ön kaydını oluştur</small><span class="akpr-nav-arrow" aria-hidden="true">›</span></button><button type="button" id="akpr-open-list" class="akpr-nav-card"><span class="akpr-nav-icon" aria-hidden="true">▤</span><strong>Araç Kayıtları</strong><small>Oluşturduğun kayıtları gör, düzenle veya iptal et</small><span class="akpr-nav-arrow" aria-hidden="true">›</span></button></nav><button type="button" id="akpr-open-report" class="akpr-btn light alt akpr-report-shortcut">📊 Excel Raporları</button>
 <div class="akpr-card akpr-detail-view" id="akpr-report-view" hidden><div class="akpr-detail-head"><button type="button" class="akpr-btn light alt akpr-back" data-akpr-back>← Ana Sayfa</button></div><h2>Danışma Excel Raporları</h2><p class="akpr-muted">Tarih aralığındaki bekleyen, perondaki, tamamlanan, çıkış yapan ve iptal edilen kayıtları indir.</p><div class="akpr-grid"><label>Başlangıç tarihi<input id="akpr-excel-start" type="date"></label><label>Bitiş tarihi<input id="akpr-excel-end" type="date"></label></div><label>Kayıt durumu<select id="akpr-excel-status"><option value="all">Tüm araçlar</option><option value="waiting">Bekleyenler</option><option value="completed">Tamamlananlar</option><option value="cancelled">İptal edilenler</option></select></label><button type="button" class="akpr-btn" id="akpr-export">Excel (.xlsx) İndir</button><p class="akpr-muted" id="akpr-export-msg" role="status"></p></div>
 <div class="akpr-card akpr-detail-view" id="akpr-new-view" hidden><div class="akpr-detail-head"><button type="button" class="akpr-btn light akpr-back" data-akpr-back>← Ana Sayfa</button></div><h2 id="akpr-form-title" style="margin:0 0 8px;font-size:20px">Yeni Araç Kaydı</h2><p class="akpr-muted">Tüm bilgiler isteğe bağlıdır. Kayıt saati otomatik alınır.</p><form id="akpr-form"><div class="akpr-grid"><label class="akpr-label">Araç plakası (isteğe bağlı)<input name="plate" maxlength="24" autocomplete="off" placeholder="48 ABC 123"></label><label class="akpr-label">Gönderen firma (isteğe bağlı)<input name="company" maxlength="120" placeholder="Firma adı"></label><label class="akpr-label">Şoför adı<input name="driver" maxlength="100" placeholder="Ad soyad"></label><label class="akpr-label">Şoför telefonu<input name="driver_phone" type="tel" inputmode="tel" maxlength="20" placeholder="05XX XXX XX XX"></label><label class="akpr-label">İrsaliye numarası<input name="waybill" maxlength="100" placeholder="İrsaliye no"></label></div><label class="akpr-label">Gerçek araç geliş tarihi ve saati (isteğe bağlı)<input name="arrival_at" type="datetime-local"></label><label class="akpr-label">İrsaliye fotoğrafı (en fazla 5 MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment"></label><label class="akpr-label">Not<textarea name="note" rows="2" maxlength="500" placeholder="Varsa açıklama"></textarea></label><div class="akpr-actions"><button class="akpr-btn primary" id="akpr-submit" type="submit">Araç Kaydını Oluştur</button><button class="akpr-btn light" id="akpr-reset" type="reset">Temizle</button></div><div id="akpr-feedback" class="akpr-msg" role="status"></div></form></div>
 <div class="akpr-card akpr-detail-view" id="akpr-list-view" hidden><div class="akpr-detail-head"><button type="button" class="akpr-btn light akpr-back" data-akpr-back>← Ana Sayfa</button></div><div class="akpr-actions" style="justify-content:space-between"><h2 style="margin:0;font-size:20px">Oluşturduğum Ön Kayıtlar</h2><button type="button" class="akpr-btn light" id="akpr-refresh">Yenile</button></div><div id="akpr-list" class="akpr-muted">Kayıtlar yükleniyor…</div></div></section>`}
 async function loadCatalog(){
  try{const rows=await api('/rest/v1/aktiva_excel_catalog?select=code,name&order=code.asc&limit=10000');catalogProducts=Array.isArray(rows)?rows.filter(x=>x.name):[]}
  catch(e){console.warn('Ön kayıt kataloğu okunamadı:',e);catalogProducts=[]}
  if(!catalogProducts.length){try{const r=await fetch('aktiva-urunler.json',{cache:'no-store'});if(r.ok){const rows=await r.json();if(Array.isArray(rows))catalogProducts=rows.filter(x=>x.name)}}catch(e){console.warn('Yerel katalog okunamadı:',e)}}
  renderProductDraft();
 }
 const blankProduct=()=>({code:'',name:'',quantity:'',unit:'koli'});
 function addProduct(){const p=readProducts();if(p.length){const old=p[activeProduct];if(!old?.name||!(Number(old.quantity)>0)){say('#akpr-feedback','Önce mevcut ürünün adını ve miktarını girin.',true);return}productDraft=p}productDraft.push(blankProduct());activeProduct=productDraft.length-1;renderProductDraft();$('#akpr-products-list [data-field="search"]')?.focus()}
 function renderProductDraft(){const host=$('#akpr-products-list');if(!host)return;const saved=productDraft.map((p,i)=>i===activeProduct?'':`<button type="button" class="akpr-saved-item" data-edit-product="${i}"><b>✓ Ürün ${i+1}: ${E(p.name||'Henüz girilmedi')}</b><span>${E(p.quantity)} ${E(p.unit)} · Düzenle ›</span></button>`).join('');const p=productDraft[activeProduct]||blankProduct();host.innerHTML=`<div class="akpr-saved-products">${saved}</div><div class="akpr-product-edit" data-line="${activeProduct}"><div class="akpr-line-head"><b>Ürün ${activeProduct+1} / ${productDraft.length}</b>${productDraft.length>1?`<button type="button" class="akpr-btn light" data-remove-product="${activeProduct}">Kaldır</button>`:''}</div><label>Ürün kataloğunda ara (isteğe bağlı)<input data-field="search" type="search" autocomplete="off" value="${E(p.name)}" placeholder="Ürün adı veya koduyla ara"></label><div class="akpr-catalog-results" id="akpr-catalog-results"></div><label>Ürün kodu (isteğe bağlı)<input data-field="code" value="${E(p.code)}"></label><label>Ürün adı *<input data-field="name" value="${E(p.name)}" placeholder="Katalogdan seçin veya elle yazın"></label><label>Miktar *<input data-field="quantity" type="number" min="0.001" step="any" value="${E(p.quantity)}"></label><label>Birim<select data-field="unit"><option value="koli" ${p.unit==='koli'?'selected':''}>Koli</option><option value="adet" ${p.unit==='adet'?'selected':''}>Adet</option></select></label></div>`}
 function readProducts(){const all=productDraft.map(p=>({...p}));const line=$('#akpr-products-list [data-line]');if(line){const i=Number(line.dataset.line);all[i]={code:line.querySelector('[data-field="code"]').value.trim(),name:line.querySelector('[data-field="name"]').value.trim(),quantity:line.querySelector('[data-field="quantity"]').value,unit:line.querySelector('[data-field="unit"]').value}}return all}
 function resetProducts(){productDraft=[blankProduct()];activeProduct=0;renderProductDraft()}
 function catalogSearch(q){const host=$('#akpr-catalog-results');if(!host)return;const term=q.trim().toLocaleLowerCase('tr');if(!term){host.innerHTML='';return}const found=catalogProducts.filter(p=>String(p.code||'').toLocaleLowerCase('tr').includes(term)||String(p.name||'').toLocaleLowerCase('tr').includes(term)).slice(0,12);host.innerHTML=found.map(p=>`<button type="button" class="akpr-catalog-item" data-catalog-code="${E(p.code)}"><strong>${E(p.name)}</strong><small>${E(p.code)}</small></button>`).join('')||'<span class="akpr-muted">Katalogda ürün bulunamadı.</span>'}
 function setupProducts(){const host=$('#akpr-products-list');host?.addEventListener('input',e=>{if(e.target.matches('[data-field="search"]')){const line=$('#akpr-products-list [data-line]');catalogSearch(e.target.value)}});
 host?.addEventListener('click',e=>{const picked=e.target.closest('[data-catalog-code]');if(picked){const entry=catalogProducts.find(p=>String(p.code)===picked.dataset.catalogCode);if(!entry)return;const line=$('#akpr-products-list [data-line]');line.querySelector('[data-field="name"]').value=entry.name;line.querySelector('[data-field="code"]').value=entry.code;line.querySelector('[data-field="search"]').value=entry.name;$('#akpr-catalog-results').innerHTML='';line.querySelector('[data-field="quantity"]').focus();return}
 const edit=e.target.closest('[data-edit-product]');if(edit){productDraft=readProducts();activeProduct=Number(edit.dataset.editProduct);renderProductDraft();return}
 const remove=e.target.closest('[data-remove-product]');if(remove){productDraft=readProducts();productDraft.splice(Number(remove.dataset.removeProduct),1);if(!productDraft.length)productDraft=[blankProduct()];activeProduct=Math.min(activeProduct,productDraft.length-1);renderProductDraft()}});
 $('#akpr-add-product')?.addEventListener('click',addProduct);resetProducts();loadCatalog()}
 function showStaffView(view){
  const root=$('#ak-pre-receiving');if(!root)return;
  const nav=$('#akpr-home-nav'),create=$('#akpr-new-view'),list=$('#akpr-list-view'),report=$('#akpr-report-view'),shortcut=$('#akpr-open-report');
  if(!nav||!create||!list)return;
  nav.hidden=view!=='home';if(shortcut)shortcut.hidden=view!=='home';create.hidden=view!=='new';list.hidden=view!=='list';if(report)report.hidden=view!=='report';
  if(view==='list')refresh();
  root.scrollIntoView({behavior:'smooth',block:'start'});
 }
 const say=(target,msg,error=false)=>{const e=$(target);if(e){e.textContent=msg;e.className='akpr-msg '+(error?'akpr-error':'akpr-ok')}};
 async function upload(file){
  if(!file)return null;
  if(file.size>5*1024*1024)throw Error('Fotoğraf 5 MB sınırını aşıyor.');
  const mime={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  if(!mime)throw Error('Fotoğrafı JPEG, PNG veya WebP olarak yükleyin.');
  const id=crypto.randomUUID();const path=session.user.id+'/'+id+'.'+mime;
  await api('/storage/v1/object/ak-sevkiyat-irsaliyeleri/'+path,{method:'POST',headers:{'Content-Type':file.type,'x-upsert':'false'},body:file});
  return path;
 }
 function resetEditing(){
  editId=null;const title=$('#akpr-form-title'),btn=$('#akpr-submit');
  if(title)title.textContent='Yeni Sevkiyat Kaydı';
  if(btn)btn.textContent='Araç Kaydını Kaydet';
 }
 function startEdit(r){
  if(document.body.dataset.role!=='pre_receiving'||r.created_by!==session?.user?.id||r.status!=='waiting')return;
  const f=$('#akpr-form');if(!f)return;
  editId=r.id;for(const [key,val] of Object.entries({plate:r.plate,company:r.company,driver:r.driver_name,driver_phone:r.driver_phone,waybill:r.waybill_number,note:r.notes,arrival_at:localInput(r.arrival_at||r.created_at)})){
   if(f.elements.namedItem(key))f.elements.namedItem(key).value=val||'';
  }
  showStaffView('new');$('#akpr-form-title').textContent='Ön Kaydı Düzenle';$('#akpr-submit').textContent='Değişiklikleri Kaydet';
  say('#akpr-feedback','Fotoğrafı değiştirmek için yeni bir fotoğraf seçebilirsin.');
  f.scrollIntoView({behavior:'smooth',block:'start'});
 }
 async function cancelRecord(r){
  if(document.body.dataset.role!=='pre_receiving'||r.created_by!==session?.user?.id||r.status!=='waiting')return;
  const reason=prompt((r.plate||recordNo(r))+' kaydının iptal nedenini yazın:');if(reason===null)return;if(!reason.trim()){alert('İptal nedeni zorunludur.');return}
  try{await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id)+'&created_by=eq.'+encodeURIComponent(session.user.id)+'&status=eq.waiting',{
   method:'PATCH',headers:{Prefer:'return=representation'},json:{status:'cancelled',cancellation_reason:reason.trim()}
  }).then(result=>{if(!Array.isArray(result)||!result.length)throw Error('Kayıt değiştirilmedi; başka bir işlem yapılmış olabilir.')});
  if(editId===r.id){$('#akpr-form')?.reset();resetEditing()}
  await refresh();
  }catch(e){alert('İptal yapılamadı: '+e.message)}
 }
 async function create(ev){ev.preventDefault();const form=ev.currentTarget,fd=new FormData(form),btn=$('#akpr-submit');if(!btn)return;
  btn.disabled=true;say('#akpr-feedback',editId?'Güncelleniyor…':'Kaydediliyor…');
  try{
   const row={plate:String(fd.get('plate')||'').trim().toLocaleUpperCase('tr-TR'),company:String(fd.get('company')||'').trim(),driver_name:String(fd.get('driver')||'').trim(),driver_phone:String(fd.get('driver_phone')||'').trim(),waybill_number:String(fd.get('waybill')||'').trim(),notes:String(fd.get('note')||'').trim()};
   row.arrival_at=parseLocal(String(fd.get('arrival_at')||''));
   // Danışma ürün kaydetmez. Düzenleme sırasında Mal Kabul ürün verisi korunur.
   if(!editId)row.products=[];
   // Ön kayıt kaydetmeden hemen önce sunucudaki güncel kayıtları kontrol et.
   // Uyarı gösterilir; gerçekten ayrı sevkiyatsa kullanıcı devam edebilir.
   const registered=await fetchRecords();
   const duplicate=(row.plate||row.waybill_number)?similarRecord(registered,row,editId):null;
   if(duplicate){
     const details=`${duplicate.plate} · ${duplicate.company} · İrsaliye: ${duplicate.waybill_number||'Girilmemiş'} · Kayıt: ${stamp(duplicate.created_at)}`;
     if(!confirm('Benzer bir sevkiyat kaydı bulundu!\n\n'+details+'\n\nAynı kaydı ikinci kez oluşturmadığından emin misin?\n\nYine de kaydetmek için Tamam seç.')){
       say('#akpr-feedback','Benzer kayıt nedeniyle işlem durduruldu. Önce kaydı kontrol edebilirsin.',true);return;
     }
   }
   const file=fd.get('photo');
   if(editId){
    const original=cache.find(r=>r.id===editId);
    if(!original||original.status!=='waiting'||original.created_by!==session.user.id)throw Error('Bu kayıt düzenlenemez.');
    if(file?.size)row.photo_path=await upload(file);
    const result=await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(editId)+'&created_by=eq.'+encodeURIComponent(session.user.id)+'&status=eq.waiting',{
     method:'PATCH',headers:{Prefer:'return=representation'},json:row
    });
    if(!Array.isArray(result)||!result.length)throw Error('Kayıt güncellenemedi; durumunu kontrol et.');
    say('#akpr-feedback','Ön kayıt güncellendi.');
   }else{
    row.photo_path=file?.size?await upload(file):null;
    await api('/rest/v1/'+table,{method:'POST',headers:{Prefer:'return=minimal'},json:row});
    say('#akpr-feedback','Sevkiyat kaydedildi ve Mal Kabul ekranına aktarıldı.');
   }
   form.reset();resetEditing();await refresh();
  }catch(e){say('#akpr-feedback',e.message,true)}finally{btn.disabled=false}
 }
 async function imageLink(path){if(!path)return null;const p=path.split('/').map(encodeURIComponent).join('/');const d=await api('/storage/v1/object/sign/ak-sevkiyat-irsaliyeleri/'+p,{method:'POST',json:{expiresIn:300}});return cfg.url+d.signedURL}
 function rows(records,host,receiving){host.innerHTML=records.length?'':'<p class="akpr-muted">Bu listede kayıt bulunmuyor.</p>';
  for(const r of records){const x=document.createElement('div');x.className='akpr-row';x.innerHTML=`<div><strong>${E(r.plate||recordNo(r))}</strong> · ${E(r.company||"Firma belirtilmedi")}<div class="akpr-muted">Kayıt No: ${E(recordNo(r))} · Kayıt: ${stamp(r.created_at)} · Geliş: ${stamp(recordedArrival(r))} · ${E(r.driver_name||'Şoför belirtilmedi')} · İrsaliye: ${E(r.waybill_number||'—')}</div><div class="akpr-muted">Perona gönderilme: ${stamp(r.docked_at)} · Çıkış: ${stamp(r.departed_at)}</div><div class="akpr-muted">${E(r.notes||'')}${r.cancellation_reason?" · İptal nedeni: "+E(r.cancellation_reason):""}</div><div class="akpr-wait-time" data-akpr-start="${E(recordedArrival(r))}" data-akpr-end="${E(r.docked_at||(r.status==='cancelled'?r.created_at:''))}">${r.docked_at?'Perona gönderilene kadar bekleme: ':'Bekleme süresi: '}<strong>${elapsedText(recordedArrival(r),r.docked_at||(r.status==='cancelled'?r.created_at:null))}</strong></div></div><div><span class="akpr-pill">${statusText(r)}</span></div>`;
   const b=document.createElement('div');b.className='akpr-actions';
   if(r.photo_path){const v=document.createElement('button');v.type='button';v.className='akpr-btn light';v.textContent='📷 İrsaliyeyi Gör';v.onclick=async()=>{v.disabled=true;try{const url=await imageLink(r.photo_path);window.open(url,'_blank','noopener,noreferrer')}catch(e){alert(e.message)}finally{v.disabled=false}};b.append(v)}
   if(!receiving&&r.created_by===session?.user?.id&&r.status==='waiting'){
    const edit=document.createElement('button');edit.type='button';edit.className='akpr-btn light';edit.textContent='✏️ Düzenle';edit.onclick=()=>startEdit(r);b.append(edit);
    const cancel=document.createElement('button');cancel.type='button';cancel.className='akpr-btn akpr-danger';cancel.textContent='İptal Et';cancel.onclick=()=>cancelRecord(r);b.append(cancel);
   }
   if(receiving&&['waiting','at_dock'].includes(r.status)){const open=document.createElement('button');open.type='button';open.className='akpr-btn primary';open.textContent='Sayımı Aç';open.onclick=()=>openCount(r);if(Array.isArray(r.products)&&r.products.length)b.append(open);}
   if(receiving&&r.status==='counting'){const resume=document.createElement('button');resume.type='button';resume.className='akpr-btn primary';resume.textContent='Sayıma Devam Et';resume.onclick=()=>openCount(r);b.append(resume)}
   if(!receiving&&canEditRecord(r)&&!r.docked_at&&!r.departed_at&&r.status==='waiting'){
     const dock=document.createElement('button');dock.type='button';dock.className='akpr-btn primary';dock.textContent='🚛 Perona Gönderildi';
     dock.onclick=async()=>{
       if(!confirm((r.plate||recordNo(r))+' aracı perona gönderildi olarak kaydedilsin mi? Bu işlem bekleme süresini durdurur.'))return;
       dock.disabled=true;
       try{
         const now=new Date().toISOString();
         const result=await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id)+'&created_by=eq.'+encodeURIComponent(session.user.id)+'&status=eq.waiting&docked_at=is.null',{
           method:'PATCH',headers:{Prefer:'return=representation'},json:{status:'at_dock',docked_at:now}
         });
         if(!Array.isArray(result)||!result.length)throw Error('İşlem kaydedilemedi. Kayıt başka cihazdan güncellenmiş olabilir.');
         await refresh();
       }catch(e){alert('Perona gönderme işlemi başarısız: '+e.message)}finally{dock.disabled=false}
     };b.append(dock);
   }
   if(!receiving&&canEditRecord(r)&&!r.docked_at&&r.status!=='cancelled'){
     const fixDock=document.createElement('button');fixDock.type='button';fixDock.className='akpr-btn light';fixDock.textContent='🕒 Eksik Peron Saatini Gir';
     fixDock.onclick=async()=>{const value=requestTime('Perona gönderilme zamanını girin',r.departed_at||new Date().toISOString());if(!value)return;
       if(Date.parse(value)<Date.parse(recordedArrival(r))||r.departed_at&&Date.parse(value)>Date.parse(r.departed_at)){alert('Peron saati gelişten önce veya çıkıştan sonra olamaz.');return}
       if(!confirm('Perona gönderilme saati '+stamp(value)+' olarak kaydedilsin mi?'))return;
       fixDock.disabled=true;try{const data={docked_at:value};if(r.status==='waiting')data.status='at_dock';const result=await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id)+'&created_by=eq.'+encodeURIComponent(session.user.id)+'&docked_at=is.null',{method:'PATCH',headers:{Prefer:'return=representation'},json:data});if(!Array.isArray(result)||!result.length)throw Error('Kayıt güncellenemedi veya saat başka bir cihazdan girildi.');await refresh()}catch(e){alert('Peron saati kaydedilemedi: '+e.message)}finally{fixDock.disabled=false}
     };b.append(fixDock);
   }
   if(!receiving&&r.created_by===session?.user?.id&&!r.departed_at&&r.status!=='cancelled'){
     const out=document.createElement('button');out.type='button';out.className='akpr-btn light';out.textContent='🚚 Araç Çıkışını Kaydet';out.onclick=async()=>{
       if(!confirm((r.plate||recordNo(r))+' aracı çıkış yaptı mı?'))return;
       out.disabled=true;try{const value=new Date().toISOString();await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id)+'&created_by=eq.'+encodeURIComponent(session.user.id),{method:'PATCH',headers:{Prefer:'return=representation'},json:{departed_at:value}}).then(x=>{if(!Array.isArray(x)||!x.length)throw Error('Çıkış saati kaydedilemedi. Yetki politikalarını kontrol edin.')});await refresh()}catch(e){alert('Çıkış kaydedilemedi: '+e.message)}finally{out.disabled=false}
     };b.append(out);
     const manualExit=document.createElement('button');manualExit.type='button';manualExit.className='akpr-btn light';manualExit.textContent='🕒 Geçmiş Çıkış Saatini Gir';manualExit.onclick=async()=>{
       const value=requestTime('Gerçek araç çıkış zamanını girin',new Date().toISOString());if(!value)return;
       if(Date.parse(value)<Date.parse(recordedArrival(r))||r.docked_at&&Date.parse(value)<Date.parse(r.docked_at)){alert('Çıkış saati gelişten veya perona gönderilmeden önce olamaz.');return}
       if(!confirm('Araç çıkışı '+stamp(value)+' olarak kaydedilsin mi?'))return;
       manualExit.disabled=true;try{const result=await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id)+'&created_by=eq.'+encodeURIComponent(session.user.id)+'&departed_at=is.null',{method:'PATCH',headers:{Prefer:'return=representation'},json:{departed_at:value}});if(!Array.isArray(result)||!result.length)throw Error('Kayıt güncellenemedi veya çıkış saati zaten girilmiş.');await refresh()}catch(e){alert('Çıkış kaydedilemedi: '+e.message)}finally{manualExit.disabled=false}
     };b.append(manualExit);
   }
   x.append(b);host.append(x)
  }
 }
 const istanbulDate=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
 // Bekleyenler için tarih kısıtlaması yoktur. Supabase'in varsayılan 1000 satır sınırı
 // nedeniyle sonuçlar sayfalanır; eski bekleyen kayıtlar listeden düşmez.
 async function fetchRecords(){
  const all=[],pageSize=500;
  for(let offset=0;offset<10000;offset+=pageSize){
   const page=await api('/rest/v1/'+table+'?select=id,created_by,plate,company,driver_name,driver_phone,waybill_number,notes,photo_path,status,created_at,arrival_at,docked_at,departed_at,cancellation_reason,products,count_results,counted_at&order=created_at.desc&limit='+pageSize+'&offset='+offset);
   if(!Array.isArray(page))throw Error('Ön kayıt listesi okunamadı.');
   all.push(...page);if(page.length<pageSize)return all;
  }
  throw Error('Kayıt sayısı listeleme sınırını aştı. Eksik liste gösterilmiyor.');
 }
 async function refresh(){if(!active())return;try{
   const records=await fetchRecords();cache=records;
   const mine=records.filter(r=>r.created_by===session?.user?.id);
   if($('#akpr-list')){
     const live=r=>!r.docked_at&&!r.departed_at&&r.status==='waiting';
     const ordered=[...mine].sort((a,b)=>Number(live(b))-Number(live(a))||(live(a)?Date.parse(recordedArrival(a))-Date.parse(recordedArrival(b)):Date.parse(b.created_at)-Date.parse(a.created_at)));
     const old=ordered.filter(r=>live(r)&&istanbulDate(recordedArrival(r))<today()).length;
     const current=ordered.filter(r=>live(r)&&istanbulDate(recordedArrival(r))===today()).length;
     const host=$('#akpr-list');host.innerHTML='<div class="akpr-pending-summary"><div><small>Önceki Günlerden Bekleyen</small><strong>'+old+' araç</strong></div><div><small>Bugün Gelen ve Bekleyen</small><strong>'+current+' araç</strong></div></div>';
     const list=document.createElement('div');host.append(list);rows(ordered,list,false);
   }
   const total=$('#akpr-total'),pending=$('#akpr-pending');
   if(total)total.textContent=mine.filter(r=>istanbulDate(r.created_at)===today()).length;
   if(pending)pending.textContent=mine.filter(r=>r.status==='waiting').length;
   if($('#akpr-records-content'))drawReceiving(records);
  }catch(e){if($('#akpr-list'))$('#akpr-list').textContent='Kayıtlar alınamadı: '+e.message;if($('#akpr-records-content'))$('#akpr-records-content').textContent='Ön kayıtlar alınamadı: '+e.message}
 }
 let cache=[];
 function drawReceiving(records){
  const host=$('#akpr-records-content');if(!host)return;
  const q=($('#akpr-record-search')?.value||'').toLocaleLowerCase('tr-TR').trim();
  const waiting=records.filter(r=>['waiting','at_dock','counting'].includes(r.status));
  const older=waiting.filter(r=>istanbulDate(r.created_at)<today()).length;
  const todayWaiting=waiting.filter(r=>istanbulDate(r.created_at)===today()).length;
  const counts=$('#akpr-pending-summary');if(counts)counts.innerHTML='<div><small>Önceki Günlerden Bekleyen</small><strong>'+older+' araç</strong></div><div><small>Bugün Gelen ve Bekleyen</small><strong>'+todayWaiting+' araç</strong></div><div><small>Toplam Bekleyen</small><strong>'+waiting.length+' araç</strong></div>';
  const filtered=records.filter(r=>(r.plate+' '+r.company+' '+(r.waybill_number||'')+' '+(r.driver_name||'')).toLocaleLowerCase('tr-TR').includes(q));
  // Bekleyen araçlar en üstte; dünden kalanlar da mutlaka görünür.
  filtered.sort((a,b)=>(['waiting','at_dock','counting'].includes(a.status)?0:1)-(['waiting','at_dock','counting'].includes(b.status)?0:1)||new Date(a.created_at)-new Date(b.created_at));
  host.textContent='';rows(filtered,host,true);
  const badge=$('#akpr-record-count');if(badge)badge.textContent=waiting.length+' bekleyen / '+records.length+' toplam ön kayıt';
 }

 async function ensureExcelJS(){
  if(window.ExcelJS?.Workbook)return window.ExcelJS;
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';s.onload=resolve;s.onerror=()=>reject(Error('Excel biçimlendirme kütüphanesi indirilemedi. İnterneti kontrol edin.'));document.head.append(s)});
  if(!window.ExcelJS?.Workbook)throw Error('Excel kütüphanesi başlatılamadı.');return window.ExcelJS;
 }
 async function exportExcel(){
  if(document.body.dataset.role!=='pre_receiving')return;
  const start=$('#akpr-excel-start')?.value,end=$('#akpr-excel-end')?.value,mode=$('#akpr-excel-status')?.value||'all',info=$('#akpr-export-msg'),btn=$('#akpr-export');
  if(!start||!end||start>end){info.textContent='Geçerli başlangıç ve bitiş tarihleri seçin.';return}
  btn.disabled=true;info.textContent='A4 baskıya uygun Excel hazırlanıyor…';
  try{
   const records=(await fetchRecords()).filter(r=>{const d=istanbulDate(recordedArrival(r));return d>=start&&d<=end}).filter(r=>mode==='all'||(mode==='waiting'?r.status==='waiting':mode==='cancelled'?r.status==='cancelled':r.status==='completed'||!!r.departed_at));
   const ExcelJS=await ensureExcelJS(),wb=new ExcelJS.Workbook();wb.creator='AKTİVA · Danışma';wb.created=new Date();wb.modified=new Date();
   const navy='FF173047',navy2='FF254760',gold='FFE0B85B',light='FFEAF0F5',muted='FF60748A',white='FFFFFFFF';
   const period=start.split('-').reverse().join('.')+' – '+end.split('-').reverse().join('.');
   function sheet(name,headers,widths,rows,{portrait=false}={}){
    const ws=wb.addWorksheet(name,{views:[{state:'frozen',ySplit:3}]});
    ws.columns=widths.map(w=>({width:w}));
    ws.pageSetup={paperSize:9,orientation:portrait?'portrait':'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,showGridLines:false,horizontalCentered:true};
    ws.pageMargins={left:.22,right:.22,top:.48,bottom:.48,header:.22,footer:.22};
    ws.headerFooter.oddHeader='&LAKTİVA  |  DANIŞMA&RDÖNEM: '+period;
    ws.headerFooter.oddFooter='&LGiriş – peron – çıkış kayıtları&RSayfa &P / &N';
    ws.properties.pageSetUpPr={fitToPage:true};
    ws.mergeCells(1,1,1,headers.length);const title=ws.getCell(1,1);title.value='AKTİVA  |  DANIŞMA ARAÇ GİRİŞ – ÇIKIŞ RAPORU';title.font={name:'Aptos Display',size:15,bold:true,color:{argb:gold}};title.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};title.alignment={vertical:'middle',horizontal:'left',indent:1};ws.getRow(1).height=33;
    ws.mergeCells(2,1,2,headers.length);const subtitle=ws.getCell(2,1);subtitle.value=period;subtitle.font={name:'Aptos',size:11,bold:true,color:{argb:navy2}};subtitle.fill={type:'pattern',pattern:'solid',fgColor:{argb:light}};subtitle.alignment={indent:1,vertical:'middle'};ws.getRow(2).height=25;
    const head=ws.getRow(3);head.values=headers;head.height=33;
    head.eachCell(c=>{c.font={name:'Aptos',size:9,bold:true,color:{argb:white}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy2}};c.alignment={vertical:'middle',horizontal:'center',wrapText:true};c.border={bottom:{style:'medium',color:{argb:gold}}}});
    rows.forEach((values,i)=>{const r=ws.addRow(values);r.height=34;r.eachCell({includeEmpty:true},(c)=>{c.font={name:'Aptos',size:9,color:{argb:navy}};c.alignment={vertical:'middle',wrapText:true};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:i%2?'FFF0F5F9':'FFFFFFFF'}};c.border={bottom:{style:'hair',color:{argb:'FFD8E2EB'}}};});});
    ws.autoFilter={from:{row:3,column:1},to:{row:Math.max(3,ws.rowCount),column:headers.length}};
    ws.pageSetup.printTitlesRow='1:3';ws.printArea='A1:'+ws.getColumn(headers.length).letter+Math.max(4,ws.rowCount);
    return ws;
   }
   const statuses={};for(const r of records){const s=statusText(r);statuses[s]=(statuses[s]||0)+1}
   const waits=records.map(r=>duration(recordedArrival(r),r.docked_at)).filter(x=>x!==null);
   const avg=waits.length?Math.round(waits.reduce((a,b)=>a+b,0)/waits.length):null;
   const formatMinutes=v=>{if(v===null||!Number.isFinite(v))return '—';const total=Math.max(0,Math.round(v*60)),h=Math.floor(total/3600),m=Math.floor(total%3600/60),sec=total%60;return (h?h+' sa ':'')+(m||h?m+' dk ':'')+sec+' sn';};
   const overview=[['Toplam araç kaydı',records.length],['Bekleyen',statuses['Bekliyor']||0],['Perona gönderilen',records.filter(r=>!!r.docked_at).length],['Tamamlanan',records.filter(r=>r.status==='completed').length],['Çıkış yapılan',records.filter(r=>!!r.departed_at).length],['İptal edilen',records.filter(r=>r.status==='cancelled').length],['Ortalama peron beklemesi',formatMinutes(avg)]];
   const os=sheet('Özet',['GÖSTERGE','DEĞER'],[34,30],overview,{portrait:true});os.getColumn(2).alignment={horizontal:'center',vertical:'middle'};os.getColumn(2).font={bold:true};os.pageSetup.fitToHeight=1;
   const vehicleRows=records.map(r=>[recordNo(r),r.plate||'—',r.company||'—',statusText(r),stamp(recordedArrival(r)),stamp(r.created_at),stamp(r.docked_at),stamp(r.departed_at),formatMinutes(duration(recordedArrival(r),r.docked_at)),formatMinutes(duration(recordedArrival(r),r.departed_at))]);
   sheet('Araç Giriş Çıkış',['Kayıt no','Plaka','Firma','Durum','Gerçek geliş','Kayıt zamanı','Perona gönderilme','Araç çıkışı','Peron bekleme','Tesiste kalış'],[20,15,23,17,20,20,20,20,20,20],vehicleRows);
   const detailRows=records.map(r=>[recordNo(r),r.plate||'—',r.company||'—',r.driver_name||'—',r.driver_phone||'—',r.waybill_number||'—',statusText(r),stamp(r.created_at),stamp(recordedArrival(r)),stamp(r.docked_at),stamp(r.departed_at),r.cancellation_reason||'—',r.notes||'—']);
   sheet('İşlem Detayları',['Kayıt no','Plaka','Firma','Şoför','Telefon','İrsaliye','Durum','Kayıt zamanı','Gerçek geliş','Perona gönderilme','Çıkış','İptal nedeni','Açıklama'],[20,14,22,18,17,20,16,19,19,19,19,22,23],detailRows);
   // Ayrı bir saatlik yoğunluk tablosu ve A4 uyumlu görsel grafik.
   const hourRows=[];
   const hourBucket=new Array(12).fill(0).map((_,i)=>({start:i*2,entries:0,exits:0}));
   for(const r of records){
     for(const [field,key] of [[recordedArrival(r),'entries'],[r.departed_at,'exits']]){
       if(!field)continue;const dt=new Date(field);if(!Number.isFinite(dt.getTime()))continue;
       const part=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',hourCycle:'h23'}).format(dt);
       const ix=Math.floor(Number(part)/2);if(hourBucket[ix])hourBucket[ix][key]++;
     }
   }
   const hh=i=>String(i).padStart(2,'0')+':00';
   for(const b of hourBucket)hourRows.push([hh(b.start)+' – '+hh(b.start+2),b.entries,b.exits]);
   const analysis=sheet('Operasyon Analizi',['SAAT ARALIĞI','ARAÇ GİRİŞİ','ARAÇ ÇIKIŞI','GİRİŞ YOĞUNLUĞU','ÇIKIŞ YOĞUNLUĞU'],[22,19,19,31,31],hourRows,{portrait:false});
   const maxCount=Math.max(1,...hourBucket.flatMap(b=>[b.entries,b.exits]));
   for(let i=0;i<hourBucket.length;i++){
     const row=analysis.getRow(i+4),b=hourBucket[i];
     for(const [col,val] of [[4,b.entries],[5,b.exits]]){
       const cell=row.getCell(col);cell.value=val?('▮'.repeat(Math.max(1,Math.round(val/maxCount*15)))+'  '+val):'—';
       cell.font={name:'Aptos',size:10,bold:true,color:{argb:col===4?'FF217195':'FF9D6930'}};
       cell.alignment={vertical:'middle',horizontal:'left',indent:1};
     }
   }
   analysis.addRow(['TOPLAM',hourBucket.reduce((n,b)=>n+b.entries,0),hourBucket.reduce((n,b)=>n+b.exits,0),'','']);
   analysis.getRow(analysis.rowCount).eachCell(c=>{c.font={name:'Aptos',size:10,bold:true,color:{argb:white}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy2}};c.alignment={vertical:'middle'}});
   analysis.autoFilter=undefined;
   analysis.printArea='A1:E'+analysis.rowCount;
   analysis.pageSetup.fitToHeight=1;
   const buffer=await wb.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AKTIVA_Danisma_A4_'+start+'_'+end+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   info.textContent=records.length+' kayıt, A4 yazdırma ayarlı Excel raporuna aktarıldı.';
  }catch(e){info.textContent='Excel oluşturulamadı: '+e.message}finally{btn.disabled=false}
 }
 function applySource(){
  const root=$('#akd-dashboard');if(!root)return;
  root.classList.toggle('akpr-show-only-pre',source==='pre');
  root.classList.toggle('akpr-hide-pre',source==='mal');
  root.querySelectorAll('[data-akpr-source]').forEach(btn=>{const selected=btn.dataset.akprSource===source;btn.classList.toggle('akpr-selected',selected);btn.setAttribute('aria-pressed',String(selected))});
 }
 function countOverlay(){let el=$('#akpr-count-overlay');if(!el){el=document.createElement('section');el.id='akpr-count-overlay';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Sevkiyat ürün sayımı');el.hidden=true;document.body.append(el);el.addEventListener('click',countClick);el.addEventListener('input',countInput);}return el}
 function closeCount(){counting=null;countOverlay().hidden=true;document.body.classList.remove('akpr-count-open');source='pre';applySource();refresh()}
 function openCount(r){if(document.body.dataset.role!=='count'||!['waiting','at_dock','counting'].includes(r.status))return;const products=Array.isArray(r.products)?r.products:[];if(!products.length){alert('Bu ön kayıtta ürün yok. Sayım için ürünler Mal Kabul tarafından girilmelidir.');return}counting={id:r.id,plate:r.plate,company:r.company,products,results:Array.isArray(r.count_results)?r.count_results.map(x=>({...x})):[]};while(counting.results.length<products.length){const p=products[counting.results.length];counting.results.push({actual:String(p.quantity),damaged:'0',note:''})}countIndex=0;countOverlay().hidden=false;document.body.classList.add('akpr-count-open');renderCount()}
 function renderCount(){if(!counting)return;const p=counting.products[countIndex],r=counting.results[countIndex],count=counting.products.length,el=countOverlay();el.innerHTML=`<header class="akpr-count-head"><button type="button" data-count-action="exit" class="akpr-count-back">← Ön Kayıt</button><strong>AKTİVA · Mal Kabul Sayımı</strong><small>${E(counting.company)} · ${E(counting.plate)}</small><div class="akpr-progress">Ürün ${countIndex+1} / ${count}</div><div class="akpr-progressbar"><span style="width:${100*(countIndex+1)/count}%"></span></div></header><main class="akpr-count-main"><div class="akpr-count-product"><small>ÜRÜN KODU: ${E(p.code||'—')}</small><h2>${E(p.name)}</h2><div class="akpr-expected">Beklenen miktar <strong>${E(p.quantity)} ${E(p.unit||'koli')}</strong></div></div><label>Sayılan miktar (${E(p.unit||'koli')})<input data-count-field="actual" type="number" min="0" step="any" value="${E(r.actual)}"></label><div id="akpr-count-difference"></div><label>Hasarlı miktar (${E(p.unit||'koli')})<input data-count-field="damaged" type="number" min="0" step="any" value="${E(r.damaged)}"></label><label>Açıklama (isteğe bağlı)<textarea data-count-field="note" rows="2" placeholder="Eksik, fazla veya hasar açıklaması">${E(r.note)}</textarea></label><div id="akpr-count-error" role="status"></div></main><footer class="akpr-count-footer"><button type="button" class="akpr-btn light" data-count-action="previous" ${countIndex===0?'disabled':''}>← Önceki</button><button type="button" class="akpr-btn primary" data-count-action="next">${countIndex===count-1?'Sayım Özeti':'Kaydet ve Sonraki Ürün →'}</button></footer>`;showCountDifference()}
 function countInput(e){const field=e.target.dataset.countField;if(!counting||!['actual','damaged','note'].includes(field))return;counting.results[countIndex][field]=e.target.value;showCountDifference()}
 function showCountDifference(){const node=$('#akpr-count-difference');if(!node||!counting)return;const expected=Number(counting.products[countIndex].quantity),actual=Number(counting.results[countIndex].actual),damaged=Number(counting.results[countIndex].damaged);node.textContent=!Number.isFinite(actual)?'Geçersiz miktar':actual<expected?`${expected-actual} eksik`:actual>expected?`${actual-expected} fazla`:'Eksik veya fazla yok';if(damaged>0)node.textContent+=` · ${damaged} hasarlı`}
 function countValid(){const r=counting.results[countIndex],actual=Number(r.actual),damaged=Number(r.damaged);return r.actual!==''&&r.damaged!==''&&Number.isFinite(actual)&&actual>=0&&Number.isFinite(damaged)&&damaged>=0&&damaged<=actual}
 async function saveCount(final=false){const row={count_results:counting.results.map(r=>({actual:Number(r.actual),damaged:Number(r.damaged),note:String(r.note||'')})),status:final?'completed':'counting'};if(final)row.counted_at=new Date().toISOString();const result=await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(counting.id)+'&status=in.(waiting,at_dock,counting)',{method:'PATCH',headers:{Prefer:'return=representation'},json:row});if(!Array.isArray(result)||!result.length)throw Error('Kayıt değiştirilemedi, durumu yenileyin.')}
 function countSummary(){const el=countOverlay();el.innerHTML=`<header class="akpr-count-head"><button data-count-action="edit" class="akpr-count-back">← Sayıma Dön</button><strong>Sayım Özeti</strong><small>${E(counting.company)} · ${E(counting.plate)}</small></header><main class="akpr-count-main"><h2>Kontrol edilen ${counting.products.length} ürün</h2>${counting.products.map((p,i)=>{const r=counting.results[i],diff=Number(r.actual)-Number(p.quantity);return `<div class="akpr-summary-line"><b>${E(p.name)}</b><small>Beklenen: ${E(p.quantity)} · Sayılan: ${E(r.actual)} ${E(p.unit||'koli')}</small><small>${diff<0?Math.abs(diff)+' eksik':diff>0?diff+' fazla':'Miktar doğru'} · Hasarlı: ${E(r.damaged)}</small></div>`}).join('')}<div id="akpr-count-error" role="status"></div></main><footer class="akpr-count-footer"><button class="akpr-btn light" data-count-action="edit">Düzelt</button><button class="akpr-btn primary" data-count-action="finish">Sayımı Tamamla ve Kaydet</button></footer>`}
 async function countClick(e){const b=e.target.closest('[data-count-action]');if(!b||!counting||countBusy)return;const action=b.dataset.countAction;if(action==='exit'){try{countBusy=true;await saveCount();closeCount()}catch(err){$('#akpr-count-error').textContent=err.message}finally{countBusy=false}return}if(action==='edit'){renderCount();return}if(action==='previous'){countIndex=Math.max(0,countIndex-1);renderCount();return}if(action==='next'){if(!countValid()){$('#akpr-count-error').textContent='Sayılan ve hasarlı miktarı kontrol edin.';return}try{countBusy=true;await saveCount();if(countIndex===counting.products.length-1)countSummary();else{countIndex++;renderCount()}}catch(err){$('#akpr-count-error').textContent=err.message}finally{countBusy=false}return}if(action==='finish'){try{countBusy=true;await saveCount(true);closeCount()}catch(err){$('#akpr-count-error').textContent=err.message}finally{countBusy=false}}}
 function receiving(){
  const root=$('#akd-dashboard');if(!root||document.body.dataset.role!=='count')return;
  const list=root.querySelector('.akd-body .akd-records-list');
  if(!list){root.classList.remove('akpr-show-only-pre','akpr-hide-pre');lastHost=null;return}
  if(lastHost===list && root.contains($('#akpr-records-panel')))return;
  lastHost=list;
  root.querySelector('#akpr-records-panel')?.remove();
  const box=document.createElement('section');box.id='akpr-records-panel';
  box.innerHTML='<div class="akpr-source-tabs" role="group" aria-label="Kayıt kaynağı"><button type="button" data-akpr-source="all">Tümü</button><button type="button" data-akpr-source="mal">Mal Kabul</button><button type="button" data-akpr-source="pre">Ön Kayıt</button></div><div class="akpr-pre-records"><div class="akpr-pre-heading"><strong>Bekleyen Sevkiyatlar</strong><span id="akpr-record-count"></span></div><div id="akpr-pending-summary" class="akpr-pending-summary" aria-label="Bekleyen sevkiyat özeti"></div><input id="akpr-record-search" type="search" placeholder="Plaka, firma, şoför veya irsaliye ara" aria-label="Ön kayıtlarda ara"><div id="akpr-records-content" class="akpr-muted">Kayıtlar yükleniyor…</div></div>';
  list.before(box);
  box.querySelectorAll('[data-akpr-source]').forEach(btn=>btn.addEventListener('click',()=>{source=btn.dataset.akprSource;applySource()}));
  box.querySelector('#akpr-record-search').addEventListener('input',()=>drawReceiving(cache));
  applySource();if(cache.length)drawReceiving(cache);else refresh();
 }
 // Only the four pre-registration navigation controls; strong inline styling bypasses conflicting global button CSS.
 function applyPreRegistrationButtonTheme(){
   if(document.body.dataset.role!=='pre_receiving')return;
   const styles=[
     ['#akpr-open-new','#21384e','#f3f7fc','#d5b360'],
     ['#akpr-open-list','#21384e','#f3f7fc','#d5b360'],
     ['#akpr-open-report','#21384e','#f3f7fc','#d5b360'],
     ['#akpr-export','#21384e','#f3f7fc','#d5b360'],
     ['#akpr-logout','#2b4157','#f3f7fc','#698197'],
     ['#ak-pre-receiving .akpr-back','#2b4157','#f3f7fc','#698197']
   ];
   for(const [selector,bg,fg,edge] of styles){
     document.querySelectorAll(selector).forEach(el=>{
       el.style.setProperty('background',bg,'important');
       el.style.setProperty('background-color',bg,'important');
       el.style.setProperty('background-image','none','important');
       el.style.setProperty('color',fg,'important');
       el.style.setProperty('border-color',edge,'important');
       el.style.setProperty('box-shadow','none','important');
     });
   }
 }
 function mount(){const role=document.body.dataset.role;if(role==='pre_receiving'){
    const app=$('#app');if(!app||app.classList.contains('hidden'))return;
    if(!$('#ak-pre-receiving')){app.insertAdjacentHTML('beforeend',markup());$('#akpr-form').addEventListener('submit',create);;$('#akpr-refresh').onclick=refresh;$('#akpr-open-report').onclick=()=>showStaffView('report');$('#akpr-export').onclick=exportExcel;$('#akpr-excel-start').value=today();$('#akpr-excel-end').value=today();$('#akpr-logout').onclick=()=>$('#logout')?.click();$('#akpr-open-new').onclick=()=>{resetEditing();$('#akpr-form')?.reset();showStaffView('new')};$('#akpr-open-list').onclick=()=>showStaffView('list');document.querySelectorAll('#ak-pre-receiving [data-akpr-back]').forEach(b=>b.addEventListener('click',()=>{resetEditing();$('#akpr-form')?.reset();showStaffView('home')}));}
    applyPreRegistrationButtonTheme();
    if(lastRole!==role)refresh();
   }else if(role==='count'){
    receiving();if(lastRole!==role)refresh();
   }
   lastRole=role;
 }
 document.addEventListener('aktiva:session-changed',()=>{lastRole='';setTimeout(mount,20)});
 new MutationObserver(()=>{if(['count','pre_receiving'].includes(document.body.dataset.role))mount()}).observe(document.body,{attributes:true,attributeFilter:['data-role']});
 let pending=false;function observeRecords(){const root=$('#akd-dashboard');if(!root)return false;new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;if(document.body.dataset.role==='count')receiving()})}).observe(root,{childList:true,subtree:true});return true}
 document.addEventListener('DOMContentLoaded',()=>{mount();if(!observeRecords()){const tryObserve=setInterval(()=>{if(observeRecords())clearInterval(tryObserve)},600)}timer=setInterval(()=>{if(!document.hidden&&active()&&['count','pre_receiving'].includes(document.body.dataset.role)){mount();refresh()}},15000);setInterval(()=>{if(document.hidden)return;document.querySelectorAll('.akpr-wait-time[data-akpr-start]').forEach(el=>{const end=el.dataset.akprEnd;const text=el.querySelector('strong');if(text)text.textContent=elapsedText(el.dataset.akprStart,end)})},30000)});
})();
