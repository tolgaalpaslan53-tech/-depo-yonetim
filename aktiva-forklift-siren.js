/* AKTİVA: optional foreground forklift siren. No subscription or server changes. */
(()=>{'use strict';
const audio=new Audio('./aktiva-forklift-siren.wav');audio.preload='auto';
let enabled=false,last=0;
const isFork=()=>document.body?.dataset.role==='fork';
function panel(){
  let btn=document.getElementById('aktivaForkSirenTest');
  if(!isFork()){if(btn)btn.remove();return;}
  if(btn)return;
  btn=document.createElement('button');btn.id='aktivaForkSirenTest';btn.type='button';
  btn.textContent='🚨 Sireni Etkinleştir / Dene';
  btn.style.cssText='position:fixed;bottom:90px;right:12px;z-index:100001;background:#b91c1c;color:white;border:1px solid #fca5a5;border-radius:12px;padding:11px 13px;font:700 13px system-ui;box-shadow:0 5px 20px #0007;max-width:220px';
  btn.addEventListener('click',async()=>{
    try{audio.pause();audio.currentTime=0;await audio.play();enabled=true;btn.textContent='🔊 Siren açık · Tekrar dinle';}
    catch(e){btn.textContent='⚠️ Sesi açıp tekrar dokun';console.warn('AKTİVA siren',e);}
  });document.body.appendChild(btn);
}
navigator.serviceWorker?.addEventListener('message',e=>{
  if(e.data?.type!=='AKTIVA_FORKLIFT_PUSH_SOUND'||!isFork()||document.visibilityState!=='visible')return;
  // Only new forklift task alerts, not generic completion/return messages.
  const msg=(String(e.data.title||'')+' '+String(e.data.body||'')+' '+String(e.data.tag||'')).toLocaleLowerCase('tr-TR');
  if(!/forklift|yeni görev|yeni gorev/.test(msg)||/tamamland|iptal|iade/.test(msg))return;
  if(Date.now()-last<2500)return;last=Date.now();
  if(!enabled)return;
  audio.pause();audio.currentTime=0;audio.play().catch(err=>console.info('Siren requires user interaction',err));
});
document.addEventListener('DOMContentLoaded',()=>{panel();new MutationObserver(panel).observe(document.body,{attributes:true,attributeFilter:['data-role']});});
})();
