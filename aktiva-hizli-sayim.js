/* AKTİVA • Hızlı Sayım v1
   Aynı ürünün farklı paletlerden gelen koli miktarlarını toplar.
   Taslaklar bu cihazda saklanır; Supabase'e yalnızca açık Kaydet işlemiyle yazılır.
   Var olan ürün sayımı, hasar, palet ve forklift bildirim akışlarını değiştirmez. */
(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const str=s=>String(s??'').toLocaleLowerCase('tr-TR');
const valid=n=>Number.isSafeInteger(n)&&n>=0&&n<=999999;
const completed=p=>p?.count_completed===true||p?.count_completed===1||p?.count_completed==='true';
const sum=a=>a.reduce((n,v)=>n+v,0);
let activeId='', selectedId='', query='', notice='', sending=false;
let sessionCacheKey='', sessionDraft={rows:{}};
function userId(){try{return session?.user?.id||''}catch{return ''}}
function storageKey(id){return 'aktiva_hizli_sayim_v1_'+userId()+'_'+id}
function drafts(id){
 const k=storageKey(id);if(sessionCacheKey===k)return sessionDraft;
 sessionCacheKey=k;sessionDraft={rows:{}};
 if(!userId())return sessionDraft;
 try{const x=JSON.parse(localStorage.getItem(k)||'null');if(x?.version===1&&x.rows&&typeof x.rows==='object'&&!Array.isArray(x.rows)){
   for(const [pid,r] of Object.entries(x.rows)){
    if(!r||typeof r!=='object'||!valid(r.base)||!valid(r.damaged)||typeof r.completed!=='boolean'||!Array.isArray(r.entries))continue;
    if(r.entries.length>1500||r.entries.some(v=>!Number.isSafeInteger(v)||v<1||v>999999))continue;
    if(sum(r.entries)>999999)continue;
    sessionDraft.rows[pid]={base:r.base,damaged:r.damaged,completed:r.completed,entries:r.entries,zero:r.zero===true};
   }
 }}catch(_){/* local storage kapalı olabilir */}
 return sessionDraft;
}
function persist(id){
 if(!userId())return;
 try{localStorage.setItem(storageKey(id),JSON.stringify({version:1,rows:drafts(id).rows}))}catch(_){notice='Cihaz depolaması kullanılamıyor; uygulamadan çıkmadan sayımı kaydedin.'}
}
function rowFor(id,p){
 const draft=drafts(id).rows;
 if(!draft[p.id])draft[p.id]={base:completed(p)?Number(p.received||0):0,damaged:Number(p.damaged||0),completed:completed(p),entries:[],zero:false};
 return draft[p.id];
}
function changed(r){return !!r&&(r.zero===true||r.entries.length>0)}
function value(p,r){return r?r.base+sum(r.entries):(completed(p)?Number(p.received||0):0)}
function stale(p,r){return !!r&&(r.base!==Number(p.received||0)||r.completed!==completed(p)||r.damaged!==Number(p.damaged||0))}
function renderToolbar(d){
 const on=activeId===d.id;
 return `<div class="akq-switch"><span><strong>Sayım yöntemi</strong><small>Ürünler farklı paletlerden geliyorsa parçalı sayım kullanın.</small></span><button type="button" id="akq-switch" aria-pressed="${on}">${on?'Klasik Sayıma Dön':'⚡ Hızlı Sayım'}</button></div>`;
}
function renderPanel(d,ps){
 const rs=drafts(d.id).rows;
 const pending=ps.filter(p=>changed(rs[p.id]));
 const completedCount=ps.filter(completed).length;
 const shown=ps.filter(p=>str(p.name+' '+(p.sku||'')).includes(str(query)));
 const chosen=ps.find(p=>p.id===selectedId)||null;
 const selectedDraft=chosen?rs[chosen.id]:null;
 const activeTotal=chosen?value(chosen,selectedDraft):0;
 let h=`<section id="akq-panel" class="akq-panel" aria-label="Parçalı hızlı sayım"><div class="akq-head"><div><strong>⚡ Hızlı Sayım</strong><small>Aynı ürüne farklı paletlerden geldikçe koli ekleyin.</small></div><div class="akq-count"><b>${completedCount}/${ps.length}</b><small>Kaydedilen ürün</small></div></div>
 <div class="akq-explain">+ Ekle ile biriken miktarlar <b>bu cihazda taslak</b> olarak kalır. <b>Sayımı Kaydet</b> ile veritabanına aktarılır.</div>
 <label class="akq-label" for="akq-search">Ürün bul</label><input id="akq-search" type="search" autocomplete="off" placeholder="Ürün adı veya kodu" value="${esc(query)}">
 <div class="akq-list" aria-label="Ürün seçimi">${shown.map(p=>{const r=rs[p.id],n=value(p,r),dirty=changed(r),isSelected=chosen?.id===p.id;return `<button type="button" data-akq-pick="${esc(p.id)}" class="akq-pick ${isSelected?'akq-selected':''}"><span class="akq-pick-name"><strong>${esc(p.name)}</strong><small>İrsaliye ${Number(p.expected||0)} koli · ${completed(p)?'Kaydedildi':'Henüz kaydedilmedi'}</small></span><span class="akq-pick-number"><b>${n}</b><small>${dirty?'● Taslak':'koli'}</small></span></button>`}).join('')||'<p class="akq-empty">Ürün bulunamadı.</p>'}</div>`;
 if(chosen){
  const dcount=selectedDraft?.entries?.length||0;
  const latest=selectedDraft?.entries||[];
  const current=completed(chosen)?Number(chosen.received||0):0;
  h+=`<div class="akq-selected-product"><div class="akq-selected-top"><div><small>SEÇİLİ ÜRÜN</small><h3>${esc(chosen.name)}</h3><span>İrsaliye: ${Number(chosen.expected||0)} koli</span></div><div class="akq-total"><strong>${activeTotal}</strong><small>Sayılan koli</small></div></div>
  <div class="akq-info"><span>Önceki kaydedilen <b>${current}</b></span><span>Yeni eklenen <b>+${sum(latest)}</b></span><span>Fark <b>${activeTotal-Number(chosen.expected||0)>0?'+':''}${activeTotal-Number(chosen.expected||0)}</b></span></div>
  ${stale(chosen,selectedDraft)?'<p class="akq-warning">Bu ürün başka bir işlemde güncellenmiş. Önce sayfayı yenileyip kontrol edin; taslak otomatik üzerine yazılmayacak.</p>':''}
  <form id="akq-add-form"><label for="akq-amount">Bu sefer bulunan miktar (koli)</label><div class="akq-add-row"><input type="number" id="akq-amount" min="1" max="999999" step="1" inputmode="numeric" required placeholder="Örn. 15"><button type="submit" ${sending?'disabled':''}>+ Ekle</button></div></form>
  ${!completed(chosen)&&activeTotal===0?`<button type="button" class="akq-zero" id="akq-zero" ${sending?'disabled':''}>Bu üründen gelmedi (0 koli)</button>`:''}
  <div class="akq-entries"><span>${dcount?'Son eklenen miktarlar':'Yeni miktar eklenmedi'}</span>${dcount?`<div>${latest.slice(-6).map((n,i)=>`<em>+${n}</em>`).join('')}</div><button type="button" id="akq-undo" ${sending?'disabled':''}>↶ Son eklemeyi geri al</button>`:selectedDraft?.zero?'<button type="button" id="akq-undo" '+(sending?'disabled':'')+'>↶ 0 koli işaretini geri al</button>':''}</div>
  ${completed(chosen)?'<p class="akq-small">Kaydedilmiş ürüne sonradan koli ekleyebilirsiniz. Önceki miktar korunur. Yanlış kaydedilen miktarı değiştirmek için Klasik Sayım → Düzenle bölümünü kullanın.</p>':''}
  </div>`;
 }
 h+=`<div class="akq-savebar"><div><strong>${pending.length} ürünün taslağı hazır</strong><small>Yalnızca ekleme yaptığınız / 0 olarak işaretlediğiniz ürünler kaydedilir.</small></div><button type="button" id="akq-save" ${sending||!pending.length?'disabled':''}>${sending?'Kaydediliyor…':'✓ Sayımı Kaydet'}</button></div>
 ${notice?`<p class="akq-message" role="status">${esc(notice)}</p>`:''}<p class="akq-small">Taslaklar aynı cihaz ve aynı kullanıcı hesabında saklanır. Farklı telefonda otomatik görünmez; internet bağlantısı ile kaydettiğiniz sayımlar ise tüm cihazlarda görünür.</p></section>`;
 return h;
}
function renderShipment(d,ps){return renderToolbar(d)+(activeId===d.id?renderPanel(d,ps):'')}
function isEnabled(id){return id===activeId}
function add(id,p,qty){
 if(sending)return false;
 const n=Number(qty);
 if(!Number.isSafeInteger(n)||n<1||n>999999){notice='1 ile 999999 arasında tam sayı girin.';return false}
 const r=rowFor(id,p);
 if(stale(p,r)){notice='Bu ürünün kaydı değişti; önce yenileyin.';return false}
 if(r.entries.length>=1500||r.base+sum(r.entries)+n>999999){notice='Toplam miktar sınırı aşıyor.';return false}
 r.entries.push(n);r.zero=false;notice='+'+n+' koli taslağa eklendi.';persist(id);return true;
}
function undo(id,p){
 const rows=drafts(id).rows,r=rows[p.id];if(!r||!changed(r)||sending)return;
 if(r.entries.length)r.entries.pop();else r.zero=false;
 if(!changed(r))delete rows[p.id];
 notice='Son ekleme geri alındı.';persist(id);
}
function markZero(id,p){
 if(sending)return;
 const r=rowFor(id,p);
 if(stale(p,r)||r.base!==0||r.entries.length||r.completed){notice='Bu ürün zaten sayılmış; düzeltmek için Klasik Sayımı açın.';return}
 r.zero=true;notice='Ürün 0 koli olarak işaretlendi (henüz kaydedilmedi).';persist(id);
}
function bind(root,delivery,ps,opts){
 if(!root||!delivery)return;
 const rerender=opts?.rerender||(()=>{});
 root.querySelector('#akq-switch')?.addEventListener('click',()=>{activeId=activeId===delivery.id?'':delivery.id;selectedId='';query='';notice='';rerender()});
 if(activeId!==delivery.id)return;
 if(!root.querySelector('#akq-panel'))return;
 const refresh=(focus)=>{
  const old=root.querySelector('#akq-panel');if(!old)return;
  const scroll=old.querySelector('.akq-list')?.scrollTop||0;
  old.outerHTML=renderPanel(delivery,ps);
  const nextList=root.querySelector('.akq-list');if(nextList)nextList.scrollTop=scroll;
  bindPanel();
  if(focus){const el=root.querySelector(focus);el?.focus();if(focus==='#akq-amount')el?.select()}
 };
 const bindPanel=()=>{
  const pane=root.querySelector('#akq-panel');if(!pane)return;
  pane.querySelector('#akq-search')?.addEventListener('input',e=>{
   const v=e.target.value,pos=e.target.selectionStart;query=v;refresh('#akq-search');const el=root.querySelector('#akq-search');try{el?.setSelectionRange(pos,pos)}catch(_){}
  });
  pane.querySelectorAll('[data-akq-pick]').forEach(b=>b.addEventListener('click',()=>{selectedId=b.dataset.akqPick;notice='';refresh('#akq-amount')}));
  pane.querySelector('#akq-add-form')?.addEventListener('submit',e=>{
   e.preventDefault();const p=ps.find(x=>x.id===selectedId);if(!p)return;
   const input=pane.querySelector('#akq-amount');add(delivery.id,p,input?.value||'');refresh('#akq-amount');
  });
  pane.querySelector('#akq-undo')?.addEventListener('click',()=>{const p=ps.find(x=>x.id===selectedId);if(p)undo(delivery.id,p);refresh('#akq-amount')});
  pane.querySelector('#akq-zero')?.addEventListener('click',()=>{const p=ps.find(x=>x.id===selectedId);if(p)markZero(delivery.id,p);refresh('#akq-amount')});
  pane.querySelector('#akq-save')?.addEventListener('click',()=>save(delivery,ps,opts,refresh));
 };
 bindPanel();
}
async function save(delivery,ps,opts,refresh){
 if(sending)return;
 const rs=drafts(delivery.id).rows;
 const targets=ps.filter(p=>changed(rs[p.id]));if(!targets.length)return;
 if(!userId()){notice='Oturum bulunamadı, yeniden giriş yapın.';refresh();return}
 sending=true;notice='Kaydediliyor: '+targets.length+' ürün';refresh();
 let ok=0;const errors=[];let ix=0;
 async function worker(){
  while(ix<targets.length){
   const p=targets[ix++],r=rs[p.id];if(!changed(r))continue;
   const count=value(p,r);
   if(!valid(count)||r.damaged>count){errors.push(p.name+': koli/hasar miktarı geçersiz.');continue}
   try{
    const current=await opts.request('/rest/v1/products?select=id,delivery_id,received,damaged,count_completed&id=eq.'+encodeURIComponent(p.id)+'&limit=1');
    const fresh=Array.isArray(current)?current[0]:null;
    if(!fresh||fresh.delivery_id!==delivery.id||stale(fresh,r))throw new Error('Ürün başka cihazda değişmiş; kontrol edin.');
    const q='/rest/v1/products?id=eq.'+encodeURIComponent(p.id)+'&received=eq.'+r.base+'&damaged=eq.'+r.damaged+'&count_completed=eq.'+r.completed;
    const result=await opts.request(q,{method:'PATCH',headers:{Prefer:'return=representation'},body:{received:count,counted_by:userId(),count_completed:true,counted_at:new Date().toISOString()}});
    if(!Array.isArray(result)||result.length!==1)throw new Error('Eşzamanlı kayıt değişti veya erişim engellendi.');
    delete rs[p.id];persist(delivery.id);ok++;
   }catch(e){errors.push(p.name+': '+String(e.message||e).slice(0,110))}
  }
 }
 await Promise.all(Array.from({length:Math.min(3,targets.length)},()=>worker()));
 sending=false;
 try{await opts.sync(true)}catch(_){}
 notice=ok+' ürünün sayımı kaydedildi.'+(errors.length?' '+errors.length+' ürün kaydedilemedi: '+errors.slice(0,2).join(' • '):'');
 // Başarılı kayıtları yeni taban değerle göster; başarısız taslaklar korunur.
 opts.rerender();
}
function style(){
 if(document.getElementById('aktiva-hizli-sayim-style'))return;
 const node=document.createElement('style');node.id='aktiva-hizli-sayim-style';node.textContent=`
 #aktivaCountUI .akq-switch{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:13px 12px;margin:11px 0;background:#17293b;border:1px solid #38536e;border-radius:13px}
 #aktivaCountUI .akq-switch span{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
 #aktivaCountUI .akq-switch small{font-size:12px;color:#c0cede}
 #aktivaCountUI .akq-switch button{background:#c91e37!important;color:#fff!important;border:0!important;padding:12px 15px;font-size:13px;font-weight:750;min-height:44px}
 #aktivaCountUI .akq-panel{padding:15px 12px;background:#101b29;border:1px solid #354b63;border-radius:14px;margin:8px 0;color:#eef3fa}
 #aktivaCountUI .akq-head{display:flex;justify-content:space-between;gap:10px;align-items:center}
 #aktivaCountUI .akq-head>div:first-child{display:flex;flex-direction:column;gap:6px;flex:1}
 #aktivaCountUI .akq-head strong{font-size:18px}
 #aktivaCountUI .akq-head small,#aktivaCountUI .akq-count small{display:block;color:#b3c3d4;font-size:12px;line-height:1.45}
 #aktivaCountUI .akq-count{text-align:right;white-space:nowrap}#aktivaCountUI .akq-count b{font-size:20px}
 #aktivaCountUI .akq-explain{border-left:3px solid #68a3ce;padding:9px 11px;margin:14px 0;background:#1b2a3b;color:#d3dfec;border-radius:0 8px 8px 0;font-size:12px;line-height:1.5}
 #aktivaCountUI .akq-label{display:block;font-size:12px;color:#cdd8e5;margin:12px 0 6px}
 #aktivaCountUI #akq-search,#aktivaCountUI #akq-amount{background:#1d3043!important;color:#fff!important;border:1px solid #48627b!important;border-radius:10px;min-height:48px;font-size:16px;width:100%;min-width:0;padding:11px}
 #aktivaCountUI .akq-list{display:grid;gap:6px;max-height:260px;overflow-y:auto;margin:12px 0}
 #aktivaCountUI .akq-pick{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;width:100%;text-align:left;color:#fff!important;background:#1c2a3a!important;border:1px solid #334b65!important;border-radius:10px;padding:12px 10px}
 #aktivaCountUI .akq-pick.akq-selected{border-color:#e33b51!important;background:#283548!important}
 #aktivaCountUI .akq-pick-name{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px;overflow-wrap:anywhere}
 #aktivaCountUI .akq-pick-name small,#aktivaCountUI .akq-pick-number small{font-size:11px;color:#b7c7d6;line-height:1.4}
 #aktivaCountUI .akq-pick-number{text-align:right;min-width:62px}
 #aktivaCountUI .akq-pick-number b{display:block;font-size:22px}
 #aktivaCountUI .akq-empty{font-size:13px;color:#c9d6e2;padding:10px}
 #aktivaCountUI .akq-selected-product{padding:14px 12px;background:#18273a;border:1px solid #466181;border-radius:13px;margin:14px 0}
 #aktivaCountUI .akq-selected-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
 #aktivaCountUI .akq-selected-top small{font-size:10px;color:#b6c9df;letter-spacing:.06em}#aktivaCountUI .akq-selected-top h3{font-size:17px;line-height:1.3;margin:5px 0;overflow-wrap:anywhere}
 #aktivaCountUI .akq-selected-top span{font-size:12px;color:#d8e3f1}
 #aktivaCountUI .akq-total{text-align:right;white-space:nowrap;min-width:72px}
 #aktivaCountUI .akq-total strong{font-size:32px;display:block;font-variant-numeric:tabular-nums}
 #aktivaCountUI .akq-total small{color:#b8ccde}
 #aktivaCountUI .akq-info{display:flex;flex-wrap:wrap;gap:8px;margin:13px 0}
 #aktivaCountUI .akq-info span{background:#263c51;padding:7px 9px;border-radius:8px;font-size:11px}
 #aktivaCountUI #akq-add-form{margin:14px 0 10px}
 #aktivaCountUI #akq-add-form label{display:block;margin:0 0 7px;color:#f3f7fb}
 #aktivaCountUI .akq-add-row{display:flex;align-items:stretch;gap:8px}
 #aktivaCountUI .akq-add-row input{flex:1}
 #aktivaCountUI .akq-add-row button{background:#cf223f!important;border:0!important;color:white!important;font-weight:750;padding:10px 14px;white-space:nowrap}
 #aktivaCountUI .akq-entries{padding-top:10px;border-top:1px solid #3a4c61;font-size:12px;color:#d8e3f1}
 #aktivaCountUI .akq-entries em{font-style:normal;display:inline-block;margin:6px 5px 5px 0;padding:6px 8px;border-radius:7px;background:#325369;color:#fff}
 #aktivaCountUI #akq-undo,#aktivaCountUI .akq-zero{display:block;background:transparent!important;color:#d2e7ff!important;border:1px solid #4b6e8a!important;padding:10px;margin-top:8px;font-size:12px}
 #aktivaCountUI .akq-savebar{display:flex;align-items:center;flex-wrap:wrap;gap:12px;justify-content:space-between;margin-top:13px;padding:12px;background:#22384b;border-radius:12px}
 #aktivaCountUI .akq-savebar>div{display:flex;flex-direction:column;gap:4px;flex:1}
 #aktivaCountUI .akq-savebar small,#aktivaCountUI .akq-small{font-size:11px;color:#c0cedd;line-height:1.5}
 #aktivaCountUI .akq-savebar button{background:#168454!important;color:#fff!important;font-weight:750;border:0!important;padding:13px 15px;min-height:46px}
 #aktivaCountUI .akq-savebar button:disabled{opacity:.5;cursor:not-allowed}
 #aktivaCountUI .akq-message{font-size:12px;padding:12px;border:1px solid #466b83;background:#192d40;border-radius:10px;color:#e4efff;line-height:1.5;overflow-wrap:anywhere}
 #aktivaCountUI .akq-warning{font-size:12px;color:#ffca8a;background:#49341b;padding:9px;border-radius:7px}
 #aktivaCountUI .akq-small{display:block;margin:10px 0 0}
 @media(max-width:420px){#aktivaCountUI .akq-panel{padding:11px 9px}#aktivaCountUI .akq-savebar button{width:100%}}
 `;document.head.appendChild(node);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',style,{once:true});else style();
window.AKTIVA_HIZLI_SAYIM={renderShipment,isEnabled,bind};
})();
