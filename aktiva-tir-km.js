/* AKTİVA · Danışma · Tır KM Takibi v1.0
 * İzole eklenti: mevcut Sevkiyat, Personel Araçları, Mal Kabul ve Forklift push akışlarına dokunmaz.
 */
(()=>{'use strict';
const $=(s,root=document)=>root.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TAB='ak_bim_tir_hareketleri';
const valid=()=>document.body.dataset.role==='pre_receiving' && typeof session!=='undefined' && !!session?.access_token;
const trDay=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
const datetime=t=>t?new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(t)):'—';
const nf=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0});
const km=n=>Number.isFinite(Number(n))?nf.format(Number(n))+' km':'—';
const addDay=d=>{const [y,m,day]=d.split('-').map(Number);return new Date(Date.UTC(y,m-1,day+1)).toISOString().slice(0,10)};
function plate(s){const t=String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const m=t.match(/^(\d{2})([A-Z]{1,3})(\d{1,5})$/);return m?m[1]+' '+m[2]+' '+m[3]:t;}
const tidy=s=>String(s||'').trim().replace(/\s+/g,' ');
let loading=false, listTicket=0, lookupTicket=0, latestRow=null, history=[], open=false, lastFocused=null;
async function api(method='GET',query={},payload=null){
 if(!valid())throw Error('Danışma oturumunuz bulunamadı. Yeniden giriş yapın.');
 if(typeof cfg==='undefined'||!cfg?.url||!cfg?.key)throw Error('Supabase bağlantısı bulunamadı.');
 const url=new URL(cfg.url+'/rest/v1/'+TAB);
 for(const [key,value] of Object.entries(query))url.searchParams.set(key,String(value));
 const headers={apikey:cfg.key,Authorization:'Bearer '+session.access_token};
 if(payload!==null){headers['Content-Type']='application/json';headers.Prefer='return=representation'}
 const r=await fetch(url.toString(),{method,headers,body:payload!==null?JSON.stringify(payload):undefined});
 if(!r.ok){let raw=await r.text(),msg=raw;try{const x=JSON.parse(raw);msg=x.message||x.error||raw}catch{};
  if(r.status===404||r.status===406||/PGRST205|schema cache|Could not find the table/i.test(msg))throw Error('Tır KM Takibi tablosu henüz kurulu değil. Önce paket içindeki SQL dosyasını Supabase SQL Editor’de çalıştırın.');
  throw Error(msg||'Sunucu hatası ('+r.status+')');}
 return r.status===204?[]:r.json();
}
const buttonTruck='<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h13v12H2zM15 9h4l3 4v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="19" cy="18" r="2"/></svg>';
function mountMenu(){
 if(!valid())return;
 const root=$('#ak-pre-receiving');if(!root)return;
 const panel=$('.ake3-drawer-panel',root);
 if(panel&&!$('#akbim-menu',panel)){
  const b=document.createElement('button');b.type='button';b.id='akbim-menu';b.className='akbim-menu-link';b.innerHTML=buttonTruck+'<span>Tır KM Takibi</span>';b.addEventListener('click',openPanel);
  const qr=$('[data-ake-action="qr"]',panel);panel.insertBefore(b,qr||$('[data-ake-action="settings"]',panel));
 }
 const secondary=$('#akpr-menu-panel .akpr-menu-extras',root);
 if(secondary&&!$('#akbim-legacy-link',secondary)){
  const b=document.createElement('button');b.id='akbim-legacy-link';b.type='button';b.className='akpr-menu-link';b.innerHTML='🚛 <span>Tır KM Takibi</span>';b.onclick=openPanel;secondary.append(b);
 }
 // Araçlar ekranında da ulaşılabilir; mevcut araçların verisi veya işlemleri değiştirilmez.
 const cars=$('#akpv-overlay');if(cars&&!$('#akbim-cars-link',cars)){
  const target=$('.akpv-hub',cars);if(target){const b=document.createElement('button');b.type='button';b.id='akbim-cars-link';b.className='akbim-cars-link';b.innerHTML='<span>🚛</span><strong>Tır KM Takibi</strong><small>Giriş · Çıkış · KM</small>';b.onclick=openPanel;target.append(b)}
 }
}
function template(){
 const root=document.createElement('div');root.id='akbim-overlay';root.hidden=true;
 root.innerHTML=`<section class="akbim-shell" role="dialog" aria-modal="true" aria-labelledby="akbim-title" tabindex="-1">
  <header class="akbim-head"><div><small>AKTİVA · DANIŞMA</small><h2 id="akbim-title">Tır KM Takibi</h2><p>Depo giriş-çıkış ve kilometre kayıtları</p></div><button type="button" id="akbim-close" aria-label="Kapat">×</button></header>
  <main class="akbim-content">
   <div class="akbim-stats"><div class="akbim-stat"><span>Bugün Giriş</span><strong id="akbim-today-in">—</strong></div><div class="akbim-stat"><span>Bugün Çıkış</span><strong id="akbim-today-out">—</strong></div><div class="akbim-stat"><span>Bugün Toplam Hareket</span><strong id="akbim-today-all">—</strong></div></div>
   <section class="akbim-card"><div class="akbim-card-title"><div><h3>Yeni KM Kaydı</h3><p>Her giriş ve her çıkış ayrı kaydedilir. Tarih ve saat otomatik alınır.</p></div></div>
    <form id="akbim-form" autocomplete="off"><div class="akbim-fields"><label class="akbim-full">Araç plakası <span>*</span><input id="akbim-plate" name="plate" required maxlength="20" placeholder="48 ABC 123" autocapitalize="characters" spellcheck="false"></label>
     <div class="akbim-prev akbim-full" id="akbim-prev" aria-live="polite">Son kilometreyi görmek için plakayı girin.</div>
     <div class="akbim-full"><label class="akbim-field-title">İşlem türü <span>*</span></label><div class="akbim-types"><label class="akbim-type"><input type="radio" name="direction" value="entry" checked><span>↘ Depoya Giriş</span></label><label class="akbim-type"><input type="radio" name="direction" value="exit"><span>↗ Depodan Çıkış</span></label></div></div>
     <label>Kilometre (KM) <span>*</span><input name="odometer_km" id="akbim-km" type="number" inputmode="numeric" min="0" max="99999999" step="1" required placeholder="Örn. 245380"></label>
     <label>Şoför adı (isteğe bağlı)<input name="driver_name" maxlength="100" placeholder="Ad soyad"></label>
     <label class="akbim-full">Not (isteğe bağlı)<textarea name="note" rows="2" maxlength="400" placeholder="Varsa açıklama"></textarea></label></div>
     <div class="akbim-actions"><button type="submit" id="akbim-save">Kaydı Oluştur</button><button type="reset" class="akbim-light">Temizle</button></div>
     <p class="akbim-message" id="akbim-message" role="status" aria-live="polite"></p></form>
   </section>
   <section class="akbim-card"><div class="akbim-section-header"><div><h3>Giriş-Çıkış Geçmişi</h3><p>Kayıtlı araçları plakaya göre arayın.</p></div><button type="button" class="akbim-light akbim-refresh" id="akbim-refresh">Yenile</button></div>
    <input id="akbim-search" type="search" maxlength="20" placeholder="Plakaya göre ara" aria-label="Plakaya göre ara"><div class="akbim-history" id="akbim-history"><div class="akbim-empty">Kayıtlar yükleniyor…</div></div><p class="akbim-hint">Geçmişte son 100 hareket gösterilir. Excel seçilen tarihlerdeki bütün hareketleri içerir.</p>
   </section>
   <section class="akbim-card"><div class="akbim-section-header"><div><h3>Tır KM Excel Raporu</h3><p>Yalnızca bu bölümün tır hareketlerini içerir. A4 yazdırmaya uygundur.</p></div></div>
    <div class="akbim-fields"><label>Başlangıç tarihi<input type="date" id="akbim-from"></label><label>Bitiş tarihi<input type="date" id="akbim-to"></label></div>
    <button type="button" id="akbim-export" class="akbim-export">Excel (.xlsx) İndir</button><p class="akbim-message" id="akbim-report-msg" role="status" aria-live="polite"></p>
   </section>
  </main></section>`;
 document.body.append(root);
 $('#akbim-close',root).addEventListener('click',closePanel);
 root.addEventListener('click',e=>{if(e.target===root)closePanel()});
 const form=$('#akbim-form',root);form.addEventListener('submit',save);form.addEventListener('reset',()=>{latestRow=null;$('#akbim-prev').textContent='Son kilometreyi görmek için plakayı girin.';if(!loading)info('')});
 let timer=0;$('#akbim-plate').addEventListener('input',e=>{clearTimeout(timer);latestRow=null;const p=plate(e.target.value);$('#akbim-prev').textContent=p?'Son KM kontrol ediliyor…':'Son kilometreyi görmek için plakayı girin.';timer=setTimeout(()=>{void lookup(p)},330)});
 $('#akbim-plate').addEventListener('blur',e=>e.target.value=plate(e.target.value));
 let searchTimer=0;$('#akbim-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>void loadHistory(),250)});
 $('#akbim-refresh').onclick=()=>{void Promise.all([loadHistory(),loadStats()])};
 $('#akbim-export').onclick=()=>{void exportExcel()};
 $('#akbim-from').value=trDay();$('#akbim-to').value=trDay();
}
const info=(s,error=false)=>{const e=$('#akbim-message');if(e){e.textContent=s;e.classList.toggle('akbim-error',error)}};
const reportInfo=(s,error=false)=>{const e=$('#akbim-report-msg');if(e){e.textContent=s;e.classList.toggle('akbim-error',error)}};
function openPanel(e){if(!valid())return;e?.preventDefault();
 lastFocused=document.activeElement;mountMenu();if(!$('#akbim-overlay'))template();
 const other=$('#akpv-overlay');if(other&&!other.hidden)$('#akpv-close',other)?.click();
 const drawer=$('.ake3-drawer');if(drawer)drawer.hidden=true;$('.ake3-hamburger')?.setAttribute('aria-expanded','false');
 const oldMenu=$('#akpr-menu-panel');if(oldMenu)oldMenu.hidden=true;
 $('#akbim-overlay').hidden=false;document.body.classList.add('akbim-open');open=true;$('#akbim-form').reset();info('');reportInfo('');
 $('#akbim-search').value='';$('#akbim-from').value=trDay();$('#akbim-to').value=trDay();
 void Promise.all([loadHistory(),loadStats()]);setTimeout(()=>$('#akbim-plate')?.focus({preventScroll:true}),70);
}
function closePanel(){const box=$('#akbim-overlay');if(box)box.hidden=true;document.body.classList.remove('akbim-open');open=false;lookupTicket++;listTicket++;lastFocused?.focus?.({preventScroll:true});}
async function lookup(p){const id=++lookupTicket,box=$('#akbim-prev');if(!box)return;if(!p){box.textContent='Son kilometreyi görmek için plakayı girin.';return}
 try{const rows=await api('GET',{select:'id,plate,direction,odometer_km,created_at',plate:'eq.'+p,order:'created_at.desc,id.desc',limit:1});if(id!==lookupTicket||!open)return;latestRow=rows[0]||null;
  box.innerHTML=latestRow?`Son kayıt: <strong>${km(latestRow.odometer_km)}</strong> · ${latestRow.direction==='entry'?'Giriş':'Çıkış'} · ${esc(datetime(latestRow.created_at))}`:'Bu plaka için önceki hareket bulunmuyor.';
 }catch(e){if(id===lookupTicket&&open){latestRow=null;box.textContent='Son KM alınamadı: '+e.message}}
}
async function save(e){e.preventDefault();if(loading||!valid())return;const form=e.currentTarget,pl=plate(form.elements.plate.value);const odo=Number(form.elements.odometer_km.value);const direction=form.elements.direction.value;
 if(!/^\d{2} [A-Z]{1,3} \d{1,5}$/.test(pl)){info('Lütfen geçerli bir araç plakası girin (ör. 48 ABC 123).',true);return}
 if(!Number.isSafeInteger(odo)||odo<0||odo>99999999){info('Kilometre tam sayı olmalı ve 0–99.999.999 aralığında bulunmalı.',true);return}
 loading=true;const b=$('#akbim-save');b.disabled=true;info('Plaka ve son kilometre doğrulanıyor…');
 try{
  const last=(await api('GET',{select:'id,direction,odometer_km,created_at',plate:'eq.'+pl,order:'created_at.desc,id.desc',limit:1}))[0];
  if(last&&odo<Number(last.odometer_km))throw Error('Girilen KM ('+km(odo)+') son kayıttan ('+km(last.odometer_km)+') düşük. KM değerini kontrol edin.');
  if(last&&last.direction===direction&&!window.confirm('Bu plakanın son kaydı da '+(direction==='entry'?'GİRİŞ':'ÇIKIŞ')+'. Aynı işlem türüyle yeni kayıt oluşturmak istiyor musunuz?')){info('Kayıt iptal edildi.');return}
  info('Kayıt Supabase’e gönderiliyor…');
  await api('POST',{},[{plate:pl,direction,odometer_km:odo,driver_name:tidy(form.elements.driver_name.value)||null,note:tidy(form.elements.note.value)||null}]);
  form.reset();$('#akbim-plate').value=pl;info((direction==='entry'?'Depoya giriş':'Depodan çıkış')+' kaydedildi: '+pl+' · '+km(odo));
  void Promise.all([lookup(pl),loadStats(),loadHistory()]);
 }catch(err){info('Kayıt oluşturulamadı: '+err.message,true)}finally{loading=false;b.disabled=false}
}
async function loadHistory(){if(!open||!valid())return;const id=++listTicket;const el=$('#akbim-history');if(!el)return;el.innerHTML='<div class="akbim-empty">Hareketler yükleniyor…</div>';
 try{const q=plate($('#akbim-search')?.value||'');const params={select:'id,plate,direction,odometer_km,driver_name,created_at,note',order:'created_at.desc,id.desc',limit:100};if(q)params.plate='ilike.*'+q+'*';
  const rows=await api('GET',params);if(id!==listTicket||!open)return;history=rows;el.innerHTML=rows.map(r=>`<article class="akbim-record"><span class="akbim-direction ${r.direction==='entry'?'entry':'exit'}">${r.direction==='entry'?'↘ Giriş':'↗ Çıkış'}</span><div class="akbim-record-main"><strong>${esc(r.plate)}</strong><small>${esc(datetime(r.created_at))}${r.driver_name?' · '+esc(r.driver_name):''}${r.note?' · '+esc(r.note):''}</small></div><strong class="akbim-record-km">${km(r.odometer_km)}</strong></article>`).join('')||'<div class="akbim-empty">Bu plakaya ait kayıt bulunamadı.</div>';
 }catch(err){if(id===listTicket&&open)el.innerHTML='<div class="akbim-empty">Hareketler alınamadı: '+esc(err.message)+'</div>'}
}
async function allRows(params,limit=20000){let arr=[],page=0;while(true){const chunk=await api('GET',{...params,limit:1000,offset:page*1000});arr.push(...chunk);if(chunk.length<1000)break;if(arr.length>=limit)throw Error('Bu aralık çok fazla kayıt içeriyor. Daha kısa bir tarih aralığı seçin.');page++}return arr}
function windowBounds(from,to){return {created_at:'gte.'+from+'T00:00:00+03:00',_end: 'lt.'+addDay(to)+'T00:00:00+03:00'}}
async function loadStats(){if(!open||!valid())return;const t=trDay(),b=windowBounds(t,t);
 try{const rows=await allRows({select:'direction,created_at',created_at:b.created_at,'and':'(created_at.lt.'+addDay(t)+'T00:00:00+03:00)',order:'created_at.asc'});
  if(!open)return;$('#akbim-today-in').textContent=rows.filter(x=>x.direction==='entry').length;$('#akbim-today-out').textContent=rows.filter(x=>x.direction==='exit').length;$('#akbim-today-all').textContent=rows.length;
 }catch(err){if(open){['akbim-today-in','akbim-today-out','akbim-today-all'].forEach(x=>$('#'+x).textContent='—');info('Günlük sayaçlar alınamadı: '+err.message,true)}}
}
async function ensureExcelJS(){if(window.ExcelJS?.Workbook)return window.ExcelJS;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';s.onload=resolve;s.onerror=()=>reject(Error('Excel kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edin.'));document.head.append(s)});if(!window.ExcelJS?.Workbook)throw Error('Excel kütüphanesi başlatılamadı.');return window.ExcelJS}
function styleSheet(sheet,title,note,columns,mode='landscape'){
 const n=columns.length;sheet.mergeCells(1,1,2,n);const c=sheet.getCell('A1');c.value=title;c.font={name:'Aptos Display',size:18,bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17283F'}};c.alignment={vertical:'middle',horizontal:'left',indent:1};sheet.getRow(1).height=23;sheet.getRow(2).height=22;
 sheet.mergeCells(3,1,3,n);const d=sheet.getCell('A3');d.value=note;d.font={name:'Aptos',size:10,color:{argb:'FF54657E'}};sheet.getRow(3).height=26;
 const head=sheet.getRow(5);head.values=[,...columns.map(c=>c.title)];head.height=27;head.eachCell(cell=>{cell.font={name:'Aptos',bold:true,color:{argb:'FFFFFFFF'},size:10};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFC92E45'}};cell.alignment={vertical:'middle',wrapText:true};cell.border={bottom:{style:'thin',color:{argb:'FFAC1A33'}}}});
 columns.forEach((x,i)=>sheet.getColumn(i+1).width=x.width);sheet.views=[{state:'frozen',ySplit:5}];
 sheet.pageSetup={paperSize:9,orientation:mode,fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.45,bottom:.45,header:.2,footer:.2}};
 sheet.headerFooter.oddFooter='AKTİVA · Tır KM Takibi    |    Sayfa &P / &N';sheet.printTitlesRow='1:5';
}
function dataRow(sheet,cells,index){const r=sheet.addRow(cells);r.height=24;r.alignment={vertical:'middle'};r.eachCell({includeEmpty:true},(cell)=>{cell.font={name:'Aptos',size:10,color:{argb:'FF26364B'}};cell.alignment={vertical:'middle',wrapText:true};if(index%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F6FA'}};cell.border={bottom:{style:'hair',color:{argb:'FFE2E8EF'}}}});return r}
async function exportExcel(){if(!valid())return;const from=$('#akbim-from').value,to=$('#akbim-to').value;if(!from||!to||from>to){reportInfo('Lütfen geçerli bir tarih aralığı seçin.',true);return}
 const b=$('#akbim-export');b.disabled=true;reportInfo('Hareketler alınıyor ve Excel hazırlanıyor…');
 try{
  const bounds=windowBounds(from,to);const rows=await allRows({select:'plate,direction,odometer_km,driver_name,note,created_at',created_at:bounds.created_at,and:'(created_at.lt.'+addDay(to)+'T00:00:00+03:00)',order:'created_at.asc,plate.asc'});
  if(!rows.length){reportInfo('Seçilen tarihlerde tır hareketi bulunamadı.');return}
  const ExcelJS=await ensureExcelJS(),wb=new ExcelJS.Workbook();wb.creator='AKTİVA · Danışma';wb.created=new Date();const detail=wb.addWorksheet('Giriş Çıkış Hareketleri');
  styleSheet(detail,'TIR KM TAKİBİ · GİRİŞ ÇIKIŞ RAPORU',`Tarih aralığı: ${from} / ${to}   •   Toplam hareket: ${rows.length}`,[{title:'Sıra',width:7},{title:'Tarih ve Saat',width:22},{title:'Araç Plakası',width:17},{title:'İşlem',width:17},{title:'KM Sayacı',width:16},{title:'Önceki KM',width:16},{title:'KM Farkı',width:14},{title:'Şoför',width:26},{title:'Not',width:34}], 'landscape');
  const byPlate=new Map();let entry=0,exit=0;rows.forEach((x,i)=>{const prev=byPlate.get(x.plate),diff=prev?Number(x.odometer_km)-Number(prev.odometer_km):null;
   const r=dataRow(detail,[i+1,datetime(x.created_at),x.plate,x.direction==='entry'?'Depoya Giriş':'Depodan Çıkış',Number(x.odometer_km),prev?Number(prev.odometer_km):'',diff===null?'':diff,x.driver_name||'',x.note||''],i);
   for(const n of [5,6,7])r.getCell(n).numFmt='#,##0';
   if(x.direction==='entry')entry++;else exit++;
   if(!byPlate.has(x.plate))byPlate.set(x.plate,{plate:x.plate,first:Number(x.odometer_km),last:Number(x.odometer_km),firstAt:x.created_at,lastAt:x.created_at,count:0,entries:0,exits:0,odometer_km:x.odometer_km});
   const p=byPlate.get(x.plate);p.last=Number(x.odometer_km);p.lastAt=x.created_at;p.odometer_km=x.odometer_km;p.count++;if(x.direction==='entry')p.entries++;else p.exits++;
  });detail.autoFilter={from:'A5',to:'I'+(5+rows.length)};detail.pageSetup.printArea='A1:I'+(5+rows.length);
  const summary=wb.addWorksheet('Plaka Özeti');styleSheet(summary,'TIR KM TAKİBİ · PLAKA ÖZETİ',`Tarih aralığı: ${from} / ${to}   •   Kayıtlı plaka: ${byPlate.size}`,[{title:'Plaka',width:18},{title:'Giriş Sayısı',width:15},{title:'Çıkış Sayısı',width:15},{title:'Toplam Hareket',width:18},{title:'İlk KM',width:18},{title:'Son KM',width:18},{title:'Aralık İçi KM Farkı',width:24}], 'landscape');
  [...byPlate.values()].sort((a,b)=>a.plate.localeCompare(b.plate,'tr')).forEach((p,i)=>{const r=dataRow(summary,[p.plate,p.entries,p.exits,p.count,p.first,p.last,p.count>1?p.last-p.first:''],i);for(const n of [5,6,7])r.getCell(n).numFmt='#,##0'});
  summary.pageSetup.printArea='A1:G'+(5+byPlate.size);
  const overview=wb.addWorksheet('Genel Özet', {views:[{state:'frozen',ySplit:5}]});styleSheet(overview,'TIR KM TAKİBİ · GENEL ÖZET',`AKTİVA Danışma   •   ${from} / ${to}`,[{title:'Gösterge',width:35},{title:'Değer',width:20}], 'portrait');
  [['Toplam hareket',rows.length],['Depoya giriş',entry],['Depodan çıkış',exit],['Farklı plaka',byPlate.size],['Rapor başlangıcı',from],['Rapor bitişi',to]].forEach((r,i)=>dataRow(overview,r,i));overview.mergeCells('A13:B13');overview.getCell('A13').value='KM farkı, aynı plakanın seçili tarih aralığındaki ardışık kayıtları arasında hesaplanır. İlk hareketten önceki kilometre rapora dahil edilmez.';overview.getCell('A13').alignment={wrapText:true};overview.getRow(13).height=45;overview.pageSetup.printArea='A1:B13';
  // Excel dosyası başka raporların kaydını içermez; yalnızca bu tablo sorgulanmıştır.
  const buffer=await wb.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`AKTIVA_Tir_KM_Giris_Cikis_${from}_${to}.xlsx`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);reportInfo(rows.length+' hareket, 3 sayfalı A4 Excel raporuna aktarıldı.');
 }catch(err){reportInfo('Excel oluşturulamadı: '+err.message,true)}finally{b.disabled=false}
}
function start(){mountMenu();const app=$('#app');if(app){new MutationObserver(changes=>{if(!valid())return;if(changes.some(c=>[...c.addedNodes].some(n=>n.nodeType===1&&(n.id==='ak-pre-receiving'||n.id==='akpv-overlay'||n.querySelector?.('#ak-pre-receiving,#akpv-overlay')))))mountMenu()}).observe(app,{childList:true})}
 document.addEventListener('aktiva:session-changed',()=>{closePanel();setTimeout(mountMenu,100)});
 // Personel araçları ekranı body üzerine sonradan eklendiğinde bağlantıyı gecikmeden göster.
 new MutationObserver(changes=>{if(valid()&&changes.some(c=>[...c.addedNodes].some(n=>n.nodeType===1&&n.id==='akpv-overlay')))mountMenu()}).observe(document.body,{childList:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){e.stopPropagation();closePanel()}});
 // Menü v4 tarafından kurulana kadar kısa bir yoklama; mevcut sayfalara render müdahalesi yapılmaz.
 setInterval(()=>{if(valid())mountMenu();else if(open)closePanel()},2500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
