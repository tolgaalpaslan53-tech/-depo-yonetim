/* AKTİVA Sevkiyat Ön Kayıt - bağımsız ek modül; forklift/push kodu değiştirilmez. */
(()=>{'use strict';
 const $=s=>document.querySelector(s), E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let lastRole='',timer=0,loaded=false,editId=null;
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
 <div class="akpr-grid"><div class="akpr-card"><div class="akpr-muted">Bugünkü araç girişi</div><div class="akpr-stat" id="akpr-total">—</div></div><div class="akpr-card"><div class="akpr-muted">Mal Kabul bekleyen</div><div class="akpr-stat" id="akpr-pending">—</div></div></div>
 <div class="akpr-card"><h2 id="akpr-form-title" style="margin:0 0 8px;font-size:20px">Yeni Sevkiyat Kaydı</h2><form id="akpr-form"><div class="akpr-grid"><label class="akpr-label">Araç plakası *<input name="plate" maxlength="24" autocomplete="off" required placeholder="48 ABC 123"></label><label class="akpr-label">Gönderen firma *<input name="company" maxlength="120" required placeholder="Firma adı"></label><label class="akpr-label">Şoför adı<input name="driver" maxlength="100" placeholder="Ad soyad"></label><label class="akpr-label">İrsaliye numarası<input name="waybill" maxlength="100" placeholder="İrsaliye no"></label></div>
 <label class="akpr-label">İrsaliye fotoğrafı (en fazla 5 MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment"></label><label class="akpr-label">Not<textarea name="note" rows="2" maxlength="500" placeholder="Varsa açıklama"></textarea></label><div class="akpr-actions"><button class="akpr-btn primary" id="akpr-submit" type="submit">Kaydet ve Mal Kabule Gönder</button><button class="akpr-btn light" id="akpr-reset" type="reset">Temizle</button></div><div id="akpr-feedback" class="akpr-msg" role="status"></div></form></div>
 <div class="akpr-card"><div class="akpr-actions" style="justify-content:space-between"><h2 style="margin:0;font-size:20px">Oluşturduğum Ön Kayıtlar</h2><button type="button" class="akpr-btn light" id="akpr-refresh">Yenile</button></div><div id="akpr-list" class="akpr-muted">Kayıtlar yükleniyor…</div></div></section>`}
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
  editId=r.id;for(const [key,val] of Object.entries({plate:r.plate,company:r.company,driver:r.driver_name,waybill:r.waybill_number,note:r.notes})){
   if(f.elements.namedItem(key))f.elements.namedItem(key).value=val||'';
  }
  $('#akpr-form-title').textContent='Ön Kaydı Düzenle';$('#akpr-submit').textContent='Değişiklikleri Kaydet';
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
   const row={plate:String(fd.get('plate')||'').trim().toLocaleUpperCase('tr-TR'),company:String(fd.get('company')||'').trim(),driver_name:String(fd.get('driver')||'').trim(),waybill_number:String(fd.get('waybill')||'').trim(),notes:String(fd.get('note')||'').trim()};
   if(!row.plate||!row.company)throw Error('Plaka ve firma zorunludur.');
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
  for(const r of records){const x=document.createElement('div');x.className='akpr-row';x.innerHTML=`<div><strong>${E(r.plate)}</strong> · ${E(r.company)}<div class="akpr-muted">${stamp(r.created_at)} · ${E(r.driver_name||'Şoför belirtilmedi')} · İrsaliye: ${E(r.waybill_number||'—')}</div><div class="akpr-muted">${E(r.notes||'')}</div></div><div><span class="akpr-pill">${r.status==='waiting'?'Mal Kabul Bekliyor':r.status==='at_dock'?'Peronda':r.status==='completed'?'Tamamlandı':'İptal'}</span></div>`;
   const b=document.createElement('div');b.className='akpr-actions';
   if(r.photo_path){const v=document.createElement('button');v.type='button';v.className='akpr-btn light';v.textContent='📷 İrsaliyeyi Gör';v.onclick=async()=>{v.disabled=true;try{const url=await imageLink(r.photo_path);window.open(url,'_blank','noopener,noreferrer')}catch(e){alert(e.message)}finally{v.disabled=false}};b.append(v)}
   if(!receiving&&r.created_by===session?.user?.id&&r.status==='waiting'){
    const edit=document.createElement('button');edit.type='button';edit.className='akpr-btn light';edit.textContent='✏️ Düzenle';edit.onclick=()=>startEdit(r);b.append(edit);
    const cancel=document.createElement('button');cancel.type='button';cancel.className='akpr-btn akpr-danger';cancel.textContent='İptal Et';cancel.onclick=()=>cancelRecord(r);b.append(cancel);
   }
   if(receiving&&r.status==='waiting'){const btn=document.createElement('button');btn.type='button';btn.className='akpr-btn primary';btn.textContent='Perona Alındı';btn.onclick=async()=>{btn.disabled=true;try{await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id),{method:'PATCH',headers:{Prefer:'return=minimal'},json:{status:'at_dock'}});await refresh()}catch(e){alert(e.message);btn.disabled=false}};b.append(btn)}
   x.append(b);host.append(x)
  }
 }
 async function refresh(){if(!active())return;try{const records=await api('/rest/v1/'+table+'?select=id,created_by,plate,company,driver_name,waybill_number,notes,photo_path,status,created_at&order=created_at.desc&limit=100');
    if($('#akpr-list')){const mine=records.filter(r=>r.created_by===session?.user?.id);rows(mine,$('#akpr-list'),false);const todays=mine.filter(r=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.created_at))===today());$('#akpr-total').textContent=todays.length;$('#akpr-pending').textContent=todays.filter(r=>r.status==='waiting').length}
    cache=records;if($('#akpr-records-content'))drawReceiving(records);
   }catch(e){if($('#akpr-list'))$('#akpr-list').textContent='Kayıtlar alınamadı: '+e.message;if($('#akpr-records-content'))$('#akpr-records-content').textContent='Ön kayıtlar alınamadı: '+e.message}
 }
 let cache=[], homeOpen=false;
 function drawReceiving(records){
  cache=records;
  const host=$('#akpr-records-content');if(!host)return;
  const q=($('#akpr-record-search')?.value||'').toLocaleLowerCase('tr-TR').trim();
  const filtered=records.filter(r=>(r.plate+' '+r.company+' '+(r.waybill_number||'')).toLocaleLowerCase('tr-TR').includes(q));
  host.textContent='';rows(filtered,host,true);
  const badge=$('#akpr-record-count');if(badge)badge.textContent=filtered.length+' ön kayıt';
  const counter=$('#akpr-home-counter');if(counter)counter.textContent=records.filter(r=>r.status==='waiting').length+' bekleyen';
 }
 function closePre(){homeOpen=false;const root=$('#akd-dashboard');root?.classList.remove('akpr-home-open');}
 function openPre(){
  if(document.body.dataset.role!=='count')return;
  homeOpen=true;receiving();const root=$('#akd-dashboard');
  root?.classList.add('akpr-home-open');refresh();
 }
 function receiving(){
  const root=$('#akd-dashboard');if(!root||document.body.dataset.role!=='count')return;
  const actions=root.querySelector('.akd-actions');
  // Kart yalnız Mal Kabul ana sayfasında bulunur; çalışan kartlara müdahale edilmez.
  if(actions&&!actions.querySelector('#akpr-home-card')){
   const card=document.createElement('button');card.type='button';card.id='akpr-home-card';card.className='akd-action';
   card.innerHTML='<span class="akd-action-ico" aria-hidden="true">🚛</span><strong>Sevkiyat Ön Kayıt</strong><small>Gelen araçları ve irsaliyeleri incele</small><b aria-hidden="true">›</b>';
   card.addEventListener('click',openPre);actions.appendChild(card);
  }
  const content=root.querySelector('.akd-content');if(!content)return;
  if(!content.querySelector('#akpr-home-panel')){
   const panel=document.createElement('section');panel.id='akpr-home-panel';panel.setAttribute('aria-label','Sevkiyat Ön Kayıt');
   panel.innerHTML='<div class="akpr-page-head"><h1>Sevkiyat Ön Kayıt</h1><button type="button" id="akpr-back-home">← Ana Sayfa</button></div><p class="akpr-page-desc">Sevkiyat Kayıt Personeli tarafından oluşturulan kayıtlar</p><div class="akpr-home-box"><div class="akpr-pre-heading"><strong>Gelen Ön Kayıtlar</strong><span id="akpr-record-count"></span></div><input id="akpr-record-search" type="search" placeholder="Plaka, firma veya irsaliye ara" aria-label="Ön kayıtlarda ara"><div id="akpr-records-content" class="akpr-muted">Kayıtlar yükleniyor…</div></div>';
   content.appendChild(panel);
   panel.querySelector('#akpr-back-home').addEventListener('click',closePre);
   panel.querySelector('#akpr-record-search').addEventListener('input',()=>drawReceiving(cache));
   if(cache.length)drawReceiving(cache);
  }
  root.classList.toggle('akpr-home-open',homeOpen&&!!actions);
 }
 // Kullanıcı başka Mal Kabul ekranına geçtiğinde yeni panel kapanır.
 document.addEventListener('click',e=>{
  if(!homeOpen)return;
  if(e.target.closest('#akpr-home-card,#akpr-home-panel'))return;
  if(e.target.closest('[data-akd],.akd-nav'))closePre();
 },true);
 function mount(){const role=document.body.dataset.role;if(role==='pre_receiving'){
    const app=$('#app');if(!app||app.classList.contains('hidden'))return;
    if(!$('#ak-pre-receiving')){app.insertAdjacentHTML('beforeend',markup());$('#akpr-form').addEventListener('submit',create);$('#akpr-form').addEventListener('reset',()=>setTimeout(resetEditing,0));$('#akpr-refresh').onclick=refresh;$('#akpr-logout').onclick=()=>$('#logout')?.click();}
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
