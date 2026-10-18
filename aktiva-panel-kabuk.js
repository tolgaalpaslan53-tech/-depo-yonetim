/* AKTIVA responsive sidebar shell. Presentation only: no Supabase, push or permission mutations. */
(()=>{'use strict';
const css=`
body[data-role="count"],body[data-role="fork"]{background:radial-gradient(ellipse at 85% 65%,#213344 0%,#071222 55%,#06101f 100%)!important;color:#f6f8fd}
body[data-role="count"] #app,body[data-role="fork"] #app{margin-left:154px!important;width:calc(100% - 154px)!important;max-width:none!important;padding:18px 15px 90px!important;min-height:100vh;box-sizing:border-box}
#aktiva-shell-sidebar{position:fixed;left:0;top:0;bottom:0;width:154px;background:linear-gradient(180deg,#061327,#07111e);border-right:1px solid #34516a;z-index:700;padding:110px 7px 18px;box-sizing:border-box;display:flex;flex-direction:column;gap:20px}
#aktiva-shell-sidebar .as-logo{width:100%;max-width:132px;border-radius:22px;object-fit:contain;aspect-ratio:1;margin:0 auto 28px}
#aktiva-shell-sidebar button{width:100%;min-height:94px;background:transparent;border:0;border-radius:17px;color:#c9d6e4;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;font-weight:800;font-size:13px;cursor:pointer}
#aktiva-shell-sidebar button.active{background:#ffd13c;color:#17212c}
#aktiva-shell-sidebar button .as-icon{font-size:26px}
#aktiva-shell-top{display:flex;align-items:center;gap:10px;margin:8px 0 25px;min-width:0}
#aktiva-shell-person{flex:1;min-width:0;display:flex;align-items:center;gap:10px;border:1px solid #42647f;border-radius:16px;padding:12px 10px;background:#0b2034;min-height:67px;box-sizing:border-box}
#aktiva-shell-person .as-person-icon{font-size:27px}#aktiva-shell-person strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}#aktiva-shell-person small{display:block;color:#b3c3d4;font-size:11px}
#aktiva-shell-top .as-top-btn{border:1px solid #456580;background:#132e45;border-radius:13px;min-width:45px;height:48px;padding:5px;color:#fff;font-size:23px;cursor:pointer}
body[data-role="count"] #aktivaCountUI .ak-user{display:none!important}
body[data-role="count"] #aktivaCountUI .ak-modern-grid{gap:13px;margin-top:26px}
body[data-role="count"] #aktivaCountUI .ak-modern-tile{min-height:195px;border:1px solid #3e7498;border-bottom:7px solid #ffce32;border-radius:24px;background:linear-gradient(155deg,#193a52,#091d32);box-shadow:0 10px 20px #0005}
body[data-role="count"] #aktivaCountUI .ak-modern-tile strong{font-size:17px}
body[data-role="count"] #aktivaCountUI .ak-modern-ico{font-size:39px}
body[data-role="count"] #aktivaCountUI .ak-modern-arrow{font-size:36px;bottom:5px}
body[data-role="fork"] #ak-fork-host .af-head{display:none!important}
body[data-role="fork"] #ak-fork-host .af-home{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-top:24px}
body[data-role="fork"] #ak-fork-host .af-home .af-nav,body[data-role="fork"] #ak-fork-host button[data-view="positions"]{min-height:185px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;text-align:center;background:linear-gradient(150deg,#193c55,#091e31)!important;border:1px solid #3d7195!important;border-bottom:7px solid #ffce32!important;border-radius:23px!important;color:#fff!important;padding:14px 9px!important;box-shadow:0 8px 20px #0004}
body[data-role="fork"] #ak-fork-host .af-home .af-nav .af-ico{font-size:34px}
body[data-role="fork"] #ak-fork-host .af-home .af-nav small{display:none}
body[data-role="fork"] #ak-fork-host .af-home .af-nav .af-arrow{color:#ffd13c;font-size:30px}
body[data-role="fork"] #ak-fork-host .af-stats{margin:24px 0 14px!important;gap:12px}
body[data-role="fork"] #ak-fork-host .af-stat{background:#0b2033!important;border:1px solid #456e8b!important;border-radius:19px!important;padding:19px!important}
body[data-role="fork"] #ak-fork-host .af-stat strong{color:#ffd13c!important;font-size:29px!important}
@media(max-width:430px){#aktiva-shell-sidebar{width:98px;padding:90px 5px 12px}#aktiva-shell-sidebar .as-logo{max-width:88px;border-radius:15px}#aktiva-shell-sidebar button{min-height:79px;font-size:11px}body[data-role="count"] #app,body[data-role="fork"] #app{margin-left:98px!important;width:calc(100% - 98px)!important;padding:12px 9px 75px!important}#aktiva-shell-person{min-height:58px;padding:8px 5px}#aktiva-shell-person .as-person-icon{display:none}#aktiva-shell-top .as-top-btn{min-width:37px;height:43px;font-size:20px}body[data-role="count"] #aktivaCountUI .ak-modern-tile{min-height:148px;padding:10px 4px 25px}body[data-role="count"] #aktivaCountUI .ak-modern-tile strong{font-size:13px}body[data-role="count"] #aktivaCountUI .ak-modern-ico{font-size:28px}body[data-role="fork"] #ak-fork-host .af-home .af-nav{min-height:145px;font-size:13px}}

/* iPhone / Android: fixed compact rail, no horizontal page overflow */
html,body{max-width:100%;overflow-x:hidden}
body[data-role="count"],body[data-role="fork"]{--as-rail:82px}
body[data-role="count"] #app,body[data-role="fork"] #app{margin-left:var(--as-rail)!important;width:calc(100% - var(--as-rail))!important;max-width:calc(100% - var(--as-rail))!important;min-width:0!important;padding:12px 9px 75px!important;overflow-x:clip;box-sizing:border-box}
#aktiva-shell-sidebar{width:var(--as-rail,82px)!important;padding:80px 5px 12px!important;gap:8px!important;overflow-y:auto;overflow-x:hidden}
#aktiva-shell-sidebar .as-logo{width:66px!important;max-width:100%!important;margin:0 auto 15px!important;border-radius:12px!important}
#aktiva-shell-sidebar button{min-height:66px!important;font-size:10px!important;gap:5px!important;padding:7px 2px!important;overflow-wrap:anywhere}
#aktiva-shell-sidebar button .as-icon{font-size:22px!important}
#aktiva-shell-top{min-width:0!important;max-width:100%;gap:5px!important;margin:4px 0 14px!important}
#aktiva-shell-person{min-width:0!important;padding:7px 5px!important;min-height:48px!important}
#aktiva-shell-person .as-person-icon{display:none!important}
#aktiva-shell-person strong{font-size:11px!important}
#aktiva-shell-person small{font-size:9px!important}
#aktiva-shell-top .as-top-btn{min-width:32px!important;width:32px!important;height:37px!important;font-size:18px!important;padding:2px!important;flex-shrink:0}
body[data-role="count"] #aktivaCountUI,body[data-role="fork"] #ak-fork-host{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box}
body[data-role="count"] #aktivaCountUI .ak-modern-grid,body[data-role="fork"] #ak-fork-host .af-home{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;min-width:0}
body[data-role="count"] #aktivaCountUI .ak-modern-tile,body[data-role="fork"] #ak-fork-host .af-home .af-nav{width:100%!important;min-width:0!important;min-height:140px!important;padding:10px 4px 20px!important;border-radius:15px!important;box-sizing:border-box;overflow-wrap:anywhere}
body[data-role="count"] #aktivaCountUI .ak-modern-tile strong{font-size:clamp(11px,3vw,16px)!important;line-height:1.25!important}
body[data-role="count"] #aktivaCountUI .ak-modern-ico{font-size:27px!important}
body[data-role="count"] #aktivaCountUI .ak-modern-arrow{font-size:25px!important}
body[data-role="fork"] #ak-fork-host .af-home .af-nav{font-size:clamp(11px,3vw,15px)!important}
body[data-role="count"] #aktivaCountUI input,body[data-role="fork"] #ak-fork-host input{max-width:100%;box-sizing:border-box}
@media(min-width:700px){body[data-role="count"],body[data-role="fork"]{--as-rail:132px}#aktiva-shell-sidebar{padding-top:75px!important}#aktiva-shell-sidebar .as-logo{width:100px!important}#aktiva-shell-sidebar button{min-height:80px!important;font-size:13px!important}body[data-role="count"] #app,body[data-role="fork"] #app{padding:18px 18px 90px!important}body[data-role="count"] #aktivaCountUI .ak-modern-grid,body[data-role="fork"] #ak-fork-host .af-home{gap:14px!important}body[data-role="count"] #aktivaCountUI .ak-modern-tile,body[data-role="fork"] #ak-fork-host .af-home .af-nav{min-height:190px!important;padding:16px!important}}
@media(max-width:360px){body[data-role="count"],body[data-role="fork"]{--as-rail:68px}#aktiva-shell-sidebar .as-logo{width:54px!important}#aktiva-shell-sidebar button{font-size:9px!important;min-height:58px!important}body[data-role="count"] #app,body[data-role="fork"] #app{padding:9px 5px 60px!important}#aktiva-shell-top .as-top-btn{min-width:28px!important;width:28px!important}body[data-role="count"] #aktivaCountUI .ak-modern-grid,body[data-role="fork"] #ak-fork-host .af-home{gap:5px!important}}
`;
const style=document.createElement('style');style.id='aktiva-shell-style';style.textContent=css;document.head.appendChild(style);
let lastRole='';
const trigger=(selector)=>{const el=document.querySelector(selector);if(el){el.click();return true}return false};
function goto(page){const role=document.body.dataset.role;if(role==='count'){
 const map={home:'#ak-back',shipment:'#ak-new',barcode:'#ak-barcode-home',catalog:'#ak-catalog-home',invoice:'#ak-asn',list:'#ak-list'};
 if(page==='home'){if(!trigger('#ak-back'))trigger('#ak-back');return}
 if(!trigger(map[page])){trigger('#ak-back');setTimeout(()=>trigger(map[page]),50)}
 }else if(role==='fork'){
 if(page==='home'){trigger('#ak-fork-host [data-af="back"]');return}
 const map={shipment:'shipments',remaining:'remaining',history:'history',positions:'positions'};
 const selector='#ak-fork-host [data-view="'+map[page]+'"]';
 if(!trigger(selector)){trigger('#ak-fork-host [data-af="back"]');setTimeout(()=>trigger(selector),50)}
 }}
function paint(){const role=document.body.dataset.role;if(!['count','fork'].includes(role)){document.getElementById('aktiva-shell-sidebar')?.remove();document.getElementById('aktiva-shell-top')?.remove();lastRole='';return}
 const host=role==='count'?document.querySelector('#aktivaCountUI'):document.querySelector('#ak-fork-host');if(!host||host.classList.contains('hidden')||host.style.display==='none')return;
 if(role===lastRole&&document.getElementById('aktiva-shell-top'))return;lastRole=role;
 document.getElementById('aktiva-shell-sidebar')?.remove();document.getElementById('aktiva-shell-top')?.remove();
 const sidebar=document.createElement('aside');sidebar.id='aktiva-shell-sidebar';const links=role==='count'?[['home','⌂','Anasayfa'],['shipment','▣','Sevkiyat'],['barcode','▥','Barkod'],['catalog','▤','Katalog'],['invoice','▧','İrsaliye']]:[['home','⌂','Anasayfa'],['shipment','▣','Sevkiyat'],['remaining','▥','Paletler'],['positions','⌖','Peron'],['history','▤','Geçmiş']];
 sidebar.innerHTML='<img class="as-logo" src="aktiva-logo.png" alt="AKTİVA">'+links.map(([key,icon,name],i)=>'<button type="button" data-as-page="'+key+'" class="'+(i===0?'active':'')+'"><span class="as-icon">'+icon+'</span>'+name+'</button>').join('');
 sidebar.addEventListener('click',e=>{const b=e.target.closest('[data-as-page]');if(!b)return;sidebar.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));goto(b.dataset.asPage)});document.body.appendChild(sidebar);
 const top=document.createElement('div');top.id='aktiva-shell-top';const person=typeof profile!=='undefined'&&profile?.full_name?profile.full_name:'Personel';top.innerHTML='<div id="aktiva-shell-person"><span class="as-person-icon">♙</span><span><strong></strong><small>'+(role==='count'?'Mal Kabul Personeli':'Forklift Personeli')+'</small></span></div><button type="button" class="as-top-btn" id="as-refresh" aria-label="Yenile">⟳</button><button type="button" class="as-top-btn" id="as-logout" aria-label="Çıkış">⇥</button>';top.querySelector('strong').textContent=person;
 top.querySelector('#as-refresh').onclick=()=>trigger(role==='fork'?'#ak-fork-host [data-af="refresh"]':'#refresh');top.querySelector('#as-logout').onclick=()=>trigger(role==='fork'?'#ak-fork-host [data-af="logout"]':'#ak-logout');
 host.parentNode.insertBefore(top,host);
}
const observer=new MutationObserver(()=>{if(document.body.dataset.role!==lastRole||!document.getElementById('aktiva-shell-top'))paint()});observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-role','class','style']});document.addEventListener('DOMContentLoaded',paint);paint();
})();
