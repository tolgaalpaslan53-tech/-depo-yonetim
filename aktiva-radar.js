/* AKTİVA Radar v1 — salt okunur, yalnızca Danışma ve Mal Kabul. */
(()=>{'use strict';
const role=()=>document.body.dataset.role;
const permitted=()=>['count','pre_receiving'].includes(role())&&!!document.querySelector('#app:not(.hidden)');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:NaN};
const arrival=r=>time(r.arrival_at||r.created_at);
const waiting=r=>r.status==='waiting'&&!r.docked_at&&!r.departed_at;
const valid=r=>r.status!=='cancelled';
let data=null, thresholds={yellow:1,red:3}, lastFetch=0, pending=false, view='summary', error='', roleLoaded='', generation=0;
const chartData=rows=>{const now=Date.now(),bins=[-60,-45,-30,-15,0];return bins.map(offset=>{const at=now+offset*60000;return {label:offset===0?'Şimdi':`${Math.abs(offset)} dk önce`,n:rows.filter(r=>valid(r)&&arrival(r)<=at&&(!r.docked_at||time(r.docked_at)>at)&&(!r.departed_at||time(r.departed_at)>at)).length}})};
function analyse(rows){const now=Date.now(),span=30*60000;
 const live=rows.filter(r=>valid(r)&&waiting(r));
 const arrivals=rows.filter(r=>valid(r)&&arrival(r)>now-span&&arrival(r)<=now).length;
 const dispatched=rows.filter(r=>valid(r)&&time(r.docked_at)>now-span&&time(r.docked_at)<=now).length;
 const near=live.filter(r=>{const m=(now-arrival(r))/60000;return Number.isFinite(m)&&m>=Math.max(0,thresholds.yellow*60-30)&&m<thresholds.yellow*60}).length;
 const old=live.filter(r=>{const m=(now-arrival(r))/60000;return Number.isFinite(m)&&m>=thresholds.yellow*60}).length;
 const net=arrivals-dispatched;
 const alerts=[];
 if(net>=5&&arrivals>=5)alerts.push({level:'high',title:'Araç kuyruğu hızla büyüyor',body:`Son 30 dakikada ${arrivals} yeni kayıt ve ${dispatched} perona yönlendirme var. Net fark +${net} araç.`});
 else if(net>=3&&arrivals>=3)alerts.push({level:'medium',title:'Araç birikmesi riski',body:`Son 30 dakikada gelen araç sayısı yönlendirilenlerden ${net} fazla.`});
 if(near)alerts.push({level:'medium',title:'Bekleme sınırına yaklaşan araçlar',body:`${near} araç, sarı uyarı eşiğine 30 dakikadan az mesafede.`});
 if(old)alerts.push({level:'medium',title:'Bekleme sınırını geçen araçlar',body:`${old} araç sarı bekleme eşiğini geçti.`});
 return {live:live.length,arrivals,dispatched,near,alerts,trend:chartData(rows),partial:rows.length>=1000};
}
function markup(){return `<section class="akr" id="akr-panel" aria-label="AKTİVA Radar"><div class="akr-top"><div><div class="akr-eyebrow">◉ OPERASYON TAKİBİ</div><h2>AKTİVA Radar</h2><p>Erken uyarı ve araç yoğunluğu</p></div><button type="button" class="akr-open" data-akr="toggle">${view==='detail'?'Özete Dön':'Detayları Gör ›'}</button></div><div class="akr-content" aria-live="polite">Veriler yükleniyor…</div></section>`}
function mount(){if(!permitted())return;if(role()==='count'&&document.querySelector('#akd-dashboard')?.dataset.akdPage!=='home')return;const parent=role()==='count'?document.querySelector('#akd-dashboard .akd-body'):document.querySelector('#ak-pre-receiving');if(!parent)return;
 let el=parent.querySelector('#akr-panel');if(!el){el=document.createElement('div');el.innerHTML=markup();el=el.firstElementChild;
  if(role()==='count'){const greeting=parent.querySelector('.akd-greeting');greeting?.after(el);if(!greeting)parent.prepend(el)}
  else{const stats=parent.querySelector('#akpr-live-status');stats?.after(el);if(!stats)parent.querySelector('#akpr-home-nav')?.after(el)}
  el.addEventListener('click',e=>{if(e.target.closest('[data-akr="toggle"]')){view=view==='detail'?'summary':'detail';render()}else if(e.target.closest('[data-akr="refresh"]'))load(true)});
  render();
 }
}
function render(){const el=document.querySelector('#akr-panel');if(!el||!permitted())return;
 const b=el.querySelector('[data-akr="toggle"]');if(b)b.textContent=view==='detail'?'Özete Dön':'Detayları Gör ›';
 const c=el.querySelector('.akr-content');if(!c)return;
 if(error){c.innerHTML=`<p class="akr-error">Radar verilerine erişilemedi. ${esc(error)}</p><button class="akr-retry" data-akr="refresh">Yeniden Dene</button>`;return}
 if(!data){c.innerHTML='<p class="akr-muted">Radar verileri yükleniyor…</p>';return}
 const a=analyse(data),level=a.alerts.some(x=>x.level==='high')?'Yüksek':a.alerts.length?'Dikkat':'Normal';
 const note=a.partial?'<p class="akr-note">Veri sınırına ulaşıldı; sayılar eksik olabilir.</p>':'';
 c.innerHTML=`<div class="akr-metrics"><div><small>Dışarıda bekleyen</small><strong>${a.live}</strong></div><div><small>Son 30 dk gelen</small><strong>${a.arrivals}</strong></div><div><small>Aktif uyarı</small><strong>${a.alerts.length}</strong></div></div><div class="akr-status"><span class="akr-dot ${level==='Yüksek'?'high':level==='Dikkat'?'medium':''}"></span><strong>${level==='Normal'?'Belirgin risk saptanmadı':`Risk seviyesi: ${level}`}</strong></div>${a.alerts.slice(0,view==='detail'?10:1).map(x=>`<div class="akr-alert"><strong>${esc(x.title)}</strong><p>${esc(x.body)}</p></div>`).join('')}${view==='detail'?`<div class="akr-detail"><h3>Son 30 dakika</h3><p>Perona yönlendirilen: <strong>${a.dispatched}</strong> · Kuyruk farkı: <strong>${a.arrivals-a.dispatched>=0?'+':''}${a.arrivals-a.dispatched}</strong></p><h3>Bekleyen araç eğilimi</h3><div class="akr-bars">${a.trend.map(p=>`<div class="akr-bar-col"><span>${p.n}</span><div class="akr-bar" style="height:${Math.max(5,Math.round(p.n/Math.max(1,...a.trend.map(x=>x.n))*100))}%"></div><small>${esc(p.label)}</small></div>`).join('')}</div><p class="akr-note">Grafik kayıt zamanları ve perona gönderilme olaylarından hesaplanır. Fiziksel peron doluluğu veya kesin gelecek tahmini değildir.</p></div>`:''}${note}<div class="akr-footer"><span>Salt okunur · ${new Date(lastFetch).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span><button type="button" data-akr="refresh">↻ Yenile</button></div>`;
}
async function request(path){const token=typeof session!=='undefined'?session?.access_token:null;if(!token||typeof cfg==='undefined'||!cfg?.url||!cfg?.key)throw Error('Oturum veya bağlantı bilgisi bulunamadı.');const res=await fetch(cfg.url+path,{headers:{apikey:cfg.key,Authorization:'Bearer '+token}});if(!res.ok)throw Error(res.status===403?'Radar için okuma yetkisi gerekli.':res.status===401?'Oturum süresi dolmuş olabilir.':`Sunucu yanıtı: ${res.status}`);return res.json()}
async function load(force=false){if(!permitted()||pending||document.hidden||!navigator.onLine)return;if(!force&&Date.now()-lastFetch<45000)return;
 const thisRole=role(),g=++generation;pending=true;error='';
 try{const rows=await request('/rest/v1/ak_sevkiyat_on_kayit?select=created_at,arrival_at,docked_at,departed_at,status&order=created_at.desc&limit=1000');
 if(!Array.isArray(rows))throw Error('Beklenmeyen veri biçimi.');
 let t=thresholds;try{const settings=await request('/rest/v1/ak_danisma_wait_settings?id=eq.1&select=yellow_hours,red_hours');const s=settings?.[0];if(Number(s?.yellow_hours)>0&&Number(s?.red_hours)>Number(s.yellow_hours))t={yellow:Number(s.yellow_hours),red:Number(s.red_hours)}}catch(e){console.warn('Radar: bekleme eşiği okunamadı',e.message)}
 if(g!==generation||role()!==thisRole)return;data=rows;thresholds=t;lastFetch=Date.now();
 }catch(e){if(g!==generation||role()!==thisRole)return;error=e.message;data=null}finally{pending=false;render()}}
function tick(){if(!permitted()){if(roleLoaded){roleLoaded='';generation++;data=null;view='summary';error=''}return}if(roleLoaded!==role()){roleLoaded=role();generation++;data=null;view='summary';error='';lastFetch=0}mount();load()}
// Mal Kabul ana sayfası yeniden çizildiğinde Radar kartı yeniden eklenir.
let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;if(permitted())mount()})}).observe(document.documentElement,{subtree:true,childList:true});
setInterval(tick,5000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});document.addEventListener('DOMContentLoaded',tick);tick();
})();
