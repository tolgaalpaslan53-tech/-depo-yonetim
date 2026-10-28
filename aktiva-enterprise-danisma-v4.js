/* AKTİVA Danışma Enterprise v3 — görünüm katmanı. Mevcut işlem düğmelerini tetikler.
   Diğer rollerin DOM'una, push, service worker veya Supabase yazma akışına müdahale etmez. */
(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s);
const icon={
 home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
 clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6M8 10h8M8 14h8M8 18h5"/>',
 truck:'<path d="M2 6h12v11H2zM14 10h4l4 4v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
 car:'<path d="M4 16l2-8h12l2 8v3h-3v-2H7v2H4z"/><path d="M5 13h14"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>',
 search:'<circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/>',
 report:'<path d="M4 20v-8h4v8M10 20V5h4v15M16 20v-11h4v11"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
 enter:'<path d="M4 4v16h8"/><path d="m15 8 5 4-5 4M8 12h12"/>',
 exit:'<path d="M19 4v16h-8"/><path d="m9 8-5 4 5 4M4 12h12"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4"/>',
 chevron:'<path d="m9 5 7 7-7 7"/>',
 check:'<path d="m5 12 5 5L20 7"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
 qr:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3M21 14v7h-7"/>'
};
const svg=n=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${icon[n]||icon.home}</svg>`;
const brandMark='<span class="ake3-logo" role="img" aria-label="AKTİVA simgesi"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 35 11.5v17L20 37 5 28.5v-17Z" fill="none" stroke="#ed203d" stroke-width="5" stroke-linejoin="round"/><path d="M6 12 20 21l14-9M20 21v15" fill="none" stroke="#ed203d" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
const navItems=[['home','Ana Sayfa','home'],['new','Sevkiyat Ön Kayıt','truck'],['cars','Personel ve Ziyaretçi Araçları','car'],['records','Araç Kayıtları','clipboard'],['report','Excel Raporları','report'],['settings','Ayarlar','settings']];
const extraItems=[['records','Araç Kayıtları','clipboard'],['qr','Şoför QR Kodu','qr'],['settings','Ayarlar','settings'],['logout','Çıkış Yap','exit']];
const metricIcons=['clipboard','truck','clock','exit'];
const qbtn=(act,label,ic,cls='')=>`<button type="button" class="${cls}" data-ake-action="${act}">${svg(ic)}<span>${label}</span></button>`;
let lastRead=0, fetching=false, tickId=0, chartSignature="";
function mount(){
 if(document.body.dataset.role!=='pre_receiving')return; // Giriş sırasında gizli uygulamada da kur, eski ekranın görünmesini bekleme.
 const root=$('#ak-pre-receiving');if(!root||root.dataset.akeV3==='ready')return;
 const head=$('.akpr-head',root),stats=$('#akpr-live-status',root),homeNav=$('#akpr-home-nav',root);
 if(!head||!stats||!homeNav||!$('#akpr-logout',head))return;
 root.dataset.akeV3='ready';
 // Kullanıcı adı ve Çıkış düğmesinin orijinal DOM öğeleri korunur.
 const user=$('.akpr-user',head),logout=$('#akpr-logout',head);
 const brand=document.createElement('div');brand.className='ake3-brand';brand.innerHTML=brandMark+'<div><strong>AKTİVA</strong><small>Depo Yönetim Sistemi</small></div>';
 const headerTitle=document.createElement('div');headerTitle.className='ake3-header-title';headerTitle.innerHTML='<strong>Danışma Operasyon Merkezi</strong><small>Giriş-çıkış ve araç operasyon takibi</small>';
 const tools=document.createElement('div');tools.className='ake3-header-tools';
 tools.innerHTML=`<button type="button" class="ake3-icon-btn ake3-bell" data-ake-action="radar" aria-label="Radar ayrıntılarını görüntüle">${svg('bell')}</button><div class="ake3-person"><span class="ake3-avatar" aria-hidden="true">${svg('home')}</span></div>`;
 if(user)tools.querySelector('.ake3-person').append(user);
 tools.append(logout);
 const hamburger=document.createElement('button');hamburger.type='button';hamburger.className='ake3-hamburger';hamburger.dataset.akeAction='drawer';hamburger.setAttribute('aria-label','Danışma menüsünü aç');hamburger.setAttribute('aria-expanded','false');hamburger.innerHTML=svg('menu');tools.append(hamburger);
 head.replaceChildren(brand,headerTitle,tools);
 const rail=document.createElement('aside');rail.className='ake3-rail';rail.setAttribute('aria-label','Danışma bölümleri');
 rail.innerHTML='<div class="ake3-rail-brand">'+brandMark+'<div><strong>AKTİVA</strong><small>Depo Yönetim Sistemi</small></div></div><nav class="ake3-rail-nav">'+navItems.map(([a,l,i])=>qbtn(a,l,i,a==='home'?'ake3-selected':'')).join('')+'</nav><div class="ake3-system"><span class="ake3-live-dot"></span><span>Ağ bağlantısı</span></div>';
 root.prepend(rail);
 const drawer=document.createElement('div');drawer.className='ake3-drawer';drawer.hidden=true;
 drawer.innerHTML='<button type="button" class="ake3-drawer-scrim" data-ake-action="close-drawer" aria-label="Menüyü kapat"></button><div class="ake3-drawer-panel"><div class="ake3-drawer-title"><strong>Ek İşlemler</strong><button type="button" data-ake-action="close-drawer" aria-label="Menüyü kapat">×</button></div>'+extraItems.map(([a,l,i])=>qbtn(a,l,i)).join('')+'</div>';
 root.append(drawer);
 const hero=document.createElement('section');hero.className='ake3-hero';hero.innerHTML='<div class="ake3-hero-shade"><strong>Danışma</strong><h2>Operasyon Merkezi</h2><p>Sevkiyat ve araç hareketleri tek ekranda</p></div>';
 const dateCard=document.createElement('aside');dateCard.className='ake3-date';dateCard.innerHTML='<span id="ake3-date-text"></span><strong id="ake3-time-text"></strong><span class="ake3-connection"><i></i><span id="ake3-online-text">Bağlantı kontrol ediliyor</span></span>';
 const heroRow=document.createElement('div');heroRow.className='ake3-hero-row';heroRow.append(hero,dateCard);head.after(heroRow);
 const section=document.createElement('div');section.className='ake3-kpis-head';section.innerHTML='<strong>Operasyon Özeti</strong><span>Bugün · Canlı veriler</span>';stats.before(section);
 // Gerçek sayaç düğümleri yer değiştirse de çekirdek modülün id ile veri güncellemesi çalışır.
 const cards=[...stats.children];
 if(cards.length===5){const yard=cards[3];yard.classList.add('ake3-yard-extra');stats.after(yard);stats.append(cards[4]);}
 [...stats.children].forEach((c,i)=>{if(i>3)return;c.classList.add('ake3-kpi');const ico=document.createElement('span');ico.className='ake3-kpi-icon ake3-kpi-icon-'+i;ico.innerHTML=svg(metricIcons[i]);c.prepend(ico)});
 const middle=document.createElement('div');middle.className='ake3-middle';middle.innerHTML='<div class="ake3-radar-slot" id="ake3-radar-slot"></div><section class="ake3-quick"><h3>Hızlı İşlemler</h3><div class="ake3-quick-grid">'+qbtn('new','Sevkiyat Ön Kayıt','clipboard')+qbtn('cars','Personel Araçları','car')+qbtn('search','Araç Ara','search')+qbtn('report','Excel Raporları','report')+'</div></section>';stats.after(middle);
 const lower=document.createElement('div');lower.className='ake3-lower';lower.innerHTML='<section class="ake3-recent"><button type="button" class="ake3-recent-toggle" data-ake-action="toggle-recent" aria-expanded="false" aria-controls="ake3-recent-content">'+svg('clock')+'<span><strong>Son Araç Hareketleri</strong><small>Son giriş ve çıkışları görüntüle</small></span>'+svg('chevron')+'</button><div id="ake3-recent-content" class="ake3-recent-content"><div class="ake3-panel-head"><h3>Son İşlemler</h3><button type="button" data-ake-action="records">Tümünü Gör '+svg('chevron')+'</button></div><div id="ake3-recent-list" class="ake3-recent-list"><p class="ake3-placeholder">İşlemler yükleniyor…</p></div></div></section><section class="ake3-chart"><h3>Günlük Hareket Özeti</h3><div class="ake3-chart-inner"><div class="ake3-chart-bars" id="ake3-chart-bars"></div><div class="ake3-chart-legend" id="ake3-chart-legend"></div></div><div class="ake3-yard-pill">Şu an depoda: <strong id="ake3-yard-value">—</strong> araç</div></section></div>';
 middle.after(lower);
 const bottom=document.createElement('nav');bottom.className='ake3-bottom';bottom.setAttribute('aria-label','Mobil hızlı gezinme');bottom.innerHTML=[['home','Ana Sayfa','home'],['new','Ön Kayıt','clipboard'],['cars','Araçlar','car'],['report','Raporlar','report']].map(([a,l,i])=>qbtn(a,l,i,a==='home'?'ake3-selected':'')).join('');root.append(bottom);
 root.addEventListener('click',onAction);
 syncState();moveRadar();paintChart();updateClock();void loadRecent();
}
function onAction(e){const b=e.target.closest('[data-ake-action]');if(!b)return;const root=$('#ak-pre-receiving');if(!root||!root.contains(b))return;
 const action=b.dataset.akeAction;
 if(action==='drawer'){const d=$('.ake3-drawer',root);if(d){d.hidden=false;b.setAttribute('aria-expanded','true')}}
 else if(action==='close-drawer'){closeDrawer(root)}
 else if(action==='toggle-recent'){const panel=$('.ake3-recent',root);const toggle=$('.ake3-recent-toggle',panel||root);if(panel&&toggle){const open=panel.classList.toggle('ake3-recent-expanded');toggle.setAttribute('aria-expanded',String(open));}}
 else{
  closeDrawer(root);
  if(b.closest('.ake3-bottom')){const overlay=$('#akpv-overlay');if(overlay&&!overlay.hidden)$('#akpv-close',overlay)?.click();}
 const map={new:'akpr-open-new',records:'akpr-open-list',report:'akpr-open-report',settings:'akpr-open-settings',cars:'akpv-launch',search:'akpv-launch',qr:'akpr-open-qr',logout:'akpr-logout'};
 if(action==='home'){const back=$('[data-akpr-back]',root);if(root.dataset.akprView!=='home')back?.click();}
 else if(action==='radar'){const radar=$('#akr-panel',root);if(radar){radar.scrollIntoView({behavior:'smooth',block:'center'});if(!$('.akr-detail',radar))$('[data-akr="toggle"]',radar)?.click()}}
 else{if(b.closest('.ake3-bottom')&&root.dataset.akprView!=='home'){const back=$('[data-akpr-back]',root);back?.click();}
      const original=$('#'+map[action],root);if(original){original.click();if(action==='search')setTimeout(()=>$('#akpv-search')?.focus(),120)}else if(action==='cars'||action==='search'){alert('Araç modülü henüz hazır değil. Sayfayı yenileyip tekrar deneyin.')}}
 }
 syncState();
}
function closeDrawer(root){const d=$('.ake3-drawer',root);if(d)d.hidden=true;$('.ake3-hamburger',root)?.setAttribute('aria-expanded','false')}
function syncState(){const root=$('#ak-pre-receiving');if(!root||root.dataset.akeV3!=='ready')return;
 const view=root.dataset.akprView||'home';const carsOpen=!!$('#akpv-overlay')&&!$('#akpv-overlay').hidden;const current=carsOpen?'cars':view==='new'?'new':view==='list'?'records':view==='report'?'report':view.includes('settings')?'settings':'home';
 root.querySelectorAll('.ake3-rail-nav button,.ake3-bottom button').forEach(btn=>{const active=btn.dataset.akeAction===current||current==='records'&&btn.dataset.akeAction==='cars';btn.classList.toggle('ake3-selected',active);if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current')});
 const isHome=view==='home';root.classList.toggle('ake3-is-home',isHome);
}
function moveRadar(){const root=$('#ak-pre-receiving');if(!root||root.dataset.akeV3!=='ready')return;const r=$('#akr-panel',root),slot=$('#ake3-radar-slot',root);if(r&&slot&&r.parentElement!==slot)slot.append(r)}
function updateClock(){const d=new Date(),opts={timeZone:'Europe/Istanbul'};const date=$('#ake3-date-text'),tm=$('#ake3-time-text');if(date)date.textContent=new Intl.DateTimeFormat('tr-TR',{...opts,day:'numeric',month:'long',year:'numeric',weekday:'long'}).format(d);if(tm)tm.textContent=new Intl.DateTimeFormat('tr-TR',{...opts,hour:'2-digit',minute:'2-digit'}).format(d);const label=$('#ake3-online-text');if(label)label.textContent=navigator.onLine?'Çevrimiçi':'Çevrimdışı';const dot=$('.ake3-live-dot');if(dot)dot.classList.toggle('ake3-offline',!navigator.onLine)}
function paintChart(){const root=$('#ak-pre-receiving');if(!root)return;const host=$('#ake3-chart-bars',root),legend=$('#ake3-chart-legend',root);if(!host||!legend)return;
 const sources=[['akpr-total','Ön Kayıt','#7f8caa'],['akpr-in-dock','Giriş','#1da979'],['akpr-done','Çıkış','#2f89d8']];
 const vals=sources.map(([id,l,c])=>({label:l,color:c,value:Math.max(0,Number($('#'+id,root)?.textContent)||0)}));const max=Math.max(1,...vals.map(a=>a.value));
 const yard=$('#akpr-onsite',root),value=$('#ake3-yard-value',root);if(yard&&value)value.textContent=yard.textContent;
 const signature=vals.map(v=>v.value).join(',');if(chartSignature===signature)return;chartSignature=signature;
 host.replaceChildren();legend.replaceChildren();
 for(const v of vals){const bar=document.createElement('div');bar.className='ake3-bar';bar.style.height=(v.value===0?4:Math.max(8,v.value/max*100))+'%';bar.style.background=v.color;bar.title=v.label+': '+v.value;bar.setAttribute('aria-label',bar.title);host.append(bar);
 const item=document.createElement('div');item.className='ake3-legend-item';const mark=document.createElement('i');mark.style.background=v.color;const label=document.createElement('span');label.textContent=v.label+': '+v.value;item.append(mark,label);legend.append(item)}
}
function textEl(tag,cl,text){const el=document.createElement(tag);el.className=cl;el.textContent=text;return el}
async function loadRecent(){const root=$('#ak-pre-receiving');if(!root||document.body.dataset.role!=='pre_receiving'||document.hidden||fetching||Date.now()-lastRead<60000)return;
 const host=$('#ake3-recent-list',root);if(!host)return;fetching=true;lastRead=Date.now();
 try{
  if(typeof session==='undefined'||typeof cfg==='undefined'||!session?.access_token||!cfg?.url||!cfg?.key)throw Error('Oturum bekleniyor');
  const url=cfg.url+'/rest/v1/ak_sevkiyat_on_kayit?select=plate,company,status,created_at,docked_at,departed_at&order=created_at.desc&limit=50';
  const res=await fetch(url,{headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token}});if(!res.ok)throw Error('Kayıtlar okunamadı ('+res.status+')');
  const data=await res.json();if(!Array.isArray(data))throw Error('Beklenmeyen kayıt yanıtı');
  if(!root.isConnected)return;
  const events=[];for(const row of data){if(row.status==='cancelled')continue;for(const [field,label,klass] of [['departed_at','Depodan Çıkış','out'],['docked_at','Depoya Giriş','in'],['created_at','Ön Kayıt','new']])if(row[field]&&Number.isFinite(Date.parse(row[field])))events.push({date:row[field],label,klass,plate:row.plate||'Plaka girilmemiş',company:row.company||''})}
  events.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));host.replaceChildren();
  if(!events.length){host.append(textEl('p','ake3-placeholder','Henüz araç hareketi bulunmuyor.'));return}
  for(const item of events.slice(0,3)){
   const row=textEl('div','ake3-recent-row','');const circle=textEl('span','ake3-recent-icon '+item.klass,'');circle.innerHTML=svg(item.klass==='new'?'clipboard':'truck');
   const name=textEl('strong','ake3-recent-plate',item.plate);const status=textEl('span','ake3-recent-status '+item.klass,item.label);
   const company=textEl('span','ake3-recent-company',item.company);const t=textEl('time','ake3-recent-time',new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'}).format(new Date(item.date)));
   row.append(circle,name,status,company,t);host.append(row)
  }
 }catch(e){if(!root.isConnected)return;host.replaceChildren(textEl('p','ake3-placeholder','Son hareketler şu anda yüklenemiyor. Araç Kayıtları bölümünden görüntüleyebilirsiniz.'));console.warn('Danışma son hareketler:',e.message)}finally{fetching=false}
}
function heartbeat(){mount();syncState();moveRadar();updateClock();paintChart();void loadRecent()}
function start(){
 if(tickId)return;
 // İlk kurulumda 2,5 saniyelik döngüyü beklemeden gerçek modülün doğuşuna tepki ver.
 // Yalnızca #app'in doğrudan çocukları izlenir; alt DOM güncellemeleri gözlenmez.
 const app=$('#app');
 if(app){new MutationObserver(changes=>{
   if(document.body.dataset.role!=='pre_receiving')return;
   if(!changes.some(x=>[...x.addedNodes].some(n=>n.nodeType===1&&(n.id==='ak-pre-receiving'||n.querySelector?.('#ak-pre-receiving')))))return;
   heartbeat();
 }).observe(app,{childList:true});}
 // Oturum rolü belirlenince, gizli kökü de ilk çizimden önce hazırlamayı dene.
 document.addEventListener('aktiva:session-changed',()=>{
   if(document.body.dataset.role==='pre_receiving')queueMicrotask(heartbeat);
 });
 heartbeat();
 // Mevcut veri/sayaç yenilemesi aynen korunur; ilk render bu döngüye bağlı değildir.
 tickId=setInterval(heartbeat,2500);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastRead=0;heartbeat()}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const root=$('#ak-pre-receiving');if(root)closeDrawer(root)}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
