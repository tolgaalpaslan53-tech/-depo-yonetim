/* AKTİVA • Yalnızca Hızlı Sayım / sade ürün düzenleme • 2026-11-03
   Önceki parçalı sayımın cihazdaki v1 taslakları okunur ve korunur.
   Sayım yalnızca personelin Kaydet işlemiyle Supabase'e yazılır.
   Forklift bildirim fonksiyonları bu dosyada değiştirilmez. */
(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('tr-TR');
const valid=n=>Number.isSafeInteger(n)&&n>=0&&n<=999999;
const completed=p=>p?.count_completed===true||p?.count_completed===1||p?.count_completed==='true';
const norm=s=>String(s??'').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const sum=a=>a.reduce((n,v)=>n+v,0);
let selectedId='', selectedDelivery='', query='', notice='', saving=false, confirmSave='';
let sessionCacheKey='', sessionDraft={rows:{}};
function userId(){try{return session?.user?.id||''}catch{return ''}}
function storageKey(id){return 'aktiva_hizli_sayim_v1_'+userId()+'_'+id}
function drafts(id){
 const k=storageKey(id);if(sessionCacheKey===k)return sessionDraft;
 sessionCacheKey=k;sessionDraft={rows:{}};
 if(!userId())return sessionDraft;
 try{
  const data=JSON.parse(localStorage.getItem(k)||'null');
  if(data?.version===1&&data.rows&&typeof data.rows==='object'&&!Array.isArray(data.rows)){
   for(const [pid,r] of Object.entries(data.rows)){
    if(!r||typeof r!=='object'||!valid(r.base)||!valid(r.damaged)||typeof r.completed!=='boolean'||!Array.isArray(r.entries))continue;
    if(r.entries.length>1500||r.entries.some(v=>!Number.isSafeInteger(v)||v<1||v>999999)||sum(r.entries)>999999)continue;
    const manual=valid(r.manual)?r.manual:null;
    const quickUndo=Array.isArray(r.quickUndo)?r.quickUndo.filter(v=>v&&typeof v==='object'&&(v.previousManual===null||valid(v.previousManual))&&typeof v.previousZero==='boolean'&&valid(v.added)&&v.added>0).slice(-100):[];
    const e=r.extra;
    const extra=e&&valid(e.damaged)&&valid(e.pallets)&&typeof e.note==='string'&&e.note.length<=500?{damaged:e.damaged,pallets:e.pallets,note:e.note}:null;
    sessionDraft.rows[pid]={base:r.base,damaged:r.damaged,completed:r.completed,entries:r.entries.slice(),zero:r.zero===true,manual,quickUndo,extra};
   }
  }
 }catch(_){/* Depolama kullanılamıyorsa cihaz belleğinde çalışır. */}
 return sessionDraft;
}
function persist(id){
 if(!userId())return;
 try{localStorage.setItem(storageKey(id),JSON.stringify({version:1,rows:drafts(id).rows}))}
 catch(_){notice='Cihazdaki taslak saklanamadı. Sayımı kapatmadan Kaydet ile tamamlayın.'}
}
function rowFor(id,p){
 const rows=drafts(id).rows;
 if(!rows[p.id])rows[p.id]={base:Number(p.received||0),damaged:Number(p.damaged||0),completed:completed(p),entries:[],zero:false,manual:null,quickUndo:[],extra:null};
 return rows[p.id];
}
function changed(r){return !!r&&(r.zero||r.entries.length>0||r.manual!==null&&r.manual!==undefined)}
function value(p,r){return r?.manual!==null&&r?.manual!==undefined?r.manual:r?r.base+sum(r.entries):Number(p.received||0)}
function stale(p,r){return !!r&&(r.base!==Number(p.received||0)||r.completed!==completed(p)||r.damaged!==Number(p.damaged||0))}
function status(p,r){
 if(changed(r))return '<span class="aks-pill aks-draft">Taslak</span>';
 if(!completed(p))return '<span class="aks-pill aks-pending">Bekliyor</span>';
 const expected=Number(p.expected||0),received=Number(p.received||0),damage=Number(p.damaged||0);
 if(received!==expected||damage)return '<span class="aks-pill aks-issue">Fark var</span>';
 return '<span class="aks-pill aks-done">✓ Sayıldı</span>';
}
function show(d,ps){
 if(selectedDelivery!==d.id){
  selectedDelivery=d.id;selectedId=(ps.find(p=>!completed(p))||{}).id||'';query='';notice='';confirmSave='';
 }
 const rows=drafts(d.id).rows;
 const done=ps.filter(completed);
 const visible=ps.filter(p=>norm(p.name+' '+(p.sku||'')).includes(norm(query)));
 let h=`<section id="aks-panel" class="aks-panel" aria-label="Hızlı Mal Kabul Sayımı">
 <div class="aks-header"><h3>Hızlı Sayım</h3><small>${done.length}/${ps.length} ürün tamamlandı</small></div>
 <label class="aks-search-label" for="aks-search">Ürün ara</label><input id="aks-search" type="search" autocomplete="off" aria-label="Ürün ara" placeholder="Ürün adı veya ürün kodu yaz…" value="${esc(query)}">
 <div class="aks-products">`;
 if(!ps.length)h+='<p class="aks-empty">Bu sevkiyatta ürün bulunamadı.</p>';
 if(!visible.length&&ps.length)h+='<p class="aks-empty">Ürün bulunamadı.</p>';
 for(const p of visible){
  const r=rows[p.id],isDone=completed(p),isSelected=selectedId===p.id;
  const expected=Number(p.expected||0),actual=Number(p.received||0),current=changed(r)?value(p,r):isDone?actual:0;
  const damagedSaved=Number(p.damaged||0),shortage=Math.max(0,expected-actual),overage=Math.max(0,actual-expected);
  const savedSummary=[shortage?fmt(shortage)+' eksik':'',overage?fmt(overage)+' fazla':'',damagedSaved?fmt(damagedSaved)+' hasarlı':''].filter(Boolean);
  h+=`<article class="aks-product${isSelected?' aks-selected':''}">
   <div class="aks-product-head">
    <div class="aks-product-main"><strong>${esc(p.name)}</strong>
     <small>İrsaliye: ${fmt(expected)} koli${isDone||changed(r)?' · Sayılan: '+fmt(current)+' koli':''}</small>
     ${isDone&&!changed(r)?`<small class="${savedSummary.length?'aks-variance':'aks-finished'}">${savedSummary.length?savedSummary.join(' · '):'✓ İrsaliye ile eşit'} · ${fmt(Math.max(0,actual-damagedSaved))} sağlam</small>`:''}
    </div>
    ${isSelected&&!isDone?'':`<button type="button" class="aks-edit-btn" data-aks-edit="${esc(p.id)}" ${saving?'disabled':''}>${isSelected?'Kapat':isDone?'Düzenle':'Say'}</button>`}
   </div>`;
  if(isSelected){
   const detail=r?.extra||{damaged:Number(p.damaged||0),pallets:Number(p.pallet_count||0),note:String(p.count_note||'')};
   const checkKey=JSON.stringify([d.id,p.id,current,detail.damaged,detail.pallets,detail.note.trim()]);
   const needsConfirm=(current!==expected||detail.damaged>0),awaitingConfirm=confirmSave===checkKey&&needsConfirm;
   const missing=Math.max(0,expected-current),extra=Math.max(0,current-expected);
   const pendingParts=[missing?fmt(missing)+' eksik':'',extra?fmt(extra)+' fazla':'',detail.damaged?fmt(detail.damaged)+' hasarlı':''].filter(Boolean);
   h+=`<form class="aks-form" id="aks-count-form" data-aks-product="${esc(p.id)}">
    <div class="aks-running"><div class="aks-running-text"><div><small>TOPLAM SAYILAN</small><strong>${fmt(current)} <span>/ ${fmt(expected)} koli</span></strong></div><div class="aks-running-balance"><small>${isDone?'FARK':'KALAN / FARK'}</small><strong class="${current===expected?'aks-match-text':current>expected?'aks-excess-text':'aks-missing-text'}">${current>expected?'+':''}${fmt(current-expected)}</strong></div></div><div class="aks-meter" role="progressbar" aria-label="İrsaliyeye göre sayılan koli" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${expected>0?Math.min(100,Math.round(current*100/expected)):current>0?100:0}"><i style="width:${expected>0?Math.min(100,Math.round(current*100/expected)):current>0?100:0}%"></i></div></div>
    ${r?.quickUndo?.length?`<div class="aks-moves"><div class="aks-moves-title">Sayım hareketleri <small>${r.quickUndo.length} grup</small></div><div class="aks-moves-list">${r.quickUndo.map((entry,i)=>`<div class="aks-move"><span>${i+1}. bulunan grup</span><strong>+${fmt(entry.added)} koli</strong>${i===r.quickUndo.length-1?`<button type="button" class="aks-move-undo" id="aks-undo" aria-label="Son eklemeyi geri al" title="Son eklemeyi geri al" ${saving?'disabled':''}>↶</button>`:''}</div>`).join('')}</div></div>`:''}
    <div class="aks-add-section"><label for="aks-part">Saydığın koli</label><div class="aks-add-line"><input id="aks-part" type="number" min="1" max="999999" step="1" inputmode="numeric" autocomplete="off" placeholder="Örn. 15" ${saving?'disabled':''}><button type="button" id="aks-add" ${saving?'disabled':''}>+ Ekle</button></div></div>
    <details class="aks-details"><summary>Hasarlı koli / not / düzeltme</summary>
      <div class="aks-extra">
       <label>Hasarlı koli <input name="damaged" type="number" min="0" max="999999" step="1" inputmode="numeric" value="${detail.damaged}" ${saving?'disabled':''}></label>
       <small class="aks-hint">Hasarlı koliler sayılan toplamın içindedir, ikinci kez eklenmez.</small>
       <label>Not (isteğe bağlı) <input name="count_note" maxlength="500" value="${esc(detail.note)}" placeholder="Örn. 3 koli ezilmiş" ${saving?'disabled':''}></label>
       <details class="aks-advanced"><summary>Diğer işlemler</summary>
         <div class="aks-extra">
          <label>Palet sayısı <input name="pallets" type="number" min="0" max="999999" step="1" value="${detail.pallets}" ${saving?'disabled':''}></label>
          <button type="button" class="aks-secondary" id="aks-zero" ${saving?'disabled':''}>0 koli geldi</button>
          <label>Toplamı düzelt <input id="aks-correct-value" type="number" min="0" max="999999" step="1" inputmode="numeric" value="${current}" ${saving?'disabled':''}></label>
          <button type="button" class="aks-secondary" id="aks-correct" ${saving?'disabled':''}>Toplamı güncelle</button>
          ${changed(r)?`<button type="button" class="aks-clear" id="aks-clear" ${saving?'disabled':''}>Kaydedilmemiş sayımı sıfırla</button>`:''}
         </div>
       </details>
      </div>
    </details>
    ${stale(p,r)?'<p class="aks-error">Kayıt başka cihazda değişmiş. Önce yenileyin; taslağınız korunur.</p>':''}
    ${awaitingConfirm?`<div class="aks-confirm"><strong>Sayımı tamamladın mı?</strong><small>İrsaliye: ${fmt(expected)} · Sayılan: ${fmt(current)} koli</small><small>${pendingParts.length?pendingParts.join(' · '):'Fark yok'}${detail.damaged?' · '+fmt(Math.max(0,current-detail.damaged))+' sağlam':''}</small><small>Kaydedersen bu miktarlar kesin sayım sonucu olur.</small></div>`:''}
    <button type="submit" class="aks-save" ${saving?'disabled':''}>${saving?'Kaydediliyor…':awaitingConfirm?'✓ Evet, sayımı tamamla':'Sayımı Kaydet'}</button>
   </form>`;
  }
  h+='</article>';
 }
 h+='</div>';
 if(notice)h+=`<p class="aks-message" role="status">${esc(notice)}</p>`;
 return h+'</section>';
}
function renderShipment(d,ps){return show(d,ps)}
function bind(root,delivery,ps,opts){
 if(!root||!delivery||!root.querySelector('#aks-panel'))return;
 const refresh=()=>opts?.rerender?.();
 root.querySelector('#aks-search')?.addEventListener('input',e=>{
  query=e.target.value;const pos=e.target.selectionStart;refresh();const box=root.querySelector('#aks-search');box?.focus();try{box?.setSelectionRange(pos,pos)}catch(_){}
 });
 root.querySelectorAll('[data-aks-edit]').forEach(btn=>btn.addEventListener('click',()=>{
  if(saving)return;selectedId=selectedId===btn.dataset.aksEdit?'':btn.dataset.aksEdit;notice='';confirmSave='';refresh();
 }));
 const form=root.querySelector('#aks-count-form');if(!form)return;
 const p=ps.find(item=>item.id===form.dataset.aksProduct);if(!p)return;
 function captureExtra(){
  confirmSave='';
  const damaged=Number(form.elements.namedItem('damaged').value),pallets=Number(form.elements.namedItem('pallets').value);
  const note=String(form.elements.namedItem('count_note').value||'').slice(0,500);
  if(!valid(damaged)||!valid(pallets))return;
  const r=rowFor(delivery.id,p);r.extra={damaged,pallets,note};persist(delivery.id);
 }
 form.querySelectorAll('[name="damaged"],[name="pallets"],[name="count_note"]').forEach(input=>input.addEventListener('input',captureExtra));
 form.querySelector('#aks-part')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();root.querySelector('#aks-add')?.click()}});
 root.querySelector('#aks-add')?.addEventListener('click',()=>{
  if(saving)return;confirmSave='';
  const raw=form.querySelector('#aks-part')?.value.trim()||'',n=Number(raw);
  if(!raw||!Number.isSafeInteger(n)||n<1||n>999999){notice='Eklenecek koli miktarını doğru girin.';refresh();return}
  const r=rowFor(delivery.id,p);if(stale(p,r)){notice='Ürün değişmiş. Taslak başka kaydın üzerine yazılmayacak.';refresh();return}
  const before=value(p,r);
  if(!valid(before)||!valid(before+n)){notice='Toplam koli miktarı sınırı aşıyor.';refresh();return}
  if(!Array.isArray(r.quickUndo))r.quickUndo=[];
  r.quickUndo.push({previousManual:r.manual===undefined?null:r.manual,previousZero:r.zero===true,added:n});
  if(r.quickUndo.length>100)r.quickUndo.shift();
  r.manual=before+n;r.zero=false;persist(delivery.id);notice='';refresh();
 });
 root.querySelector('#aks-undo')?.addEventListener('click',()=>{
  if(saving)return;confirmSave='';const r=rowFor(delivery.id,p);if(stale(p,r)){notice='Ürün değişmiş. Önce sayfayı yenileyin.';refresh();return}
  const last=r.quickUndo?.pop();if(!last)return;
  r.manual=last.previousManual;r.zero=last.previousZero;
  if(!changed(r)&&!r.extra)delete drafts(delivery.id).rows[p.id];
  persist(delivery.id);notice='Son '+fmt(last.added)+' koli eklemesi geri alındı.';refresh();
 });
 root.querySelector('#aks-zero')?.addEventListener('click',()=>{
  if(saving)return;confirmSave='';const r=rowFor(delivery.id,p);if(stale(p,r)){notice='Ürün değişmiş. Önce sayfayı yenileyin.';refresh();return}
  r.manual=0;r.zero=true;r.quickUndo=[];persist(delivery.id);notice='0 koli sayımı seçildi. Kaydet ile tamamlayın.';refresh();
 });
 root.querySelector('#aks-correct')?.addEventListener('click',()=>{
  if(saving)return;confirmSave='';const raw=form.querySelector('#aks-correct-value')?.value.trim()||'',n=Number(raw);
  if(!raw||!valid(n)){notice='Doğru toplam koli miktarını girin.';refresh();return}
  const r=rowFor(delivery.id,p);if(stale(p,r)){notice='Ürün değişmiş. Önce sayfayı yenileyin.';refresh();return}
  r.manual=n;r.zero=n===0;r.quickUndo=[];persist(delivery.id);notice='Toplam '+fmt(n)+' koli olarak düzeltildi.';refresh();
 });
 root.querySelector('#aks-clear')?.addEventListener('click',()=>{
  confirmSave='';delete drafts(delivery.id).rows[p.id];persist(delivery.id);notice='Bu ürünün kaydedilmemiş sayım taslağı temizlendi.';refresh();
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(saving)return;
  const r=drafts(delivery.id).rows[p.id];const count=value(p,r);
  const damage=Number(form.elements.namedItem('damaged').value);
  const pallets=Number(form.elements.namedItem('pallets').value);
  const note=String(form.elements.namedItem('count_note').value||'').trim();
  if(!completed(p)&&!changed(r)){notice='Önce saydığınız kolileri ekleyin. Hiç koli gelmediyse “0 koli geldi” seçin.';refresh();return}
  if(!valid(count)||!valid(damage)||damage>count||!valid(pallets)||note.length>500){notice='Koli, hasar ve palet miktarlarını kontrol edin.';refresh();return}
  if(!userId()){notice='Oturum bulunamadı; yeniden giriş yapın.';refresh();return}
  const key=JSON.stringify([delivery.id,p.id,count,damage,pallets,note]);
  if((count!==Number(p.expected||0)||damage>0)&&confirmSave!==key){
   // Fark ve hasar kaydı yanlışlıkla tamamlanmasın; ikinci dokunuş onaydır.
   captureExtra();confirmSave=key;notice='';refresh();return;
  }
  captureExtra();confirmSave='';saving=true;notice='Sayım kaydediliyor…';refresh();
  try{
   const latest=await opts.request('/rest/v1/products?select=id,delivery_id,received,damaged,pallet_count,count_completed&id=eq.'+encodeURIComponent(p.id)+'&limit=1');
   const fresh=Array.isArray(latest)?latest[0]:null;
   if(!fresh||fresh.delivery_id!==delivery.id||Number(fresh.received||0)!==Number(p.received||0)||Number(fresh.damaged||0)!==Number(p.damaged||0)||completed(fresh)!==completed(p)||Number(fresh.pallet_count||0)!==Number(p.pallet_count||0)){
    throw Error('Ürün başka cihazda değiştirilmiş. Sayfayı yenileyip kontrol edin. Taslak korunuyor.');
   }
   const old=drafts(delivery.id).rows[p.id];if(old&&stale(p,old))throw Error('Taslak eski sayım değerine ait; kayıt yapmadan kontrol edin.');
   const q='/rest/v1/products?id=eq.'+encodeURIComponent(p.id)+'&delivery_id=eq.'+encodeURIComponent(delivery.id)+'&received=eq.'+Number(fresh.received||0)+'&damaged=eq.'+Number(fresh.damaged||0)+'&count_completed=eq.'+completed(fresh)+'&pallet_count=eq.'+Number(fresh.pallet_count||0);
   const result=await opts.request(q,{method:'PATCH',headers:{Prefer:'return=representation'},body:{received:count,damaged:damage,pallet_count:pallets,count_note:note,counted_by:userId(),count_completed:true,counted_at:new Date().toISOString()}});
   if(!Array.isArray(result)||result.length!==1)throw Error('Sayım güncellenemedi; başka cihazda değişmiş olabilir. Taslak korunuyor.');
   delete drafts(delivery.id).rows[p.id];persist(delivery.id);selectedId=(ps.find(item=>item.id!==p.id&&!completed(item))||{}).id||'';notice='✓ '+p.name+' kaydedildi.';
   try{await opts.sync(true)}catch(_){notice='✓ Sayım kaydedildi. Liste yenilenemedi; bağlantıyı kontrol edip sayfayı yenileyin.'}
  }catch(err){notice='Kaydedilemedi: '+String(err?.message||err).slice(0,220)}
  finally{saving=false;refresh()}
 });
}
function style(){
 if(document.getElementById('aktiva-tek-sayim-style'))return;
 const node=document.createElement('style');node.id='aktiva-tek-sayim-style';node.textContent=`
 #aktivaCountUI .aks-panel{margin:12px 0 8px;border-radius:14px;border:1px solid #344353;background:#181f2b;padding:13px 12px;color:#f6f7fa;min-width:0}
 #aktivaCountUI .aks-header{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap}
 #aktivaCountUI .aks-header h3{font-size:18px;margin:0 0 4px;line-height:1.3}
 #aktivaCountUI .aks-header small{color:#b7c3d0;font-size:12px}
 #aktivaCountUI .aks-overview{margin:14px 0 4px;background:#242d3b;border:1px solid #394655;border-radius:12px;padding:13px 8px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
 #aktivaCountUI .aks-overview>div{display:flex;flex-direction:column;gap:5px;min-width:0;text-align:center}
 #aktivaCountUI .aks-overview small{color:#c4cbd5;font-size:11px}
 #aktivaCountUI .aks-overview strong{font-size:clamp(17px,4.4vw,25px);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
 #aktivaCountUI .aks-number-warn{color:#ffb7a1}
 #aktivaCountUI .aks-explainer{color:#aab8c8;font-size:11px;margin:8px 0 0;line-height:1.45}
 #aktivaCountUI .aks-alert{font-size:12px;padding:9px 11px;margin-top:10px;border-radius:9px;background:#3b2b28;color:#ffd9c8}
 #aktivaCountUI .aks-pill{display:inline-block;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:700;white-space:nowrap}
 #aktivaCountUI .aks-done{background:#173c31;color:#9be5c4}#aktivaCountUI .aks-pending{background:#343b46;color:#cdd6df}
 #aktivaCountUI .aks-issue{background:#503527;color:#ffd2a0}#aktivaCountUI .aks-draft{background:#2f4260;color:#c8ddff}
 #aktivaCountUI .aks-products{display:grid;gap:9px;margin-top:13px}
 #aktivaCountUI .aks-product{border:1px solid #343e4a;border-radius:11px;background:#202733;padding:13px 12px;min-width:0}
 #aktivaCountUI .aks-product-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-width:0}
 #aktivaCountUI .aks-product-main{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1}
 #aktivaCountUI .aks-product-main strong{font-size:14px;line-height:1.35;overflow-wrap:anywhere}
 #aktivaCountUI .aks-product-main small{font-size:12px;color:#c0c7d2;line-height:1.4}
 #aktivaCountUI .aks-product-main .aks-variance{color:#f7b4aa}#aktivaCountUI .aks-product-main .aks-pending-text{color:#b5d2ff}
 #aktivaCountUI .aks-product-side{display:flex;flex-direction:column;align-items:flex-end;gap:9px;flex-shrink:0}
 #aktivaCountUI .aks-edit-btn{min-height:36px;min-width:74px;border:1px solid #5b6774!important;background:#303a48!important;color:#fff!important;padding:7px 12px;font-size:12px;font-weight:700}
 #aktivaCountUI .aks-form{display:grid;gap:9px;border-top:1px solid #3a4553;margin-top:13px;padding-top:12px}
 #aktivaCountUI .aks-form label,#aktivaCountUI .aks-search-label{font-size:12px;font-weight:700;color:#d8e2ec;margin:0}
 #aktivaCountUI .aks-form input,#aktivaCountUI #aks-search{display:block;min-width:0;max-width:100%;width:100%;min-height:45px;border-radius:10px;background:#182332!important;color:white!important;border:1px solid #506174!important;font-size:16px;padding:10px 12px}
 #aktivaCountUI .aks-search-label{display:block;margin:15px 0 7px}#aktivaCountUI #aks-search{margin-bottom:9px}
 #aktivaCountUI .aks-match{justify-self:start;padding:8px!important;border:1px solid #526679!important;background:#243448!important;color:#d9e8fa!important;font-size:12px}
 #aktivaCountUI .aks-running{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:13px 12px;border-radius:10px;background:#233347;border:1px solid #4a6680;flex-wrap:wrap}
 #aktivaCountUI .aks-running>div{display:flex;flex-direction:column;gap:3px}
 #aktivaCountUI .aks-running>div small{font-size:10px;color:#becfe1;letter-spacing:.7px}
 #aktivaCountUI .aks-running strong{color:white;font-size:27px;line-height:1.2;font-variant-numeric:tabular-nums}
 #aktivaCountUI .aks-running strong span{font-size:13px;color:#b8cce0;font-weight:500}
 #aktivaCountUI .aks-running>small{font-size:12px;color:#9bdfc8}
 #aktivaCountUI .aks-running>small.aks-number-warn{color:#ffd0aa}
 #aktivaCountUI .aks-add-section small{font-size:11px;color:#adbfce}
 #aktivaCountUI .aks-quick-actions{display:flex;flex-wrap:wrap;gap:7px}
 #aktivaCountUI .aks-quick-actions button{background:#2a3749!important;color:#e6eef7!important;border:1px solid #43576e!important;min-height:37px;padding:8px 12px;font-size:12px}
 #aktivaCountUI .aks-correction .aks-extra button{justify-self:start;background:#344b64!important;color:#fff!important;padding:10px 12px}
 #aktivaCountUI .aks-add-section{display:grid;gap:7px;padding:10px 0 4px}
 #aktivaCountUI .aks-add-line{display:flex;gap:8px;align-items:stretch;min-width:0}
 #aktivaCountUI .aks-add-line input{flex:1;min-width:0}
 #aktivaCountUI .aks-add-line button{background:#ca243c!important;color:#fff!important;padding:8px 14px!important;min-width:100px;font-size:13px;font-weight:700}
 #aktivaCountUI .aks-details{border:1px solid #3e4958;border-radius:9px;padding:11px;background:#1b2430}
 #aktivaCountUI .aks-details summary{font-size:13px;color:#cdd7e3;cursor:pointer;font-weight:650}
 #aktivaCountUI .aks-extra{display:grid;gap:10px;margin-top:12px}
 #aktivaCountUI .aks-extra label{display:grid;gap:6px}
 #aktivaCountUI .aks-form-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:3px} #aktivaCountUI .aks-form-actions .aks-save{flex:1;min-width:180px}
 #aktivaCountUI .aks-save{background:#c82336!important;color:#fff!important;border:0!important;min-height:44px;padding:10px 18px;font-size:14px;font-weight:700}
 #aktivaCountUI .aks-clear{background:transparent!important;color:#bccbdd!important;border:1px solid #536071!important;min-height:42px;padding:9px 11px;font-size:12px}
 #aktivaCountUI .aks-hint{color:#aebdcd;font-size:11px;line-height:1.5}
 #aktivaCountUI .aks-message,#aktivaCountUI .aks-draft-info{padding:10px 12px;margin:13px 0 0;border-radius:9px;background:#24374c;border:1px solid #3c5570;color:#e3f0ff;font-size:12px;line-height:1.5;overflow-wrap:anywhere}
 #aktivaCountUI .aks-draft-info{display:flex;flex-direction:column;gap:3px}
 #aktivaCountUI .aks-draft-info small{color:#b9c8d9}
 #aktivaCountUI .aks-error{color:#ffd5b7;font-size:12px}
 #aktivaCountUI .aks-empty{font-size:13px;color:#b8c4d1;padding:11px}
 #aktivaCountUI .aks-notify{margin:12px 0 5px;border-top:1px solid #3c4858;padding-top:14px;display:grid;gap:9px}
 #aktivaCountUI .aks-notify small{color:#b4c1cf;font-size:12px;line-height:1.5}
 #aktivaCountUI .aks-notify .ak-submit{justify-self:start;width:auto;font-size:13px;min-height:45px}
 @media(max-width:420px){#aktivaCountUI .aks-panel{padding:11px 9px}#aktivaCountUI .aks-product{padding:12px 10px}#aktivaCountUI .aks-product-side{gap:7px}#aktivaCountUI .aks-overview strong{font-size:18px}}

 /* Minimum görünüm: tek aktif ürün, tek koli girişi, tek kayıt butonu */
 #aktivaCountUI .aks-panel{padding:14px 12px;margin:6px 0 8px;border-color:#303c4b;background:#171f2c}
 #aktivaCountUI .aks-header{display:flex;align-items:baseline;gap:12px;justify-content:space-between;border-bottom:1px solid #323e4e;padding-bottom:11px}
 #aktivaCountUI .aks-header h3{margin:0;font-size:19px}
 #aktivaCountUI .aks-header small{white-space:nowrap;font-size:12px}
 #aktivaCountUI .aks-products{gap:8px;margin-top:11px}
 #aktivaCountUI .aks-product{background:#202938;border:1px solid #364253;padding:13px 12px}
 #aktivaCountUI .aks-product.aks-selected{border-color:#4d6077}
 #aktivaCountUI .aks-product-head{align-items:center}
 #aktivaCountUI .aks-product-main strong{font-size:14px}
 #aktivaCountUI .aks-product-main small{font-size:12px}
 #aktivaCountUI .aks-edit-btn{min-width:64px;padding:8px 10px;min-height:36px}
 #aktivaCountUI .aks-form{gap:12px;margin-top:12px;padding-top:12px}
 #aktivaCountUI .aks-running{display:block;background:none;border:0;border-radius:0;padding:0}
 #aktivaCountUI .aks-running>small{font-size:11px;color:#c3ceda;display:block;letter-spacing:.2px;margin-bottom:2px}
 #aktivaCountUI .aks-running strong{font-size:31px;color:#fff}
 #aktivaCountUI .aks-running strong span{font-size:15px}
 #aktivaCountUI .aks-add-section{padding:0;gap:7px}
 #aktivaCountUI .aks-add-section>label{font-size:12px}
 #aktivaCountUI .aks-add-line button{min-width:96px;font-size:15px!important}
 #aktivaCountUI .aks-finished{color:#99e4c2!important}
 #aktivaCountUI .aks-confirm{display:grid;gap:5px;background:#293345;border:1px solid #57677c;border-radius:10px;padding:12px;margin:0;color:#fff;font-size:12px;line-height:1.4}
 #aktivaCountUI .aks-confirm strong{font-size:14px}
 #aktivaCountUI .aks-confirm small{color:#d3dcea;font-size:12px}
 #aktivaCountUI .aks-advanced{border:0;border-top:1px solid #374456;padding-top:9px}
 #aktivaCountUI .aks-advanced summary{font-size:12px;color:#b7c7db;cursor:pointer}
 #aktivaCountUI .aks-hint{font-size:11px;color:#b0bed0;line-height:1.4}
 #aktivaCountUI .aks-undo{background:transparent!important;border:0!important;color:#cbd8e5!important;font-size:12px;padding:3px 0;text-align:left;justify-self:start}
 #aktivaCountUI .aks-search-label{margin:12px 0 7px;font-size:13px;color:#d6e2f0;display:block}
 #aktivaCountUI #aks-search{min-height:45px;background:#1f2a3a!important;border:1px solid #45566c!important;color:#fff!important}
 #aktivaCountUI .aks-running{background:#253141;border-radius:10px;padding:12px 12px 10px;border:1px solid #3d4d63}
 #aktivaCountUI .aks-running-text{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;min-width:0}
 #aktivaCountUI .aks-running-text>div:first-child{min-width:0}
 #aktivaCountUI .aks-running-text small{font-size:10px;color:#c0cad6;display:block;letter-spacing:.2px}
 #aktivaCountUI .aks-running-text strong{font-size:29px;line-height:1.25;color:#fff;white-space:nowrap;letter-spacing:-.4px}
 #aktivaCountUI .aks-running-text strong span{font-size:13px;font-weight:500;letter-spacing:0;color:#b5c2cf}
 #aktivaCountUI .aks-running-balance{text-align:right;flex-shrink:0}
 #aktivaCountUI .aks-running-balance strong{font-size:24px}
 #aktivaCountUI .aks-running-balance strong.aks-match-text{color:#a3e8c7}
 #aktivaCountUI .aks-running-balance strong.aks-excess-text{color:#ffbd9f}
 #aktivaCountUI .aks-running-balance strong.aks-missing-text{color:#e6ecf5}
 #aktivaCountUI .aks-meter{height:5px;margin-top:10px;background:#384356;border-radius:6px;overflow:hidden}
 #aktivaCountUI .aks-meter i{display:block;height:100%;background:#e5324d;border-radius:6px;transition:width .15s ease}
 #aktivaCountUI .aks-moves{margin-top:1px;padding:8px 0 4px;border-top:1px solid #364354}
 #aktivaCountUI .aks-moves-title{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:700;font-size:13px;margin:2px 0 6px;color:#e8eef5}
 #aktivaCountUI .aks-moves-title small{color:#aabbd0;font-size:11px;font-weight:400}
 #aktivaCountUI .aks-moves-list{display:grid;gap:0;max-height:180px;overflow-y:auto}
 #aktivaCountUI .aks-move{display:flex;align-items:center;gap:9px;min-height:34px;border-bottom:1px solid #333f50;font-size:12px}
 #aktivaCountUI .aks-move span{flex:1;color:#bfccda}
 #aktivaCountUI .aks-move strong{color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap}
 #aktivaCountUI .aks-move-undo{min-width:30px!important;min-height:30px!important;background:transparent!important;border:0!important;color:#d7e1ee!important;font-size:23px;padding:0!important;display:flex;align-items:center;justify-content:center}
 @media(max-width:400px){#aktivaCountUI .aks-running-text strong{font-size:25px}#aktivaCountUI .aks-running-text strong span{font-size:12px}#aktivaCountUI .aks-running-balance strong{font-size:22px}}
 #aktivaCountUI .aks-details{background:transparent;border:0;border-top:1px solid #3d4b5e;padding:11px 0 0;border-radius:0}
 #aktivaCountUI .aks-details summary{font-size:12px;font-weight:500;color:#bac8d8}
 #aktivaCountUI .aks-extra{gap:8px;margin-top:10px}
 #aktivaCountUI .aks-secondary{background:#2d3b4f!important;color:#fff!important;border:1px solid #506177!important;padding:10px}
 #aktivaCountUI .aks-save{display:block;width:100%;font-size:15px;min-height:48px}
 @media(max-width:420px){#aktivaCountUI .aks-panel{padding:11px 9px}#aktivaCountUI .aks-add-line input{font-size:18px}}
 `;document.head.appendChild(node);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',style,{once:true});else style();
window.AKTIVA_HIZLI_SAYIM={renderShipment,bind,isEnabled:()=>true};
})();
