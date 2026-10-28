/* AKTİVA - Palet İade bağımsız modül. Mevcut forklift/push fonksiyonlarına dokunmaz. */
(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s),role=()=>document.body.dataset.role,uid=()=>{try{return session?.user?.id}catch{return null}};
const fmt=s=>s?new Date(s).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'—';
const date=s=>s?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s)):'';
const today=()=>date(new Date());let taskDateMode='today',taskDateStart=today(),taskDateEnd=today();
let cancelOpen=false,page='list',active=null,chosen=[],quantities={},search='',pickerOpen=true,taskStatus='all',catalogSearch='',data=[],catalog=[],message='',busy=false,assignId=null,forkStaff=[],editingCode=null,productFilter='all',completionReturnId=null,receivingStaff=[];
async function api(path,opts={}){if(!uid())throw Error('Önce giriş yapın');return req(path,opts)}
async function rpc(fn,body){const x=await api('/rest/v1/rpc/'+fn,{method:'POST',body,headers:{Prefer:'return=representation'}});return x}
async function getAll(table,cols='*'){let a=[];for(let off=0;off<50000;off+=1000){const x=await api('/rest/v1/'+table+'?select='+encodeURIComponent(cols)+'&limit=1000&offset='+off);a.push(...x);if(x.length<1000)return a}throw Error('Rapor sınırı aşıldı; eksik rapor üretilmedi')}
async function load(){[data,catalog]=await Promise.all([getAll('ak_palet_returns'),getAll('ak_palet_catalog')]);data.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}
function open(){if(!['count','fork'].includes(role()))return;taskDateMode='today';taskDateStart=today();taskDateEnd=today();taskStatus='all';catalogSearch='';page='list';cancelOpen=false;message='';document.getElementById('akpi-modal').hidden=false;document.getElementById('akpi-modal').classList.toggle('akpi-receiving',role()==='count');refresh()}
window.AKTIVA_OPEN_PALET_IADE=open;
function close(){editingCode=null;document.querySelector('#akpi-quantity-dialog')?.remove();const modal=document.getElementById('akpi-modal');if(modal)modal.hidden=true}
async function refresh(){busy=true;try{await load();message=''}catch(e){message='Veri alınamadı: '+e.message}finally{busy=false;draw()}}
function catalogRowsHtml(){const q=catalogSearch.trim().toLocaleLowerCase('tr');const filtered=catalog.filter(p=>(String(p.name||'')+' '+String(p.code||'')).toLocaleLowerCase('tr').includes(q));return `<div class="akpi-catalog-meta">${filtered.length} sonuç${filtered.length>(q?20:8)?' · '+(q?20:8)+' gösteriliyor, diğerleri için arama yapın':''}</div>`+(filtered.length?filtered.slice(0,q?20:8).map(p=>`<div class="akpi-catalog-row"><strong>${esc(p.name)}</strong><small>${esc(p.code)}</small></div>`).join(''):'<p class="akpi-empty">Aramanıza uygun ürün bulunamadı.</p>')}
function draw(){const host=$('#akpi-content');if(!host)return;const count=role()==='count',fork=role()==='fork';if(!count&&!fork){close();return}
let h=`<div class="akpi-top"><div><small>AKTİVA / ${count?'MAL KABUL':'FORKLİFT PERSONELİ'}</small><h2>Palet İade Operasyonu</h2></div><button data-pi="close" class="akpi-outline akpi-close" aria-label="Kapat">✕</button></div><nav class="akpi-tabs" aria-label="Palet iade menüsü">${count?`<button class="${page==='create'?'active':''}" data-pi="create"><span class="akpi-tab-icon">＋</span>Yeni İade</button>`:''}<button class="${page==='list'||page==='detail'?'active':''}" data-pi="list"><span class="akpi-tab-icon">☷</span>Görevler</button>${count?'<button class="'+(page==='catalog'?'active':'')+'" data-pi="catalog"><span class="akpi-tab-icon">▣</span>Ürün Kataloğu</button>':''}<button class="${page==='report'?'active':''}" data-pi="report"><span class="akpi-tab-icon">▤</span>Excel Raporları</button></nav>`;
if(message)h+=`<p class="akpi-msg">${esc(message)}</p>`;if(busy)h+='<p>Supabase kayıtları yükleniyor…</p>';
if(page==='list'){const currentDay=today();const baseRows=data.filter(r=>count||(r.status!=='completed'&&r.status!=='cancelled')||r.completed_by===uid());const datedRows=baseRows.filter(r=>{const d=date(r.created_at);return taskDateMode==='today'?d===currentDay:!!d&&taskDateStart<=taskDateEnd&&d>=taskDateStart&&d<=taskDateEnd});const rows=count&&taskStatus!=='all'?datedRows.filter(r=>taskStatus==='waiting'?!['active','completed','cancelled'].includes(r.status):r.status===taskStatus):datedRows;h+=`<div class="akpi-section-title"><div class="akpi-section-heading"><h3>Palet İade Görevleri</h3><p>İade operasyonları ve geçmiş kayıtlar</p></div><span class="akpi-count">${rows.length} görev</span></div><div class="akpi-date-filter" role="group" aria-label="Görev tarihi"><div class="akpi-date-switch"><button type="button" data-pi="date-today" class="${taskDateMode==='today'?'selected':''}" aria-pressed="${taskDateMode==='today'}">Bugün</button><button type="button" data-pi="date-range" class="${taskDateMode==='range'?'selected':''}" aria-pressed="${taskDateMode==='range'}">Tarih Aralığı</button></div>${taskDateMode==='range'?`<div class="akpi-date-fields"><label>Başlangıç<input type="date" id="akpi-date-start" value="${esc(taskDateStart)}" max="9999-12-31"></label><label>Bitiş<input type="date" id="akpi-date-end" value="${esc(taskDateEnd)}" max="9999-12-31"></label></div>${taskDateStart>taskDateEnd?'<p class="akpi-date-warning">Başlangıç tarihi bitiş tarihinden sonra olamaz.</p>':''}`:`<p class="akpi-date-caption">◷ &nbsp;${esc(currentDay.split('-').reverse().join('.'))} · Günlük kayıtlar</p>`}</div>`;if(count)h+=`<div class="akpi-status-filter" role="group" aria-label="Görev durum filtresi">${[['all','Tümü'],['waiting','Bekleyen'],['active','İşlemde'],['completed','Tamamlanan'],['cancelled','İptal']].map(([k,label])=>`<button type="button" data-pi="task-status" data-status="${k}" class="${taskStatus===k?'selected':''}" aria-pressed="${taskStatus===k}">${label}<span>${k==='all'?datedRows.length:datedRows.filter(r=>k==='waiting'?!['active','completed','cancelled'].includes(r.status):r.status===k).length}</span></button>`).join('')}</div>`;if(!rows.length)h+='<p class="akpi-empty">Seçilen tarihte görüntülenecek palet iade görevi yok.</p>';for(const r of rows){const status=r.status==='completed'?'Tamamlandı':r.status==='active'?'İşlemde':r.status==='cancelled'?'İptal Edildi':'Bekliyor';h+=`<div class="akpi-item akpi-task ${r.status==='cancelled'?'akpi-is-cancelled':''}"><div class="akpi-task-main"><div class="akpi-task-head"><strong>${esc(r.company)}</strong><span class="akpi-status ${esc(r.status)}">${r.status==='cancelled'?'✕ ':''}${status}</span></div><small>${esc(r.plate)} · ${esc(r.driver)}</small>${r.status==='cancelled'?`<div class="akpi-cancel-summary"><strong>✕ Bu iade kaydı iptal edildi</strong><span>İptal nedeni: ${esc(r.cancel_reason||'Belirtilmedi')}</span><small>İptal tarihi: ${fmt(r.cancelled_at)}</small></div>`:''}<div class="akpi-task-foot"><small>${fmt(r.created_at)}${r.status==='completed'?' · '+r.total_pallets+' palet':''}</small><button data-pi="detail" data-id="${r.id}" class="akpi-detail">Detay ›</button>${count&&r.status!=='cancelled'?`<button data-pi="cancel-return" data-id="${r.id}" class="akpi-cancel-button" aria-label="İade kaydını iptal et">✕ <span>İptal Et</span></button>`:''}${count&&r.status!=='completed'&&r.status!=='cancelled'?`<button data-pi="assign" data-id="${r.id}" class="akpi-detail">Forkliftçi Seç</button>`:''}</div></div></div>`}h+='<div class="akpi-refresh-wrap"><button class="akpi-outline akpi-refresh" data-pi="refresh">↻ Yenile</button></div>'}
if(page==='create'&&count)h+=`<div class="akpi-page-heading"><span class="akpi-eyebrow">YENİ GÖREV</span><h3>Yeni Palet İade Kaydı</h3><p>Firma ve araç bilgilerini girin. Kaydı oluşturduktan sonra görevli forkliftçiyi seçebilirsiniz.</p></div><form id="akpi-create" class="akpi-soft-card"><label>Palet firması adı<input name="company" placeholder="Firma adını yazın" autocomplete="organization" required minlength="2" maxlength="150"></label><label>Şoför adı soyadı<input name="driver" placeholder="Ad soyad" autocomplete="name" required minlength="2" maxlength="150"></label><label>Tır plakası<input name="plate" placeholder="48 ABC 123" autocapitalize="characters" required minlength="3" maxlength="30"></label><button type="submit" class="akpi-primary">Kaydı Oluştur ve Devam Et <span aria-hidden="true">›</span></button><small class="akpi-form-note">Sonraki adım: Forkliftçi seçimi ve görev bildirimi.</small></form>`;
if(page==='assign'&&count){const r=data.find(x=>x.id===assignId);h+=`<h3>Forkliftçi Görevlendir</h3><p class="akpi-hint">Kayıt oluşturuldu. Bildirimin gönderileceği forklift personelini seçin.</p><div class="akpi-item"><div><strong>${esc(r?.company||'Palet iade kaydı')}</strong><small>${esc(r?.plate||'')}</small></div></div><form id="akpi-assign"><label>Forklift personeli<select name="forklift" required><option value="">Personel seçiniz</option>${forkStaff.map(x=>`<option value="${esc(x.id)}">${esc(x.full_name||'İsimsiz personel')}</option>`).join('')}</select></label><button type="submit" ${forkStaff.length?'':'disabled'}>Görev Gönder</button></form>${forkStaff.length?'':'<p class="akpi-hint">Aktif forklift personeli bulunamadı veya listeye erişilemiyor.</p>'}<button class="akpi-outline" data-pi="list">Daha sonra görevlendir</button>`;}
if(page==='catalog'&&count){h+=`<div class="akpi-page-heading"><span class="akpi-eyebrow">ÜRÜN YÖNETİMİ</span><h3>Palet İade Ürün Kataloğu</h3><p>Kayıtlı ürünlerde arama yapın veya aşağıdaki bölümlerden ürün ekleyin.</p></div><div class="akpi-catalog-list akpi-soft-card"><div class="akpi-catalog-head"><strong>Kayıtlı Ürünler</strong><span class="akpi-count">${catalog.length} ürün</span></div><label class="akpi-search-label" for="akpi-catalog-search">Ürün veya malzeme kodu ara</label><input id="akpi-catalog-search" type="search" placeholder="Ürün adı veya kodu yazın…" autocomplete="off" value="${esc(catalogSearch)}"><div id="akpi-catalog-results">${catalogRowsHtml()}</div></div><div class="akpi-catalog-tools"><details class="akpi-tool"><summary><span>＋</span><strong>Ürün Ekle / Güncelle</strong><em>›</em></summary><div class="akpi-tool-body"><p class="akpi-hint">Malzeme kodunu ve ürün adını girin.</p><form id="akpi-product"><label>Malzeme kodu<input name="code" required placeholder="Malzeme kodu"></label><label>Ürün adı<input name="name" required placeholder="Ürün adı"></label><button type="submit" class="akpi-primary">Ürünü Kaydet</button></form></div></details><details class="akpi-tool"><summary><span>▤</span><strong>Excel / CSV / TXT Yükle</strong><em>›</em></summary><div class="akpi-tool-body"><p class="akpi-hint">Dosyada Ürün Kodu ve Ürün Adı sütunları bulunmalıdır.</p><label>Dosya seç<input type="file" id="akpi-file" accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"></label><button type="button" data-pi="import" class="akpi-primary">Dosyayı Kontrol Et ve Yükle</button></div></details><details class="akpi-tool"><summary><span>▣</span><strong>Fotoğraftan Ürün Oku</strong><em>›</em></summary><div class="akpi-tool-body akpi-photo"><p class="akpi-hint">Kamera veya galeriden ürün listesi seçin. Kodları kaydetmeden önce kontrol edin; fotoğraf otomatik olarak sunucuya yüklenmez.</p><label>Fotoğraf Çek<input type="file" id="akpi-photo-camera" accept="image/*" capture="environment"></label><label>Galeriden Seç<input type="file" id="akpi-photo-gallery" accept="image/*"></label><button type="button" data-pi="photo-read" class="akpi-primary">Seçilen Fotoğrafı Oku</button><div id="akpi-photo-review"></div></div></details></div>`;}
if(page==='detail'){const r=data.find(x=>x.id===active);if(!r){page='list';return draw()}h+=`<button class="akpi-back" data-pi="list">‹ Görevlere dön</button><h3>${esc(r.company)}</h3><p>Şoför: ${esc(r.driver)} · Plaka: ${esc(r.plate)}</p><p>Kayıt: ${fmt(r.created_at)} · Durum: ${r.status==='completed'?'Tamamlandı':r.status==='active'?'İşlemde':r.status==='cancelled'?'İptal Edildi':'Bekliyor'}</p>`;
if(r.status==='cancelled'){h+=`<div class="akpi-cancelled-note"><strong>İptal Edildi</strong><p>İptal nedeni: ${esc(r.cancel_reason||'—')}</p><small>İptal tarihi: ${fmt(r.cancelled_at)}</small></div>`}else if(r.status==='completed'){h+=`<p><strong>Toplam ${r.total_pallets} palet</strong> · ${fmt(r.completed_at)}</p><div id="akpi-items">Ürünler yükleniyor…</div>`;setTimeout(()=>detailItems(r.id),0)}
else if(fork){h+=`<h3>Yükleme Kalemleri</h3><p class="akpi-hint">Her ürünün miktarını ve birimini ayrı giriniz.</p><div id="akpi-selected">${selectedRows()}</div><button type="button" class="akpi-add-product" data-pi="add-product">＋ ${chosen.length?'Başka Ürün Ekle':'Katalogdan Ürün Seç'}</button><div id="akpi-picker" ${pickerOpen?'':'hidden'}><label>Ürün ara<input id="akpi-search" placeholder="Ürün adı veya malzeme kodu" value="${esc(search)}" autocomplete="off"></label><div class="akpi-filter-tabs" role="group" aria-label="Ürün türü"><button type="button" data-pi="filter-products" data-filter="all" class="${productFilter==='all'?'selected':''}">Tüm Ürünler</button><button type="button" data-pi="filter-products" data-filter="palet" class="${productFilter==='palet'?'selected':''}">Paletler</button><button type="button" data-pi="filter-products" data-filter="kasa" class="${productFilter==='kasa'?'selected':''}">Kasalar</button></div><div class="akpi-products" id="akpi-products">${productRows()}</div></div><button data-pi="complete" class="akpi-complete">Yüklemeyi Tamamla</button>`}
else h+='<p>Forklift personelinin yüklemeyi tamamlaması bekleniyor.</p>'}
if(page==='completion-notify'&&fork){const r=data.find(x=>x.id===completionReturnId);h+=`<div class="akpi-notify-card"><h3>✓ Yükleme Tamamlandı</h3><p class="akpi-hint">Yükleme kaydedildi. Bildirimin gönderileceği mal kabul personelini seçin.</p><div class="akpi-notify-detail"><div><small>Firma</small><strong>${esc(r?.company||'—')}</strong></div><div><small>Plaka</small><strong>${esc(r?.plate||'—')}</strong></div><div><small>Şoför</small><strong>${esc(r?.driver||'—')}</strong></div></div><form id="akpi-notify-form"><label>Mal Kabul Personeli<select name="receiver" required><option value="">Personel seçiniz</option>${receivingStaff.map(x=>`<option value="${esc(x.id)}">${esc(x.full_name||'İsimsiz personel')}</option>`).join('')}</select></label><button type="submit" ${receivingStaff.length?'':'disabled'}>↗ Bildirimi Gönder</button></form>${receivingStaff.length?'':'<p class="akpi-hint">Mal kabul personel listesi alınamadı. Tekrar deneyin.</p>'}<button type="button" class="akpi-outline" data-pi="retry-receivers">↻ Personelleri Yenile</button><button type="button" class="akpi-outline" data-pi="list">Görevlere Dön</button></div>`;}
 if(page==='report'&&count){h+=`<div class="akpi-page-heading"><span class="akpi-eyebrow">RAPORLAMA</span><h3>Palet İade Excel Raporu</h3><p>İstediğiniz tarih aralığındaki kayıtları A4 yazdırmaya uygun Excel raporu olarak alın.</p></div><div class="akpi-soft-card akpi-report-card"><div class="akpi-report-presets" role="group" aria-label="Hızlı tarih seçimi"><button type="button" data-pi="report-today">Bugün</button><button type="button" data-pi="report-week">Son 7 Gün</button><button type="button" data-pi="report-month">Son 30 Gün</button></div><div class="akpi-report-dates"><label>Başlangıç tarihi<input type="date" id="akpi-start" value="${date(new Date(Date.now()-30*86400000))}"></label><label>Bitiş tarihi<input type="date" id="akpi-end" value="${today()}"></label></div><button type="button" class="akpi-primary akpi-export" data-pi="export">↓ Excel Raporunu Oluştur</button><p class="akpi-hint">4 sayfa: Özet, Günlük Döküm, Personel Raporu ve İşlem Detayları. Bekleyen, işlemdeki, tamamlanan ve iptal edilen kayıtlar rapor kurallarına göre değerlendirilir.</p></div>`}
else if(page==='report'){h+=`<h3>Palet İade Excel Raporu</h3><div class="akpi-grid akpi-report-dates" style="width:100%;max-width:100%;min-width:0;padding-right:16px;box-sizing:border-box"><label>Başlangıç tarihi<input type="date" id="akpi-start" style="display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box;position:relative;left:0;margin:8px 0 0;" value="${date(new Date(Date.now()-30*86400000))}"></label><label>Bitiş tarihi<input type="date" id="akpi-end" style="display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box;position:relative;left:0;margin:8px 0 0;" value="${today()}"></label></div><button data-pi="export">📥 Seçilen Tarih Aralığını Excel İndir</button><p class="akpi-hint">Özet, Günlük Döküm, Personel Raporu ve İşlem Detayları. Kayıt tarihine göre hazırlanır. Bekleyen ve işlemdeki görevler de rapora dahil edilir; tamamlananların bilgileri güncel gösterilir.</p>`}
if(page==='list'&&count&&cancelOpen){const r=data.find(x=>x.id===active);if(r&&r.status!=='cancelled')h+=`<div class="akpi-cancel-overlay"><div class="akpi-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="akpi-cancel-heading"><div class="akpi-cancel-dialog-head"><div><small>AKTİVA · KAYIT YÖNETİMİ</small><h3 id="akpi-cancel-heading">İade Kaydını İptal Et</h3></div><button type="button" class="akpi-cancel-dismiss" data-pi="cancel-dismiss" aria-label="İptal penceresini kapat">✕</button></div><div class="akpi-cancel-target"><strong>${esc(r.company)}</strong><span>${esc(r.plate)} · ${esc(r.driver)}</span></div><p class="akpi-cancel-explainer">Bu görev aktif forklift listesinden kaldırılır. Kayıt ve iptal nedeni Excel raporunda saklanır.</p><form id="akpi-cancel-form"><label for="akpi-cancel-reason">İptal nedeni <em>zorunlu</em></label><textarea id="akpi-cancel-reason" name="reason" required minlength="5" maxlength="500" rows="4" placeholder="Örn. Araç yüklemesi iptal edildi"></textarea><div class="akpi-cancel-actions"><button type="button" data-pi="cancel-dismiss" class="akpi-cancel-nevermind">Vazgeç</button><button type="submit" class="akpi-cancel-confirm">İptali Onayla</button></div></form></div></div>`;else cancelOpen=false}
host.innerHTML=h;$('#akpi-create')?.addEventListener('submit',create);$('#akpi-cancel-form')?.addEventListener('submit',cancelReturn);$('#akpi-assign')?.addEventListener('submit',assignForklift);$('#akpi-notify-form')?.addEventListener('submit',sendCompletionNotification);$('#akpi-product')?.addEventListener('submit',saveProduct);$('#akpi-search')?.addEventListener('input',e=>{search=e.target.value;$('#akpi-products').innerHTML=productRows()});}
function selectedRows(){
 const lines=chosen.map(code=>{const p=catalog.find(x=>x.code===code),q=quantities[code]||{qty:'',unit:'palet'};return `<div class="akpi-line akpi-line-card"><div class="akpi-line-title"><img class="akpi-illustration" src="${productImage(p?.name)}" alt="" loading="lazy"><div class="akpi-line-info"><strong>${esc(p?.name||code)}</strong><small>Malzeme kodu: ${esc(code)}</small></div><span class="akpi-line-amount">${esc(q.qty)} ${q.unit==='kasa'?'kasa':'palet'}</span></div><div class="akpi-line-actions"><button type="button" data-pi="edit-line" data-code="${esc(code)}">✎ Düzenle</button><button type="button" class="akpi-remove" data-pi="remove-line" data-code="${esc(code)}">Sil</button></div></div>`}).join('');
 const totals=chosen.reduce((a,code)=>{const q=quantities[code]||{};const n=Number(q.qty);if(Number.isSafeInteger(n)&&n>0&&n<=999999)a[q.unit==='kasa'?'kasa':'palet']+=n;return a},{palet:0,kasa:0});
 return `<div class="akpi-selected-heading"><h3>Yükleme Listesi</h3><span>${chosen.length} ürün</span></div>${lines||'<p class="akpi-hint">Henüz ürün eklenmedi. Aşağıdan katalogdan ürün seçiniz.</p>'}<div class="akpi-totals"><strong>Yükleme Özeti</strong><span>${totals.palet} palet · ${totals.kasa} kasa</span></div>`;
}
function productImage(name){return /kasa/i.test(String(name||''))?'akpi-kasa.svg':'akpi-palet.svg'}
function productRows(){return catalog.filter(p=>!chosen.includes(p.code)&&(productFilter==='all'||(productFilter==='kasa'?/kasa/i.test(p.name):!/kasa/i.test(p.name)))&&(p.code+' '+p.name).toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))).slice(0,100).map(p=>`<button type="button" class="akpi-product" data-pi="pick-product" data-code="${esc(p.code)}"><img class="akpi-illustration" src="${productImage(p.name)}" alt="" loading="lazy"><span class="akpi-product-info"><strong>${esc(p.name)}</strong><small>Malzeme kodu: ${esc(p.code)}</small></span><span class="akpi-product-plus" aria-hidden="true">＋</span></button>`).join('')||'<p class="akpi-hint">Eşleşen ürün bulunamadı. Farklı bir ad veya kod arayın.</p>'}
function openQuantity(code){
 const p=catalog.find(x=>x.code===code);if(!p)return;
 editingCode=code;const q=quantities[code]||{qty:'',unit:'palet'};
 document.querySelector('#akpi-quantity-dialog')?.remove();
 const overlay=document.createElement('div');overlay.id='akpi-quantity-dialog';overlay.className='akpi-quantity-overlay';overlay.innerHTML=`<div class="akpi-quantity-panel" role="dialog" aria-modal="true" aria-labelledby="akpi-quantity-heading"><div class="akpi-quantity-top"><span>AKTİVA · YÜKLEME MİKTARI</span><button type="button" data-pi="cancel-quantity" aria-label="Kapat">✕</button></div><h2 id="akpi-quantity-heading">${esc(p.name)}</h2><p class="akpi-quantity-code">Malzeme kodu: ${esc(code)}</p><label class="akpi-quantity-label">Yükleme Birimi</label><div class="akpi-unit-options"><button type="button" data-pi="set-unit" data-unit="palet" class="${q.unit!=='kasa'?'selected':''}" aria-pressed="${q.unit!=='kasa'}"><img class="akpi-unit-image" src="akpi-palet.svg" alt=""><strong>Palet</strong><span class="akpi-unit-check">✓</span></button><button type="button" data-pi="set-unit" data-unit="kasa" class="${q.unit==='kasa'?'selected':''}" aria-pressed="${q.unit==='kasa'}"><img class="akpi-unit-image" src="akpi-kasa.svg" alt=""><strong>Kasa</strong><span class="akpi-unit-check">✓</span></button></div><div class="akpi-quantity-selected" style="display:flex;align-items:center;gap:12px;padding:12px;margin:14px 0 10px;background:#172536;border:1px solid #40556a;border-radius:13px"><img src="${productImage(p.name)}" alt="" style="width:55px;height:55px;object-fit:contain;flex-shrink:0"><div style="min-width:0;flex:1"><div style="color:#e9c75c;font-size:11px;font-weight:800;letter-spacing:.8px">SEÇİLEN ÜRÜN</div><strong style="display:block;color:#fff;overflow-wrap:anywhere">${esc(p.name)}</strong><small style="color:#b5c3d2">Kod: ${esc(code)}</small></div><span style="color:#e9c75c;font-size:22px" aria-label="Ürün seçildi">✓</span></div><label class="akpi-quantity-label" for="akpi-quantity-value">Yüklenecek Miktar</label><div class="akpi-quantity-stepper"><button type="button" data-pi="qty-minus" aria-label="Miktarı azalt">−</button><input id="akpi-quantity-value" type="number" min="1" max="999999" step="1" inputmode="numeric" placeholder="0" value="${esc(q.qty)}"><button type="button" data-pi="qty-plus" aria-label="Miktarı artır">＋</button></div><div class="akpi-quantity-preview">Eklenecek yükleme: <strong id="akpi-quantity-preview-text">${esc(q.qty||0)} ${q.unit==='kasa'?'kasa':'palet'}</strong></div><p class="akpi-quantity-help">Miktarı girin ve yükleme listesine ekleyin.</p><div class="akpi-quantity-actions"><button type="button" data-pi="cancel-quantity">Vazgeç</button><button type="button" class="akpi-quantity-save" data-pi="save-quantity">${chosen.includes(code)?'Değişiklikleri Kaydet':'＋ Ürün Ekle'}</button></div></div>`;
 $('#akpi-modal').append(overlay);overlay.querySelector('#akpi-quantity-value').focus();
}
function updateQuantityPreview(){const el=$('#akpi-quantity-preview-text'),input=$('#akpi-quantity-value');if(el&&input){const n=Number(input.value);const unit=$('#akpi-quantity-dialog .akpi-unit-options button.selected')?.dataset.unit||'palet';el.textContent=(Number.isSafeInteger(n)&&n>0?n:0)+' '+unit}}
function updateSelected(){const el=$('#akpi-selected');if(el)el.innerHTML=selectedRows();const add=$('.akpi-add-product');if(add)add.textContent='＋ '+(chosen.length?'Başka Ürün Ekle':'Katalogdan Ürün Seç');const products=$('#akpi-products');if(products)products.innerHTML=productRows()}
async function detailItems(id){try{const x=await api('/rest/v1/ak_palet_return_items?return_id=eq.'+encodeURIComponent(id));const el=$('#akpi-items');if(el&&active===id)el.innerHTML='<h3>Seçilen Ürünler</h3>'+x.map(p=>`<div class="akpi-item"><div><strong>${esc(p.name_snapshot)}</strong><small>${esc(p.code)}</small></div><strong>${p.quantity==null?'Miktar belirtilmemiş':esc(p.quantity)+' '+(p.unit==='kasa'?'kasa':'palet')}</strong></div>`).join('')}catch(e){message=e.message}}
async function loadForkStaff(){forkStaff=await rpc('ak_palet_fork_staff',{});if(!Array.isArray(forkStaff))forkStaff=[]}
async function notifyAssignedForklift(returnId){
 const base=String(window.MK_CONFIG?.url||localStorage.getItem('mk_supabase_url')||'').replace(/\/$/,'');
 const key=window.MK_CONFIG?.key||'';
 if(!base||!key||!session?.access_token)throw Error('Supabase bağlantısı veya oturum eksik');
 const res=await fetch(base+'/functions/v1/send-push',{
  method:'POST',headers:{'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+session.access_token},
  body:JSON.stringify({event:'pallet_return_assigned',return_id:returnId})
 });
 const raw=await res.text();let result;try{result=JSON.parse(raw)}catch{result=null}
 if(!res.ok||result?.error||result?.success===false)throw Error(String(result?.error||result?.message||raw||'Bildirim sunucusu hatası').slice(0,180)+' ('+res.status+')');
 if(result?.sent===0||result?.sent_count===0||result?.delivered===0)throw Error('Seçilen forkliftçinin kayıtlı bildirim cihazı bulunamadı');
 return result;
}
async function assignForklift(e){e.preventDefault();const b=e.target.querySelector('button'),person=e.target.elements.namedItem('forklift').value;if(!person||!assignId)return;b.disabled=true;const returnId=assignId;try{
 await rpc('ak_palet_assign_fork',{p_return_id:returnId,p_fork_id:person});
 const selected=forkStaff.find(x=>x.id===person);let notice='';
 try{await notifyAssignedForklift(returnId);notice='Görev '+(selected?.full_name||'seçilen personele')+' atandı ve push bildirimi gönderildi.'}
 catch(pushError){notice='Görev atandı ancak bildirim gönderilemedi: '+pushError.message}
 page='list';assignId=null;await refresh();message=notice;draw();
 }catch(err){message='Görev atanamadı: '+err.message;draw()}}

async function create(e){e.preventDefault();const f=e.target,b=f.querySelector('button');b.disabled=true;try{const created=await rpc('ak_palet_create',{p_company:f.elements.namedItem('company').value.trim(),p_driver:f.elements.namedItem('driver').value.trim(),p_plate:f.elements.namedItem('plate').value.trim()});await load();const resultId=typeof created==='string'?created:Array.isArray(created)?(created[0]?.id||created[0]?.ak_palet_create||created[0]):created?.id||created?.ak_palet_create;const found=data.find(x=>x.id===resultId)||data.find(x=>x.created_by===uid()&&x.company===f.elements.namedItem('company').value.trim()&&x.plate===f.elements.namedItem('plate').value.trim());if(!found)throw Error('Kayıt oluşturuldu ancak yeni kayıt belirlenemedi. Görevler ekranından kontrol edin.');assignId=found.id;await loadForkStaff();page='assign';message='İade kaydı kaydedildi. Forkliftçi seçin.';draw()}catch(err){message=err.message;page='list';draw()}}
async function cancelReturn(e){e.preventDefault();if(role()!=='count'||!active)return;const reason=e.target.elements.namedItem('reason').value.trim();if(reason.length<5){message='İptal nedenini en az 5 karakter olarak yazın.';return draw()}const btn=e.target.querySelector('[type=submit]');btn.disabled=true;try{await rpc('ak_palet_cancel',{p_id:active,p_reason:reason});await load();cancelOpen=false;page='list';message='İade kaydı iptal edildi. Excel raporunda kayıtlı kalacak.';draw()}catch(err){message='İptal işlemi başarısız: '+err.message;btn.disabled=false;draw()}}
async function saveProduct(e){e.preventDefault();const f=e.target;try{await rpc('ak_palet_catalog_save',{p_code:f.elements.namedItem("code").value.trim(),p_name:f.elements.namedItem("name").value.trim()});await refresh()}catch(e){message=e.message;draw()}}
async function importFile(){
 const f=$('#akpi-file')?.files?.[0];if(!f)return alert('Excel, CSV veya TXT dosyası seçiniz');
 if(f.size>8000000)return alert('Dosya 8 MB sınırını aşıyor');
 let rows=[];
 try{
  if(/\.xlsx?$/i.test(f.name)){
   if(!window.XLSX)await new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';sc.onload=resolve;sc.onerror=()=>reject(Error('Excel okuyucu yüklenemedi. İnternet bağlantısını kontrol edin.'));document.head.append(sc)});
   const wb=XLSX.read(await f.arrayBuffer(),{type:'array',raw:true,cellText:true});
   const ws=wb.Sheets[wb.SheetNames[0]];if(!ws)throw Error('Excel sayfası bulunamadı');
   rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
  }else if(/\.(csv|txt)$/i.test(f.name)){
   const raw=(await f.text()).replace(/^\uFEFF/,'');rows=raw.split(/\r?\n/).filter(x=>x.trim()).map(line=>{const sep=line.includes(';')?';':line.includes('\t')?'\t':',';return line.split(sep).map(x=>x.trim().replace(/^"|"$/g,''))});
  }else throw Error('Yalnızca .xlsx, .xls, .csv ve .txt dosyaları destekleniyor');
  if(rows.length>10000)throw Error('Tek seferde en fazla 10.000 satır yüklenebilir');
  const norm=x=>String(x??'').trim();
  const header=rows.findIndex(r=>r.some(v=>/ürün\s*kodu|malzeme\s*kodu|stok\s*kodu|product\s*code/i.test(norm(v)))&&r.some(v=>/ürün\s*ad[ıi]|malzeme\s*ad[ıi]|ürün\s*ismi|product\s*name/i.test(norm(v))));
  let codeCol=0,nameCol=1;
  if(header>=0){codeCol=rows[header].findIndex(v=>/ürün\s*kodu|malzeme\s*kodu|stok\s*kodu|product\s*code/i.test(norm(v)));nameCol=rows[header].findIndex(v=>/ürün\s*ad[ıi]|malzeme\s*ad[ıi]|ürün\s*ismi|product\s*name/i.test(norm(v)))}
  const found=(header>=0?rows.slice(header+1):rows).map(r=>[norm(r[codeCol]),norm(r[nameCol])]).filter(r=>r[0]&&r[1]&&/\d/.test(r[0])&&!/^(ürün|malzeme|stok)\s*kodu$/i.test(r[0]));
  if(!found.length)throw Error('Ürün kodu ve adı bulunamadı. İlk iki sütun Kod / Ürün Adı olmalı veya başlıklar tanınmalı.');
  const unique=[...new Map(found.map(r=>[r[0],r])).values()];
  if(!confirm(unique.length+' ürün kaydedilsin mi?\nİlk ürün: '+unique[0].join(' · ')+'\nAynı kodlar güncellenecek.'))return;
  let ok=0;try{for(const [code,name] of unique){await rpc('ak_palet_catalog_save',{p_code:code,p_name:name});ok++}await refresh();message=ok+' ürün Excel/katalog dosyasından kaydedildi';draw()}catch(e){message=ok+' ürün kaydedildi; devamında hata: '+e.message;draw()}
 }catch(e){alert('Dosya okunamadı: '+e.message)}
}

let photoDraft=[];let selectedPhotoSource="";
function photoReview(){const el=$('#akpi-photo-review');if(!el)return;el.innerHTML='<p class="akpi-hint">'+photoDraft.length+' satır bulundu. Hatalı kod ve adları düzeltiniz; istemediklerinizi siliniz. Kaydetmeden önce kontrol zorunludur.</p>'+photoDraft.map((r,i)=>`<div class="akpi-grid akpi-photo-row"><label>Kod<input data-photo-code="${i}" value="${esc(r[0])}"></label><label>Ürün adı<input data-photo-name="${i}" value="${esc(r[1])}"></label></div>`).join('')+'<button type="button" data-pi="photo-save">Kontrol Ettim · Ürünleri Kaydet</button>'}
async function readPhoto(){
 const f=$(selectedPhotoSource==='camera'?'#akpi-photo-camera':'#akpi-photo-gallery')?.files?.[0];
 if(!f)return alert('Önce fotoğraf çekiniz veya galeriden seçiniz');
 if(!f.type.startsWith('image/'))return alert('Fotoğraf seçiniz');
 if(f.size>12000000)return alert('Fotoğraf 12 MB sınırını aşıyor');
 const el=$('#akpi-photo-review');el.textContent='Fotoğraf okunuyor; görüntü yönleri kontrol ediliyor…';
 try{
  if(!window.Tesseract)await new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';sc.onload=resolve;sc.onerror=()=>reject(Error('OCR kütüphanesi yüklenemedi'));document.head.append(sc)});
  const bitmap=await createImageBitmap(f);const worker=await Tesseract.createWorker('tur+eng');
  let best=[],bestAngle=0;
  try{
   for(const angle of [0,90,270]){
    el.textContent='Fotoğraf okunuyor… ('+(angle===0?'orijinal':angle+'°')+')';
    const rotated=angle!==0;const scale=Math.min(2,2400/Math.max(bitmap.width,bitmap.height));
    const w=Math.round((rotated?bitmap.height:bitmap.width)*scale),h=Math.round((rotated?bitmap.width:bitmap.height)*scale);
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
    ctx.translate(w/2,h/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(bitmap,-bitmap.width*scale/2,-bitmap.height*scale/2,bitmap.width*scale,bitmap.height*scale);
    const out=await worker.recognize(canvas);const lines=out.data.text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const rows=[];let pending='';
    for(const line of lines){
     const normalized=line.replace(/[|]/g,' ').replace(/(?<=\d)[Oo](?=\d)/g,'0');
     const m=normalized.match(/(?:^|\s)([69]\d{6})\s*[-:;.,]?\s*(.*)/);
     if(m){if(pending&&rows.length&&!rows[rows.length-1][1])rows[rows.length-1][1]=pending;rows.push([m[1],m[2].trim()]);pending='';}
     else if(rows.length&&/^(PALET|KASA|YOĞURT|SEBZE|IFCO|TRENTO|KARPUZ)/i.test(line)&&!rows[rows.length-1][1])rows[rows.length-1][1]=line;
     else pending=line;
    }
    const dedup=[...new Map(rows.map(r=>[r[0],r])).values()];
    const score=x=>x.reduce((n,r)=>n+1+(r[1].length>7?1:0),0);
    if(score(dedup)>score(best)){best=dedup;bestAngle=angle;}
    if(best.length>=22)break;
   }
  }finally{await worker.terminate();bitmap.close?.()}
  photoDraft=best;
  if(!best.length){el.textContent='Kodlar okunamadı. Fotoğrafı daha yakından çekiniz veya CSV yükleyiniz.';return}
  photoReview();const hint=document.createElement('p');hint.className='akpi-hint';hint.textContent='Fotoğraf '+bestAngle+'° yönünde okundu. '+best.length+' ürün bulundu. Fotoğraftaki tüm satırları karşılaştırın; eksik olanları elle ekleyin. Onay vermeden kayıt yapılmaz.';el.prepend(hint);
 }catch(e){el.textContent='Fotoğraf okunamadı: '+e.message}
}
async function savePhotoRows(){const rows=photoDraft.map((r,i)=>[$(`[data-photo-code="${i}"]`)?.value.trim(),$(`[data-photo-name="${i}"]`)?.value.trim()]).filter(r=>r[0]||r[1]);if(!rows.length)return alert('Kaydedilecek ürün bulunamadı');if(rows.some(r=>!/^\d{7,10}$/.test(r[0])||!r[1]||r[1].length<3))return alert('Ürün kodlarını (7-10 rakam) ve adlarını kontrol ediniz');if(new Set(rows.map(r=>r[0])).size!==rows.length)return alert('Tekrarlanan ürün kodlarını düzeltiniz');if(!confirm(rows.length+' ürün Supabase kataloğuna kaydedilsin mi?'))return;let ok=0;try{for(const [code,name] of rows){await rpc('ak_palet_catalog_save',{p_code:code,p_name:name});ok++}photoDraft=[];await refresh();message=ok+' ürün fotoğraftan kontrol edilerek kaydedildi';draw()}catch(e){message=ok+' ürün kaydedildi; devamında hata: '+e.message;draw()}}
async function loadReceivingStaff(){const rows=await rpc('ak_palet_receiving_staff',{});receivingStaff=Array.isArray(rows)?rows:[];}
async function sendCompletionNotification(e){e.preventDefault();const b=e.target.querySelector('[type=submit]'),receiver=e.target.elements.namedItem('receiver').value;if(!receiver||!completionReturnId)return;b.disabled=true;try{const noticeId=await rpc('ak_palet_queue_completion_notice',{p_return_id:completionReturnId,p_receiver_id:receiver});const id=typeof noticeId==='string'?noticeId:(Array.isArray(noticeId)?noticeId[0]:noticeId?.id);if(!id)throw Error('Bildirim kaydı numarası alınamadı');const response=await fetch(cfg.url+'/functions/v1/aktiva-completion-push',{method:'POST',headers:{'Authorization':'Bearer '+session.access_token,'apikey':cfg.key,'Content-Type':'application/json'},body:JSON.stringify({notice_id:id})});const result=await response.json().catch(()=>({}));if(!response.ok||!result.success)throw Error(result.error||'Push gönderilemedi');message='Yükleme tamamlandı bildirimi seçilen mal kabul personeline gönderildi.';completionReturnId=null;page='list';draw()}catch(err){message='Bildirim kaydedilemedi: '+err.message;b.disabled=false;draw()}}
async function complete(){
 if(!chosen.length)return alert('Önce en az bir ürün seçiniz');
 const lines=chosen.map(code=>({code,quantity:Number(quantities[code]?.qty),unit:quantities[code]?.unit||'palet'}));
 if(lines.some(x=>!Number.isSafeInteger(x.quantity)||x.quantity<1||x.quantity>999999))return alert('Her ürün için 1 ile 999999 arasında tam sayı miktar giriniz');
 const pallets=lines.filter(x=>x.unit==='palet').reduce((a,x)=>a+x.quantity,0);
 const cases=lines.filter(x=>x.unit==='kasa').reduce((a,x)=>a+x.quantity,0);
 if(pallets>999999||cases>999999)return alert('Toplam miktar 999999 sınırını aşıyor');
 if(!confirm(chosen.length+' ürün: '+pallets+' palet ve '+cases+' kasa kaydedilecek. Onaylıyor musunuz?'))return;
 try{await rpc('ak_palet_complete_lines',{p_id:active,p_lines:lines});chosen=[];quantities={};search='';await refresh();completionReturnId=active;page='completion-notify';try{await loadReceivingStaff()}catch(e){message='Personel listesi alınamadı: '+e.message}draw()}catch(e){message='Yükleme kaydedilemedi: '+e.message;draw()}
}
const encoder=new TextEncoder();const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const u16=(v)=>[v&255,(v>>>8)&255],u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
const crcTable=(()=>{const a=[];for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);a.push(c>>>0)}return a})();
const crc32=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0};
function zip(files){const parts=[],central=[];let pos=0;for(const [name,content] of files){const n=encoder.encode(name),d=encoder.encode(content),crc=crc32(d);const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0)]);parts.push(local,n,d);central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(pos)]),n);pos+=local.length+n.length+d.length}const centralSize=central.reduce((s,a)=>s+a.length,0);return new Blob([...parts,...central,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(pos),...u16(0)])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
function col(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
function sheet(rows,summary=false){
const count=Math.max(1,rows.length),width=Math.max(1,...rows.map(r=>r.length));
const columnWidths=rows[0].map((h,i)=>{const title=String(h||'');return Math.min(42,Math.max(15,title.length+5,...rows.slice(1,60).map(r=>Math.min(42,String(r[i]??'').length+3))))});
if(summary){const fixed=[31,38,23,20,20];columnWidths.splice(0,columnWidths.length,...fixed)}
const cols='<cols>'+columnWidths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols>';
const data=rows.map((r,ri)=>'<row r="'+(ri+1)+'" ht="'+(ri===0?35:(summary?32:26))+'" customHeight="1">'+r.map((v,ci)=>{const ref=col(ci)+(ri+1),style=ri===0?1:ri%2===0?3:2;if(typeof v==='number'&&Number.isFinite(v))return '<c r="'+ref+'" s="'+style+'"><v>'+v+'</v></c>';return '<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>'}).join('')+'</row>').join('');
const filter=rows.length>1?'<autoFilter ref="A1:'+col(width-1)+count+'"/>':'';
return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/>'+cols+'<sheetData>'+data+'</sheetData>'+filter+'<printOptions horizontalCentered="1"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="'+(summary?'1':'0')+'"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>'}
function workbook(tabs){
const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/><color rgb="FF233046"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF172338"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F4FA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="hair"><color rgb="FFD8E1EC"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="true"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="true"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="true"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
const files=[['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+tabs.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>'],['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+tabs.map((t,i)=>'<sheet name="'+xml(t[0])+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>'],['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+tabs.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(tabs.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],['xl/styles.xml',styles]];tabs.forEach((t,i)=>files.push(['xl/worksheets/sheet'+(i+1)+'.xml',sheet(t[1],i===0)]));return zip(files)}


// Standart ExcelJS XLSX yazıcısı: elle ZIP/XML üretmek yerine uyumlu dosya.
async function compatibleWorkbook(tabs){
 if(!window.ExcelJS)await new Promise((resolve,reject)=>{
  const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  sc.onload=resolve;sc.onerror=()=>reject(Error('Excel oluşturucu yüklenemedi. İnternet bağlantısını kontrol edin.'));
  document.head.appendChild(sc);
 });
 const wb=new window.ExcelJS.Workbook();wb.creator='AKTİVA';wb.modified=new Date();
 const navy='172338',light='EDF2F8',ink='233046',line='D8E1EC';
 const footer='Bu belge, bekleyen, işlemdeki ve tamamlanan operasyonların kayıt ve kontrol amacıyla raporlanması için düzenlenmiştir.';
 for(const [name,rows] of tabs){
  const summary=name==='Özet';
  const ws=wb.addWorksheet(name,{views:[{state:'frozen',ySplit:summary?8:1}],pageSetup:{paperSize:9,orientation:summary?'landscape':'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.4,bottom:.55,header:.15,footer:.25}}});
  const width=Math.max(1,...rows.map(r=>r.length));
  const widths=summary?[15,24,19,19,20,15,13,13]:name==='İşlem Detayları'?[20,18,17,20,21,21,15,40,12,12,15]:name==='Personel Raporu'?[17,27,17,15,15]:[20,18,16,16];
  ws.columns=Array.from({length:width},(_,i)=>({width:widths[i]||18}));
  rows.forEach((values,ri)=>{
   const row=ws.addRow(values);row.height=ri===0?32:25;
   row.alignment={vertical:'middle',wrapText:true};
   row.eachCell({includeEmpty:false},cell=>{
    const heading=summary?(ri===0||ri===7):(ri===0);
    cell.font={name:'Aptos',size:heading?10:10,bold:heading,color:{argb:heading?'FFFFFFFF':'FF'+ink}};
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:heading?'FF'+navy:'FF'+(ri%2===0?'FFFFFF':light)}};
    cell.border={bottom:{style:'hair',color:{argb:'FF'+line}}};
   });
  });
  if(summary){
   ws.mergeCells('A1:H1');ws.getCell('A1').font={name:'Aptos Display',size:17,bold:true,color:{argb:'FFFFFFFF'}};
   ws.getRow(1).height=43;
   ws.mergeCells('A2:H2');ws.getRow(2).height=29;
   ws.mergeCells('A4:B4');ws.mergeCells('C4:D4');ws.mergeCells('E4:F4');ws.mergeCells('G4:H4');
   ws.mergeCells('A5:B5');ws.mergeCells('C5:D5');ws.mergeCells('E5:F5');ws.mergeCells('G5:H5');
   for(const ref of ['A4','C4','E4','G4']){
    const c=ws.getCell(ref);c.font={name:'Aptos',size:10,bold:true,color:{argb:'FF'+ink}};
    c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+light}};
    c.alignment={horizontal:'center',vertical:'middle'};
   }
   for(const ref of ['A5','C5','E5','G5']){
    const c=ws.getCell(ref);c.font={name:'Aptos Display',size:17,bold:true,color:{argb:'FF'+navy}};
    c.alignment={horizontal:'center',vertical:'middle'};
   }
   ws.getRow(5).height=39;
   ws.getRow(7).height=23;ws.getRow(8).height=32;
   ws.autoFilter={from:'A8',to:'H'+Math.max(8,rows.length)};
   ws.pageSetup.printTitlesRow='1:8';
  }else{
   if(rows.length>1)ws.autoFilter={from:{row:1,column:1},to:{row:rows.length,column:width}};
   ws.pageSetup.printTitlesRow='1:1';
  }
  ws.headerFooter.oddFooter='&L'+footer+'&RSayfa &P / &N';
  ws.headerFooter.oddHeader='&CAKTİVA - '+name;
  ws.printOptions={horizontalCentered:true};
  ws.pageSetup.printArea='A1:'+String.fromCharCode(64+width)+Math.max(1,rows.length);
 }
 return new Blob([await wb.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
async function exportReport(){
 const a=$('#akpi-start')?.value,b=$('#akpi-end')?.value;
 if(!a||!b||a>b)return alert('Geçerli tarih aralığı seçiniz');
 const exportButton=document.querySelector('[data-pi="export"]');
 if(exportButton?.disabled)return;
 if(exportButton)exportButton.disabled=true;
 try{
  message='Excel hazırlanıyor…';
  const [returns,items,people]=await Promise.all([getAll('ak_palet_returns'),getAll('ak_palet_return_items'),rpc('ak_palet_report_person_names',{})]);
  const names=Object.fromEntries((people||[]).filter(p=>p.person_id&&p.full_name).map(p=>[p.person_id,p.full_name]));
  const who=id=>id?(names[id]||'Ad soyad kayıtlı değil'):'—';
  const selected=returns.filter(r=>r.created_at&&date(r.created_at)>=a&&date(r.created_at)<=b&&(role()==='count'||r.completed_by===uid()||r.status!=='completed')).sort((x,y)=>String(x.created_at).localeCompare(String(y.created_at))||String(x.id).localeCompare(String(y.id)));
  const statusOf=r=>r.status==='completed'?'Tamamlandı':r.status==='active'?'İşlemde':r.status==='cancelled'?'İptal Edildi':'Bekliyor';
  const statusDate=r=>statusOf(r)+(r.status==='cancelled'?' · '+fmt(r.cancelled_at):r.completed_at?' · '+fmt(r.completed_at):'');
  const ids=new Set(selected.map(r=>r.id));
  const byId=new Map();
  for(const x of items){if(!ids.has(x.return_id))continue;if(!byId.has(x.return_id))byId.set(x.return_id,[]);byId.get(x.return_id).push(x)}
  // Sabit gorunen iade numarasi: IAD-YYNNNNNN (12 karakter).
  // UUID asil benzersiz kimliktir; 6 haneli gorunen kisimda teorik cakisma riski vardir.
  const returnNumber=(id,createdAt)=>{
   const yearMatch=String(createdAt??'').match(/^(\d{4})/);
   const yy=yearMatch?yearMatch[1].slice(-2):'00';
   const raw=String(id??'');
   let hash=14695981039346656037n;
   for(let i=0;i<raw.length;i++){
    hash=BigInt.asUintN(64,(hash^BigInt(raw.charCodeAt(i)))*1099511628211n);
   }
   return 'IAD-'+yy+String(hash%1000000n).padStart(6,'0');
  };
  const shortId=new Map(selected.map(r=>[r.id,returnNumber(r.id,r.created_at)]));
  const amount=x=>{const n=Number(x?.quantity);return Number.isFinite(n)&&n>0?n:0};
  const totals=r=>{let pallet=0,caseCount=0;for(const x of byId.get(r.id)||[]){if(String(x.unit||'').toLocaleLowerCase('tr-TR')==='kasa')caseCount+=amount(x);else if(String(x.unit||'').toLocaleLowerCase('tr-TR')==='palet')pallet+=amount(x)}return [pallet,caseCount]};
  const daily=new Map(),fork=new Map(),receive=new Map();
  const addPerson=(map,id,p,k)=>{const key=id||'bilinmiyor';if(!map.has(key))map.set(key,{name:who(id),count:0,pallet:0,caseCount:0});const v=map.get(key);v.count++;v.pallet+=p;v.caseCount+=k};
  for(const r of selected){if(r.status==='cancelled')continue;const d=date(r.created_at),[p,k]=totals(r);if(!daily.has(d))daily.set(d,{count:0,pallet:0,caseCount:0});const v=daily.get(d);v.count++;v.pallet+=p;v.caseCount+=k;if(r.completed_by)addPerson(fork,r.completed_by,p,k);addPerson(receive,r.created_by,p,k)}
  const totalP=[...daily.values()].reduce((n,v)=>n+v.pallet,0),totalK=[...daily.values()].reduce((n,v)=>n+v.caseCount,0);
  const summary=[
   ['AKTİVA  |  OPERASYON ÖZETİ'],
   ['Palet ve Kasa İade Raporu  •  '+a+' / '+b],
   [],
   ['RAPOR DÖNEMİ','','TOPLAM KAYIT','','TOPLAM PALET','','TOPLAM KASA'],
   [a+' / '+b,'',selected.length,'',totalP,'',totalK],
   [],
   ['İADE KAYITLARI · BEKLEYEN / İŞLEMDE / TAMAMLANAN / İPTAL EDİLEN'],
   ['İade No','Durum / Tamamlanma','Firma','Araç Plakası','Forkliftçi','Mal Kabul','Palet','Kasa']
  ];
  for(const r of selected){const [p,k]=r.status==='cancelled'?[0,0]:totals(r);summary.push([shortId.get(r.id),statusDate(r),r.company,r.plate,who(r.completed_by),who(r.created_by),p,k])}
  if(!selected.length)summary.push(['Seçilen dönemde iade kaydı bulunamadı.']);
  const dayRows=[['Tarih','İşlem Sayısı','Palet','Kasa'],...[...daily.entries()].sort((x,y)=>x[0].localeCompare(y[0])).map(([d,v])=>[d,v.count,v.pallet,v.caseCount]),['TOPLAM',selected.length,totalP,totalK]];
  const personRows=[['Görev','Personel Ad Soyad','İşlem Sayısı','Palet','Kasa'],...[...fork.values()].sort((x,y)=>x.name.localeCompare(y.name,'tr')).map(x=>['Forkliftçi',x.name,x.count,x.pallet,x.caseCount]),...[...receive.values()].sort((x,y)=>x.name.localeCompare(y.name,'tr')).map(x=>['Mal Kabul',x.name,x.count,x.pallet,x.caseCount])];
  const detailRows=[['Kayıt Tarihi','Firma','Plaka','Şoför','Forkliftçi','Mal Kabul Personeli','Ürün Kodu','Ürün Adı','Miktar','Birim','İade No','Durum / Tamamlanma','İptal Nedeni','İptal Eden','İptal Tarihi']];
  for(const r of selected){const xs=byId.get(r.id)||[];for(const x of (xs.length?xs:[null]))detailRows.push([fmt(r.created_at),r.company,r.plate,r.driver,who(r.completed_by),who(r.created_by),x?.code||'—',x?.name_snapshot||'Henüz ürün girilmedi',x?.quantity??'—',x?.unit==='kasa'?'Kasa':x?.unit==='palet'?'Palet':'—',shortId.get(r.id),statusDate(r),r.cancel_reason||'—',who(r.cancelled_by),fmt(r.cancelled_at)]);}
  const blob=await compatibleWorkbook([['Özet',summary],['Günlük Döküm',dayRows],['Personel Raporu',personRows],['İşlem Detayları',detailRows]]);
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='AKTIVA_Rapor_'+a+'_'+b+'.xlsx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  message=selected.length+' kayıt (iptal edilenler dahil) rapora aktarıldı';draw();
 }catch(e){message='Excel oluşturulamadı: '+e.message;draw()}
 finally{const b=document.querySelector('[data-pi="export"]');if(b)b.disabled=false}
}
function mount(){if($('#akpi-modal'))return;const s=document.createElement('style');s.textContent=`#akpi-modal[hidden]{display:none!important}#akpi-modal{position:fixed;inset:0;z-index:2147483000;background:#090e18f5;color:#f3f6fc;overflow:auto;padding:20px 12px 65px;font:15px system-ui}#akpi-content{max-width:860px;margin:auto;background:#151d2a;border:1px solid #354154;border-radius:18px;padding:18px}#akpi-modal *{box-sizing:border-box}#akpi-modal button{background:#b91632;border:1px solid #df3a50;border-radius:10px;color:white;padding:12px;font:600 14px system-ui;cursor:pointer}#akpi-modal .akpi-outline{background:#263348;border-color:#495771}#akpi-modal .akpi-top,#akpi-modal .akpi-item{display:flex;justify-content:space-between;align-items:center;gap:12px}#akpi-modal .akpi-top h2{margin:4px 0}#akpi-modal .akpi-top small,#akpi-modal small{color:#abb8c9;display:block;font-size:12px}#akpi-modal .akpi-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}#akpi-modal .akpi-tabs button{background:#2a3547}#akpi-modal .akpi-item{border:1px solid #39485d;padding:12px;border-radius:12px;margin:8px 0;overflow-wrap:anywhere}#akpi-modal label{display:block;margin:14px 0;color:#d7e1ef;font-weight:600}#akpi-modal select{display:block;width:100%;margin:7px 0;padding:13px;border-radius:10px;background:#101723;color:white;border:1px solid #59677c;font:16px system-ui}#akpi-modal input{display:block;width:100%;margin:7px 0;padding:13px;border-radius:10px;background:#101723;color:white;border:1px solid #59677c;font:16px system-ui}#akpi-modal .akpi-product{display:flex;gap:10px;width:100%;text-align:left;margin:5px 0;background:#222d3d}#akpi-modal .akpi-product.on{border-color:#f2cb40;background:#3c3040}#akpi-modal .akpi-products{max-height:320px;overflow:auto}#akpi-modal .akpi-hint{font-size:13px;color:#b6c3d4;line-height:1.5}#akpi-modal .akpi-msg{padding:10px;background:#46301e;border-radius:8px}#akpi-modal .akpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:550px){#akpi-modal .akpi-grid{grid-template-columns:1fr}#akpi-modal .akpi-top h2{font-size:19px}}`;s.textContent+='#akpi-modal.akpi-receiving{background:rgba(5,10,19,.91);padding:clamp(14px,4vw,28px) 12px 50px}#akpi-modal.akpi-receiving #akpi-content{max-width:720px;background:#151e2d;border:1px solid #35445a;border-radius:20px;padding:clamp(16px,4vw,25px);box-shadow:0 22px 65px #0005}#akpi-modal.akpi-receiving .akpi-top{align-items:flex-start}#akpi-modal.akpi-receiving .akpi-top small{font-size:11px;letter-spacing:1.1px;color:#99abc3}#akpi-modal.akpi-receiving .akpi-top h2{font-size:clamp(19px,5vw,25px);letter-spacing:-.6px;margin:6px 0 0}#akpi-modal.akpi-receiving .akpi-close{padding:0;width:36px;height:36px;min-width:36px;border:1px solid #38475a;background:#263143;font-size:18px}#akpi-modal.akpi-receiving .akpi-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:22px 0 25px}#akpi-modal.akpi-receiving .akpi-tabs button{min-height:64px;display:flex;align-items:center;justify-content:center;gap:8px;background:#1d2a3c;border:1px solid #39495f;color:#e8edf5;padding:11px 8px;font-size:13px;line-height:1.25}#akpi-modal.akpi-receiving .akpi-tabs button.active{background:#c7091b;border-color:#e3384c;color:#fff}#akpi-modal.akpi-receiving .akpi-tab-icon{font-size:20px;line-height:1}#akpi-modal.akpi-receiving .akpi-section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 13px}#akpi-modal.akpi-receiving .akpi-section-title h3{font-size:17px;margin:0}#akpi-modal.akpi-receiving .akpi-count{font-size:11px;color:#c4cfdf;background:#283549;padding:6px 9px;border-radius:99px;white-space:nowrap}#akpi-modal.akpi-receiving .akpi-task{display:block;background:#192436;border:1px solid #35465c;padding:13px 14px;margin:8px 0;border-radius:12px}#akpi-modal.akpi-receiving .akpi-task-main{width:100%;min-width:0}#akpi-modal.akpi-receiving .akpi-task-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px}#akpi-modal.akpi-receiving .akpi-task-head strong{font-size:15px;overflow-wrap:anywhere}#akpi-modal.akpi-receiving .akpi-status{font-size:10px;padding:5px 7px;border-radius:6px;background:#2b394a;color:#d9e5f4;white-space:nowrap}#akpi-modal.akpi-receiving .akpi-status.completed{background:#1c3b32;color:#9ce7c2}#akpi-modal.akpi-receiving .akpi-status.active{background:#46391d;color:#ffe09a}#akpi-modal.akpi-receiving .akpi-task-foot{border-top:1px solid #314055;margin-top:10px;padding-top:10px;display:flex;align-items:center;justify-content:space-between;gap:8px}#akpi-modal.akpi-receiving .akpi-task-foot small{min-width:0;overflow-wrap:anywhere;font-size:11px}#akpi-modal.akpi-receiving .akpi-detail{background:transparent;border:0;color:#ff6574;padding:4px 0 4px 8px;white-space:nowrap;font-size:13px}#akpi-modal.akpi-receiving .akpi-refresh-wrap{text-align:center;margin-top:14px}#akpi-modal.akpi-receiving .akpi-refresh{padding:9px 15px;background:#263348;border-color:#465670;font-size:12px}#akpi-modal.akpi-receiving .akpi-back{background:transparent;border:0;color:#e4afba;padding:7px 0;font-size:13px}#akpi-modal.akpi-receiving button:focus-visible{outline:2px solid #f5c94d;outline-offset:3px}@media(max-width:370px){#akpi-modal.akpi-receiving .akpi-tabs button{font-size:12px;gap:4px}#akpi-modal.akpi-receiving .akpi-task-foot{align-items:flex-start}}';s.textContent+='\n#akpi-modal .akpi-date-filter{margin:0 0 16px;padding:11px;background:#111d2c;border:1px solid #344961;border-radius:13px}\n#akpi-modal .akpi-date-switch{display:grid;grid-template-columns:1fr 1fr;gap:8px}\n#akpi-modal .akpi-date-switch button{background:#223348;border:1px solid #405670;color:#dce6f5;border-radius:10px;padding:11px 7px;font-weight:650}\n#akpi-modal .akpi-date-switch button.selected{background:#31465b;border:2px solid #f4c442;color:#ffd45a;padding:10px 6px}\n#akpi-modal .akpi-date-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}\n#akpi-modal .akpi-date-fields label{font-size:12px;margin:0;color:#b9c9db}\n#akpi-modal .akpi-date-fields input{width:100%;min-width:0;margin:5px 0 0;padding:10px 7px;font-size:14px;color-scheme:dark}\n#akpi-modal .akpi-date-caption{margin:9px 3px 0;color:#aabdd2;font-size:12px}\n#akpi-modal .akpi-date-warning{color:#ffb1a6;font-size:12px;margin:8px 0 0}\n@media(max-width:360px){#akpi-modal .akpi-date-fields{grid-template-columns:1fr}}\n';s.textContent+='\n/* AKTIVA - Sadece palet iade gorev listesi: sakin, kurumsal gorunum. */\n#akpi-modal .akpi-section-title{align-items:center!important;margin:2px 0 15px!important}\n#akpi-modal .akpi-section-heading{min-width:0}\n#akpi-modal .akpi-section-heading h3{font-size:17px!important;letter-spacing:-.3px;line-height:1.25;margin:0 0 5px!important;color:#f1f5fc}\n#akpi-modal .akpi-section-heading p{margin:0;color:#91a4ba;font-size:11px;line-height:1.45;font-weight:400}\n#akpi-modal .akpi-count{background:#26364a!important;color:#d8e3ef!important;border:1px solid #35485e!important;font-size:11px!important;padding:7px 10px!important}\n#akpi-modal .akpi-date-filter{padding:12px!important;margin:0 0 17px!important;background:#152338!important;border:1px solid #34485f!important;border-radius:15px!important}\n#akpi-modal .akpi-date-switch{gap:4px!important;padding:4px;background:#0d1929;border:1px solid #2c4056;border-radius:12px}\n#akpi-modal .akpi-date-switch button{min-width:0;min-height:43px;background:transparent!important;border:1px solid transparent!important;border-radius:9px!important;color:#aabbd0!important;padding:10px 6px!important;font-size:13px!important;font-weight:600!important;box-shadow:none!important;letter-spacing:0!important}\n#akpi-modal .akpi-date-switch button.selected{background:#2d435a!important;border:1px solid #49647e!important;color:#fff!important;padding:10px 6px!important;box-shadow:0 2px 8px #0002!important}\n#akpi-modal .akpi-date-switch button:focus-visible{outline:2px solid #9db8d3!important;outline-offset:2px}\n#akpi-modal .akpi-date-fields{gap:12px!important;margin-top:14px!important}\n#akpi-modal .akpi-date-fields label{min-width:0!important;font-size:11px!important;font-weight:550!important;color:#b7c8d9!important;letter-spacing:.1px}\n#akpi-modal .akpi-date-fields input{min-width:0!important;width:100%!important;max-width:100%!important;margin:7px 0 0!important;padding:10px 7px!important;min-height:45px!important;background:#0f1b2c!important;border:1px solid #40536a!important;border-radius:10px!important;color:#eef4fb!important;font-size:12px!important;font-weight:500!important;color-scheme:dark!important;box-shadow:none!important}\n#akpi-modal .akpi-date-fields input:focus{outline:2px solid #688baa;outline-offset:1px}\n#akpi-modal .akpi-date-caption{font-size:12px!important;color:#a7bad0!important;margin:13px 4px 2px!important;line-height:1.5}\n#akpi-modal .akpi-empty{color:#9aacc2!important;font-size:13px!important;line-height:1.55!important;text-align:center;padding:18px 8px!important}\n#akpi-modal .akpi-task{background:#192a3e!important;border:1px solid #354b64!important;border-radius:14px!important;padding:14px!important;margin:10px 0!important}\n#akpi-modal .akpi-task-head strong{font-size:14px!important;letter-spacing:-.2px}\n#akpi-modal .akpi-task-foot{border-top-color:#32485e!important}\n#akpi-modal .akpi-task .akpi-detail{background:#273a50!important;border:1px solid #47617b!important;border-radius:9px!important;color:#e6eef9!important;padding:7px 10px!important;font-size:12px!important}\n#akpi-modal .akpi-refresh{background:#223348!important;border:1px solid #405770!important;color:#d4e1f0!important;border-radius:10px!important;font-size:12px!important;padding:9px 15px!important}\n@media(max-width:370px){#akpi-modal .akpi-date-fields{gap:7px!important}#akpi-modal .akpi-date-fields input{font-size:11px!important;padding:9px 4px!important}#akpi-modal .akpi-section-heading p{font-size:10px}}\n';document.head.append(s);const reportStyle=document.createElement('style');reportStyle.textContent='#akpi-modal .akpi-report-dates{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:12px!important;width:100%!important;min-width:0!important;max-width:100%!important}#akpi-modal .akpi-report-dates>label{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;overflow:visible!important}#akpi-modal .akpi-report-dates input[type=date]{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box!important;margin:8px 0 0!important;padding:12px!important;font-size:16px!important;min-height:48px!important}#akpi-modal .akpi-report-dates input[type=date]::-webkit-date-and-time-value{min-width:0;text-align:center}\n/* Excel tarihleri: hem forklift hem mal kabul, iOS Safari tasma onarimi */\n#akpi-modal .akpi-report-dates{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow:hidden!important;padding:0 8px 0 0!important}\n#akpi-modal .akpi-report-dates>label{display:block!important;position:relative!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;padding:0!important;margin:0 0 16px!important;overflow:hidden!important}\n#akpi-modal .akpi-report-dates>label>input[type=date]{display:block!important;position:relative!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;margin:8px 0 0!important;padding:10px 12px!important;min-height:48px!important;font-size:16px!important;transform:none!important;left:auto!important;right:auto!important}\n#akpi-modal .akpi-report-dates>label>input[type=date]::-webkit-date-and-time-value{min-width:0!important;text-align:center!important}\n';document.head.append(reportStyle);const reportEdgeStyle=document.createElement('style');reportEdgeStyle.textContent='#akpi-modal .akpi-report-dates{width:100%!important;max-width:100%!important;min-width:0!important;padding-right:16px!important;box-sizing:border-box!important;overflow:visible!important}#akpi-modal .akpi-report-dates>label{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow:visible!important}#akpi-modal .akpi-report-dates #akpi-start,#akpi-modal .akpi-report-dates #akpi-end{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;margin:8px 0 0!important;position:relative!important;left:0!important;right:auto!important}';document.head.append(reportEdgeStyle);const receivingPolish=document.createElement('style');receivingPolish.textContent=`
/* Yalnız Mal Kabul: Palet İade Operasyonu butonları */
#akpi-modal.akpi-receiving button:not(.akpi-cancel-confirm):not(.akpi-cancel-button){background:#263b52!important;background-image:none!important;border:1px solid #4b647e!important;color:#eaf1fa!important;border-radius:11px!important;box-shadow:none!important;font-weight:650!important;transition:background .15s,border-color .15s}
#akpi-modal.akpi-receiving button:not(.akpi-cancel-confirm):not(.akpi-cancel-button):hover{background:#344e68!important;border-color:#7790a9!important}
#akpi-modal.akpi-receiving .akpi-tabs button.active,#akpi-modal.akpi-receiving .akpi-date-switch button.selected,#akpi-modal.akpi-receiving .akpi-unit-options button.selected{background:#244c64!important;border-color:#5a94ac!important;color:#fff!important}
#akpi-modal.akpi-receiving button.akpi-cancel-confirm,#akpi-modal.akpi-receiving button.akpi-cancel-button{background:#a83245!important;border-color:#c65d6e!important;color:#fff!important}
#akpi-modal.akpi-receiving button:focus-visible{outline:2px solid #92c9e2!important;outline-offset:2px}
`;document.head.append(receivingPolish);const el=document.createElement('section');el.id='akpi-modal';el.hidden=true;el.innerHTML='<div id="akpi-content"></div>';document.body.append(el);el.addEventListener('input',e=>{if(e.target.id==='akpi-catalog-search'){catalogSearch=e.target.value;const list=$('#akpi-catalog-results');if(list)list.innerHTML=catalogRowsHtml();return}if(e.target.id==='akpi-quantity-value')updateQuantityPreview();const code=e.target.dataset.akpiQty;if(code&&quantities[code]){quantities[code].qty=e.target.value;const total=$('.akpi-totals');if(total){const t=chosen.reduce((a,c)=>{const q=quantities[c]||{},n=Number(q.qty);if(Number.isSafeInteger(n)&&n>0&&n<=999999)a[q.unit==='kasa'?'kasa':'palet']+=n;return a},{palet:0,kasa:0});total.querySelector('span').textContent=t.palet+' palet · '+t.kasa+' kasa'}}});el.addEventListener('change',e=>{if(e.target.id==='akpi-date-start'||e.target.id==='akpi-date-end'){if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))return;if(e.target.id==='akpi-date-start')taskDateStart=e.target.value;else taskDateEnd=e.target.value;draw();return}const code=e.target.dataset.akpiUnit;if(code&&quantities[code]){quantities[code].unit=e.target.value;const selectedHost=$('#akpi-selected');if(selectedHost)selectedHost.innerHTML=selectedRows()}if(e.target.id==='akpi-photo-camera'&&e.target.files?.length){selectedPhotoSource='camera';const other=$('#akpi-photo-gallery');if(other)other.value=''}else if(e.target.id==='akpi-photo-gallery'&&e.target.files?.length){selectedPhotoSource='gallery';const other=$('#akpi-photo-camera');if(other)other.value=''}});el.addEventListener('click',async e=>{const b=e.target.closest('[data-pi]');if(!b)return;const act=b.dataset.pi;if(act==='task-status'){taskStatus=b.dataset.status||'all';draw();return}if(act==='report-today'||act==='report-week'||act==='report-month'){const a=$('#akpi-start'),z=$('#akpi-end');if(a&&z){const now=new Date();z.value=today();a.value=date(new Date(now.getTime()-(act==='report-today'?0:act==='report-week'?6:29)*86400000));el.querySelectorAll('.akpi-report-presets button').forEach(x=>x.classList.toggle('selected',x===b))}return}if(act==='date-today'){taskDateMode='today';draw();return}if(act==='date-range'){taskDateMode='range';draw();return}if(act==='close')return close();if(act==='filter-products'){productFilter=b.dataset.filter;el.querySelectorAll('.akpi-filter-tabs button').forEach(x=>x.classList.toggle('selected',x.dataset.filter===productFilter));const list=$('#akpi-products');if(list)list.innerHTML=productRows();return}if(act==='add-product'){pickerOpen=true;search='';const picker=$('#akpi-picker');if(picker)picker.hidden=false;const field=$('#akpi-search');if(field){field.value='';field.focus()}const products=$('#akpi-products');if(products)products.innerHTML=productRows();return}if(act==='pick-product'||act==='edit-line'){openQuantity(b.dataset.code);return}
if(act==='cancel-quantity'){editingCode=null;$('#akpi-quantity-dialog')?.remove();return}
if(act==='set-unit'){const wrap=b.closest('.akpi-unit-options');wrap.querySelectorAll('button').forEach(x=>{const yes=x===b;x.classList.toggle('selected',yes);x.setAttribute('aria-pressed',String(yes))});updateQuantityPreview();return}if(act==='qty-minus'||act==='qty-plus'){const input=$('#akpi-quantity-value');if(input){const current=Number(input.value)||0;input.value=String(Math.max(1,Math.min(999999,current+(act==='qty-plus'?1:-1))));updateQuantityPreview()}return}
if(act==='save-quantity'){
 const code=editingCode,field=$('#akpi-quantity-value'),n=Number(field?.value),unit=$('#akpi-quantity-dialog .akpi-unit-options button.selected')?.dataset.unit||'palet';
 if(!code||!field?.value.trim()||!Number.isSafeInteger(n)||n<1||n>999999){alert('1 ile 999999 arasında geçerli bir tam sayı giriniz.');field?.focus();return}
 if(!chosen.includes(code))chosen.push(code);quantities[code]={qty:String(n),unit};editingCode=null;$('#akpi-quantity-dialog')?.remove();pickerOpen=false;const picker=$('#akpi-picker');if(picker)picker.hidden=true;search='';const fieldSearch=$('#akpi-search');if(fieldSearch)fieldSearch.value='';updateSelected();return
}
if(act==='remove-line'){const code=b.dataset.code;if(!chosen.includes(code))return;if(!confirm('Bu ürünü yükleme listesinden kaldırmak istiyor musunuz?'))return;chosen=chosen.filter(x=>x!==code);delete quantities[code];updateSelected();return}
if(act==='cancel-dismiss'){cancelOpen=false;message='';return draw()}if(act==='cancel-return'){if(role()!=='count')return;active=b.dataset.id;cancelOpen=true;message='';draw();$('#akpi-cancel-reason')?.focus();return}if(act==='assign'){assignId=b.dataset.id;try{await loadForkStaff()}catch(err){message=err.message}page='assign';return draw()}if(act==='detail'){editingCode=null;$('#akpi-quantity-dialog')?.remove();active=b.dataset.id;chosen=[];quantities={};search='';pickerOpen=true;page='detail';const r=data.find(x=>x.id===active);if(role()==='fork'&&r?.status==='waiting')try{await rpc('ak_palet_open',{p_id:active});await load()}catch(err){message=err.message}return draw()}if(act==='retry-receivers'){try{await loadReceivingStaff();message=''}catch(err){message=err.message}return draw()}if(act==='refresh')return refresh();if(act==='import')return importFile();if(act==='photo-read')return readPhoto();if(act==='photo-save')return savePhotoRows();if(act==='complete')return complete();if(act==='export')return exportReport();page=act;message='';draw()});}
function corporateForkStyle(){if(document.getElementById('akpi-fork-corporate'))return;
const style=document.createElement('style');style.id='akpi-fork-corporate';style.textContent=`
#ak-fork-host .afv-cards .akpi-entry{visibility:visible!important;opacity:1!important}
#akpi-modal:not(.akpi-receiving){background:rgba(7,11,18,.96);padding:18px 12px 50px}
#akpi-modal:not(.akpi-receiving) #akpi-content{max-width:720px;background:#141c28;border:1px solid #344256;border-radius:17px;padding:clamp(16px,4vw,24px);box-shadow:0 20px 65px #0007}
#akpi-modal:not(.akpi-receiving) .akpi-top{align-items:flex-start}
#akpi-modal:not(.akpi-receiving) .akpi-top small{font-size:11px;letter-spacing:1px;color:#9eafc2}
#akpi-modal:not(.akpi-receiving) .akpi-top h2{font-size:clamp(19px,5vw,24px);line-height:1.25;margin:7px 0 0;letter-spacing:-.4px}
#akpi-modal:not(.akpi-receiving) .akpi-close{width:38px;height:38px;min-width:38px;background:#263345;border:1px solid #405168;padding:0}
#akpi-modal:not(.akpi-receiving) .akpi-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:20px 0 23px}
#akpi-modal:not(.akpi-receiving) .akpi-tabs button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:46px;background:#263245;border:1px solid #3b4b61;padding:9px 7px;font-size:13px;white-space:normal}
#akpi-modal:not(.akpi-receiving) .akpi-tabs button.active{background:#ad1021;border-color:#bd2b3c}
#akpi-modal:not(.akpi-receiving) .akpi-tab-icon{font-size:17px}
#akpi-modal:not(.akpi-receiving) .akpi-section-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 12px}
#akpi-modal:not(.akpi-receiving) .akpi-section-title h3{font-size:17px;margin:0}
#akpi-modal:not(.akpi-receiving) .akpi-count{font-size:12px;background:#293649;color:#cbd6e3;border-radius:7px;padding:6px 9px;white-space:nowrap}
#akpi-modal:not(.akpi-receiving) .akpi-task{display:block;background:#1b2635;border:1px solid #39495d;border-radius:12px;padding:14px;margin:10px 0}
#akpi-modal:not(.akpi-receiving) .akpi-task-main{width:100%;min-width:0}
#akpi-modal:not(.akpi-receiving) .akpi-task-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px}
#akpi-modal:not(.akpi-receiving) .akpi-task-head strong{font-size:16px;min-width:0;overflow-wrap:anywhere}
#akpi-modal:not(.akpi-receiving) .akpi-status{font-size:11px;flex-shrink:0;background:#354154;color:#e4ebf4;padding:5px 9px;border-radius:7px;white-space:nowrap}
#akpi-modal:not(.akpi-receiving) .akpi-status.completed{background:#1d4237;color:#a2e5c2}
#akpi-modal:not(.akpi-receiving) .akpi-status.active{background:#4b3a21;color:#ffe0a0}
#akpi-modal:not(.akpi-receiving) .akpi-task-foot{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;border-top:1px solid #344359;margin-top:11px;padding-top:11px}
#akpi-modal:not(.akpi-receiving) .akpi-task-foot small{flex:1;min-width:140px;line-height:1.4}
#akpi-modal:not(.akpi-receiving) .akpi-detail{background:#a80f20;border:1px solid #bb2b3b;padding:9px 13px;font-size:12px;border-radius:8px;white-space:nowrap}
#akpi-modal:not(.akpi-receiving) .akpi-refresh-wrap{display:flex;justify-content:flex-end;margin-top:15px}
#akpi-modal:not(.akpi-receiving) .akpi-refresh{font-size:12px;padding:9px 12px}
#akpi-modal .akpi-line{background:#1c2838;border:1px solid #38495d;border-radius:12px;padding:12px;margin:10px 0}#akpi-modal .akpi-line-title{display:flex;align-items:center;justify-content:space-between;gap:8px}#akpi-modal .akpi-line-inputs{display:grid;grid-template-columns:1fr 1fr;gap:10px}#akpi-modal .akpi-line-inputs label{font-size:12px;margin:8px 0 0}#akpi-modal .akpi-remove{background:#303b4a;border-color:#435168;padding:7px 11px}#akpi-modal .akpi-totals{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#263447;padding:13px;border-radius:9px;margin:15px 0;color:#fbd25d}#akpi-modal #akpi-picker[hidden]{display:none!important}#akpi-modal .akpi-add-product{width:100%;background:#26384d;border:1px dashed #8293a9;color:#f5f7fa;margin:12px 0;font-weight:650}#akpi-modal .akpi-complete{width:100%;margin-top:14px}#akpi-modal #akpi-selected h3{margin:16px 0 8px}#akpi-modal #akpi-selected h3 small{display:inline;color:#aab9ca;font-weight:400}@media(max-width:370px){#akpi-modal .akpi-line-inputs{grid-template-columns:1fr}}

#akpi-modal .akpi-selected-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0 10px}
#akpi-modal .akpi-selected-heading h3{margin:0;font-size:19px}
#akpi-modal .akpi-selected-heading span{background:#29394f;padding:7px 11px;border-radius:9px;color:#e1e9f4;font-weight:700}
#akpi-modal .akpi-line-card{padding:16px;margin:12px 0;border:1px solid #455671;background:#1b293b}
#akpi-modal .akpi-line-card strong{font-size:16px}
#akpi-modal .akpi-line-amount{color:#f6cf59;font-size:18px;font-weight:800;white-space:nowrap}
#akpi-modal .akpi-line-actions{display:flex;gap:9px;margin-top:15px}
#akpi-modal .akpi-line-actions button{flex:1;background:#293b52;border:1px solid #4a5f7a}
#akpi-modal .akpi-line-actions .akpi-remove{background:#422634;border-color:#7d3c4e;color:#ffd1d8}
#akpi-modal .akpi-product{align-items:center;min-height:67px;border:1px solid #43536a;padding:13px!important;margin:9px 0!important;border-radius:12px}
#akpi-modal .akpi-product-plus{display:grid;place-items:center;min-width:33px;height:33px;border-radius:9px;background:#ad1529;font-size:22px}
#akpi-modal .akpi-product-arrow{margin-left:auto;font-size:24px;color:#c9d4e5}
#akpi-modal .akpi-product strong{font-size:15px}
#akpi-modal .akpi-quantity-overlay{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,7,16,.92);overflow:auto}
#akpi-modal .akpi-quantity-panel{width:min(100%,510px);max-height:calc(100dvh - 36px);overflow-y:auto;background:#182436;border:1px solid #586a83;border-radius:22px;padding:clamp(19px,5vw,30px);box-shadow:0 28px 90px #000b}
#akpi-modal .akpi-quantity-top{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#b5c4d8;font-size:11px;letter-spacing:1.5px;font-weight:750}
#akpi-modal .akpi-quantity-top button{background:#344158;border-color:#53647c;min-width:39px;height:39px;padding:0;font-size:19px}
#akpi-modal .akpi-quantity-panel h2{font-size:clamp(22px,5vw,29px);line-height:1.2;margin:18px 0 7px;overflow-wrap:anywhere}
#akpi-modal .akpi-quantity-code{color:#9fb1c8;margin:0 0 25px;font-size:13px}
#akpi-modal .akpi-quantity-label{font-size:14px;color:#f1f5fc;margin:20px 0 10px;font-weight:750}
#akpi-modal .akpi-unit-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#akpi-modal .akpi-unit-options button{background:#263448;border:2px solid #475971;border-radius:13px;min-height:70px;font-size:19px}
#akpi-modal .akpi-unit-options button.selected{background:#a90c22;border-color:#ff5b6d;box-shadow:0 0 0 2px #c62e3e44}
#akpi-modal #akpi-quantity-value{height:84px;text-align:center;font-size:38px;font-weight:800;background:#0e1726;border:2px solid #5a6f8b;border-radius:14px;margin:0}
#akpi-modal #akpi-quantity-value:focus{outline:2px solid #f6d15d;outline-offset:2px}
#akpi-modal .akpi-quantity-help{font-size:12px;color:#a9bbd0;line-height:1.5;margin:10px 0 23px}
#akpi-modal .akpi-quantity-actions{display:grid;grid-template-columns:1fr 1.5fr;gap:10px}
#akpi-modal .akpi-quantity-actions button{min-height:56px;font-size:15px}
#akpi-modal .akpi-quantity-actions button:first-child{background:#354359;border-color:#5a6a80}
#akpi-modal .akpi-quantity-actions .akpi-quantity-save{background:#d00621;border-color:#f43a50}

#akpi-modal .akpi-unit-options button{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:112px;background:#172436!important;border:2px solid #4b5e78!important;color:#dce6f4!important;box-shadow:none!important;transition:background .12s,border-color .12s}
#akpi-modal .akpi-unit-options button.selected{background:linear-gradient(135deg,#ae0017,#ed0927)!important;border:3px solid #ff8a9a!important;color:#fff!important;box-shadow:0 0 0 3px rgba(255,78,104,.18)!important}
#akpi-modal .akpi-unit-options .akpi-unit-icon{font-size:28px;line-height:1}
#akpi-modal .akpi-unit-options strong{font-size:20px}
#akpi-modal .akpi-unit-check{display:none;position:absolute;right:10px;top:8px;width:26px;height:26px;border-radius:50%;background:#fff;color:#bd001c;font-size:18px;font-weight:900;line-height:26px}
#akpi-modal .akpi-unit-options button.selected .akpi-unit-check{display:block}
#akpi-modal .akpi-quantity-stepper{display:grid;grid-template-columns:64px minmax(0,1fr) 64px;gap:9px;align-items:center}
#akpi-modal .akpi-quantity-stepper button{height:74px;border-radius:14px;background:#c9001e;border:1px solid #fa3855;font-size:32px;padding:0}
#akpi-modal .akpi-quantity-stepper #akpi-quantity-value{height:74px;min-width:0;font-size:34px}
#akpi-modal .akpi-quantity-preview{margin:17px 0 20px;padding:15px;border-radius:13px;background:#303045;border:1px solid #5a4555;color:#dce4ee;font-size:14px}
#akpi-modal .akpi-quantity-preview strong{display:block;margin-top:5px;font-size:25px;color:#ffce52}
/* AKTİVA premium palet iade görsel katmanı */
#akpi-modal #akpi-content{background:linear-gradient(155deg,#111e2d,#0b1725 75%)!important;border:1px solid #344b62!important;box-shadow:0 18px 65px #0009!important}
#akpi-modal .akpi-top h2{color:#f2f6fd;letter-spacing:-.5px}
#akpi-modal .akpi-top h2::first-letter{color:#f2f6fd}
#akpi-modal .akpi-tabs button,#akpi-modal:not(.akpi-receiving) .akpi-tabs button,#akpi-modal.akpi-receiving .akpi-tabs button{background:linear-gradient(145deg,#25364a,#172637)!important;border:1px solid #3d526b!important;color:#f3f6fb!important;border-radius:12px!important;box-shadow:inset 0 1px #ffffff0b!important}
#akpi-modal .akpi-tabs button.active,#akpi-modal:not(.akpi-receiving) .akpi-tabs button.active,#akpi-modal.akpi-receiving .akpi-tabs button.active{border-color:#f3c83e!important;background:#2b3540!important;color:#ffdb60!important}
#akpi-modal .akpi-tab-icon{color:#ffcd3f}
#akpi-modal .akpi-task,#akpi-modal .akpi-line-card,#akpi-modal .akpi-product{background:linear-gradient(135deg,#1b2a3d,#132131)!important;border:1px solid #3c526c!important;border-radius:14px!important}
#akpi-modal .akpi-detail,#akpi-modal:not(.akpi-receiving) .akpi-detail{background:#27384c!important;border:1px solid #536a85!important;color:#e9f0fb!important}
#akpi-modal .akpi-product{display:flex;align-items:center;gap:12px;min-height:94px;padding:10px!important;text-align:left;width:100%;overflow:hidden}
#akpi-modal .akpi-illustration{display:block;width:82px;height:72px;object-fit:contain;flex:none;background:radial-gradient(ellipse,#31445a88,transparent 75%);border-radius:10px}
#akpi-modal .akpi-product-info{min-width:0;flex:1;overflow-wrap:anywhere}
#akpi-modal .akpi-product-info strong{display:block;color:#f4f7ff;font-size:13px;line-height:1.35}
#akpi-modal .akpi-product-info small{margin-top:5px;color:#a5b7cb;font-size:11px}
#akpi-modal .akpi-product-plus{flex:none;margin-left:auto;display:grid;place-items:center;min-width:38px;height:40px;background:#344a62!important;border:1px solid #5a7594!important;border-radius:9px;color:white;font-size:25px}
#akpi-modal .akpi-line-title{align-items:center;gap:10px;flex-wrap:wrap}
#akpi-modal .akpi-line-info{flex:1;min-width:130px;overflow-wrap:anywhere}
#akpi-modal .akpi-line-info small{margin-top:5px}
#akpi-modal .akpi-line-amount{color:#ffcf43!important}
#akpi-modal .akpi-line-actions button{background:#293d52!important;border-color:#56718e!important}
#akpi-modal .akpi-line-actions .akpi-remove{background:#291c27!important;border-color:#ad3a4b!important;color:#ff8e9a!important}
#akpi-modal .akpi-add-product{background:#152536!important;border:1px dashed #8394a9!important;color:#fff!important}
#akpi-modal .akpi-totals{background:#23354a!important;color:#ffd34e!important;border:1px solid #354b63}
#akpi-modal .akpi-complete{background:linear-gradient(110deg,#b9001c,#f20a27)!important;border:1px solid #ff3850!important}
#akpi-modal .akpi-filter-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:12px 0}
#akpi-modal .akpi-filter-tabs button{background:#1a293b!important;border:1px solid #3d5168!important;border-radius:10px!important;padding:10px 4px!important;font-size:12px!important;color:#d9e4f2!important}
#akpi-modal .akpi-filter-tabs button.selected{background:#ffd044!important;color:#152030!important;border-color:#ffe186!important}
#akpi-modal .akpi-products{max-height:440px;overflow:auto;overscroll-behavior:contain}
#akpi-modal .akpi-unit-options button.selected{background:#29384b!important;border:2px solid #ffd04a!important;color:#ffda6d!important;box-shadow:0 0 0 2px #ffd04a22!important}
#akpi-modal .akpi-unit-check{background:#ffd044!important;color:#172231!important}
#akpi-modal .akpi-unit-image{width:85px;height:65px;object-fit:contain}
#akpi-modal .akpi-quantity-stepper button{background:#34475e!important;border-color:#5a7190!important}
#akpi-modal .akpi-quantity-actions .akpi-quantity-save{background:#b90924!important}
@media(max-width:390px){#akpi-modal .akpi-illustration{width:64px;height:60px}#akpi-modal .akpi-product{gap:7px}#akpi-modal .akpi-product-info strong{font-size:12px}#akpi-modal .akpi-product-plus{min-width:34px;height:36px}}

@media(max-width:380px){#akpi-modal .akpi-quantity-stepper{grid-template-columns:49px minmax(0,1fr) 49px}#akpi-modal .akpi-quantity-stepper button{height:65px}#akpi-modal .akpi-unit-options button{min-height:98px}}

/* Palet iade iptal gorunumu: sadece bu modul, forklift push kodu degismez */
#akpi-modal .akpi-task.akpi-is-cancelled{background:#241f2b!important;border:1px solid #925264!important;box-shadow:inset 3px 0 0 #f07988!important}
#akpi-modal .akpi-status.cancelled{background:#783040!important;border:1px solid #c96577!important;color:#fff0f1!important;font-weight:750!important;font-size:11px!important}
#akpi-modal .akpi-cancel-summary{display:flex;flex-direction:column;gap:5px;padding:11px 12px;margin:12px 0 2px;background:#392630;border:1px solid #80505e;border-radius:10px;overflow-wrap:anywhere}
#akpi-modal .akpi-cancel-summary strong{font-size:12px;color:#ffb4be}
#akpi-modal .akpi-cancel-summary span{font-size:12px;color:#f1d7dc;line-height:1.5}
#akpi-modal .akpi-cancel-summary small{font-size:11px;color:#d3a7b1}
#akpi-modal .akpi-task .akpi-cancel-button{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;white-space:nowrap!important;min-width:0!important;padding:9px 12px!important;background:#452a37!important;color:#ffdce2!important;border:1px solid #a45d70!important;border-radius:10px!important;font-size:12px!important;font-weight:700!important;line-height:1.2!important;box-shadow:none!important}
#akpi-modal .akpi-task .akpi-cancel-button:hover{background:#613342!important}
#akpi-modal .akpi-cancel-overlay{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(4,10,19,.83);overflow-y:auto}
#akpi-modal .akpi-cancel-dialog{width:min(100%,480px);max-height:calc(100dvh - 36px);overflow-y:auto;background:#172437;border:1px solid #4c5c71;border-radius:18px;padding:20px;box-shadow:0 24px 70px #0009}
#akpi-modal .akpi-cancel-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
#akpi-modal .akpi-cancel-dialog-head small{color:#a7bad0;font-size:10px;letter-spacing:1px}
#akpi-modal .akpi-cancel-dialog-head h3{font-size:20px;line-height:1.25;color:#fff;margin:8px 0 0}
#akpi-modal .akpi-cancel-dismiss{background:#2b3c50!important;border:1px solid #53647a!important;border-radius:9px!important;min-width:37px;padding:8px!important}
#akpi-modal .akpi-cancel-target{display:flex;flex-direction:column;gap:5px;margin-top:20px;padding:14px;background:#223348;border:1px solid #3e536b;border-radius:12px}
#akpi-modal .akpi-cancel-target strong{color:#fff;font-size:16px}
#akpi-modal .akpi-cancel-target span{color:#b6c7db;font-size:12px}
#akpi-modal .akpi-cancel-explainer{color:#c8d3e2;font-size:12px;line-height:1.6;margin:15px 0}
#akpi-modal #akpi-cancel-form label{margin:12px 0 8px;font-size:13px;color:#f0f4fa}
#akpi-modal #akpi-cancel-form label em{font-style:normal;color:#ffabb9;margin-left:4px}
#akpi-modal #akpi-cancel-form textarea{display:block;width:100%;resize:vertical;min-height:112px;padding:13px;border:1px solid #60748c;border-radius:11px;background:#0d1929;color:#fff;font:14px system-ui;box-sizing:border-box}
#akpi-modal #akpi-cancel-form textarea:focus{outline:2px solid #8caecf;outline-offset:1px}
#akpi-modal .akpi-cancel-actions{display:grid;grid-template-columns:1fr 1.2fr;gap:9px;margin-top:18px}
#akpi-modal .akpi-cancel-actions button{min-height:46px!important;padding:10px!important;font-size:13px!important;border-radius:10px!important}
#akpi-modal .akpi-cancel-nevermind{background:#2b3c50!important;border:1px solid #50637b!important;color:#e3ebf6!important}
#akpi-modal .akpi-cancel-confirm{background:#b91d37!important;border:1px solid #e15a70!important;color:#fff!important}
@media(max-width:420px){#akpi-modal .akpi-task-foot{gap:8px!important}#akpi-modal .akpi-task-foot small{flex-basis:100%!important;min-width:0!important}#akpi-modal .akpi-cancel-dialog{padding:16px}}
`;document.head.append(style)}
function attach(){if(!uid()||!['count','fork'].includes(role()))return;mount();if(role()==='fork'||role()==='count')return;const target=$('#akd-dashboard .akd-actions');if(!target||target.querySelector('.akpi-entry'))return;const b=document.createElement('button');b.type='button';b.className=(role()==='count'?'akd-action':'afv-card')+' akpi-entry';b.innerHTML=role()==='count'?'<span class="akd-action-ico">♻</span><strong>Palet İade Operasyonu</strong><small>İade görevi, katalog ve Excel raporu</small><b>›</b>':'<span class="afv-card-icon">♻</span><strong>Palet İade</strong><span class="afv-arrow">›</span>';b.addEventListener('click',open);target.append(b)}
function malKabulPaletStyle(){if(document.getElementById('akpi-receiving-v2'))return;const st=document.createElement('style');st.id='akpi-receiving-v2';st.textContent=`
/* Yalnızca Mal Kabul rolü: ana sayfadaki açık kart tasarımıyla uyum. */
#akpi-modal.akpi-receiving{background:rgba(13,27,46,.62)!important;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:clamp(9px,2vw,20px) 10px 42px!important;color:#1a2e49!important}
#akpi-modal.akpi-receiving #akpi-content{background:#eef2f8!important;max-width:790px!important;padding:0 0 26px!important;border:1px solid #d8e1ed!important;border-radius:23px!important;box-shadow:0 24px 80px #0c1a3290!important;overflow:hidden}
#akpi-modal.akpi-receiving #akpi-content> :not(.akpi-top):not(.akpi-tabs){margin-left:clamp(14px,4vw,27px);margin-right:clamp(14px,4vw,27px)}
#akpi-modal.akpi-receiving .akpi-top{background:#172a43;padding:23px clamp(17px,4vw,27px) 21px;align-items:flex-start!important;color:#fff!important}
#akpi-modal.akpi-receiving .akpi-top small{color:#a9c0d9!important;font-size:10px!important;letter-spacing:1.6px!important;font-weight:700!important}
#akpi-modal.akpi-receiving .akpi-top h2{color:#fff!important;font-size:clamp(21px,5vw,27px)!important;font-weight:800!important;line-height:1.18!important;margin:7px 0 0!important}
#akpi-modal.akpi-receiving .akpi-top button.akpi-close{width:38px!important;height:38px!important;min-width:38px!important;padding:0!important;background:#2a405b!important;border:1px solid #526680!important;color:#fff!important;border-radius:11px!important}
#akpi-modal.akpi-receiving .akpi-tabs{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important;margin:0!important;padding:14px clamp(14px,4vw,27px) 16px!important;background:#fff!important;border-bottom:1px solid #dce5ef}
#akpi-modal.akpi-receiving .akpi-tabs button{min-width:0!important;min-height:53px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;gap:3px!important;padding:7px 3px!important;background:#f3f6fa!important;background-image:none!important;border:1px solid #dae3ee!important;border-radius:11px!important;color:#3b516b!important;box-shadow:none!important;font-size:clamp(9px,2.45vw,12px)!important;font-weight:750!important;line-height:1.22!important;letter-spacing:0!important;text-align:center!important;white-space:normal!important}
#akpi-modal.akpi-receiving .akpi-tabs button .akpi-tab-icon{font-size:18px!important;line-height:1!important;color:#566e86!important}
#akpi-modal.akpi-receiving .akpi-tabs button.active{background:#e8153e!important;background-image:none!important;border-color:#e8153e!important;color:#fff!important;box-shadow:0 5px 13px #e8153e25!important}
#akpi-modal.akpi-receiving .akpi-tabs button.active .akpi-tab-icon{color:#fff!important}
#akpi-modal.akpi-receiving h3{color:#1a2e49!important;font-size:18px!important;letter-spacing:-.3px!important}
#akpi-modal.akpi-receiving .akpi-section-title{display:flex!important;align-items:center!important;justify-content:space-between!important;margin-top:22px!important;margin-bottom:13px!important}
#akpi-modal.akpi-receiving .akpi-section-heading h3{margin:0 0 3px!important;font-size:19px!important}
#akpi-modal.akpi-receiving .akpi-section-heading p{color:#667e97!important;font-size:12px!important}
#akpi-modal.akpi-receiving .akpi-count{background:#e5edf7!important;color:#34526c!important;border:1px solid #cedae8!important;border-radius:10px!important;font-size:12px!important;font-weight:700!important}
#akpi-modal.akpi-receiving .akpi-date-filter{background:#fff!important;border:1px solid #d8e2ee!important;border-radius:15px!important;padding:11px!important;margin-bottom:12px!important;box-shadow:0 3px 12px #162e4c0a!important}
#akpi-modal.akpi-receiving .akpi-date-switch{background:#edf2f7!important;border:1px solid #dce4ed!important;gap:4px!important}
#akpi-modal.akpi-receiving .akpi-date-switch button{color:#536b83!important;background:transparent!important;border:0!important;font-size:13px!important;min-height:40px!important}
#akpi-modal.akpi-receiving .akpi-date-switch button.selected{background:#1c3a57!important;color:#fff!important;border:0!important}
#akpi-modal.akpi-receiving .akpi-date-caption{color:#74869a!important;margin:8px 6px 0!important}
#akpi-modal.akpi-receiving .akpi-date-fields label{color:#536b83!important}
#akpi-modal.akpi-receiving .akpi-date-fields input{background:#f6f8fb!important;color:#20344b!important;border:1px solid #d3deea!important;color-scheme:light!important}
#akpi-modal.akpi-receiving .akpi-status-filter{display:flex;gap:7px;overflow:auto;padding:2px 0 7px;scrollbar-width:thin;overscroll-behavior-x:contain}
#akpi-modal.akpi-receiving .akpi-status-filter button{background:#fff!important;background-image:none!important;border:1px solid #d4e0ec!important;color:#556b84!important;border-radius:100px!important;white-space:nowrap!important;padding:9px 10px!important;font-size:11px!important;box-shadow:none!important;display:flex;align-items:center;gap:5px;min-height:36px}
#akpi-modal.akpi-receiving .akpi-status-filter button.selected{background:#1b3754!important;color:#fff!important;border-color:#1b3754!important}
#akpi-modal.akpi-receiving .akpi-status-filter button span{font-size:10px;opacity:.78}
#akpi-modal.akpi-receiving .akpi-task{background:#fff!important;border:1px solid #d8e2ee!important;border-radius:15px!important;box-shadow:0 4px 13px #223b540c!important;padding:15px!important;margin:10px clamp(14px,4vw,27px)!important}
#akpi-modal.akpi-receiving .akpi-task-head strong{color:#182d46!important;font-size:15px!important}
#akpi-modal.akpi-receiving .akpi-task small{color:#647991!important}
#akpi-modal.akpi-receiving .akpi-task-foot{border-top:1px solid #e2e9f1!important;padding-top:10px!important;gap:8px!important;flex-wrap:wrap!important}
#akpi-modal.akpi-receiving .akpi-task-foot small{font-size:11px!important;flex:1 0 100%!important}
#akpi-modal.akpi-receiving .akpi-task .akpi-detail{background:#eaf0f6!important;border:1px solid #ccd9e7!important;color:#203b58!important;border-radius:9px!important;padding:9px 12px!important;font-size:12px!important}
#akpi-modal.akpi-receiving .akpi-task .akpi-cancel-button{background:#fff0f2!important;border:1px solid #f0b8c2!important;color:#b1324b!important;border-radius:9px!important;margin-left:auto!important}
#akpi-modal.akpi-receiving .akpi-status.completed{background:#ddf6e9!important;color:#136947!important;border:0!important}
#akpi-modal.akpi-receiving .akpi-status.active{background:#fff1d5!important;color:#976007!important;border:0!important}
#akpi-modal.akpi-receiving .akpi-status.cancelled{background:#ffe8ec!important;border:0!important;color:#a4384c!important}
#akpi-modal.akpi-receiving .akpi-task.akpi-is-cancelled{background:#fff9fa!important;border:1px solid #edccd4!important;box-shadow:inset 3px 0 0 #d6657c!important}
#akpi-modal.akpi-receiving .akpi-cancel-summary{background:#fff0f2!important;border:1px solid #f2c9d1!important}
#akpi-modal.akpi-receiving .akpi-cancel-summary strong,#akpi-modal.akpi-receiving .akpi-cancel-summary span,#akpi-modal.akpi-receiving .akpi-cancel-summary small{color:#a74656!important}
#akpi-modal.akpi-receiving .akpi-empty{color:#657c94!important}
#akpi-modal.akpi-receiving .akpi-refresh-wrap{margin-top:16px!important;text-align:center}
#akpi-modal.akpi-receiving .akpi-refresh{background:#e4ebf4!important;border:1px solid #cdd9e8!important;color:#3b536b!important}
#akpi-modal.akpi-receiving .akpi-page-heading{margin-top:22px;margin-bottom:14px}
#akpi-modal.akpi-receiving .akpi-page-heading h3{font-size:20px!important;margin:5px 0 7px!important}
#akpi-modal.akpi-receiving .akpi-page-heading p{font-size:12px;color:#627890;line-height:1.55;margin:0}
#akpi-modal.akpi-receiving .akpi-eyebrow{font-size:10px;font-weight:800;letter-spacing:1.5px;color:#c8173d}
#akpi-modal.akpi-receiving .akpi-soft-card{background:#fff!important;border:1px solid #d8e2ed!important;border-radius:16px!important;padding:clamp(15px,4vw,21px)!important;box-shadow:0 4px 16px #1b35500b!important}
#akpi-modal.akpi-receiving label{font-size:13px!important;font-weight:700!important;color:#344b64!important;margin:0 0 16px!important}
#akpi-modal.akpi-receiving input:not([type=file]),#akpi-modal.akpi-receiving select{background:#f8fafc!important;border:1px solid #cbd8e6!important;color:#1a304a!important;border-radius:10px!important;padding:12px!important;min-height:47px!important;font-size:16px!important;box-shadow:none!important;color-scheme:light!important}
#akpi-modal.akpi-receiving input::placeholder{color:#a0afbf!important}
#akpi-modal.akpi-receiving input[type=file]{background:#f4f7fb!important;border:1px dashed #bdcddd!important;color:#2d445d!important;padding:11px!important;min-height:52px!important;font-size:12px!important;width:100%!important}
#akpi-modal.akpi-receiving .akpi-hint,#akpi-modal.akpi-receiving .akpi-form-note{color:#647b93!important;font-size:12px!important;line-height:1.55!important}
#akpi-modal.akpi-receiving .akpi-form-note{margin-top:12px;display:block!important}
#akpi-modal.akpi-receiving button.akpi-primary{background:#e8153e!important;background-image:none!important;border:1px solid #e8153e!important;border-radius:11px!important;color:#fff!important;font-size:14px!important;font-weight:750!important;min-height:47px!important;padding:12px 16px!important;box-shadow:0 5px 12px #e8153e1a!important}
#akpi-modal.akpi-receiving #akpi-create button.akpi-primary{width:100%!important}
#akpi-modal.akpi-receiving #akpi-create{margin-top:0}
#akpi-modal.akpi-receiving .akpi-catalog-head{display:flex;justify-content:space-between;align-items:center;gap:9px;margin-bottom:12px;color:#1d3550}
#akpi-modal.akpi-receiving .akpi-search-label{display:block!important;margin-bottom:6px!important}
#akpi-modal.akpi-receiving #akpi-catalog-search{margin:0 0 9px!important}
#akpi-modal.akpi-receiving .akpi-catalog-meta{color:#8192a5;font-size:11px;margin:4px 0 6px}
#akpi-modal.akpi-receiving .akpi-catalog-row{padding:10px 0;border-bottom:1px solid #e9eef4;display:flex;justify-content:space-between;align-items:center;gap:12px}
#akpi-modal.akpi-receiving .akpi-catalog-row strong{color:#1b314e;font-size:12px;overflow-wrap:anywhere}
#akpi-modal.akpi-receiving .akpi-catalog-row small{color:#7b90a5;font-size:11px;text-align:right;overflow-wrap:anywhere}
#akpi-modal.akpi-receiving .akpi-catalog-tools{margin-top:13px}
#akpi-modal.akpi-receiving .akpi-tool{margin:9px 0;border:1px solid #d8e3ee;border-radius:14px;background:#fff;overflow:hidden}
#akpi-modal.akpi-receiving .akpi-tool summary{display:flex;align-items:center;gap:10px;list-style:none;cursor:pointer;padding:14px 15px;color:#213750;font-weight:750;font-size:13px}
#akpi-modal.akpi-receiving .akpi-tool summary::-webkit-details-marker{display:none}
#akpi-modal.akpi-receiving .akpi-tool summary span{color:#df1941;font-size:19px;min-width:26px}
#akpi-modal.akpi-receiving .akpi-tool summary em{margin-left:auto;color:#6d8198;font-size:19px;font-style:normal;transition:transform .15s}
#akpi-modal.akpi-receiving .akpi-tool[open] summary em{transform:rotate(90deg)}
#akpi-modal.akpi-receiving .akpi-tool-body{padding:16px!important;border-top:1px solid #e5ebf2}
#akpi-modal.akpi-receiving .akpi-tool-body label{display:block!important}
#akpi-modal.akpi-receiving .akpi-tool-body .akpi-primary{width:100%!important}
#akpi-modal.akpi-receiving .akpi-report-presets{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px}
#akpi-modal.akpi-receiving .akpi-report-presets button{background:#edf2f8!important;border:1px solid #d8e3ed!important;color:#36516e!important;border-radius:9px!important;font-size:12px!important;padding:8px 10px!important;box-shadow:none!important}
#akpi-modal.akpi-receiving .akpi-report-presets button.selected{background:#203e5e!important;border-color:#203e5e!important;color:#fff!important}
#akpi-modal.akpi-receiving .akpi-report-card .akpi-report-dates{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;overflow:visible!important;padding:0!important;max-width:100%!important}
#akpi-modal.akpi-receiving .akpi-report-dates>label{margin:0 0 11px!important;min-width:0!important;overflow:visible!important}
#akpi-modal.akpi-receiving .akpi-report-dates input[type=date]{width:100%!important;max-width:100%!important;min-width:0!important;color-scheme:light!important;margin:7px 0 0!important}
#akpi-modal.akpi-receiving .akpi-export{width:100%!important;margin:4px 0 7px!important}
#akpi-modal.akpi-receiving .akpi-report-card .akpi-hint{margin:9px 0 0!important}
#akpi-modal.akpi-receiving .akpi-msg{border:1px solid #e8d9b9;background:#fff8e9;color:#775514!important;border-radius:11px}
#akpi-modal.akpi-receiving .akpi-back{color:#365673!important;background:transparent!important;border:0!important}
#akpi-modal.akpi-receiving .akpi-item:not(.akpi-task){background:#fff!important;border:1px solid #d8e3ee!important;color:#283d55!important;border-radius:12px!important}
#akpi-modal.akpi-receiving .akpi-item strong{color:#20364e!important}
#akpi-modal.akpi-receiving .akpi-item small{color:#71859d!important}
#akpi-modal.akpi-receiving #akpi-assign button[type=submit]{background:#e8153e!important;border-color:#e8153e!important;color:#fff!important}
#akpi-modal.akpi-receiving .akpi-cancel-dialog{background:#16283d!important;color:#f3f6fa!important}
#akpi-modal.akpi-receiving .akpi-cancel-dialog h3{color:#fff!important}
#akpi-modal.akpi-receiving .akpi-cancel-dialog label{color:#fff!important}
@media(max-width:550px){#akpi-modal.akpi-receiving .akpi-report-card .akpi-report-dates{grid-template-columns:1fr!important}#akpi-modal.akpi-receiving .akpi-tabs{gap:5px!important}#akpi-modal.akpi-receiving .akpi-tabs button{padding:7px 2px!important}#akpi-modal.akpi-receiving .akpi-task-foot{justify-content:flex-start!important}}

/* Eski genel buton stillerini yalnız Mal Kabul modalinde geçersiz kılar. */
#akpi-modal.akpi-receiving #akpi-content .akpi-tabs button:not(.active){background:#f3f6fa!important;background-image:none!important;border:1px solid #dae3ee!important;color:#354d66!important;box-shadow:none!important}
#akpi-modal.akpi-receiving #akpi-content .akpi-tabs button.active{background:#e8153e!important;background-image:none!important;border:1px solid #e8153e!important;color:#fff!important;box-shadow:0 5px 13px #e8153e25!important}
#akpi-modal.akpi-receiving #akpi-content .akpi-status-filter button:not(.selected){background:#fff!important;border:1px solid #d4e0ec!important;color:#556b84!important}
#akpi-modal.akpi-receiving #akpi-content .akpi-status-filter button.selected{background:#1b3754!important;border:1px solid #1b3754!important;color:#fff!important}
#akpi-modal.akpi-receiving #akpi-content button.akpi-primary{background:#e8153e!important;background-image:none!important;border-color:#e8153e!important;color:#fff!important}
#akpi-modal.akpi-receiving #akpi-content .akpi-report-presets button:not(.selected){background:#edf2f8!important;border-color:#d8e3ed!important;color:#36516e!important}
#akpi-modal.akpi-receiving #akpi-content .akpi-report-presets button.selected{background:#203e5e!important;border-color:#203e5e!important;color:#fff!important}
#akpi-modal.akpi-receiving #akpi-content .akpi-date-switch button:not(.selected){background:transparent!important;border:0!important;color:#536b83!important}
#akpi-modal.akpi-receiving #akpi-content .akpi-date-switch button.selected{background:#1c3a57!important;border:0!important;color:#fff!important}

#akpi-modal.akpi-receiving #akpi-content>.akpi-section-title{margin-left:clamp(14px,4vw,27px)!important;margin-right:clamp(14px,4vw,27px)!important}
@media(max-width:550px){
#akpi-modal.akpi-receiving #akpi-content .akpi-tabs{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
#akpi-modal.akpi-receiving #akpi-content .akpi-tabs button{flex-direction:row!important;gap:8px!important;min-height:47px!important;font-size:12px!important;padding:8px 4px!important}
#akpi-modal.akpi-receiving #akpi-content .akpi-tabs .akpi-tab-icon{font-size:17px!important}
}
@media(prefers-reduced-motion:reduce){#akpi-modal.akpi-receiving *,#akpi-modal.akpi-receiving *::before{transition:none!important;animation:none!important}}
`;document.head.append(st)}
const start=()=>{mount();corporateForkStyle();malKabulPaletStyle();attach();/* Mal Kabul kartı dashboard tarafından tek seferde çizilir. */};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();



