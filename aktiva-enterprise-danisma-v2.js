/* AKTİVA Danışma v2: yalnızca dekoratif ikonlar ve güvenli kısayol etiketleri. */
(()=>{'use strict';
const icons={home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',new:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8 10h8M8 14h8"/>',car:'<path d="m5 16 1-6 2-4h8l2 4 1 6v3h-3v-2H8v2H5z"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/>',report:'<path d="M4 20V11h4v9M10 20V5h4v15M16 20v-8h4v8"/>',qr:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM21 14v7h-7"/>'};
function svg(name){return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+icons[name]+'</svg>'}
function apply(){const root=document.querySelector('#ak-pre-receiving');if(!root)return;
const bottom=root.querySelector('.ake-bottom');if(bottom&&!bottom.dataset.v2){bottom.dataset.v2='1';bottom.querySelectorAll('button').forEach((b,i)=>{const small=b.querySelector('small');const label=small?.textContent||'';b.innerHTML=svg(['home','new','car','report'][i])+'<small>'+label+'</small>';if(i===0)b.classList.add('ake-active')});bottom.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;bottom.querySelectorAll('button').forEach(x=>x.classList.remove('ake-active'));b.classList.add('ake-active')})}
const rail=root.querySelector('.ake-rail');if(rail&&!rail.dataset.v2){rail.dataset.v2='1';rail.querySelectorAll('.ake-rail-items button').forEach((b,i)=>{const span=b.querySelector('span');if(span)b.innerHTML=svg(['home','new','car','report','qr'][i])+span.outerHTML})}
const quick=root.querySelector('.ake-quick-grid');if(quick&&!quick.dataset.v2){quick.dataset.v2='1';quick.querySelectorAll('button').forEach((b,i)=>{const span=b.querySelector('span');if(span)span.outerHTML=svg(['new','car','report','qr'][i])})}
const summary=root.querySelector('.ake-section-title');if(summary){const title=summary.querySelector('strong');if(title)title.textContent='Günlük Operasyon Özeti'}
}
let pending=false;const observer=new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;apply()})});observer.observe(document.documentElement,{subtree:true,childList:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
