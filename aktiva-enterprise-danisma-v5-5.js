/* AKTİVA Danışma V5.5 — native tarih alanı için görsel katman.
   Kayıt değerlerine, olay işleyicilerine, Supabase ve push koduna dokunmaz. */
(()=>{'use strict';
const dateIds=['akpr-excel-start','akpr-excel-end','akpr-history-start','akpr-history-end'];
const dateFormat=new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',year:'numeric'});
const calendarSVG='<svg class="akv55-date-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>';
function dateText(field){
 const raw=field.value||'';
 if(!raw)return field.type==='datetime-local'?'Tarih ve saat seç':'Tarih seç';
 const [daypart,timepart]=raw.split('T'),parts=daypart.split('-').map(Number);
 if(parts.length!==3||!parts.every(Number.isFinite))return raw;
 const day=new Date(parts[0],parts[1]-1,parts[2]);
 const label=dateFormat.format(day);
 return timepart?label+' · '+timepart.slice(0,5):label;
}
function refresh(field){
 const shell=field.parentElement;
 if(!shell?.classList.contains('akv55-date-shell'))return;
 shell.querySelector('.akv55-date-text').textContent=dateText(field);
 shell.classList.toggle('akv55-empty',!field.value);
}
function enhance(field){
 if(!field||field.closest('.akv55-date-shell'))return;
 const shell=document.createElement('span');shell.className='akv55-date-shell';
 const text=document.createElement('span');text.className='akv55-date-text';
 field.parentNode.insertBefore(shell,field);shell.append(text);
 shell.insertAdjacentHTML('beforeend',calendarSVG);shell.append(field);
 field.addEventListener('input',()=>refresh(field));
 field.addEventListener('change',()=>refresh(field));
 refresh(field);
}
function ensure(){
 if(document.body.dataset.role!=='pre_receiving')return;
 const root=document.getElementById('ak-pre-receiving');
 if(!root)return;
 for(const id of dateIds)enhance(root.querySelector('#'+id));
 enhance(root.querySelector('#akpr-new-view input[name="arrival_at"]'));
 for(const id of dateIds){const field=root.querySelector('#'+id);if(field)refresh(field)}
 const arr=root.querySelector('#akpr-new-view input[name="arrival_at"]');if(arr)refresh(arr);
}
function resetNavScroll(){
 if(document.body.dataset.role!=='pre_receiving')return;
 // Ekran ilk açıldığında eski sayfadan kalan kaydırma konumu taşınmasın.
 window.scrollTo(0,0);
 const root=document.getElementById('ak-pre-receiving');
 if(root&&root.scrollTop>0)root.scrollTop=0;
}
function onNavigation(event){
 if(document.body.dataset.role!=='pre_receiving')return;
 const target=event.target.closest('[data-ake-action],#akpr-menu-report,#akpr-menu-settings,[data-akpr-back]');
 if(!target)return;
 const action=target.dataset.akeAction;
 const navigation=target.closest('.ake3-bottom,.ake3-rail-nav,.ake3-drawer-panel') ||
   target.matches('#akpr-menu-report,#akpr-menu-settings,[data-akpr-back]');
 if(!navigation || ['drawer','close-drawer','toggle-recent','radar'].includes(action))return;
 setTimeout(()=>{ensure();resetNavScroll()},0);
}
function start(){
 document.addEventListener('click',onNavigation,true);
 document.addEventListener('input',e=>{if(e.target.matches('input[type="date"],input[type="datetime-local"]'))refresh(e.target)},true);
 document.addEventListener('reset',e=>{if(e.target.id==='akpr-form')setTimeout(ensure,0)},true);
 document.addEventListener('aktiva:session-changed',()=>setTimeout(ensure,0));
 ensure();
 // Yalnızca DOM'a yeni kök eklenmesini izle; class/attribute gözlemi ve render döngüsü yok.
 const app=document.getElementById('app');
 if(app){const observer=new MutationObserver(records=>{
   if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(
     n.id==='ak-pre-receiving'||n.querySelector?.('#ak-pre-receiving')))))ensure();
 });observer.observe(app,{childList:true,subtree:true});}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
