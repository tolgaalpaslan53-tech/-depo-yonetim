/* AKTİVA Sevkiyat Ön Kayıt - bağımsız ek modül; forklift/push kodu değiştirilmez. */
(()=>{'use strict';
 const $=s=>document.querySelector(s), E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let lastRole='',timer=0,loaded=false;
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
 <div class="akpr-card"><h2 style="margin:0 0 8px;font-size:20px">Yeni Sevkiyat Kaydı</h2><form id="akpr-form"><div class="akpr-grid"><label class="akpr-label">Araç plakası *<input name="plate" maxlength="24" autocomplete="off" required placeholder="48 ABC 123"></label><label class="akpr-label">Gönderen firma *<input name="company" maxlength="120" required placeholder="Firma adı"></label><label class="akpr-label">Şoför adı<input name="driver" maxlength="100" placeholder="Ad soyad"></label><label class="akpr-label">İrsaliye numarası<input name="waybill" maxlength="100" placeholder="İrsaliye no"></label></div>
 <label class="akpr-label">İrsaliye fotoğrafı (en fazla 5 MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment"></label><label class="akpr-label">Not<textarea name="note" rows="2" maxlength="500" placeholder="Varsa açıklama"></textarea></label><div class="akpr-actions"><button class="akpr-btn primary" id="akpr-submit" type="submit">Kaydet ve Mal Kabule Gönder</button><button class="akpr-btn light" type="reset">Temizle</button></div><div id="akpr-feedback" class="akpr-msg" role="status"></div></form></div>
 <div class="akpr-card"><div class="akpr-actions" style="justify-content:space-between"><h2 style="margin:0;font-size:20px">Gelen Sevkiyatlar</h2><button type="button" class="akpr-btn light" id="akpr-refresh">Yenile</button></div><div id="akpr-list" class="akpr-muted">Kayıtlar yükleniyor…</div></div></section>`}
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
 async function create(ev){ev.preventDefault();const form=ev.currentTarget,fd=new FormData(form),btn=$('#akpr-submit');if(!btn)return;
  btn.disabled=true;say('#akpr-feedback','Kaydediliyor…');let photo=null;
  try{photo=await upload(fd.get('photo')?.size?fd.get('photo'):null);
   const row={plate:String(fd.get('plate')||'').trim().toLocaleUpperCase('tr-TR'),company:String(fd.get('company')||'').trim(),driver_name:String(fd.get('driver')||'').trim(),waybill_number:String(fd.get('waybill')||'').trim(),notes:String(fd.get('note')||'').trim(),photo_path:photo};
   if(!row.plate||!row.company)throw Error('Plaka ve firma zorunludur.');
   await api('/rest/v1/'+table,{method:'POST',headers:{Prefer:'return=minimal'},json:row});form.reset();say('#akpr-feedback','Sevkiyat kaydedildi ve Mal Kabul ekranına aktarıldı.');await refresh();
  }catch(e){say('#akpr-feedback',e.message,true)}finally{btn.disabled=false}
 }
 async function imageLink(path){if(!path)return null;const p=path.split('/').map(encodeURIComponent).join('/');const d=await api('/storage/v1/object/sign/ak-sevkiyat-irsaliyeleri/'+p,{method:'POST',json:{expiresIn:300}});return cfg.url+d.signedURL}
 function rows(records,host,receiving){host.innerHTML=records.length?'':'<p class="akpr-muted">Bu listede kayıt bulunmuyor.</p>';
  for(const r of records){const x=document.createElement('div');x.className='akpr-row';x.innerHTML=`<div><strong>${E(r.plate)}</strong> · ${E(r.company)}<div class="akpr-muted">${stamp(r.created_at)} · ${E(r.driver_name||'Şoför belirtilmedi')} · İrsaliye: ${E(r.waybill_number||'—')}</div><div class="akpr-muted">${E(r.notes||'')}</div></div><div><span class="akpr-pill">${r.status==='waiting'?'Mal Kabul Bekliyor':r.status==='at_dock'?'Peronda':r.status==='completed'?'Tamamlandı':'İptal'}</span></div>`;
   const b=document.createElement('div');b.className='akpr-actions';
   if(r.photo_path){const v=document.createElement('button');v.type='button';v.className='akpr-btn light';v.textContent='📷 İrsaliyeyi Gör';v.onclick=async()=>{v.disabled=true;try{const url=await imageLink(r.photo_path);window.open(url,'_blank','noopener,noreferrer')}catch(e){alert(e.message)}finally{v.disabled=false}};b.append(v)}
   if(receiving&&r.status==='waiting'){const btn=document.createElement('button');btn.type='button';btn.className='akpr-btn primary';btn.textContent='Perona Alındı';btn.onclick=async()=>{btn.disabled=true;try{await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id),{method:'PATCH',headers:{Prefer:'return=minimal'},json:{status:'at_dock'}});await refresh()}catch(e){alert(e.message);btn.disabled=false}};b.append(btn)}
   x.append(b);host.append(x)
  }
 }
 async function refresh(){if(!active())return;try{const records=await api('/rest/v1/'+table+'?select=id,plate,company,driver_name,waybill_number,notes,photo_path,status,created_at&order=created_at.desc&limit=100');
    if($('#akpr-list')){rows(records,$('#akpr-list'),false);const todays=records.filter(r=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.created_at))===today());$('#akpr-total').textContent=todays.length;$('#akpr-pending').textContent=todays.filter(r=>r.status==='waiting').length}
    if($('#akpr-receiving-list'))rows(records,$('#akpr-receiving-list'),true);
   }catch(e){if($('#akpr-list'))$('#akpr-list').textContent='Kayıtlar alınamadı: '+e.message;if($('#akpr-receiving-list'))$('#akpr-receiving-list').textContent='Kayıtlar alınamadı: '+e.message}
 }
 function receiving(){if($('#akpr-receiving-panel')||!document.querySelector('#akd-dashboard'))return;
  const panel=document.createElement('section');panel.id='akpr-receiving-panel';panel.innerHTML='<div class="akpr-actions" style="justify-content:space-between"><h3>🚚 Sevkiyat Ön Kayıt · Bekleyen Araçlar</h3><button class="akpr-btn light" type="button" id="akpr-receiving-refresh">Yenile</button></div><div id="akpr-receiving-list" class="akpr-muted">Yükleniyor…</div>';
  const target=$('#akd-dashboard');target.prepend(panel);panel.querySelector('button').onclick=refresh;
 }
 function mount(){const role=document.body.dataset.role;if(role==='pre_receiving'){
    const app=$('#app');if(!app||app.classList.contains('hidden'))return;
    if(!$('#ak-pre-receiving')){app.insertAdjacentHTML('beforeend',markup());$('#akpr-form').addEventListener('submit',create);$('#akpr-refresh').onclick=refresh;$('#akpr-logout').onclick=()=>$('#logout')?.click();}
    if(lastRole!==role)refresh();
   }else if(role==='count'){
    receiving();if(lastRole!==role)refresh();
   }
   lastRole=role;
 }
 document.addEventListener('aktiva:session-changed',()=>{lastRole='';setTimeout(mount,20)});
 new MutationObserver(()=>{if(['count','pre_receiving'].includes(document.body.dataset.role))mount()}).observe(document.body,{attributes:true,attributeFilter:['data-role']});
 document.addEventListener('DOMContentLoaded',()=>{mount();timer=setInterval(()=>{if(!document.hidden&&active()&&['count','pre_receiving'].includes(document.body.dataset.role)){mount();refresh()}},15000)});
})();
