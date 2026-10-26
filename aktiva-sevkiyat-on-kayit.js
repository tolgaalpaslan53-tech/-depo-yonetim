/* AKTİVA Sevkiyat Ön Kayıt - bağımsız ek modül; forklift/push kodu değiştirilmez. */
(()=>{'use strict';
 const $=s=>document.querySelector(s), E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let lastRole='',timer=0,loaded=false,editId=null,source='all',lastHost=null,productDraft=[],counting=null,countIndex=0,countBusy=false,activeProduct=0,catalogProducts=[]; 
 const allowed=()=>typeof profile!=='undefined' && ['pre_receiving','count','admin'].includes(profile?.role);
 const active=()=>typeof session!=='undefined'&&!!session?.access_token&&allowed();
 const base=()=>typeof cfg!=='undefined'?cfg:null;
 // Danışma talepleri ana uygulamanın oturum yenilemesini kullanır.
 // Aynı anda birden fazla isteğin refresh token yarışına girmesi önlenir.
 let danismaRefreshPromise=null;
 const expiredAuth=e=>/jwt expired|invalid jwt|token.*expired|expired.*token/i.test(String(e||''));
 async function ensureDanismaSession(force=false){
   if(!session?.refresh_token)throw Error('Oturum sona erdi. Bilgileriniz korunuyor; tekrar giriş yapın.');
   const expires=Number(session.expires_at)||0;
   if(!force&&expires&&expires>Date.now()/1000+90)return;
   if(!force&&!expires)return; // Eski oturumlar 401 üzerine yenilenir.
   if(!danismaRefreshPromise){
     danismaRefreshPromise=(async()=>{
       if(typeof refreshToken!=='function')throw Error('Oturum yenileme kullanılamıyor.');
       const ok=await refreshToken();
       if(!ok)throw Error('Oturum yenilenemedi. Bilgileriniz korunuyor; tekrar giriş yapın.');
     })().finally(()=>{danismaRefreshPromise=null});
   }
   return danismaRefreshPromise;
 }
 async function api(path,opt={}){
   if(!active()||!base()?.url||!base()?.key)throw Error('Oturum sona erdi. Bilgileriniz korunuyor; tekrar giriş yapın.');
   await ensureDanismaSession();
   // Yalnızca doğrulanmış yetkilendirme hatası sonrası bir kere tekrarlanır.
   for(let attempt=0;attempt<2;attempt++){
     const token=session?.access_token;
     if(!token)throw Error('Oturum sona erdi. Bilgileriniz korunuyor; tekrar giriş yapın.');
     const h={'apikey':cfg.key,'Authorization':'Bearer '+token,...(opt.headers||{})};
     if(opt.json!==undefined)h['Content-Type']='application/json';
     const r=await fetch(cfg.url+path,{method:opt.method||'GET',headers:h,body:opt.json===undefined?opt.body:JSON.stringify(opt.json)});
     const t=await r.text();let v;try{v=JSON.parse(t)}catch{v=t}
     if(r.ok)return v;
     const err=v?.message||v?.error_description||v?.error||('İstek başarısız: '+r.status);
     if(attempt===0&&r.status===401&&expiredAuth(err)){
       await ensureDanismaSession(true);
       continue;
     }
     if(r.status===401)throw Error('Oturum doğrulanamadı. Bilgileriniz korunuyor; tekrar giriş yapın.');
     throw Error(err);
   }
 }

 const stamp=t=>t?new Date(t).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'—';
 const elapsedText=(start,end)=>{
   const a=Date.parse(start||''),b=end?Date.parse(end):Date.now();
   if(!Number.isFinite(a)||!Number.isFinite(b))return '—';
   const total=Math.max(0,Math.floor((b-a)/60000));
   return (Math.floor(total/1440)?Math.floor(total/1440)+' gün ':'')+Math.floor(total%1440/60)+' sa '+(total%60)+' dk';
 };
 const normalized=v=>String(v||'').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g,' ');
 const cleanPlate=v=>normalized(v).replace(/[^A-Z0-9]/g,'');
 const duplicateInYard=(records,row,except)=>!!cleanPlate(row.plate)&&records.find(r=>r.id!==except&&r.status!=='cancelled'&&!r.departed_at&&cleanPlate(r.plate)===cleanPlate(row.plate));
 const online=()=>navigator.onLine;
 const draftKey='aktiva_danisma_form_draft_v2';
 let cache=[],driverSuggestions=[];
 function driverLookup(){const f=$('#akpr-form'),host=$('#akpr-driver-suggestions');if(!f||!host)return;
  const q=String(f.elements.driver.value||'').trim().toLocaleLowerCase('tr-TR');if(q.length<2){host.innerHTML='';return}
  const found=[],seen=new Set();for(const r of cache){if(!r.driver_name||!r.driver_phone||!r.driver_name.toLocaleLowerCase('tr-TR').includes(q))continue;const key=normalized(r.driver_name)+'|'+r.driver_phone;if(seen.has(key))continue;seen.add(key);found.push(r);if(found.length===6)break}
  driverSuggestions=found;
  host.innerHTML=found.length?'<div style="display:grid;gap:5px;margin-top:6px">'+found.map((r,i)=>'<button type="button" class="akpr-btn light" data-driver-index="'+i+'">'+E(r.driver_name)+' · '+E(r.driver_phone)+'</button>').join('')+'</div>':'';
 }
 function networkStatus(){const el=$('#akpr-network-status');if(el)el.textContent=online()?'● İnternet bağlantısı mevcut':'● Çevrimdışı: Bilgileri taslak olarak koruyoruz, sunucuya kayıt yapılamaz.'}
 function saveDraft(){const f=$('#akpr-form');if(!f||editId)return;try{const keys=['plate','company','driver','driver_phone','waybill','note','arrival_at'],data={};for(const k of keys)data[k]=f.elements.namedItem(k)?.value||'';sessionStorage.setItem(draftKey,JSON.stringify(data))}catch{}}
 function restoreDraft(){try{const raw=sessionStorage.getItem(draftKey);if(!raw)return;const values=JSON.parse(raw),f=$('#akpr-form');if(!f)return;for(const [k,v] of Object.entries(values))if(f.elements.namedItem(k))f.elements.namedItem(k).value=String(v||'')}catch{}}


 const table='ak_sevkiyat_on_kayit';
 const recordNo=r=>'DK-'+String((r.created_at||'').slice(0,4)||new Date().getFullYear())+'-'+String(r.id||'').replace(/-/g,'').slice(0,10).toUpperCase();
 const localInput=t=>{if(!t)return '';const d=new Date(t);if(!Number.isFinite(d.getTime()))return '';return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(' ','T')};
 const parseLocal=v=>v?new Date(v).toISOString():null;
 const recordedArrival=r=>r.arrival_at||r.created_at;
 // Türkiye sabit UTC+03:00: manuel girilen saat cihazın saat diliminden etkilenmez.
 const manualTime=raw=>{if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(raw||''))return null;const d=new Date(raw+':00+03:00');return Number.isFinite(d.getTime())&&localInput(d.toISOString())===raw?d.toISOString():null};
 const requestTime=(caption,defaultTime)=>{const entered=prompt(caption+'\nTürkiye saati (YYYY-AA-GG SS:DD):',localInput(defaultTime||new Date().toISOString()).replace('T',' '));if(entered===null)return null;const timestamp=manualTime(entered.trim().replace(' ','T'));if(!timestamp){alert('Geçerli tarih ve saat girin. Örnek: 2026-10-24 15:30');return null}return timestamp};
 const isQr=r=>r.registration_source==='qr';
 const canEditRecord=r=>document.body.dataset.role==='pre_receiving'&&(isQr(r)||r.created_by===session?.user?.id);
 const ownerFilter=r=>isQr(r)?'':'&created_by=eq.'+encodeURIComponent(session.user.id);
 const qrAction=(r,action,extra={})=>api('/rest/v1/rpc/ak_danisma_qr_action',{method:'POST',json:{p_record_id:r.id,p_action:action,p_note:extra.note??null,p_time:extra.time??null}}).then(v=>{if(v!==true)throw Error('QR kaydı güncellenemedi.');return [r]});

 const fmtMinutes=n=>Number.isFinite(n)?Math.round(n)+' dk':'—';
 const duration=(a,b)=>a&&b?Math.max(0,(Date.parse(b)-Date.parse(a))/60000):null;
 const statusText=r=>r.status==='cancelled'?'İptal edildi':r.departed_at?'Çıkış yaptı':r.status==='completed'?'Tamamlandı':r.status==='counting'?'Sayım devam ediyor':r.status==='at_dock'?'Perona Gönderildi':'Bekliyor';

 // Danışma bekleme uyarıları: Supabase üzerinde tüm danışma cihazları için ortak ayarlar.
 let waitThresholds={yellow:1,red:3};
 async function loadWaitThresholds(){
  if(document.body.dataset.role!=='pre_receiving')return;
  try{const rows=await api('/rest/v1/ak_danisma_wait_settings?id=eq.1&select=yellow_hours,red_hours');
   const a=rows?.[0];if(a&&Number(a.yellow_hours)>0&&Number(a.red_hours)>Number(a.yellow_hours)){
    waitThresholds={yellow:Number(a.yellow_hours),red:Number(a.red_hours)};
    if($('#akpr-yellow-hours'))$('#akpr-yellow-hours').value=waitThresholds.yellow;
    if($('#akpr-red-hours'))$('#akpr-red-hours').value=waitThresholds.red;
    applyWaitWarnings();
   }
  }catch(e){const msg=$('#akpr-settings-msg');if(msg)msg.textContent='Ayarlar okunamadı. SQL kurulumunu ve bağlantıyı kontrol edin: '+e.message;}
 }
 function applyWaitWarnings(){
  if(document.body.dataset.role!=='pre_receiving')return;
  document.querySelectorAll('#akpr-list .akpr-row').forEach(row=>{
   const el=row.querySelector('.akpr-wait-time');if(!el)return;
   const badge=row.querySelector('.akpr-wait-warning');badge?.remove();
   row.classList.remove('akpr-warning-yellow','akpr-warning-red');
   if(row.dataset.vehicleState!=='outside')return;
   const started=Date.parse(el.dataset.akprStart);if(!Number.isFinite(started))return;
   const hours=Math.max(0,(Date.now()-started)/3600000);
   const severity=hours>=waitThresholds.red?'red':hours>=waitThresholds.yellow?'yellow':null;
   if(!severity)return;
   row.classList.add('akpr-warning-'+severity);
   const tag=document.createElement('span');tag.className='akpr-wait-warning '+severity;
   tag.textContent=severity==='red'?'Uzun bekleme':'Bekleme uyarısı';
   row.querySelector('.akpr-vehicle-top')?.append(tag);
  });
 }
 async function saveWaitThresholds(){
  const y=Number($('#akpr-yellow-hours')?.value),r=Number($('#akpr-red-hours')?.value);
  if(!Number.isSafeInteger(y)||!Number.isSafeInteger(r)||y<1||r<=y){say('#akpr-settings-msg','Pozitif tam saatler girin. Kırmızı süre sarıdan büyük olmalı.',true);return;}
  const btn=$('#akpr-save-settings');btn.disabled=true;
  try{await api('/rest/v1/ak_danisma_wait_settings?id=eq.1',{method:'PATCH',headers:{'Prefer':'return=representation'},json:{yellow_hours:y,red_hours:r}}).then(rows=>{if(!Array.isArray(rows)||rows.length!==1)throw Error('Ayarlar kaydedilemedi; yetki veya SQL kurulumunu kontrol edin.')});
   waitThresholds={yellow:y,red:r};applyWaitWarnings();say('#akpr-settings-msg','Ayarlar tüm Danışma cihazları için kaydedildi.');
  }catch(e){say('#akpr-settings-msg','Kaydedilemedi: '+e.message,true)}finally{btn.disabled=false}
 }
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function markup(){return `<section id="ak-pre-receiving"><div class="akpr-head"><div><h1>📋 AKTİVA · Danışma</h1><div class="akpr-user"><strong id="akpr-user-name">Danışma Personeli</strong><small class="akpr-user-role">Danışma Personeli</small></div></div><button type="button" class="akpr-btn" id="akpr-logout">Çıkış</button></div>
 <p class="akpr-muted" id="akpr-network-status" role="status" style="margin:4px 2px 12px"></p>
 <nav class="akpr-home-nav" id="akpr-home-nav" aria-label="Sevkiyat işlemleri" style="margin:0 0 14px"><button type="button" id="akpr-open-new" class="akpr-nav-card" style="min-height:146px"><span class="akpr-nav-icon" aria-hidden="true">＋</span><strong>Yeni Araç Kaydı</strong><small>Gelen aracın ve irsaliyenin ön kaydını oluştur</small><span class="akpr-nav-arrow" aria-hidden="true">›</span></button><button type="button" id="akpr-open-qr" class="akpr-nav-card" style="min-height:146px"><span class="akpr-nav-icon" aria-hidden="true">▦</span><strong>Şoför QR Kodu</strong><small>A4 çıktısını görüntüle ve yazdır</small><span class="akpr-nav-arrow" aria-hidden="true">›</span></button><button type="button" id="akpr-open-list" class="akpr-nav-card" style="min-height:146px"><span class="akpr-nav-icon" aria-hidden="true">▤</span><strong>Araç Kayıtları</strong><small>Araç kayıtlarını ve QR başvurularını yönet</small><span class="akpr-nav-arrow" aria-hidden="true">›</span></button></nav>
 <div class="akpr-grid akpr-compact-status akpr-five-stats" id="akpr-live-status" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 14px"><div class="akpr-card akpr-mini-card" style="padding:14px 15px;margin:0"><div class="akpr-muted">Bugünkü Ön Kayıt</div><div class="akpr-stat" id="akpr-total">—</div></div><div class="akpr-card akpr-mini-card" style="padding:14px 15px;margin:0"><div class="akpr-muted">Bugün Depoya Giren</div><div class="akpr-stat" id="akpr-in-dock" style="font-size:22px">—</div></div><div class="akpr-card akpr-mini-card" style="padding:14px 15px;margin:0"><div class="akpr-muted">Dışarıda Bekleyenler</div><div class="akpr-stat" id="akpr-queue" style="font-size:22px">—</div></div><div class="akpr-card akpr-mini-card" style="padding:14px 15px;margin:0"><div class="akpr-muted">Depodaki Araçlar</div><div class="akpr-stat" id="akpr-onsite" style="font-size:22px">—</div></div><div class="akpr-card akpr-mini-card" style="padding:14px 15px;margin:0"><div class="akpr-muted">Bugün Çıkış Yapanlar</div><div class="akpr-stat" id="akpr-done" style="font-size:22px">—</div></div></div><button type="button" id="akpr-open-report" class="akpr-btn light alt akpr-report-shortcut">📊 Excel Raporları</button><button type="button" id="akpr-open-settings" class="akpr-btn light alt akpr-report-shortcut">⚙ Ayarlar</button>
 <div class="akpr-card akpr-detail-view" id="akpr-settings-view" hidden><div class="akpr-detail-head"><button type="button" class="akpr-btn light akpr-back" data-akpr-back>← Ana Sayfa</button></div><h2>Danışma Ayarları</h2><p class="akpr-muted">Danışma işlemleriyle ilgili ayarları buradan yönetin.</p><button type="button" class="akpr-settings-option" id="akpr-open-wait-settings"><span class="akpr-settings-option-icon">◷</span><span class="akpr-settings-option-copy"><strong>Araç Bekleme Süresi</strong><small>Sarı ve kırmızı bekleme uyarılarını düzenleyin</small></span><span aria-hidden="true">›</span></button></div><div class="akpr-card akpr-detail-view" id="akpr-wait-settings-view" hidden><div class="akpr-detail-head"><button type="button" class="akpr-btn light akpr-back" id="akpr-wait-settings-back">← Ayarlar</button></div><h2>Araç Bekleme Süresi</h2><p class="akpr-muted">Dışarıda bekleyen araçların uyarı başlangıçlarını saat cinsinden belirleyin.</p><div class="akpr-grid"><label class="akpr-label">Sarı uyarı başlangıcı (saat)<input id="akpr-yellow-hours" type="number" inputmode="numeric" min="1" step="1" value="1"></label><label class="akpr-label">Kırmızı uyarı başlangıcı (saat)<input id="akpr-red-hours" type="number" inputmode="numeric" min="2" step="1" value="3"></label></div><button type="button" class="akpr-btn primary" id="akpr-save-settings">Ayarları Kaydet</button><p class="akpr-muted" id="akpr-settings-msg" role="status"></p></div>
 <div class="akpr-card akpr-detail-view" id="akpr-report-view" hidden><div class="akpr-detail-head"><button type="button" class="akpr-btn light alt akpr-back" data-akpr-back>← Ana Sayfa</button></div><h2>Danışma Excel Raporları</h2><p class="akpr-muted">Tarih aralığındaki bekleyen, perondaki, tamamlanan, çıkış yapan ve iptal edilen kayıtları indir.</p><div class="akpr-grid"><label>Başlangıç tarihi<input id="akpr-excel-start" type="date"></label><label>Bitiş tarihi<input id="akpr-excel-end" type="date"></label></div><label>Kayıt durumu<select id="akpr-excel-status"><option value="all">Tüm araçlar</option><option value="waiting">Bekleyenler</option><option value="completed">Tamamlananlar</option><option value="cancelled">İptal edilenler</option></select></label><button type="button" class="akpr-btn" id="akpr-export">Excel (.xlsx) İndir</button><p class="akpr-muted" id="akpr-export-msg" role="status"></p></div>
 <div class="akpr-card akpr-detail-view" id="akpr-new-view" hidden><div class="akpr-detail-head"><button type="button" class="akpr-btn light akpr-back" data-akpr-back>← Ana Sayfa</button></div><h2 id="akpr-form-title" style="margin:0 0 8px;font-size:20px">Yeni Araç Kaydı</h2><p class="akpr-muted">Tüm bilgiler isteğe bağlıdır. Kayıt saati otomatik alınır.</p><form id="akpr-form"><div class="akpr-grid"><label class="akpr-label">Araç plakası (isteğe bağlı)<input name="plate" maxlength="24" autocomplete="off" placeholder="48 ABC 123"></label><label class="akpr-label">Gönderen firma (isteğe bağlı)<input name="company" maxlength="120" placeholder="Firma adı"></label><label class="akpr-label">Şoför adı<input name="driver" maxlength="100" autocomplete="off" placeholder="Ad soyad"><span id="akpr-driver-suggestions" class="akpr-muted" aria-live="polite"></span></label><label class="akpr-label">Şoför telefonu<input name="driver_phone" type="tel" inputmode="tel" maxlength="20" placeholder="05XX XXX XX XX"></label><label class="akpr-label">İrsaliye numarası<input name="waybill" maxlength="100" placeholder="İrsaliye no"></label></div><label class="akpr-label">Gerçek araç geliş tarihi ve saati (isteğe bağlı)<input name="arrival_at" type="datetime-local"></label><label class="akpr-label">İrsaliye fotoğrafı (en fazla 5 MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment"></label><label class="akpr-label">Not<textarea name="note" rows="2" maxlength="500" placeholder="Varsa açıklama"></textarea></label><div class="akpr-actions"><button class="akpr-btn primary" id="akpr-submit" type="submit">Araç Kaydını Oluştur</button><button class="akpr-btn light" id="akpr-reset" type="reset">Temizle</button></div><div id="akpr-feedback" class="akpr-msg" role="status"></div></form></div>
 <div class="akpr-card akpr-detail-view" id="akpr-list-view" hidden><div class="akpr-detail-head"><button type="button" class="akpr-btn light akpr-back" data-akpr-back>← Ana Sayfa</button></div><div class="akpr-actions" style="justify-content:space-between"><h2 style="margin:0;font-size:20px">Araç Kayıtları</h2><button type="button" class="akpr-btn light" id="akpr-refresh">Yenile</button></div><label class="akpr-label akpr-search-label">Araç ara<input id="akpr-search" type="search" autocomplete="off" placeholder="Plaka, firma, şoför veya irsaliye numarası"></label><div class="akpr-filter-bar" role="group" aria-label="Kayıt türü"><button type="button" class="akpr-filter-tab is-active" data-akpr-tab="active">Aktif</button><button type="button" class="akpr-filter-tab" data-akpr-tab="exited">Geçmiş</button><button type="button" class="akpr-filter-tab" data-akpr-tab="all">Tümü</button></div><label class="akpr-label akpr-advanced-filter">Detaylı filtre<select id="akpr-filter"><option value="active">Aktif araçlar</option><option value="exited">Geçmiş kayıtlar (çıkış yapanlar)</option><option value="all">Tüm kayıtlar</option><option value="missing">Eksik bilgili kayıtlar</option><option value="open">Depodaki araçlar</option><option value="waiting">Dışarıda bekleyenler</option><option value="exited">Çıkış yapanlar</option><option value="previous">Önceki günlerden bekleyenler</option></select></label><div id="akpr-history-dates" style="display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0"><label class="akpr-label">Başlangıç tarihi<input id="akpr-history-start" type="date"></label><label class="akpr-label">Bitiş tarihi<input id="akpr-history-end" type="date"></label></div><div id="akpr-list" class="akpr-muted">Kayıtlar yükleniyor…</div></div></section>`}
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
  const nav=$('#akpr-home-nav'),stats=$('#akpr-live-status'),create=$('#akpr-new-view'),list=$('#akpr-list-view'),report=$('#akpr-report-view'),shortcut=$('#akpr-open-report'),settings=$('#akpr-settings-view'),waitSettings=$('#akpr-wait-settings-view'),settingsShortcut=$('#akpr-open-settings');
  if(!nav||!create||!list)return;
  document.body.classList.toggle('akpr-settings-fullscreen',view==='settings'||view==='wait-settings');
  nav.hidden=view!=='home';if(stats)stats.hidden=view!=='home';if(shortcut)shortcut.hidden=view!=='home';if(settingsShortcut)settingsShortcut.hidden=view!=='home';if(settings)settings.hidden=view!=='settings';if(waitSettings)waitSettings.hidden=view!=='wait-settings';create.hidden=view!=='new';list.hidden=view!=='list';if(report)report.hidden=view!=='report';
  if(view==='list')refresh();if(view==='wait-settings')loadWaitThresholds();
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
  if(!online()){saveDraft();say('#akpr-feedback','Bağlantı yok. Taslak bu sekmede korundu; internete bağlanınca kontrol edip kaydedin.',true);return}
  saveDraft(); // Hata/oturum süresi dolması sırasında doldurulmuş alanlar kaybolmasın.
  btn.disabled=true;say('#akpr-feedback',editId?'Güncelleniyor…':'Kaydediliyor…');
  try{
   const row={plate:String(fd.get('plate')||'').trim().toLocaleUpperCase('tr-TR'),company:String(fd.get('company')||'').trim(),driver_name:String(fd.get('driver')||'').trim(),driver_phone:String(fd.get('driver_phone')||'').trim(),waybill_number:String(fd.get('waybill')||'').trim(),notes:String(fd.get('note')||'').trim()};
   row.arrival_at=parseLocal(String(fd.get('arrival_at')||''));
   // Danışma ürün kaydetmez. Düzenleme sırasında Mal Kabul ürün verisi korunur.
   if(!editId)row.products=[];
   // Aktif plaka çakışmaları aynı anda açılan cihazlar için SQL benzersiz indeksiyle de korunur.
   const registered=await fetchRecords();
   const duplicate=duplicateInYard(registered,row,editId);
   if(duplicate)throw Error('Bu plakanın tesiste açık kaydı var: '+recordNo(duplicate)+'. Önce mevcut kaydı kontrol edin.');
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
   form.reset();try{sessionStorage.removeItem(draftKey)}catch{}resetEditing();await refresh();
  }catch(e){say('#akpr-feedback',e.message,true)}finally{btn.disabled=false}
 }
 async function imageLink(path){if(!path)return null;const p=path.split('/').map(encodeURIComponent).join('/');const d=await api('/storage/v1/object/sign/ak-sevkiyat-irsaliyeleri/'+p,{method:'POST',json:{expiresIn:300}});return cfg.url+d.signedURL}
 function rows(records,host,receiving){host.innerHTML=records.length?'':'<p class="akpr-muted">Bu listede kayıt bulunmuyor.</p>';
  for(const r of records){const x=document.createElement('div');x.className='akpr-row';x.dataset.recordId=r.id;
   const state=r.status==='cancelled'?'cancelled':r.departed_at?'exited':r.docked_at?'depot':'outside';
   x.dataset.vehicleState=state;
   const summary=document.createElement('div');summary.className='akpr-vehicle-head';
   summary.innerHTML=`<div class="akpr-vehicle-top"><div><strong class="akpr-plate">${E(r.plate||recordNo(r))}</strong><div class="akpr-vehicle-company">${E(r.company||'Firma belirtilmedi')}</div></div><span class="akpr-pill akpr-state-${state}">${E(r.status==='cancelled'?'İptal edildi':r.departed_at?'Çıkış yaptı':r.docked_at?'Depoda':'Dışarıda bekliyor')}</span></div><div class="akpr-vehicle-facts"><div><small>Şoför</small><b>${E(r.driver_name||'Belirtilmedi')}</b></div><div><small>İrsaliye</small><b>${E(r.waybill_number||'—')}</b></div><div><small>Ön kayıt</small><b>${stamp(r.created_at)}</b></div><div><small>Depoya giriş</small><b>${stamp(r.docked_at)}</b></div></div><div class="akpr-wait-time" data-akpr-start="${E(recordedArrival(r))}" data-akpr-end="${E(r.docked_at||(r.status==='cancelled'?r.created_at:''))}">${r.docked_at?'Giriş öncesi bekleme: ':'Bekleme süresi: '}<strong>${elapsedText(recordedArrival(r),r.docked_at||(r.status==='cancelled'?r.created_at:null))}</strong></div>`;
   if(!receiving){
     const stage=r.status==='cancelled'?-1:r.departed_at?2:r.docked_at?1:0;
     const labels=['Ön Kayıt','Perona Gönderildi','Çıkış'];
     const progress=document.createElement('div');progress.className='akpr-vehicle-progress';
     progress.setAttribute('aria-label',stage<0?'İptal edilmiş kayıt':'Araç işlem aşaması: '+labels[stage]);
     progress.innerHTML='<div class="akpr-progress-labels">'+labels.map((label,i)=>'<span class="'+(i===stage?'is-current':'')+'">'+E(label)+'</span>').join('')+'</div><div class="akpr-progress-track">'+labels.map((_,i)=>'<span class="'+(stage>=i?'is-done':'')+'"></span>').join('')+'</div>';
     summary.append(progress);
   }
   if(receiving){x.innerHTML=`<div><strong>${E(r.plate||recordNo(r))}</strong> · ${E(r.company||"Firma belirtilmedi")}<div class="akpr-muted">Kayıt No: ${E(recordNo(r))} · Kayıt: ${stamp(r.created_at)} · Geliş: ${stamp(recordedArrival(r))} · ${E(r.driver_name||'Şoför belirtilmedi')} · İrsaliye: ${E(r.waybill_number||'—')}</div><div class="akpr-muted">Perona gönderilme: ${stamp(r.docked_at)} · Çıkış: ${stamp(r.departed_at)}</div><div class="akpr-muted">${r.operation_note?"Operasyon notu: "+E(r.operation_note)+" · ":""}${E(r.notes||'')}${r.cancellation_reason?" · İptal nedeni: "+E(r.cancellation_reason):""}</div><div class="akpr-wait-time" data-akpr-start="${E(recordedArrival(r))}" data-akpr-end="${E(r.docked_at||(r.status==='cancelled'?r.created_at:''))}">${r.docked_at?'Perona gönderilene kadar bekleme: ':'Bekleme süresi: '}<strong>${elapsedText(recordedArrival(r),r.docked_at||(r.status==='cancelled'?r.created_at:null))}</strong></div></div><div><span class="akpr-pill">${statusText(r)}</span></div>`; }else{x.append(summary);}
   const details=document.createElement('details');details.className='akpr-vehicle-details';
   const title=document.createElement('summary');title.textContent='İşlem detayları ve seçenekler';details.append(title);
   const info=document.createElement('div');info.className='akpr-vehicle-more';
   info.innerHTML=`<div><small>Kayıt türü</small><span>${isQr(r)?'Şoför QR Kaydı':'Danışma Kaydı'}</span></div><div><small>Kayıt numarası</small><span>${E(recordNo(r))}</span></div><div><small>Gerçek geliş</small><span>${stamp(recordedArrival(r))}</span></div><div><small>Perona gönderilme</small><span>${stamp(r.docked_at)}</span></div><div><small>Çıkış</small><span>${stamp(r.departed_at)}</span></div>${r.driver_phone?`<div><small>Telefon</small><span>${E(r.driver_phone)}</span></div>`:''}${r.operation_note?`<div><small>Operasyon notu</small><span>${E(r.operation_note)}</span></div>`:''}${r.notes?`<div><small>Kayıt notu</small><span>${E(r.notes)}</span></div>`:''}${r.cancellation_reason?`<div><small>İptal nedeni</small><span>${E(r.cancellation_reason)}</span></div>`:''}`;
   details.append(info);
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
         const result=isQr(r)?await qrAction(r,'dock',{time:now}):await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id)+'&created_by=eq.'+encodeURIComponent(session.user.id)+'&status=eq.waiting&docked_at=is.null',{
           method:'PATCH',headers:{Prefer:'return=representation'},json:{status:'at_dock',docked_at:now}
         });
         if(!Array.isArray(result)||!result.length)throw Error('İşlem kaydedilemedi. Kayıt başka cihazdan güncellenmiş olabilir.');
         await refresh();
       }catch(e){alert('Perona gönderme işlemi başarısız: '+e.message)}finally{dock.disabled=false}
     };b.append(dock);
   }
   if(!receiving&&canEditRecord(r)&&!isQr(r)&&!r.docked_at&&r.status!=='cancelled'){
     const fixDock=document.createElement('button');fixDock.type='button';fixDock.className='akpr-btn light';fixDock.textContent='🕒 Eksik Peron Saatini Gir';
     fixDock.onclick=async()=>{const value=requestTime('Perona gönderilme zamanını girin',r.departed_at||new Date().toISOString());if(!value)return;
       if(Date.parse(value)<Date.parse(recordedArrival(r))||r.departed_at&&Date.parse(value)>Date.parse(r.departed_at)){alert('Peron saati gelişten önce veya çıkıştan sonra olamaz.');return}
       if(!confirm('Perona gönderilme saati '+stamp(value)+' olarak kaydedilsin mi?'))return;
       fixDock.disabled=true;try{const result=await api('/rest/v1/rpc/ak_danisma_eksik_peron_saati',{method:'POST',json:{p_record_id:r.id,p_docked_at:value}});if(result!==true)throw Error('Peron saati kaydedilemedi. Kayıt başka cihazdan değiştirilmiş veya saat geçersiz olabilir.');await refresh()}catch(e){alert('Peron saati kaydedilemedi: '+e.message)}finally{fixDock.disabled=false}
     };b.append(fixDock);
   }
   if(!receiving&&canEditRecord(r)&&!r.departed_at&&r.status!=='cancelled'){
     const out=document.createElement('button');out.type='button';out.className='akpr-btn light';out.textContent='🚚 Araç Çıkışını Kaydet';out.onclick=async()=>{
       const missing=[!r.docked_at?'perona gönderilme saati':''].filter(Boolean);const warning=missing.length?'\n\nEksik işlemler: '+missing.join(', ')+'.\nGerekçeyle çıkış yapabilirsiniz.':'';if(!confirm((r.plate||recordNo(r))+' aracı çıkış yaptı mı?'+warning))return;const reason=missing.length?prompt('Eksik işlem varken araç çıkış gerekçesi (zorunlu):'):'';if(missing.length&&!reason?.trim())return;
       out.disabled=true;try{const value=new Date().toISOString();await (isQr(r)?qrAction(r,'exit',{time:value,note:reason?'Çıkış açıklaması: '+reason.trim():null}):api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id)+'&created_by=eq.'+encodeURIComponent(session.user.id),{method:'PATCH',headers:{Prefer:'return=representation'},json:{departed_at:value,...(reason?{operation_note:(r.operation_note? r.operation_note+" | ":"")+"Çıkış açıklaması: "+reason.trim()}: {})}})).then(x=>{if(!Array.isArray(x)||!x.length)throw Error('Çıkış saati kaydedilemedi. Yetki politikalarını kontrol edin.')});await refresh()}catch(e){alert('Çıkış kaydedilemedi: '+e.message)}finally{out.disabled=false}
     };b.append(out);
     const manualExit=document.createElement('button');manualExit.type='button';manualExit.className='akpr-btn light';manualExit.textContent='🕒 Geçmiş Çıkış Saatini Gir';manualExit.onclick=async()=>{
       const value=requestTime('Gerçek araç çıkış zamanını girin',new Date().toISOString());if(!value)return;
       if(Date.parse(value)<Date.parse(recordedArrival(r))||r.docked_at&&Date.parse(value)<Date.parse(r.docked_at)){alert('Çıkış saati gelişten veya perona gönderilmeden önce olamaz.');return}
       const missing=[!r.docked_at?'perona gönderilme saati':''].filter(Boolean);if(!confirm('Araç çıkışı '+stamp(value)+' olarak kaydedilsin mi?'+(missing.length?'\nEksik işlemler: '+missing.join(', '):'')))return;const manualReason=missing.length?prompt('Eksik işlem varken çıkış gerekçesi (zorunlu):'):'';if(missing.length&&!manualReason?.trim())return;
       manualExit.disabled=true;try{const result=isQr(r)?await qrAction(r,'exit',{time:value,note:manualReason?'Geçmiş çıkış açıklaması: '+manualReason.trim():null}):await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id)+'&created_by=eq.'+encodeURIComponent(session.user.id)+'&departed_at=is.null',{method:'PATCH',headers:{Prefer:'return=representation'},json:{departed_at:value,...(manualReason?{operation_note:(r.operation_note?r.operation_note+" | ":"")+"Geçmiş çıkış açıklaması: "+manualReason.trim()}: {})}});if(!Array.isArray(result)||!result.length)throw Error('Kayıt güncellenemedi veya çıkış saati zaten girilmiş.');await refresh()}catch(e){alert('Çıkış kaydedilemedi: '+e.message)}finally{manualExit.disabled=false}
     };b.append(manualExit);
   }
   if(!receiving&&canEditRecord(r)){
     const note=document.createElement('button');note.type='button';note.className='akpr-btn light';note.textContent='📝 Operasyon Notu';note.onclick=async()=>{const value=prompt('Danışma ve Mal Kabul ekranında görünecek operasyon notu:',r.operation_note||'');if(value===null)return;if(value.length>500){alert('En fazla 500 karakter yazın.');return}try{const result=isQr(r)?await qrAction(r,'note',{note:value}):await api('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(r.id)+'&created_by=eq.'+encodeURIComponent(session.user.id),{method:'PATCH',headers:{Prefer:'return=representation'},json:{operation_note:value}});if(!result?.length)throw Error('Kaydedilemedi.');await refresh()}catch(e){alert(e.message)}};b.append(note);
     const history=document.createElement('button');history.type='button';history.className='akpr-btn light';history.textContent='🕘 İşlem Geçmişi';history.onclick=async()=>{
       try{
         const events=await api('/rest/v1/ak_danisma_audit?select=changed_at,actor_id,changed_fields,old_times,new_times&record_id=eq.'+encodeURIComponent(r.id)+'&order=changed_at.desc&limit=100');
         const ids=[...new Set([...(events||[]).map(e=>e.actor_id),...(!isQr(r)?[r.created_by]:[])].filter(Boolean))];
         const names=new Map();
         if(profile?.id&&profile?.full_name)names.set(profile.id,profile.full_name);
         if(ids.length){
           // Diğer danışma personelinin adı profiles RLS nedeniyle doğrudan okunamaz.
           // Yalnızca işlem geçmişinde bulunan aktörler için yetki kontrollü RPC kullanılır.
           const results=await Promise.allSettled(ids.filter(id=>!names.has(id)).map(async id=>({
             id,
             name:await api('/rest/v1/rpc/ak_danisma_personel_adi',{
               method:'POST',json:{p_user_id:id}
             })
           })));
           for(const result of results){
             if(result.status==='fulfilled'){
               const {id,name}=result.value;
               if(typeof name==='string'&&name.trim())names.set(id,name.trim());
             }else console.warn('AKTİVA: Personel adı RPC üzerinden okunamadı',result.reason);
           }
         }
         const descriptions={departed_at:'Araç çıkışı kaydedildi',docked_at:'Araç perona gönderildi',arrival_at:'Depoya giriş saati güncellendi',status:'Araç durumu güncellendi',operation_note:'Operasyon notu güncellendi',driver_name:'Şoför bilgisi güncellendi',driver_phone:'Telefon bilgisi güncellendi',plate:'Plaka güncellendi',company:'Firma bilgisi güncellendi',waybill_number:'İrsaliye bilgisi güncellendi',cancellation_reason:'İptal nedeni kaydedildi'};
         const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Araç işlem geçmişi');
         dialog.style.cssText='position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px';
         const panel=document.createElement('div');panel.style.cssText='background:#142333;color:#f2f5f8;border:1px solid #415367;border-radius:18px;width:min(100%,520px);max-height:80vh;overflow:auto;padding:20px;font:inherit';
         const heading=document.createElement('h3');heading.textContent='Araç İşlem Geçmişi';heading.style.margin='0 0 16px';panel.append(heading);
         // İlk kayıt, değişiklik denetim tablosunda INSERT olayı olmasa da
         // ana kaydın değişmeyen created_at/created_by bilgileriyle gösterilir.
         const entries=(events||[]).map(event=>{
           const fields=Array.isArray(event.changed_fields)?event.changed_fields:[];
           const effective=fields.filter(f=>!(f==='status'&&(fields.includes('docked_at')||fields.includes('departed_at'))));
           const labels=[...new Set(effective.map(field=>descriptions[field]||'Kayıt bilgisi güncellendi'))];
           return {at:event.changed_at,title:labels.join(' · ')||'Kayıt güncellendi',actor:event.actor_id};
         });
         // Eski veya denetim kaydı eksik araçlarda, ana tablodaki kesin
         // çıkış zamanını göster. Olay aktörünü tahmin etme.
         const exitInAudit=(events||[]).some(event=>{
           const fields=Array.isArray(event.changed_fields)?event.changed_fields:[];
           return fields.includes('departed_at') ||
             (event.new_times&&event.old_times&&event.new_times.departed_at&&!event.old_times.departed_at);
         });
         if(r.departed_at&&!exitInAudit){
           entries.push({at:r.departed_at,title:'Araç Çıkışı Kaydedildi',actor:null,missingAudit:true});
         }
         if(r.created_at){
           entries.push({at:r.created_at,title:isQr(r)?'QR Kod ile Ön Kayıt Oluşturuldu':'Danışma Tarafından Ön Kayıt Oluşturuldu',actor:isQr(r)?null:r.created_by,creation:true});
         }
         entries.sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0));
         if(!entries.length){const empty=document.createElement('p');empty.textContent='Henüz işlem kaydı bulunmuyor.';panel.append(empty)}
         for(const entry of entries){
           const item=document.createElement('div');item.style.cssText='padding:12px 0;border-top:1px solid #34475a';
           const title=document.createElement('strong');title.textContent=entry.title;title.style.display='block';item.append(title);
           const time=document.createElement('div');time.textContent=stamp(entry.at);time.style.cssText='opacity:.75;font-size:.88em;margin-top:5px';item.append(time);
           const person=document.createElement('div');
           person.textContent=entry.missingAudit?'İşlemi yapan: Geçmiş personel kaydı bulunamadı':entry.creation&&isQr(r)?'Kayıt yöntemi: Şoför QR kodu':
             (entry.creation?'Kaydı oluşturan: ':'İşlemi yapan: ')+(names.get(entry.actor)||'Personel adı bulunamadı');
           person.style.cssText='margin-top:7px;font-size:.92em';item.append(person);panel.append(item);
         }
         const close=document.createElement('button');close.type='button';close.textContent='Kapat';close.className='akpr-btn light';close.style.cssText='margin-top:16px;width:100%';close.onclick=()=>dialog.remove();panel.append(close);dialog.append(panel);
         dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.remove()});document.body.append(dialog);
       }catch(e){alert('Geçmiş okunamadı: '+e.message)}
     };b.append(history);
   }
   if(receiving){x.append(b)}else{
     // Yalnızca o an uygulanabilir ana işlem kartın üzerinde görünür;
     // diğer mevcut işlemler açılır detay bölümünde korunur.
     const main=[...b.children].find(el=>el.tagName==='BUTTON'&&(
       el.textContent.includes('Perona Gönderildi')||el.textContent.includes('Araç Çıkışını Kaydet')));
     if(main){
       const quick=document.createElement('div');quick.className='akpr-quick-action';
       main.classList.add('akpr-main-action');quick.append(main);
       x.append(quick);
     }
     if(b.childElementCount)details.append(b);
     x.append(details);
   }host.append(x)
  }
 }
 const istanbulDate=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
 // Bekleyenler için tarih kısıtlaması yoktur. Supabase'in varsayılan 1000 satır sınırı
 // nedeniyle sonuçlar sayfalanır; eski bekleyen kayıtlar listeden düşmez.
 async function fetchRecords(){
  const all=[],pageSize=500;
  for(let offset=0;offset<10000;offset+=pageSize){
   const page=await api('/rest/v1/'+table+'?select=id,created_by,registration_source,plate,company,driver_name,driver_phone,waybill_number,notes,photo_path,status,created_at,arrival_at,docked_at,departed_at,cancellation_reason,products,count_results,counted_at,operation_note&order=created_at.desc&limit='+pageSize+'&offset='+offset);
   if(!Array.isArray(page))throw Error('Ön kayıt listesi okunamadı.');
   all.push(...page);if(page.length<pageSize)return all;
  }
  throw Error('Kayıt sayısı listeleme sınırını aştı. Eksik liste gösterilmiyor.');
 }
 let visibleRecordCount=10;
 async function refresh(){if(!active())return;try{
   const records=await fetchRecords();cache=records;
   const mine=records.filter(r=>isQr(r)||r.created_by===session?.user?.id);
   if($('#akpr-list')){
     const live=r=>!r.docked_at&&!r.departed_at&&r.status==='waiting';
     const ordered=[...mine].sort((a,b)=>Number(live(b))-Number(live(a))||(live(a)?Date.parse(recordedArrival(a))-Date.parse(recordedArrival(b)):Date.parse(b.created_at)-Date.parse(a.created_at)));
     const old=ordered.filter(r=>live(r)&&istanbulDate(recordedArrival(r))<today()).length;
     const current=ordered.filter(r=>live(r)&&istanbulDate(recordedArrival(r))===today()).length;
     const host=$('#akpr-list');const openDetails=new Set([...host.querySelectorAll('details.akpr-vehicle-details[open]')].map(el=>el.closest('.akpr-row')?.dataset.recordId).filter(Boolean));host.innerHTML=(old||current)?'<div class="akpr-pending-summary"><div><small>Önceki Günlerden Bekleyen</small><strong>'+old+' araç</strong></div><div><small>Bugün Gelen ve Bekleyen</small><strong>'+current+' araç</strong></div></div>':'';
     const filter=$('#akpr-filter')?.value||'active';document.querySelectorAll('#akpr-list-view [data-akpr-tab]').forEach(b=>{b.classList.toggle('is-active',b.dataset.akprTab===filter)});const historyDates=$('#akpr-history-dates');if(historyDates)historyDates.style.display=(filter==='exited'||filter==='all')?'grid':'none';const dateStart=$('#akpr-history-start')?.value||'';const dateEnd=$('#akpr-history-end')?.value||'';const search=($('#akpr-search')?.value||'').toLocaleLowerCase('tr-TR').trim();const filtered=ordered.filter(r=>(!search||[r.plate,r.company,r.driver_name,r.driver_phone,r.waybill_number,recordNo(r)].some(v=>String(v||'').toLocaleLowerCase('tr-TR').includes(search)))&&((filter==='all'||filter==='active'&&r.status!=='cancelled'&&!r.departed_at||filter==='missing'&&(!r.plate||!r.company||!r.driver_name||!r.driver_phone||!r.waybill_number)||filter==='open'&&!!r.docked_at&&!r.departed_at&&r.status!=='cancelled'||filter==='waiting'&&live(r)||filter==='exited'&&!!r.departed_at||filter==='previous'&&live(r)&&istanbulDate(recordedArrival(r))<today()))&&((filter!=='exited'&&filter!=='all')||(!dateStart&&!dateEnd)||(!!(r.departed_at||r.created_at)&&(!dateStart||istanbulDate(r.departed_at||r.created_at)>=dateStart)&&(!dateEnd||istanbulDate(r.departed_at||r.created_at)<=dateEnd))));
     const list=document.createElement('div');host.append(list);rows(filtered.slice(0,visibleRecordCount),list,false);applyWaitWarnings();if(!filtered.length){const empty=document.createElement('p');empty.className='akpr-empty-state';empty.textContent=filter==='active'?'Şu anda işlem bekleyen araç bulunmuyor.':'Seçilen kriterlerde araç kaydı bulunamadı.';host.append(empty)}if(filtered.length>visibleRecordCount){const more=document.createElement('button');more.type='button';more.className='akpr-btn light';more.style.cssText='width:100%;margin:12px 0';more.textContent='Sonraki 10 kaydı göster ('+visibleRecordCount+' / '+filtered.length+')';more.onclick=()=>{visibleRecordCount+=10;refresh()};host.append(more)}list.querySelectorAll('.akpr-row').forEach(el=>{const id=el.dataset.recordId;if(id&&openDetails.has(id)){const d=el.querySelector('details.akpr-vehicle-details');if(d)d.open=true;}});
   }
   const total=$('#akpr-total'),pending=$('#akpr-pending');
   if(total)total.textContent=mine.filter(r=>istanbulDate(r.created_at)===today()).length;
   if(pending)pending.textContent=mine.filter(r=>r.status==='waiting'&&!r.departed_at).length;
   const onsite=mine.filter(r=>r.status!=='cancelled'&&!r.departed_at&&!!r.docked_at),liveWait=mine.filter(r=>r.status==='waiting'&&!r.docked_at&&!r.departed_at);
   for(const [id,val] of [['akpr-onsite',onsite.length],['akpr-queue',liveWait.length],['akpr-in-dock',mine.filter(r=>r.status!=='cancelled'&&!!r.docked_at&&istanbulDate(r.docked_at)===today()).length],['akpr-done',mine.filter(r=>r.departed_at&&istanbulDate(r.departed_at)===today()).length]]){const el=$('#'+id);if(el)el.textContent=val;}
   driverLookup();networkStatus();
   if($('#akpr-records-content'))drawReceiving(records);
  }catch(e){if($('#akpr-list'))$('#akpr-list').textContent='Kayıtlar alınamadı: '+e.message;if($('#akpr-records-content'))$('#akpr-records-content').textContent='Ön kayıtlar alınamadı: '+e.message}
 }
 // cache declared in shared module state
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
   const allRows=await fetchRecords();const dayMs=86400000;const startMs=Date.parse(start+'T00:00:00Z'),endMs=Date.parse(end+'T00:00:00Z'),days=Math.round((endMs-startMs)/dayMs)+1;
   const prevStart=new Date(startMs-days*dayMs).toISOString().slice(0,10),prevEnd=new Date(startMs-dayMs).toISOString().slice(0,10);
   const periodRows=(a,b)=>allRows.filter(r=>{const d=istanbulDate(recordedArrival(r));return d>=a&&d<=b});const previous=periodRows(prevStart,prevEnd);
   const metric=(arr,fn)=>arr.filter(fn).length;
   const comparison=sheet('Dönem Karşılaştırma',['GÖSTERGE','SEÇİLEN DÖNEM','ÖNCEKİ EŞİT DÖNEM','DEĞİŞİM'],[34,24,28,23],[
    ['Araç girişi',records.length,previous.length,records.length-previous.length],
    ['Araç çıkışı',metric(records,r=>!!r.departed_at),metric(previous,r=>!!r.departed_at),metric(records,r=>!!r.departed_at)-metric(previous,r=>!!r.departed_at)],
    ['Perona gönderilen',metric(records,r=>!!r.docked_at),metric(previous,r=>!!r.docked_at),metric(records,r=>!!r.docked_at)-metric(previous,r=>!!r.docked_at)],
    ['İptal edilen',metric(records,r=>r.status==='cancelled'),metric(previous,r=>r.status==='cancelled'),metric(records,r=>r.status==='cancelled')-metric(previous,r=>r.status==='cancelled')]
   ],{portrait:true});comparison.getCell('A9').value='Önceki dönem: '+prevStart+' – '+prevEnd;comparison.printArea='A1:D9';comparison.pageSetup.fitToHeight=1;
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
 // Danışma menüsünde eski sarı vurguları yeniden yazma; renkler CSS'de yönetilir.
 function applyPreRegistrationButtonTheme(){
   if(document.body.dataset.role!=='pre_receiving')return;
   const root=$('#ak-pre-receiving');if(!root)return;
   for(const button of root.querySelectorAll('button')){
     for(const prop of ['background','background-color','background-image','color','border-color','border-bottom','box-shadow']){
       // Önceki sürümün JS üzerinden eklediği inline !important renkleri temizle.
       if(button.style.getPropertyPriority(prop)==='important')button.style.removeProperty(prop);
     }
   }
   // Sarı alt kenarlık farklı global stillerden gelebilir.
   // Yalnızca Danışma ana sayfasındaki üç gezinme kartını inline öncelikle sabitle.
   for(const card of root.querySelectorAll('#akpr-home-nav > button.akpr-nav-card')){
     card.style.setProperty('border','1px solid #4c647b','important');
     card.style.setProperty('border-bottom','1px solid #4c647b','important');
     card.style.setProperty('border-bottom-color','#4c647b','important');
     card.style.setProperty('box-shadow','none','important');
     card.style.setProperty('background-image','none','important');
   }
 }
 function updateDanismaUser(){
  const target=$('#akpr-user-name');if(!target)return;
  const p=typeof profile!=='undefined'?profile:null;
  const name=typeof p?.full_name==='string'?p.full_name.trim():'';
  target.textContent=name||'Danışma Personeli';
 }
 function mount(){const role=document.body.dataset.role;if(role==='pre_receiving'){
    const app=$('#app');if(!app||app.classList.contains('hidden'))return;
    if(!$('#ak-pre-receiving')){app.insertAdjacentHTML('beforeend',markup());$('#akpr-form').addEventListener('submit',create);$('#akpr-form').addEventListener('input',e=>{saveDraft();if(e.target.name==='driver')driverLookup()});$('#akpr-driver-suggestions').addEventListener('click',e=>{const b=e.target.closest('[data-driver-index]');if(!b)return;const r=driverSuggestions[Number(b.dataset.driverIndex)];if(!r)return;const f=$('#akpr-form');f.elements.driver.value=r.driver_name;f.elements.driver_phone.value=r.driver_phone;$('#akpr-driver-suggestions').innerHTML='';saveDraft()});$('#akpr-filter').addEventListener('change',()=>{visibleRecordCount=10;refresh()});document.querySelectorAll('#akpr-list-view [data-akpr-tab]').forEach(b=>b.addEventListener('click',()=>{$('#akpr-filter').value=b.dataset.akprTab;visibleRecordCount=10;refresh()}));['akpr-history-start','akpr-history-end'].forEach(id=>$('#'+id)?.addEventListener('change',()=>{visibleRecordCount=10;refresh()}));$('#akpr-search').addEventListener('input',()=>{const q=$('#akpr-search');clearTimeout(q._akTimer);q._akTimer=setTimeout(()=>{visibleRecordCount=10;refresh()},160)});window.addEventListener('online',networkStatus);window.addEventListener('offline',networkStatus);restoreDraft();networkStatus();$('#akpr-refresh').onclick=refresh;$('#akpr-open-report').onclick=()=>showStaffView('report');$('#akpr-open-settings').onclick=()=>showStaffView('settings');$('#akpr-open-wait-settings').onclick=()=>showStaffView('wait-settings');$('#akpr-wait-settings-back').onclick=()=>showStaffView('settings');$('#akpr-save-settings').onclick=saveWaitThresholds;loadWaitThresholds();$('#akpr-export').onclick=exportExcel;$('#akpr-excel-start').value=today();$('#akpr-excel-end').value=today();$('#akpr-logout').onclick=()=>$('#logout')?.click();updateDanismaUser();$('#akpr-open-new').onclick=()=>{resetEditing();$('#akpr-form')?.reset();restoreDraft();showStaffView('new')};$('#akpr-open-list').onclick=()=>showStaffView('list');$('#akpr-open-qr').onclick=()=>window.open('sofor-qr-yazdir.html','_blank','noopener');document.querySelectorAll('#ak-pre-receiving [data-akpr-back]').forEach(b=>b.addEventListener('click',()=>{resetEditing();$('#akpr-form')?.reset();showStaffView('home')}));}
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
 document.addEventListener('DOMContentLoaded',()=>{mount();if(!observeRecords()){const tryObserve=setInterval(()=>{if(observeRecords())clearInterval(tryObserve)},600)}timer=setInterval(()=>{if(!document.hidden&&active()&&['count','pre_receiving'].includes(document.body.dataset.role)){mount();refresh();if(document.body.dataset.role==='pre_receiving')loadWaitThresholds()}},15000);setInterval(()=>{if(document.hidden)return;document.querySelectorAll('.akpr-wait-time[data-akpr-start]').forEach(el=>{const end=el.dataset.akprEnd;const text=el.querySelector('strong');if(text)text.textContent=elapsedText(el.dataset.akprStart,end)});applyWaitWarnings()},30000)});
})();
