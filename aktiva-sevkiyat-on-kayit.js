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
 const table='ak_sevkiyat_on_kayit';
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function markup(){return `<section id="ak-pre-receiving"><div class="akpr-head"><div><h1>📋 AKTİVA · Sevkiyat Ön Kayıt</h1><small>Sevkiyat Kayıt Personeli</small></div><button type="button" class="akpr-btn" id="akpr-logout">Çıkış</button></div>
 <div class="akpr-grid"><div class="akpr-card"><div class="akpr-muted">Bugünkü Ön Kayıt</div><div class="akpr-stat" id="akpr-total">—</div></div><div class="akpr-card"><div class="akpr-muted">Toplam Bekleyen Ön Kayıt</div><div class="akpr-stat" id="akpr-pending">—</div></div></div>
 <nav class="akpr-home-nav" id="akpr-home-nav" aria-label="Sevkiyat işlemleri"><button type="button" id="akpr-open-new" class="akpr-nav-card"><span class="akpr-nav-icon" aria-hidden="true">＋</span><strong>Yeni Sevkiyat Kaydı</strong><small>Gelen aracın ve irsaliyenin ön kaydını oluştur</small><span class="akpr-nav-arrow" aria-hidden="true">›</span></button><button type="button" id="akpr-open-list" class="akpr-nav-card"><span class="akpr-nav-icon" aria-hidden="true">▤</span><strong>Sevkiyat Kayıtlarım</strong><small>Oluşturduğun kayıtları gör, düzenle veya iptal et</small><span class="akpr-nav-arrow" aria-hidden="true">›</span></button></nav>
 <div class="akpr-card akpr-detail-view" id="akpr-new-view" hidden><div class="akpr-detail-head"><button type="button" class="akpr-btn light akpr-back" data-akpr-back>← Ana Sayfa</button></div><h2 id="akpr-form-title" style="margin:0 0 8px;font-size:20px">Yeni Sevkiyat Kaydı</h2><form id="akpr-form"><div class="akpr-grid"><label class="akpr-label">Araç plakası *<input name="plate" maxlength="24" autocomplete="off" required placeholder="48 ABC 123"></label><label class="akpr-label">Gönderen firma *<input name="company" maxlength="120" required placeholder="Firma adı"></label><label class="akpr-label">Şoför adı<input name="driver" maxlength="100" placeholder="Ad soyad"></label><label class="akpr-label">Şoför telefonu<input name="driver_phone" type="tel" inputmode="tel" maxlength="20" placeholder="05XX XXX XX XX"></label><label class="akpr-label">İrsaliye numarası<input name="waybill" maxlength="100" placeholder="İrsaliye no"></label></div>
 <div class="akpr-products"><h3>Sevkiyattaki Ürünler</h3><div id="akpr-products-list"></div><button type="button" id="akpr-add-product" class="akpr-btn light">＋ Ürün Ekle</button></div><label class="akpr-label">İrsaliye fotoğrafı (en fazla 5 MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment"></label><label class="akpr-label">Not<textarea name="note" rows="2" maxlength="500" placeholder="Varsa açıklama"></textarea></label><div class="akpr-actions"><button class="akpr-btn primary" id="akpr-submit" type="submit">Kaydet ve Mal Kabule Gönder</button><button class="akpr-btn light" id="akpr-reset" type="reset">Temizle</button></div><div id="akpr-feedback" class="akpr-msg" role="status"></div></form></div>
 <div class="akpr-card akpr-detail-view" id="akpr-list-view" hidden><div class="akpr-detail-head"><button type="button" class="akpr-btn light akpr-back" data-akpr-back>← Ana Sayfa</button></div><div class="akpr-actions" style="justify-content:space-between"><h2 style="margin:0;font-size:20px">Oluşturduğum Ön Kayıtlar</h2><button type="button" class="akpr-btn light" id="akpr-refresh">Yenile</button></div><div id="akpr-list" class="akpr-muted">Kayıtlar yükleniyor…</div></div></section>`}
 async function loadCatalog(){
  try{const rows=await api('/rest/v1/aktiva_excel_catalog?select=code,name&order=code.asc&limit=10000');catalogProducts=Array.isArray(rows)?rows.filter(x=>x.name):[]}
  catch(e){console.warn('Ön kayıt kataloğu okunamadı:',e);catalogProducts=[]}
  if(!catalogProducts.length){try{const r=await fetch('aktiva-urunler.json',{cache:'no-store'});if(r.ok){const rows=await r.json();if(Array.isArray(rows))catalogProducts=rows.filter(x=>x.name)}}catch(e){console.warn('Yerel katalog okunamadı:',e)}}
  renderProductDraft();
 }
 const blankProduct=()=>({code:'',name:'',quantity:'',unit:'koli'});
 function addProduct(){const p=readProducts();if(p.length){const old=p[activeProduct];if(!old?.name||!(Number(old.quantity)>0)){say('#akpr-feedback','Önce mevcut ürünün adını ve miktarını girin.',true);return}productDraft=p}productDraft.push(blankProduct());activeProduct=productDraft.length-1;renderProductDraft();$('#akpr-products-list [data-field="search"]')?.focus()}
 function renderProductDraft(){const host=$('#akpr-products-list');if(!host)return;const saved=productDraft.map((p,i)=>i===activeProduct?'':`<button type="button" class="akpr-saved-item" data-edit-product="${i}"><b>✓ Ürün ${i+1}: ${E(p.name||'Henüz girilmedi')}</b><span>${E(p.quantity)} ${E(p.unit)} · Düzenle ›</span></button>`).join('');const p=productDraft[activeProduct]||blankProduct();host.innerHTML=`<div class="akpr-saved-products">${saved}</div><div class="akpr-product-edit" data-line="${activeProduct}"><div class="akpr-line-head"><b>Ürün ${activeProduct+1} / ${productDraft.length}</b>${productDraft.length>1?`<button type="button" class="akpr-btn light" data-remove-product="${activeProduct}">Kaldır</button>`:''}</div><label>Ürün kataloğunda ara *<input data-field="search" type="search" autocomplete="off" value="${E(p.name)}" placeholder="Ürün adı veya koduyla ara"></label><div class="akpr-catalog-results" id="akpr-catalog-results"></div><label>Ürün kodu<input data-field="code" value="${E(p.code)}" readonly></label><label>Seçilen ürün *<input data-field="name" value="${E(p.name)}" required readonly placeholder="Katalogdan ürün seçin"></label><label>Miktar *<input data-field="quantity" type="number" min="0.001" step="any" value="${E(p.quantity)}" required></label><label>Birim<select data-field="unit"><option value="koli" ${p.unit==='koli'?'selected':''}>Koli</option><option value="adet" ${p.unit==='adet'?'selected':''}>Adet</option></select></label></div>`}
 function readProducts(){const all=productDraft.map(p=>({...p}));const line=$('#akpr-products-list [data-line]');if(line){const i=Number(line.dataset.line);all[i]={code:line.querySelector('[data-field="code"]').value.trim(),name:line.querySelector('[data-field="name"]').value.trim(),quantity:line.querySelector('[data-field="quantity"]').value,unit:line.querySelector('[data-field="unit"]').value}}return all}
 function resetProducts(){productDraft=[blankProduct()];activeProduct=0;renderProductDraft()}
 function catalogSearch(q){const host=$('#akpr-catalog-results');if(!host)return;const term=q.trim().toLocaleLowerCase('tr');if(!term){host.innerHTML='';return}const found=catalogProducts.filter(p=>String(p.code||'').toLocaleLowerCase('tr').includes(term)||String(p.name||'').toLocaleLowerCase('tr').includes(term)).slice(0,12);host.innerHTML=found.map(p=>`<button type="button" class="akpr-catalog-item" data-catalog-code="${E(p.code)}"><strong>${E(p.name)}</strong><small>${E(p.code)}</small></button>`).join('')||'<span class="akpr-muted">Katalogda ürün bulunamadı.</span>'}
 function setupProducts(){const host=$('#akpr-products-list');host?.addEventListener('input',e=>{if(e.target.matches('[data-field="search"]')){const line=$('#akpr-products-list [data-line]');line.querySelector('[data-field="name"]').value='';line.querySelector('[data-field="code"]').value='';catalogSearch(e.target.value)}});
 host?.addEventListener('click',e=>{const picked=e.target.closest('[data-catalog-code]');if(picked){const entry=catalogProducts.find(p=>String(p.code)===picked.dataset.catalogCode);if(!entry)return;const line=$('#akpr-products-list [data-line]');line.querySelector('[data-field="name"]').value=entry.name;line.querySelector('[data-field="code"]').value=entry.code;line.querySelector('[data-field="search"]').value=entry.name;$('#akpr-catalog-results').innerHTML='';line.querySelector('[data-field="quantity"]').focus();return}
 const edit=e.target.closest('[data-edit-product]');if(edit){productDraft=readProducts();activeProduct=Number(edit.dataset.editProduct);renderProductDraft();return}
 const remove=e.target.closest('[data-remove-product]');if(remove){productDraft=readProducts();productDraft.splice(Number(remove.dataset.removeProduct),1);if(!productDraft.length)productDraft=[blankProduct()];activeProduct=Math.min(activeProduct,productDraft.length-1);renderProductDraft()}});
 $('#akpr-add-product')?.addEventListener('click',addProduct);resetProducts();loadCatalog()}
 function showStaffView(view){
  const root=$('#ak-pre-receiving');if(!root)return;
  const nav=$('#akpr-home-nav'),create=$('#akpr-new-view'),list=$('#akpr-list-view');
  if(!nav||!create||!list)return;
  nav.hidden=view!=='home';create.hidden=view!=='new';list.hidden=view!=='list';
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
  if(btn)btn.textContent='Kaydet ve Mal Kabule Gönder';
 }
 function startEdit(r){
  if(document.body.dataset.role!=='pre_receiving'||r.created_by!==session?.user?.id||r.status!=='waiting')return;
  const f=$('#akpr-form');if(!f)return;
  editId=r.id;productDraft=(Array.isArray(r.products)?r.products:[]).map(x=>({...x}));if(!productDraft.length)productDraft=[blankProduct()];activeProduct=0;renderProductDraft();for(const [key,val] of Object.entries({plate:r.plate,company:r.company,driver:r.driver_name,driver_phone:r.driver_phone,waybill:r.waybill_number,note:r.notes})){
   if(f.elements.namedItem(key))f.elements.namedItem(key).value=val||'';
  }
  showStaffView('new');$('#akpr-form-title').textContent='Ön Kaydı Düzenle';$('#akpr-submit').textContent='Değişiklikleri Kaydet';
  say('#akpr-feedback','Fotoğrafı değiştirmek için yeni bir fotoğraf seçebilirsin.');
  f.scrollIntoView({behavior:'smooth',block:'start'});
 }
 async function cancelRecord(r){
  if(document.body.dataset.role!=='pre_receiving'||r.created_by!==session?.user?.id||r.status!=='waiting')return;
  if(!confirm(r.plate+' plakalı ön kaydı iptal etmek istiyor musun? Kayıt Mal Kabul aktif listesinden çıkar, geçmişte iptal edildi olarak kalır.'))return;
  try{await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id)+'&created_by=eq.'+encodeURIComponent(session.user.id)+'&status=eq.waiting',{
   method:'PATCH',headers:{Prefer:'return=representation'},json:{status:'cancelled'}
  }).then(result=>{if(!Array.isArray(result)||!result.length)throw Error('Kayıt değiştirilmedi; başka bir işlem yapılmış olabilir.')});
  if(editId===r.id){$('#akpr-form')?.reset();resetEditing()}
  await refresh();
  }catch(e){alert('İptal yapılamadı: '+e.message)}
 }
 async function create(ev){ev.preventDefault();const form=ev.currentTarget,fd=new FormData(form),btn=$('#akpr-submit');if(!btn)return;
  btn.disabled=true;say('#akpr-feedback',editId?'Güncelleniyor…':'Kaydediliyor…');
  try{
   const row={plate:String(fd.get('plate')||'').trim().toLocaleUpperCase('tr-TR'),company:String(fd.get('company')||'').trim(),driver_name:String(fd.get('driver')||'').trim(),driver_phone:String(fd.get('driver_phone')||'').trim(),waybill_number:String(fd.get('waybill')||'').trim(),notes:String(fd.get('note')||'').trim()};
   if(!row.plate||!row.company)throw Error('Plaka ve firma zorunludur.');
   const products=readProducts();if(products.some(x=>!['koli','adet'].includes(x.unit)))throw Error('Birim yalnızca adet veya koli olabilir.');if(!products.length||products.some(x=>!x.name||!Number.isFinite(x.quantity)||x.quantity<=0))throw Error('Her ürün için ad ve sıfırdan büyük miktar girin.');row.products=products;
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
   form.reset();resetEditing();resetProducts();await refresh();
  }catch(e){say('#akpr-feedback',e.message,true)}finally{btn.disabled=false}
 }
 async function imageLink(path){if(!path)return null;const p=path.split('/').map(encodeURIComponent).join('/');const d=await api('/storage/v1/object/sign/ak-sevkiyat-irsaliyeleri/'+p,{method:'POST',json:{expiresIn:300}});return cfg.url+d.signedURL}
 function rows(records,host,receiving){host.innerHTML=records.length?'':'<p class="akpr-muted">Bu listede kayıt bulunmuyor.</p>';
  for(const r of records){const x=document.createElement('div');x.className='akpr-row';x.innerHTML=`<div><strong>${E(r.plate)}</strong> · ${E(r.company)}<div class="akpr-muted">Geliş: ${stamp(r.created_at)} · ${E(r.driver_name||'Şoför belirtilmedi')} · İrsaliye: ${E(r.waybill_number||'—')}</div><div class="akpr-muted">${E(r.notes||'')}</div></div><div><span class="akpr-pill">${r.status==='waiting'?'Mal Kabul Bekliyor':r.status==='at_dock'?'Peronda':r.status==='counting'?'Sayım Devam Ediyor':r.status==='completed'?'Tamamlandı':'İptal'}</span></div>`;
   const b=document.createElement('div');b.className='akpr-actions';
   if(r.photo_path){const v=document.createElement('button');v.type='button';v.className='akpr-btn light';v.textContent='📷 İrsaliyeyi Gör';v.onclick=async()=>{v.disabled=true;try{const url=await imageLink(r.photo_path);window.open(url,'_blank','noopener,noreferrer')}catch(e){alert(e.message)}finally{v.disabled=false}};b.append(v)}
   if(!receiving&&r.created_by===session?.user?.id&&r.status==='waiting'){
    const edit=document.createElement('button');edit.type='button';edit.className='akpr-btn light';edit.textContent='✏️ Düzenle';edit.onclick=()=>startEdit(r);b.append(edit);
    const cancel=document.createElement('button');cancel.type='button';cancel.className='akpr-btn akpr-danger';cancel.textContent='İptal Et';cancel.onclick=()=>cancelRecord(r);b.append(cancel);
   }
   if(receiving&&['waiting','at_dock'].includes(r.status)){const open=document.createElement('button');open.type='button';open.className='akpr-btn primary';open.textContent='Sayımı Aç';open.onclick=()=>openCount(r);b.append(open);const btn=document.createElement('button');btn.type='button';btn.className='akpr-btn primary';btn.textContent='Perona Alındı';btn.onclick=async()=>{btn.disabled=true;try{await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id),{method:'PATCH',headers:{Prefer:'return=minimal'},json:{status:'at_dock'}});await refresh()}catch(e){alert(e.message);btn.disabled=false}};b.append(btn)}
   if(receiving&&r.status==='counting'){const resume=document.createElement('button');resume.type='button';resume.className='akpr-btn primary';resume.textContent='Sayıma Devam Et';resume.onclick=()=>openCount(r);b.append(resume)}
   x.append(b);host.append(x)
  }
 }
 const istanbulDate=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
 // Bekleyenler için tarih kısıtlaması yoktur. Supabase'in varsayılan 1000 satır sınırı
 // nedeniyle sonuçlar sayfalanır; eski bekleyen kayıtlar listeden düşmez.
 async function fetchRecords(){
  const all=[],pageSize=500;
  for(let offset=0;offset<10000;offset+=pageSize){
   const page=await api('/rest/v1/'+table+'?select=id,created_by,plate,company,driver_name,driver_phone,waybill_number,notes,photo_path,status,created_at,products,count_results,counted_at&order=created_at.desc&limit='+pageSize+'&offset='+offset);
   if(!Array.isArray(page))throw Error('Ön kayıt listesi okunamadı.');
   all.push(...page);if(page.length<pageSize)return all;
  }
  throw Error('Kayıt sayısı listeleme sınırını aştı. Eksik liste gösterilmiyor.');
 }
 async function refresh(){if(!active())return;try{
   const records=await fetchRecords();cache=records;
   const mine=records.filter(r=>r.created_by===session?.user?.id);
   if($('#akpr-list'))rows(mine,$('#akpr-list'),false);
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
 function applySource(){
  const root=$('#akd-dashboard');if(!root)return;
  root.classList.toggle('akpr-show-only-pre',source==='pre');
  root.classList.toggle('akpr-hide-pre',source==='mal');
  root.querySelectorAll('[data-akpr-source]').forEach(btn=>{const selected=btn.dataset.akprSource===source;btn.classList.toggle('akpr-selected',selected);btn.setAttribute('aria-pressed',String(selected))});
 }
 function countOverlay(){let el=$('#akpr-count-overlay');if(!el){el=document.createElement('section');el.id='akpr-count-overlay';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Sevkiyat ürün sayımı');el.hidden=true;document.body.append(el);el.addEventListener('click',countClick);el.addEventListener('input',countInput);}return el}
 function closeCount(){counting=null;countOverlay().hidden=true;document.body.classList.remove('akpr-count-open');source='pre';applySource();refresh()}
 function openCount(r){if(document.body.dataset.role!=='count'||!['waiting','at_dock','counting'].includes(r.status))return;const products=Array.isArray(r.products)?r.products:[];if(!products.length){alert('Bu ön kayıtta ürün bilgisi bulunmuyor. Sevkiyat Kayıt Personeli ürünleri eklemeli.');return}counting={id:r.id,plate:r.plate,company:r.company,products,results:Array.isArray(r.count_results)?r.count_results.map(x=>({...x})):[]};while(counting.results.length<products.length){const p=products[counting.results.length];counting.results.push({actual:String(p.quantity),damaged:'0',note:''})}countIndex=0;countOverlay().hidden=false;document.body.classList.add('akpr-count-open');renderCount()}
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
 function mount(){const role=document.body.dataset.role;if(role==='pre_receiving'){
    const app=$('#app');if(!app||app.classList.contains('hidden'))return;
    if(!$('#ak-pre-receiving')){app.insertAdjacentHTML('beforeend',markup());$('#akpr-form').addEventListener('submit',create);setupProducts();$('#akpr-form').addEventListener('reset',()=>setTimeout(()=>{resetEditing();resetProducts()},0));$('#akpr-refresh').onclick=refresh;$('#akpr-logout').onclick=()=>$('#logout')?.click();$('#akpr-open-new').onclick=()=>{resetEditing();$('#akpr-form')?.reset();showStaffView('new')};$('#akpr-open-list').onclick=()=>showStaffView('list');document.querySelectorAll('#ak-pre-receiving [data-akpr-back]').forEach(b=>b.addEventListener('click',()=>{resetEditing();$('#akpr-form')?.reset();showStaffView('home')}));}
    if(lastRole!==role)refresh();
   }else if(role==='count'){
    receiving();if(lastRole!==role)refresh();
   }
   lastRole=role;
 }
 document.addEventListener('aktiva:session-changed',()=>{lastRole='';setTimeout(mount,20)});
 new MutationObserver(()=>{if(['count','pre_receiving'].includes(document.body.dataset.role))mount()}).observe(document.body,{attributes:true,attributeFilter:['data-role']});
 let pending=false;function observeRecords(){const root=$('#akd-dashboard');if(!root)return false;new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;if(document.body.dataset.role==='count')receiving()})}).observe(root,{childList:true,subtree:true});return true}
 document.addEventListener('DOMContentLoaded',()=>{mount();if(!observeRecords()){const tryObserve=setInterval(()=>{if(observeRecords())clearInterval(tryObserve)},600)}timer=setInterval(()=>{if(!document.hidden&&active()&&['count','pre_receiving'].includes(document.body.dataset.role)){mount();refresh()}},15000)});
})();
