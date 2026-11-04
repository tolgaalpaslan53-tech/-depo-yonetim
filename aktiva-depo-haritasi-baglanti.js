/* AKTİVA mevcut modüllere dokunmadan Depo Haritası girişleri ekler. */
(()=>{
'use strict';
function mount(){
 const parent=document.querySelector('#pickingModule > section.card > .row');
 if(parent&&!document.getElementById('akDepotPickerLink')){
  const a=document.createElement('a');a.id='akDepotPickerLink';a.href='./depo-haritasi.html';a.textContent='🗺️ Depo Haritası';a.setAttribute('aria-label','Depo haritasını ve ürün konumlarını aç');
  a.style.cssText='background:#1d455b;color:#f3fcff;border:1px solid #6bbbd3;border-radius:9px;padding:10px 12px;font-size:13px;font-weight:750;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;min-height:38px';
  parent.appendChild(a);
 }
 const grid=document.querySelector('#adminNavigation .admin-nav-grid');
 if(grid&&!document.getElementById('akDepotAdminLink')){
  const b=document.createElement('button');b.id='akDepotAdminLink';b.type='button';b.textContent='🗺️ Depo Haritası';b.addEventListener('click',()=>{window.location.href='./depo-haritasi.html'});grid.appendChild(b);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
