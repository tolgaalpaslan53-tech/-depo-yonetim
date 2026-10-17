/* AKTİVA: Mal Kabul + Tedarikçi Sevkiyatları ortak sayım ilerleme görünümü. */
(()=>{'use strict';
const STYLE='aktiva-shipment-progress-style';let asnCache=[],asnFetched=0,loading=false,scheduled=false;
function install(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`
#aktivaCountUI .ak-shipment-pro.ak-shipment-finished{background:linear-gradient(110deg,#0c2d20,#123b29)!important;border-color:#287e4b!important}
#aktivaCountUI .ak-shipment-pro.ak-shipment-finished .ak-shipment-head{background:transparent!important}
#aktivaCountUI .ak-shipment-status{display:inline-flex;align-items:center;border-radius:100px;padding:5px 10px;background:#17733e;color:#f1fff6;font-size:12px;font-weight:700;white-space:nowrap}
#aktivaCountUI .ak-shipment-track{height:7px;border-radius:20px;overflow:hidden;background:#343c46;margin:0 14px 13px}
#aktivaCountUI .ak-shipment-fill{height:100%;background:linear-gradient(90deg,#248c50,#48cc78);border-radius:20px;transition:width .25s ease}
#aktivaCountUI .ak-shipment-finished .ak-shipment-track{background:#1b5133}
`;document.head.appendChild(s)}
function products(){try{return typeof items!=='undefined'&&Array.isArray(items)?items:[]}catch(_){return []}}
function decorate(card,button,ps){const done=ps.filter(p=>p.count_completed===true).length,finished=ps.length>0&&done===ps.length,pct=ps.length?100*done/ps.length:0;
card.classList.toggle('ak-shipment-finished',finished);
let status=button.querySelector('.ak-shipment-status');if(finished){if(!status){status=document.createElement('span');status.className='ak-shipment-status';button.appendChild(status)}if(status.textContent!=='✓ Sayım Tamamlandı')status.textContent='✓ Sayım Tamamlandı'}else if(status)status.remove();
let track=card.querySelector(':scope > .ak-shipment-track');if(!track){track=document.createElement('div');track.className='ak-shipment-track';track.setAttribute('role','progressbar');track.setAttribute('aria-label','Sayım ilerlemesi');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');card.appendChild(track)}
const val=String(Math.round(pct));if(track.getAttribute('aria-valuenow')!==val)track.setAttribute('aria-valuenow',val);
let fill=track.querySelector('.ak-shipment-fill');if(!fill){fill=document.createElement('div');fill.className='ak-shipment-fill';track.appendChild(fill)}const width=pct+'%';if(fill.style.width!==width)fill.style.width=width;
}
function update(){const root=document.getElementById('aktivaCountUI');if(!root||root.classList.contains('hidden'))return;const all=products();
root.querySelectorAll('.ak-shipment-pro').forEach(card=>{const normal=card.querySelector('[data-open]'),asn=card.querySelector('[data-asn-open]');if(normal){decorate(card,normal,all.filter(p=>String(p.delivery_id)===String(normal.dataset.open)))}else if(asn){const record=asnCache.find(r=>String(r.id)===String(asn.dataset.asnOpen));const ps=record?.delivery_id?all.filter(p=>String(p.delivery_id)===String(record.delivery_id)):[];decorate(card,asn,ps)}});
if(root.querySelector('[data-asn-open]'))fetchAsn();}
async function fetchAsn(){if(loading||Date.now()-asnFetched<12000||typeof req!=='function')return;loading=true;asnFetched=Date.now();try{const data=await req('/rest/v1/aktiva_supplier_shipments?select=id,delivery_id&order=created_at.desc&limit=500');if(Array.isArray(data)){asnCache=data;queue()}}catch(e){/* Kayıtların görünmesini engelleme */}finally{loading=false}}
function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;update()})}
function init(){install();let watched=null;const observer=new MutationObserver(()=>{const root=document.getElementById('aktivaCountUI');if(root&&root!==watched){watched=root;new MutationObserver(queue).observe(root,{childList:true,subtree:true});queue()}});observer.observe(document.body,{childList:true,subtree:true});const root=document.getElementById('aktivaCountUI');if(root){watched=root;new MutationObserver(queue).observe(root,{childList:true,subtree:true})}queue();document.addEventListener('visibilitychange',()=>{if(!document.hidden){asnFetched=0;queue()}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
