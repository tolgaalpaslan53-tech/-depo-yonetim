/* AKTIVA responsive sidebar shell. Presentation only: no Supabase, push or permission mutations. */
(()=>{'use strict';
const css=`
:root{--ak-yellow:#ffce37;--ak-dark:#071526;--ak-panel:#10263b}
html,body{max-width:100%;overflow-x:clip}
body[data-role="count"],body[data-role="fork"]{--ak-rail:82px;background:radial-gradient(ellipse at 88% 80%,#283f50 0%,#0b1b2b 50%,#061326 100%)!important;color:#fff}
body[data-role="count"] header,body[data-role="fork"] header{display:none!important}
body[data-role="count"] #aktivaSyncBadge{display:none!important}
body[data-role="count"] #app,body[data-role="fork"] #app{margin-left:var(--ak-rail)!important;width:calc(100% - var(--ak-rail))!important;max-width:calc(100% - var(--ak-rail))!important;min-width:0!important;padding:0 10px 70px!important;box-sizing:border-box;overflow-x:clip}
body[data-role="count"] .wrap,body[data-role="fork"] .wrap{padding:0!important;max-width:100%!important}
#aktiva-shell-sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--ak-rail);padding:110px 5px 15px;background:linear-gradient(#061426,#071426);border-right:1px solid #34516c;z-index:700;display:flex;flex-direction:column;align-items:center;gap:7px;box-sizing:border-box;overflow-y:auto;overflow-x:hidden}
#aktiva-shell-sidebar .as-logo{display:block;width:68px;height:68px;object-fit:contain;border-radius:13px;margin:0 auto 20px}
#aktiva-shell-sidebar button{width:100%;min-height:65px;padding:7px 2px;border:0;border-radius:13px;background:transparent!important;color:#d1dce9!important;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;font-size:10px;font-weight:700;cursor:pointer;line-height:1.15}
#aktiva-shell-sidebar button.active{background:var(--ak-yellow)!important;color:#101c2a!important}
#aktiva-shell-sidebar button .as-icon{font-size:22px;line-height:1.2}
#aktiva-shell-top{display:flex;align-items:center;gap:6px;margin:22px 0 22px;min-width:0;width:100%;box-sizing:border-box}
#aktiva-shell-person{display:flex;align-items:center;gap:7px;flex:1;min-width:0;border:1px solid #426784;background:#0c2034;border-radius:15px;padding:9px 8px;min-height:52px;box-sizing:border-box}
#aktiva-shell-person .as-person-icon{font-size:22px;flex-shrink:0}
#aktiva-shell-person .as-person-text{min-width:0;overflow:hidden}
#aktiva-shell-person strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
#aktiva-shell-person small{display:block;font-size:9px;color:#aabdd1;white-space:nowrap}
#aktiva-shell-top .as-top-btn{flex:0 0 33px;width:33px;height:42px;padding:0;border:1px solid #456781;border-radius:11px;background:#142d42;color:#fff;font-size:22px;cursor:pointer}
body[data-role="count"] #aktivaCountUI,body[data-role="fork"] #ak-fork-host{min-width:0!important;max-width:100%!important;width:100%!important;box-sizing:border-box}
body[data-role="count"] #aktivaCountUI{padding:0!important;margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
body[data-role="count"] #aktivaCountUI .ak-user{display:none!important}
body[data-role="count"] #aktivaCountUI .ak-modern-heading{margin:4px 0 17px!important}
body[data-role="count"] #aktivaCountUI .ak-modern-heading h2{font-size:clamp(18px,5vw,25px)!important;line-height:1.2}
body[data-role="count"] #aktivaCountUI .ak-modern-heading small{font-size:11px}
body[data-role="count"] #aktivaCountUI .ak-modern-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;margin:0 0 25px!important}
body[data-role="count"] #aktivaCountUI .ak-modern-tile{width:100%!important;min-width:0!important;min-height:160px!important;padding:13px 5px 22px!important;gap:8px!important;border:1px solid #407899!important;border-bottom:6px solid var(--ak-yellow)!important;border-radius:19px!important;background:linear-gradient(150deg,#1a3b54,#0b2034)!important;box-shadow:0 8px 18px #0004!important;color:#fff!important;box-sizing:border-box;overflow-wrap:anywhere}
body[data-role="count"] #aktivaCountUI .ak-modern-tile strong{font-size:clamp(11px,3.3vw,16px)!important;line-height:1.3!important}
body[data-role="count"] #aktivaCountUI .ak-modern-tile small{font-size:10px!important;line-height:1.2}
body[data-role="count"] #aktivaCountUI .ak-modern-ico{font-size:30px!important;line-height:1.2}
body[data-role="count"] #aktivaCountUI .ak-modern-arrow{color:var(--ak-yellow)!important;font-size:29px!important;bottom:0!important}
body[data-role="count"] #aktivaCountUI .ak-modern-section{gap:8px!important}
body[data-role="count"] #aktivaCountUI .ak-modern-wide{background:#10283d!important;border:1px solid #3a6584!important;border-radius:15px!important;color:#fff!important;padding:14px 12px!important;font-size:12px!important}
body[data-role="count"] #aktivaCountUI .ak-modern-wide span{color:var(--ak-yellow)!important}
body[data-role="count"] #aktivaCountUI .ak-modern-section>button{background:#10283d!important}
body[data-role="fork"] #ak-fork-host{background:transparent!important;border:0!important;padding:0!important;margin:0!important;box-shadow:none!important}
body[data-role="fork"] #ak-fork-host .af-head{display:none!important}
body[data-role="fork"] #ak-fork-host .af-home{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;margin:0 0 20px!important}
body[data-role="fork"] #ak-fork-host .af-home .af-nav,body[data-role="fork"] #ak-fork-host button[data-view="positions"]{min-width:0!important;width:100%!important;min-height:160px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:9px!important;padding:12px 5px 21px!important;text-align:center!important;border:1px solid #407899!important;border-bottom:6px solid var(--ak-yellow)!important;border-radius:19px!important;background:linear-gradient(150deg,#1a3b54,#0b2034)!important;color:#fff!important;font-size:clamp(11px,3.2vw,15px)!important;line-height:1.3!important;box-shadow:0 8px 18px #0004!important;box-sizing:border-box;overflow-wrap:anywhere}
body[data-role="fork"] #ak-fork-host .af-home .af-nav .af-ico{font-size:29px!important}
body[data-role="fork"] #ak-fork-host .af-home .af-nav small{display:none!important}
body[data-role="fork"] #ak-fork-host .af-home .af-nav .af-arrow{margin:0!important;font-size:29px!important;color:var(--ak-yellow)!important}
body[data-role="fork"] #ak-fork-host .af-stats{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px!important;margin:14px 0!important}
body[data-role="fork"] #ak-fork-host .af-stat{min-width:0;background:#0c2135!important;border:1px solid #426986!important;border-radius:17px!important;padding:13px 10px!important}
body[data-role="fork"] #ak-fork-host .af-stat strong{font-size:26px!important;color:var(--ak-yellow)!important}
body[data-role="fork"] #ak-fork-host .af-stat small{font-size:11px!important}
body[data-role="fork"] #ak-fork-host input,body[data-role="count"] #aktivaCountUI input{max-width:100%;min-width:0;box-sizing:border-box}
@media(min-width:700px){body[data-role="count"],body[data-role="fork"]{--ak-rail:132px}#aktiva-shell-sidebar .as-logo{width:110px;height:110px}#aktiva-shell-sidebar button{min-height:82px;font-size:13px}#aktiva-shell-sidebar button .as-icon{font-size:27px}body[data-role="count"] #app,body[data-role="fork"] #app{padding:0 22px 80px!important}body[data-role="count"] #aktivaCountUI .ak-modern-grid,body[data-role="fork"] #ak-fork-host .af-home{gap:15px!important}body[data-role="count"] #aktivaCountUI .ak-modern-tile,body[data-role="fork"] #ak-fork-host .af-home .af-nav{min-height:200px!important}#aktiva-shell-person strong{font-size:15px}#aktiva-shell-person small{font-size:12px}}
@media(max-width:360px){body[data-role="count"],body[data-role="fork"]{--ak-rail:68px}#aktiva-shell-sidebar .as-logo{width:54px;height:54px}#aktiva-shell-sidebar button{font-size:9px;min-height:57px}body[data-role="count"] #app,body[data-role="fork"] #app{padding:0 6px 65px!important}#aktiva-shell-person .as-person-icon{display:none}#aktiva-shell-top .as-top-btn{flex-basis:29px;width:29px}body[data-role="count"] #aktivaCountUI .ak-modern-grid,body[data-role="fork"] #ak-fork-host .af-home{gap:6px!important}}

body[data-role="count"] #ak-fork-host:not(.af-count-visible){display:none!important}
body[data-role="fork"] #aktivaCountUI{display:none!important}
body[data-role="count"] #aktivaCountUI .ak-role-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:14px 0}
body[data-role="count"] #aktivaCountUI .ak-role-stats>div{min-width:0;background:#0c2135;border:1px solid #426986;border-radius:16px;padding:13px 10px}
body[data-role="count"] #aktivaCountUI .ak-role-stats small{display:block;color:#b9c8d7;font-size:11px;line-height:1.4}
body[data-role="count"] #aktivaCountUI .ak-role-stats strong{display:block;color:#ffce37;font-size:27px;margin-top:8px}
body[data-role="count"] #aktivaCountUI .ak-recent{border:1px solid #426986;border-radius:16px;background:#0c2135;padding:15px;margin:12px 0 25px}
body[data-role="count"] #aktivaCountUI .ak-recent>strong{display:block;font-size:16px;padding-bottom:12px;border-bottom:1px solid #35506b}
body[data-role="count"] #aktivaCountUI .ak-recent p{display:flex;justify-content:space-between;gap:9px;font-size:13px;align-items:center}
body[data-role="count"] #aktivaCountUI .ak-recent small{font-size:10px;color:#bdcbd9}
body[data-role="fork"] #ak-fork-host .af-home+.af-sub{display:none!important}
#aktiva-shell-sidebar{padding-top:72px!important}
#aktiva-shell-top{position:sticky!important;top:env(safe-area-inset-top,0px)!important;z-index:850!important;background:#081a2b!important;border-radius:14px!important;padding:7px 0!important;margin:4px 0 18px!important;display:flex!important;visibility:visible!important;opacity:1!important}
body[data-role="fork"] #app>#aktiva-shell-top{display:flex!important}
body[data-role="count"] #app>#aktiva-shell-top{display:flex!important}
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
 const sidebar=document.createElement('aside');sidebar.id='aktiva-shell-sidebar';const links=role==='count'?[['home','⌂','Anasayfa']]:[['home','⌂','Anasayfa'],['shipment','▣','Sevkiyat'],['remaining','▥','Paletler'],['positions','⌖','Peron'],['history','▤','Geçmiş']];
 sidebar.innerHTML='<img class="as-logo" src="aktiva-logo.png" alt="AKTİVA">'+links.map(([key,icon,name],i)=>'<button type="button" data-as-page="'+key+'" class="'+(i===0?'active':'')+'"><span class="as-icon">'+icon+'</span>'+name+'</button>').join('');
 sidebar.addEventListener('click',e=>{const b=e.target.closest('[data-as-page]');if(!b)return;sidebar.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));goto(b.dataset.asPage)});document.body.appendChild(sidebar);
 const top=document.createElement('div');top.id='aktiva-shell-top';const person=typeof profile!=='undefined'&&profile?.full_name?profile.full_name:'Personel';top.innerHTML='<div id="aktiva-shell-person"><span class="as-person-icon">♙</span><span class="as-person-text"><strong></strong><small>'+(role==='count'?'Mal Kabul Personeli':'Forklift Personeli')+'</small></span></div><button type="button" class="as-top-btn" id="as-refresh" aria-label="Yenile">⟳</button><button type="button" class="as-top-btn" id="as-logout" aria-label="Çıkış">⇥</button>';top.querySelector('strong').textContent=person;
 top.querySelector('#as-refresh').onclick=()=>{if(!trigger(role==='fork'?'#ak-fork-host [data-af="refresh"]':'#refresh'))trigger('#refresh')};top.querySelector('#as-logout').onclick=()=>{if(!trigger(role==='fork'?'#ak-fork-host [data-af="logout"]':'#ak-logout'))trigger('#logout')};
 document.getElementById('app').insertBefore(top,document.getElementById('app').firstChild);
}
const observer=new MutationObserver(()=>{if(document.body.dataset.role!==lastRole||!document.getElementById('aktiva-shell-top'))paint()});observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-role','class','style']});document.addEventListener('DOMContentLoaded',paint);paint();
})();
