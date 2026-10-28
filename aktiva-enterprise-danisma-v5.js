/* AKTİVA Danışma Enterprise v5 — hafif görünüm iyileştirme yardımcıları */
(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s);
function apply(){
  if(document.body.dataset.role!=='pre_receiving') return;
  const report=$('#akpr-report-view');
  if(report) report.dataset.ake5='ready';
  const overlay=$('#akpv-overlay');
  if(overlay) overlay.dataset.ake5='ready';
}
function scrollActiveView(){
  if(document.body.dataset.role!=='pre_receiving') return;
  const report=$('#akpr-report-view');
  // V5.6: no scrollIntoView here. Navigation is handled by the core SPA.
  // Programmatic scrolling to the report caused iOS to hide the page header.
}
document.addEventListener('DOMContentLoaded',()=>{apply(); setTimeout(apply,600);});
document.addEventListener('aktiva:session-changed',()=>setTimeout(apply,180));
document.addEventListener('click',e=>{
  const t=e.target.closest('#akpr-open-report,#akpr-menu-report,[data-ake-action="report"],#akpv-launch,[data-ake-action="cars"],#akpv-report-toggle,#akpv-show-history');
  if(!t) return;
  setTimeout(()=>{apply(); if(t.matches('#akpr-open-report,#akpr-menu-report,[data-ake-action="report"]')) scrollActiveView();},120);
});
new MutationObserver(()=>apply()).observe(document.documentElement,{childList:true,subtree:true});
})();
