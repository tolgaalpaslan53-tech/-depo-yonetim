/* AKTİVA: Mal Kabul sade mobil arayüz. Mevcut Supabase oturumunu ve tablolarını kullanır. */
(()=>{'use strict';
const $a=id=>document.getElementById(id), safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let view='home',lines=[],editId=null,opened=null,firmNames=new Set(),productNames=new Set(),msg='',draftName='',draftFirm='',draftPlate='';
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
const dateOf=s=>s?new Date(s).toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'}):'';
const dlist=()=>typeof deliveries==='undefined'?[]:deliveries;
const plist=()=>typeof items==='undefined'?[]:items;
const logged=()=>typeof profile!=='undefined'&&profile?.role==='count'&&typeof session!=='undefined'&&!!session;
const container=()=> $a('aktivaCountUI');
function toast(t){msg=t;render();}
function build(){if($a('aktivaCountUI'))return;const el=document.createElement('section');el.id='aktivaCountUI';el.className='hidden';$a('app').insertBefore(el,$a('message'));}
function nav(to){view=to;opened=null;editId=null;msg='';render();}
function options(arr,q){if(!q?.trim())return '';return [...arr].filter(x=>x.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))&&x.toLocaleLowerCase('tr')!==q.toLocaleLowerCase('tr')).slice(0,5).map(x=>`<button type="button" class="ak-suggestion" data-suggest="${safe(x)}">${safe(x)}</button>`).join('')}
function summary(){const day=today(),me=session?.user?.id;const mine=dlist().filter(d=>d.created_by===me&&dateOf(d.arrived_at)===day);const counted=plist().filter(p=>p.counted_by===me&&p.count_completed&&dateOf(p.counted_at)===day);return {shipments:mine.length,products:counted.length,pallets:counted.reduce((a,p)=>a+Number(p.pallet_count||0),0)}}
function message(s){if(!s.products)return 'Yeni bir gün, yeni fırsatlar.';if(s.products>=10)return 'Bugün büyük emek verdin, teşekkürler!';if(s.products>=3)return 'Güzel ilerliyorsun, emeğine sağlık!';return 'İyi bir başlangıç yaptın!'}
function render(){build();const el=container();el.classList.toggle('hidden',!logged());if(!logged())return;
const me=profile?.full_name||'Personel', stats=summary();firmNames=new Set([...firmNames,...dlist().map(d=>d.supplier).filter(Boolean)]);productNames=new Set([...productNames,...plist().map(p=>p.name).filter(Boolean)]);
let html=`<div class="ak-user"><span class="ak-avatar">♙</span><div><small>Hoş geldin</small><strong>${safe(me)}</strong><small>Mal Kabul Personeli</small></div></div>`;
if(view==='home')html+=`<button class="ak-tile ak-primary" id="ak-new"><span class="ak-tile-icon">▣</span><strong>Ürün Kaydet</strong></button><button class="ak-tile" id="ak-list"><span class="ak-tile-icon">▤</span><strong>Kaydedilen Sevkiyatlar</strong><small>${dlist().length} sevkiyat</small></button>`;
if(view==='create')html+=`<div class="ak-heading"><h2>Yeni Sevkiyat</h2><button class="ak-back" id="ak-back">Geri</button></div><form id="ak-form"><label>Gönderen firma *<input id="ak-firm" autocomplete="off" required maxlength="150" placeholder="Firma adı" value="${safe(draftFirm)}"></label><div id="ak-firm-suggestions" class="ak-suggestions"></div><label>Plaka (isteğe bağlı)<input id="ak-plate" maxlength="80" placeholder="48 ABC 123" value="${safe(draftPlate)}"></label><h3>Ürün Listesi</h3><div id="ak-lines">${lines.map((p,i)=>`<div class="ak-line"><div><strong>${safe(p.name)}</strong><small>${p.cartons} koli · ${p.pallets} palet</small></div><button type="button" class="ak-remove" data-remove="${i}">Sil</button></div>`).join('')}</div><label>Ürün adı<input id="ak-product" autocomplete="off" maxlength="200" placeholder="Ürün adı" value="${safe(draftName)}"></label><div id="ak-product-suggestions" class="ak-suggestions"></div><div class="ak-two"><label>Kaç koli?<input id="ak-cartons" type="number" min="1" step="1" placeholder="120"></label><label>Kaç palet?<input id="ak-pallets" type="number" min="1" step="1" placeholder="3"></label></div><button type="button" class="ak-outline" id="ak-add">+ Listeye Ürün Ekle</button><button type="submit" class="ak-submit" id="ak-save">Sevkiyatı Kaydet</button></form>`;
if(view==='list'){
 html+=`<div class="ak-heading"><h2>Kaydedilen Sevkiyatlar</h2><button class="ak-back" id="ak-back">Geri</button></div>`;
 for(const d of dlist()){
  const ps=plist().filter(p=>p.delivery_id===d.id);
  html+=`<div class="ak-shipment"><button class="ak-shipment-head" data-open="${safe(d.id)}"><strong>${safe(d.supplier)}</strong><small>${safe(d.vehicle||'Plakasız')} · ${ps.length} ürün</small></button>`;
  if(opened===d.id){
   for(const p of ps){
    html+=`<div class="ak-product"><strong>${safe(p.name)}</strong><small>${Number(p.expected||0)} koli · ${Number(p.pallet_count||0)} palet</small><div class="ak-complete"><span>${p.count_completed?'✓ Sayımı Tamamlandı':'Bekliyor'}</span><button type="button" data-edit="${safe(p.id)}">${p.count_completed?'Düzenle':'Sayımı Tamamla'}</button></div>`;
    if(editId===p.id)html+=`<form class="ak-edit-form" data-editform="${safe(p.id)}"><label>Eksik koli<input name="missing" type="number" min="0" max="${Number(p.expected||0)}" step="1" value="${Math.max(0,Number(p.expected||0)-Number(p.received||0))}" required></label><label>Gerçek palet sayısı<input name="pallets" type="number" min="0" step="1" value="${Number(p.pallet_count||0)}" required></label><div class="ak-two"><button type="button" class="ak-outline" id="ak-cancel">İptal</button><button type="submit" class="ak-submit">Kaydet</button></div></form>`;
    html+='</div>';
   }
  }
  html+='</div>';
 }
 if(!dlist().length)html+='<p>Henüz sevkiyat bulunmuyor.</p>';
}

html+=`<div class="ak-successes"><div class="ak-success-title">★ Günlük Başarıların <span>${new Date().toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'})}</span></div><div class="ak-metrics"><div><strong>${stats.shipments}</strong><small>Sevkiyat</small></div><div><strong>${stats.products}</strong><small>Ürün</small></div><div><strong>${stats.pallets}</strong><small>Palet</small></div></div><p>${message(stats)}</p></div>`;
if(msg)html+=`<p class="ak-message" role="status">${safe(msg)}</p>`;el.innerHTML=html;
el.querySelector('#ak-new')?.addEventListener('click',()=>nav('create'));el.querySelector('#ak-list')?.addEventListener('click',()=>nav('list'));el.querySelector('#ak-back')?.addEventListener('click',()=>nav('home'));
el.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{opened=opened===b.dataset.open?null:b.dataset.open;editId=null;render()});
el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{editId=b.dataset.edit;render()});el.querySelector('#ak-cancel')?.addEventListener('click',()=>{editId=null;render()});
el.querySelectorAll('[data-editform]').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const p=plist().find(x=>x.id===f.dataset.editform);if(!p)return;const m=Number(f.elements.missing.value),a=Number(f.elements.pallets.value);if(!Number.isSafeInteger(m)||m<0||m>Number(p.expected)||!Number.isSafeInteger(a)||a<0){toast('Miktarları kontrol et.');return}try{await req('/rest/v1/products?id=eq.'+encodeURIComponent(p.id),{method:'PATCH',body:{received:Number(p.expected)-m,pallet_count:a,counted_by:session.user.id,count_completed:true,counted_at:new Date().toISOString()}});editId=null;await sync(true);toast('Sayım bilgileri güncellendi.')}catch(err){toast(err.message)}});
el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{lines.splice(Number(b.dataset.remove),1);render()});
const fi=el.querySelector('#ak-firm'),pr=el.querySelector('#ak-product');if(fi){fi.oninput=()=>{draftFirm=fi.value;el.querySelector('#ak-firm-suggestions').innerHTML=options(firmNames,fi.value);bindSuggest('firm')};fi.dispatchEvent(new Event('input'))}if(pr){pr.oninput=()=>{draftName=pr.value;el.querySelector('#ak-product-suggestions').innerHTML=options(productNames,pr.value);bindSuggest('product')};pr.dispatchEvent(new Event('input'))}
el.querySelector('#ak-add')?.addEventListener('click',()=>{const n=pr.value.trim(),c=Number(el.querySelector('#ak-cartons').value),p=Number(el.querySelector('#ak-pallets').value);if(!n||!Number.isSafeInteger(c)||c<=0||!Number.isSafeInteger(p)||p<=0){toast('Ürün adı, koli ve palet sayılarını kontrol et.');return}draftFirm=fi.value;draftPlate=el.querySelector('#ak-plate').value;lines.push({name:n,cartons:c,pallets:p});draftName='';render()});
el.querySelector('#ak-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=fi.value.trim(),plate=el.querySelector('#ak-plate').value.trim();if(!f||!lines.length){toast('Firma ve en az bir ürün gir.');return}const b=el.querySelector('#ak-save');b.disabled=true;try{const now=new Date().toISOString(),obj={created_by:session.user.id,vehicle:plate||'-',supplier:f,invoice:'-',arrived_at:now,pallets:lines.reduce((a,p)=>a+p.pallets,0),cartons:lines.reduce((a,p)=>a+p.cartons,0),status:'open'};const ds=await req('/rest/v1/deliveries',{method:'POST',body:obj,headers:{Prefer:'return=representation'}});const id=ds?.[0]?.id;if(!id)throw Error('Sevkiyat kaydı oluşturuldu ancak ürün bağlantısı alınamadı.');const rows=lines.map(p=>({counted_by:session.user.id,delivery_id:id,name:p.name,sku:'',expected:p.cartons,received:0,count_completed:false,damaged:0,returned:0,pallet_count:p.pallets}));await req('/rest/v1/products',{method:'POST',body:rows,headers:{Prefer:'return=minimal'}});lines=[];draftName='';draftFirm='';draftPlate='';await sync(true);opened=id;view='list';toast('Sevkiyat kaydedildi.')}catch(err){toast('Kayıt hatası: '+err.message)}finally{b.disabled=false}});
}
function bindSuggest(type){const root=container(),id=type==='firm'?'ak-firm':'ak-product';root.querySelectorAll(`#ak-${type}-suggestions [data-suggest]`).forEach(b=>b.onclick=()=>{root.querySelector('#'+id).value=b.dataset.suggest;if(type==='firm')draftFirm=b.dataset.suggest;else draftName=b.dataset.suggest;root.querySelector(`#ak-${type}-suggestions`).innerHTML=''})}
const oldRender=typeof render==='function'?render:null;
// Ana uygulamanın yenileme ve oturum akışına müdahale etmeden, veriler yenilendiğinde ekranı güncelle.
const observe=new MutationObserver(()=>{if(!logged())container()?.classList.add('hidden');else if(container()?.classList.contains('hidden'))render()});
window.addEventListener('load',()=>{build();observe.observe($a('app'),{attributes:true,attributeFilter:['class']});setInterval(()=>{if(logged()&&!document.hidden&&view!=='create'&&editId===null)render()},10000);render()});
})();
