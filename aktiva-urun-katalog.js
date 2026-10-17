(()=>{'use strict';
let products=[],map={},chosen=null,pendingBarcode='';
try{map=JSON.parse(localStorage.getItem('aktiva_barkod_eslestirme_demo')||'{}')||{}}catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const style=document.createElement('style');style.textContent=`#aktivaCatalogOverlay{position:fixed;inset:0;z-index:2147483001;background:#101722;color:#f5f6fa;overflow:auto;padding:16px;font:15px system-ui}#aktivaCatalogOverlay .ac-wrap{max-width:650px;margin:auto}#aktivaCatalogOverlay input,#aktivaCatalogOverlay select{width:100%;box-sizing:border-box;background:#202a39;color:white;border:1px solid #647084;border-radius:9px;padding:12px;margin:6px 0;font-size:16px}#aktivaCatalogOverlay button{background:#c62842;color:white;border:0;border-radius:9px;padding:12px;cursor:pointer;margin:4px}#aktivaCatalogOverlay .ac-item{display:block;width:100%;text-align:left;background:#202a39;border:1px solid #485466;border-radius:9px;padding:12px;margin:5px 0}#aktivaCatalogOverlay small{color:#b8c1cf}#ac-selected{background:#183a30;border:1px solid #44aa79;border-radius:12px;padding:12px;margin:12px 0}#ac-list:empty{display:none}`;document.head.append(style);
async function init(){if(products.length)return;try{const r=await fetch('aktiva-urunler.json',{cache:'no-store'});if(!r.ok)throw Error('Dosya bulunamadı');const data=await r.json();if(!Array.isArray(data))throw Error('Ürün listesi geçersiz');products=data}catch(e){alert('Ürün listesi yüklenemedi: '+e.message)}}
function view(){let el=document.getElementById('aktivaCatalogOverlay');if(!el){el=document.createElement('div');el.id='aktivaCatalogOverlay';document.body.append(el)}chosen=null;el.innerHTML='<div class="ac-wrap"><button type="button" id="ac-close">← Geri</button><h2>AKTİVA • Ürün Barkod Tanıtımı</h2><p id="ac-hint">Ürün adı veya kodunu yazın.</p><label>Ürün ara<input id="ac-search" autocomplete="off" placeholder="Ürün adı veya kodu"></label><div id="ac-list"></div><div id="ac-selected" hidden></div><div id="ac-detail"></div><p><small>Barkod eşleştirmeleri bu sürümde yalnızca bu cihazda tutulur.</small></p></div>';el.querySelector('#ac-close').onclick=()=>el.remove();el.querySelector('#ac-search').oninput=showResults}
function showResults(){const el=document.getElementById('aktivaCatalogOverlay');if(!el)return;const term=el.querySelector('#ac-search').value.trim().toLocaleLowerCase('tr');const list=el.querySelector('#ac-list');if(!term){list.innerHTML='';return}const linked=map[term];const found=products.filter(p=>String(p.code||'').toLocaleLowerCase('tr').includes(term)||String(p.name||'').toLocaleLowerCase('tr').includes(term)||String(p.position||'').toLocaleLowerCase('tr').includes(term)||p.code===linked).slice(0,8);list.innerHTML=found.map(p=>`<button type="button" class="ac-item" data-code="${esc(p.code)}"><b>${esc(p.name)}</b><br><small>Kod: ${esc(p.code)} · Pozisyon: ${esc(p.position)}</small></button>`).join('')||'<p>Ürün bulunamadı.</p>';list.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>select(b.dataset.code))}
function select(code){chosen=products.find(p=>String(p.code)===String(code));if(!chosen)return;const root=document.getElementById('aktivaCatalogOverlay');if(!root)return;root.querySelector('#ac-search').value=chosen.name;root.querySelector('#ac-list').innerHTML='';const selected=root.querySelector('#ac-selected');selected.hidden=false;selected.innerHTML=`<strong>✓ SEÇİLEN ÜRÜN</strong><div style="font-size:18px;font-weight:700;margin:8px 0">${esc(chosen.name)}</div><small>Kod: ${esc(chosen.code)} · Depo pozisyonu: ${esc(chosen.position)} · Koli içi: ${esc(chosen.pack??'Belirsiz')}</small><div><button type="button" id="ac-change">Başka ürün seç</button></div>`;selected.querySelector('#ac-change').onclick=()=>{chosen=null;selected.hidden=true;root.querySelector('#ac-detail').innerHTML='';const input=root.querySelector('#ac-search');input.value='';input.focus()};const el=root.querySelector('#ac-detail');el.innerHTML='<label>Bu ürüne barkod bağla<input id="ac-barcode" inputmode="numeric" placeholder="Okutulan barkod numarası"></label><button type="button" id="ac-save">✓ Barkodu seçilen ürüne eşleştir</button>';el.querySelector('#ac-barcode').value=pendingBarcode;el.querySelector('#ac-save').onclick=()=>{const barcode=el.querySelector('#ac-barcode').value.trim();if(!/^\d{6,20}$/.test(barcode)){alert('Geçerli barkod numarası girin');return}if(map[barcode]&&map[barcode]!==chosen.code&&!confirm('Bu barkod başka ürüne bağlı. Değiştirilsin mi?'))return;map[barcode]=chosen.code;localStorage.setItem('aktiva_barkod_eslestirme_demo',JSON.stringify(map));if(typeof window.AKTIVA_miniBarcodeMapped==='function')window.AKTIVA_miniBarcodeMapped({name:chosen.name,code:chosen.code,pack:chosen.pack,position:chosen.position,barcode});alert('Barkod seçilen ürünle bu cihazda eşleştirildi.');pendingBarcode='';root.remove()}}
async function open(){pendingBarcode='';await init();view()}
async function openBarcodeMatch(barcode){pendingBarcode=String(barcode||'').trim();if(!pendingBarcode)return;await init();view();const root=document.getElementById('aktivaCatalogOverlay');const linked=products.find(p=>p.code===map[pendingBarcode]);if(linked){select(linked.code);return}root.querySelector('#ac-hint').textContent='Okutulan barkod: '+pendingBarcode+' — Eşleştirmek için ürün arayın ve seçin.';root.querySelector('#ac-search').focus()}
window.AKTIVA_openBarcodeMatch=openBarcodeMatch;
// Yeni Sevkiyat ürün listesi için küçük barkod okutucu. Eski sevkiyat kayıtlarına dokunmaz.
let miniBarcode='';
function miniFill(p,barcode){
 const form=document.getElementById('ak-form');if(!form||!p)return;
 const input=form.querySelector('#ak-product');if(input){input.value=String(p.name||'');input.dispatchEvent(new Event('input',{bubbles:true}));}if(typeof window.AKTIVA_setShipmentScannedProduct==='function')window.AKTIVA_setShipmentScannedProduct({...p,barcode});
 const info=form.querySelector('#ak-mini-result');if(info){info.hidden=false;info.innerHTML='<strong>✓ Ürün bulundu</strong><div>'+esc(p.name||'')+'</div><small>Ürün kodu: '+esc(p.code||'')+' · Koli içi: '+esc(p.pack??'Belirtilmemiş')+' adet</small><small style="display:block">Barkod: '+esc(barcode||'')+'</small>';}
}
window.AKTIVA_miniBarcodeMapped=(p)=>{if(miniBarcode){miniFill(p,p.barcode||miniBarcode);miniBarcode='';}};
window.AKTIVA_miniBarcodeHandler=(barcode)=>{
 const form=document.getElementById('ak-form');if(!form||!document.getElementById('ak-mini-scanner'))return false;
 miniBarcode=String(barcode||'').trim();
 (async()=>{
  await init();
  const p=products.find(x=>String(x.code)===String(map[miniBarcode]));
  if(p){miniFill(p,miniBarcode);miniBarcode='';}
  else {const info=document.getElementById('ak-mini-result');if(info){info.hidden=false;info.textContent='Barkod henüz eşleşmedi. Açılan ekranda ürünü seçip barkodu bağlayın.';}await openBarcodeMatch(miniBarcode);}
 })().catch(e=>{const info=document.getElementById('ak-mini-result');if(info){info.hidden=false;info.textContent='Ürün sorgusu başarısız: '+e.message;}});
 return true;
};
function attachMini(){
 const form=document.getElementById('ak-form');if(!form||form.querySelector('#ak-mini-scanner'))return;
 const heading=[...form.querySelectorAll('h3')].find(h=>h.textContent.trim()==='Ürün Listesi');if(!heading)return;
 const wrap=document.createElement('div');wrap.id='ak-mini-scanner';wrap.style.cssText='background:#262a31;border:1px solid #484b52;border-radius:12px;padding:11px;margin:10px 0;color:#fff';
 wrap.innerHTML='<button type="button" id="ak-mini-open" style="width:100%;padding:11px">▥ Barkod Okut · Ürün Bilgilerini Getir</button><div id="ak-mini-result" hidden style="margin-top:10px;line-height:1.8;color:#d8fbe1"></div>';
 heading.insertAdjacentElement('afterend',wrap);
 wrap.querySelector('#ak-mini-open').onclick=()=>{miniBarcode='';if(typeof window.AKTIVA_startBarcodeScanner==='function')window.AKTIVA_startBarcodeScanner('shipment');else alert('Barkod okuyucu henüz yüklenmedi. Sayfayı yenileyin.');};
}
new MutationObserver(attachMini).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',attachMini);

function attach(){const root=document.getElementById('aktivaCountUI');if(!root||root.classList.contains('hidden')||root.querySelector('#ac-open'))return;const b=document.createElement('button');b.id='ac-open';b.textContent='🔎 Ürün Kataloğu / Koli Hesapla';b.style.cssText='display:block;width:100%;margin:10px 0;background:#c62842;color:white;padding:14px;border:0;border-radius:10px;font-weight:700';b.onclick=open;root.prepend(b)}
new MutationObserver(attach).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});document.addEventListener('DOMContentLoaded',attach);
})();
