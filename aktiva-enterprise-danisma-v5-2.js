/* AKTİVA Danışma v5.2: yalnızca mobil sekme geçişinde kaydırma düzeltmesi.
   Veri yazma, Supabase, forklift ve bildirim akışlarına müdahale etmez. */
(()=>{'use strict';
  document.addEventListener('click',event=>{
    if(document.body.dataset.role!=='pre_receiving')return;
    const button=event.target.closest('.ake3-bottom button[data-ake-action],.ake3-rail-nav button[data-ake-action],.ake3-drawer-panel button[data-ake-action]');
    if(!button)return;
    const action=button.dataset.akeAction;
    if(!['home','new','records','report','cars','search'].includes(action))return;
    // Mevcut SPA navigasyonu tamamlandıktan sonra yeni ekranın üstünü göster.
    setTimeout(()=>{
      if(document.body.dataset.role!=='pre_receiving')return;
      if(action==='cars'||action==='search'){
        const overlay=document.getElementById('akpv-overlay');
        if(overlay&&!overlay.hidden)overlay.scrollTop=0;
      }else{
        window.scrollTo({top:0,left:0,behavior:'instant'});
      }
    },70);
  },true);
})();
