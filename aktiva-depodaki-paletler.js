/* AKTİVA · Depodaki Paletler: doğrulanmış irsaliye ambalaj girişleri.
 * Palet Takibi, Palet İade Operasyonu ve push bildirimleri bağımsızdır.
 * Çıkışlar/önceki stok kayda alınmadığı için bu ekrandaki değerler giriş toplamıdır.
 */
(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('tr-TR');
const date=s=>s?new Date(s).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'short',timeStyle:'short'}):'—';
const role=()=>document.body?.dataset?.role;
// Yalnızca ekranda kullanılan depo terminolojisi. Veritabanında irsaliyenin
// orijinal kodu, adı, palet/kasa ayrımı ve miktarı değiştirilmeden saklanır.
const TAM_KODLAR=new Set(['9900351','9900353','9900355','9900360','9900022','9900369','9900363']);
const YARIM_KODLAR=new Set(['9900352','9900354','9900356','9900362','9900023','9900370','9900364']);
function paletSinifi(item){
 if(item.kind!=='palet')return '';
 const code=String(item.code||'').trim();
 if(TAM_KODLAR.has(code))return 'tam';
 if(YARIM_KODLAR.has(code))return 'yarim';
 const name=String(item.name||'').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[İIı]/g,'I').replace(/Ü/g,'U');
 if(/DUSS(?:EL|L)?DORF|60\s*[X×*]\s*80/.test(name))return 'yarim';
 if(/\bEURO\b|80\s*[X×*]\s*120/.test(name))return 'tam';
 return '';
}
const paletAdi=sinif=>sinif==='tam'?'Tam Palet (EUR)':sinif==='yarim'?'Yarım Palet (DUS)':'';
let entries=[],filter='palet',query='',busy=false;
function style(){if(document.getElementById('akdp-style'))return;const el=document.createElement('style');el.id='akdp-style';el.textContent=`
.akdp-overlay[hidden]{display:none!important}.akdp-overlay{position:fixed;inset:0;z-index:2147483100;background:rgba(2,7,15,.82);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}
.akdp-overlay,.akdp-overlay *{box-sizing:border-box}.akdp-panel{width:min(100%,760px);max-height:min(94dvh,1000px);overflow:auto;overscroll-behavior:contain;background:#121c2a;color:#eef3fb;border:1px solid #394859;border-radius:21px;box-shadow:0 24px 90px #0008;padding:clamp(15px,3vw,27px);font-family:system-ui,-apple-system,sans-serif}
.akdp-header{display:flex;align-items:start;justify-content:space-between;gap:12px;margin-bottom:18px}.akdp-eyebrow{color:#d38b96;font-size:11px;letter-spacing:.13em;font-weight:800}.akdp-header h2{margin:5px 0;font-size:clamp(22px,4vw,30px);line-height:1.2;color:white}.akdp-lead{font-size:13px;line-height:1.5;color:#b8c5d4;margin:4px 0 14px}.akdp-close{background:#293749!important;color:#eef3fb!important;border:1px solid #4b5c71!important;border-radius:11px!important;min-width:43px;min-height:43px;padding:0!important;font-size:25px!important}
.akdp-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}.akdp-stat{background:#1d2b3d;border:1px solid #405167;border-radius:15px;padding:13px}.akdp-stat small{display:block;color:#aebcce;font-size:12px}.akdp-stat strong{display:block;font-size:28px;color:white;margin-top:4px;font-variant-numeric:tabular-nums}
.akdp-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:13px 0}.akdp-tabs button{background:#26344a!important;border:1px solid #4c5b70!important;color:#dbe6f5!important;border-radius:11px!important;padding:11px 15px!important;font-size:13px!important}.akdp-tabs button[aria-pressed=true]{background:#aa2334!important;border-color:#e25a68!important;color:white!important}
.akdp-search{display:block;width:100%;background:#0c1827!important;color:white!important;border:1px solid #536176!important;border-radius:12px!important;padding:13px!important;font-size:16px!important;margin-bottom:14px}.akdp-search::placeholder{color:#b0b8c4}
.akdp-list{display:grid;gap:9px}.akdp-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;background:#1b293b;border:1px solid #34475d;border-radius:13px}.akdp-item>div{min-width:0}.akdp-item strong{display:block;color:white;font-size:14px;line-height:1.42;overflow-wrap:anywhere}.akdp-item small{display:block;color:#aebdd0;font-size:12px;margin-top:5px}.akdp-amount{font-size:23px;font-weight:800;color:#fff;white-space:nowrap;font-variant-numeric:tabular-nums}.akdp-amount small{font-weight:500;font-size:11px;color:#b6c5d9;text-align:right}
.akdp-type-head{font-size:13px;font-weight:750;color:#dce6f3;margin:17px 0 9px}.akdp-type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-bottom:15px}.akdp-type-card{background:#192a39;border:1px solid #41556b;border-radius:13px;padding:13px}.akdp-type-card small{display:block;color:#b8cadc;font-size:12px}.akdp-type-card strong{display:block;color:white;font-variant-numeric:tabular-nums;font-size:24px;margin-top:5px}.akdp-item small.akdp-original{color:#c6d2e1;font-size:12px;line-height:1.42;margin-top:3px}.akdp-note{margin:15px 0 5px;color:#c3ccda;font-size:12px;line-height:1.55;background:#202d3f;border-left:3px solid #dd9c54;border-radius:7px;padding:12px}.akdp-bottom{display:flex;justify-content:flex-end;margin-top:15px}.akdp-refresh{background:#273850!important;border:1px solid #50617a!important;border-radius:10px!important;color:white!important;padding:11px 17px!important}.akdp-error{padding:13px;border-radius:10px;border:1px solid #ba4d56;background:#4d2028;color:#fff}.akdp-empty{color:#b9c8d8;text-align:center;padding:30px 14px}
body.akdp-scroll-lock{overflow:hidden!important}@media(max-width:480px){.akdp-overlay{align-items:flex-end;padding:0}.akdp-panel{max-height:95dvh;border-radius:20px 20px 0 0;padding:19px 15px env(safe-area-inset-bottom,14px)}.akdp-stat strong{font-size:24px}.akdp-item{padding:12px}}
`;document.head.appendChild(el)}
function getPanel(){return document.getElementById('akdp-overlay')}
function destroy(){const overlay=getPanel();if(!overlay)return;overlay.remove();document.body.classList.remove('akdp-scroll-lock');}
function draw(error=''){
 const overlay=getPanel();if(!overlay)return;const root=overlay.querySelector('#akdp-content');if(!root)return;
 const map=new Map();let palletTotal=0,caseTotal=0,tamTotal=0,yarimTotal=0;
 for(const r of entries){if(!Array.isArray(r.satirlar))continue;for(const row of r.satirlar){const kind=row.kind==='kasa'?'kasa':'palet',qty=Number(row.quantity);
  if(!Number.isSafeInteger(qty)||qty<=0)continue;
  const code=String(row.code||''),name=String(row.name||''),key=kind+'|'+(code||name.toLocaleUpperCase('tr-TR'));
  if(!map.has(key))map.set(key,{kind,code,name,quantity:0,deliveries:0,latest:''});
  const item=map.get(key);item.quantity+=qty;item.deliveries++;
  if(!item.latest||r.kayit_tarihi>item.latest)item.latest=r.kayit_tarihi;
  if(kind==='palet'){palletTotal+=qty;const sinif=paletSinifi({kind,code,name});if(sinif==='tam')tamTotal+=qty;else if(sinif==='yarim')yarimTotal+=qty;}else caseTotal+=qty;
 }}
 const items=[...map.values()].filter(x=>x.kind===filter&&(x.name+' '+x.code+' '+paletAdi(paletSinifi(x))).toLocaleLowerCase('tr-TR').includes(query)).sort((a,b)=>b.quantity-a.quantity||a.name.localeCompare(b.name,'tr'));
 root.innerHTML=`<div class="akdp-summary"><div class="akdp-stat"><small>Kaydedilen palet girişi</small><strong>${fmt(palletTotal)}</strong></div><div class="akdp-stat"><small>Kaydedilen kasa girişi</small><strong>${fmt(caseTotal)}</strong></div></div>
 <div class="akdp-tabs" role="group" aria-label="Ambalaj türü"><button type="button" data-akdp="palet" aria-pressed="${filter==='palet'}">Paletler</button><button type="button" data-akdp="kasa" aria-pressed="${filter==='kasa'}">Kasalar / Box</button></div>
 ${filter==='palet'?`<h3 class="akdp-type-head">Palet türlerine göre giriş toplamı</h3><div class="akdp-type-grid"><div class="akdp-type-card"><small>Tam Palet (EUR)</small><strong>${fmt(tamTotal)}</strong><small>Euro · 80 × 120 cm</small></div><div class="akdp-type-card"><small>Yarım Palet (DUS)</small><strong>${fmt(yarimTotal)}</strong><small>Düsseldorf · 60 × 80 cm</small></div></div>`:''}
 <input id="akdp-search" class="akdp-search" type="search" autocomplete="off" placeholder="Kod veya tür ara" value="${esc(query)}" aria-label="Palet veya kasa kodu ile ara">
 ${error?`<p class="akdp-error" role="alert">${esc(error)}</p>`:''}
 <div class="akdp-list">${busy?'<p class="akdp-empty">Depo kayıtları yükleniyor…</p>':items.length?items.map(x=>`<div class="akdp-item"><div><strong>${esc(paletAdi(paletSinifi(x))||x.name)}</strong>${paletAdi(paletSinifi(x))?`<small class="akdp-original">${esc(x.name)}</small>`:''}<small>${esc(x.code||'Diğer '+(x.kind==='palet'?'palet':'kasa'))} · ${fmt(x.deliveries)} kayıt · Son giriş: ${esc(date(x.latest))}</small></div><div class="akdp-amount">${fmt(x.quantity)}<small>adet giriş</small></div></div>`).join(''):'<p class="akdp-empty">Bu türde henüz kayıt bulunmuyor.</p>'}</div>
 <p class="akdp-note"><strong>Stok bilgisi:</strong> Bunlar bu özellik kurulduktan sonra onaylanan irsaliyelerden gelen toplam miktarlardır. Önceden depoda bulunanlar ve Palet İade Operasyonu ile çıkanlar henüz otomatik hesaba katılmaz. Dolayısıyla kesin mevcut stok sayısı değildir.</p>
 <div class="akdp-bottom"><button class="akdp-refresh" type="button" data-akdp="refresh" ${busy?'disabled':''}>↻ Kayıtları Yenile</button></div>`;
 root.querySelectorAll('[data-akdp="palet"],[data-akdp="kasa"]').forEach(b=>b.onclick=()=>{filter=b.dataset.akdp;query='';draw()});
 root.querySelector('#akdp-search')?.addEventListener('input',e=>{query=e.target.value.toLocaleLowerCase('tr-TR');const start=e.target.selectionStart;draw();const el=root.querySelector('#akdp-search');el?.focus();try{el?.setSelectionRange(start,start)}catch{}});
 root.querySelector('[data-akdp="refresh"]')?.addEventListener('click',load);
}
async function load(){if(busy)return;busy=true;draw();try{
 let results=[];
 for(let offset=0;offset<50000;offset+=1000){
  const rows=await req('/rest/v1/ak_depo_ambalaj_girisleri?select=delivery_id,satirlar,kayit_tarihi&order=kayit_tarihi.desc&limit=1000&offset='+offset);
  if(!Array.isArray(rows))throw Error('Supabase beklenmeyen yanıt verdi.');results.push(...rows);if(rows.length<1000)break;
  if(offset>=49000)throw Error('Kayıt sınırı aşıldı. Eksik toplam gösterilmedi.');
 }
 entries=results;busy=false;draw();
 }catch(err){entries=[];busy=false;let m=err.message||String(err);if(/404|does not exist|schema cache|PGRST205|relation .* not found/i.test(m))m='Veritabanı kurulum dosyası henüz çalıştırılmamış olabilir. AKTIVA_DEPODAKI_PALETLER.sql kurulumu gerekli.';draw('Kayıtlar alınamadı: '+m)}
}
function open(){if(role()!=='count')return;if(getPanel())return;style();filter='palet';query='';entries=[];
 const overlay=document.createElement('div');overlay.id='akdp-overlay';overlay.className='akdp-overlay';overlay.innerHTML='<section class="akdp-panel" role="dialog" aria-modal="true" aria-labelledby="akdp-title"><header class="akdp-header"><div><small class="akdp-eyebrow">MAL KABUL · AMBALAJ KAYITLARI</small><h2 id="akdp-title">Palet Envanteri</h2><p class="akdp-lead">İrsaliye girişlerini Tam Palet (EUR) ve Yarım Palet (DUS) olarak görün; orijinal kodlara göre ayrı inceleyin.</p></div><button class="akdp-close" type="button" aria-label="Kapat">×</button></header><div id="akdp-content" role="region" aria-live="polite"></div></section>';
 overlay.addEventListener('click',e=>{if(e.target===overlay)destroy()});overlay.querySelector('.akdp-close').onclick=destroy;
 overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){destroy();e.stopPropagation()}});
 document.body.appendChild(overlay);document.body.classList.add('akdp-scroll-lock');overlay.querySelector('.akdp-close').focus();load();
}
window.AKTIVA_OPEN_DEPODAKI_PALETLER=open;
})();
