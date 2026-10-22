/* AKTIVA: Mal Kabul push aboneligi. Forklift push modulu degistirilmez. */
(()=>{'use strict';
const keyName='aktiva_vapid_public_key';let busy=false;
const current=()=>{try{return {user:session?.user,role:profile?.role,token:session?.access_token,url:cfg?.url,key:cfg?.key}}catch{return {}}};
const supported=()=>('serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window&&location.protocol==='https:');
const b64=v=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-v.length%4)%4)),c=>c.charCodeAt(0));
async function sub(enable){const s=current();if(s.role!=='count'||!s.user||!s.token)throw Error('Mal kabul hesabıyla giriş yapın');if(!supported())throw Error('Bildirim desteklenmiyor; iPhone için uygulamayı Ana Ekrana Ekle ile açın');const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});const ready=await navigator.serviceWorker.ready;const existing=await ready.pushManager.getSubscription();if(enable){const key=(window.AKTIVA_VAPID_PUBLIC_KEY||localStorage.getItem(keyName)||'').trim();if(!/^[A-Za-z0-9_-]{87,88}$/.test(key))throw Error('VAPID açık anahtarı bulunamadı');if(await Notification.requestPermission()!=='granted')throw Error('Bildirim izni verilmedi');const p=existing||await ready.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(key)});const r=await fetch(s.url+'/rest/v1/dx_push_subscriptions?on_conflict=user_id,endpoint',{method:'POST',headers:{apikey:s.key,Authorization:'Bearer '+s.token,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:s.user.id,subscription:p.toJSON()})});if(!r.ok)throw Error('Cihaz kaydedilemedi: '+r.status);return '🟢 Bildirimler açık';}
if(existing){const r=await fetch(s.url+'/rest/v1/dx_push_subscriptions?user_id=eq.'+encodeURIComponent(s.user.id)+'&endpoint=eq.'+encodeURIComponent(existing.endpoint),{method:'DELETE',headers:{apikey:s.key,Authorization:'Bearer '+s.token}});if(!r.ok)throw Error('Cihaz kaydı silinemedi: '+r.status);if(!await existing.unsubscribe())throw Error('Cihaz aboneliği kapatılamadı')}return '🔕 Bildirimler kapalı';}
function render(){
 const s=current();let panel=document.getElementById('akReceivingPushPanel');
 if(s.role!=='count'||!s.user){panel?.remove();return}
 const header=document.querySelector('#akd-dashboard .akd-header-actions');
 if(!header){panel?.remove();return}
 if(panel&&panel.parentElement!==header){panel.remove();panel=null}
 if(panel)return;
 panel=document.createElement('div');panel.id='akReceivingPushPanel';
 panel.style.cssText='position:relative;display:flex;align-items:center;flex:0 0 auto;z-index:50';
 panel.innerHTML=`<button type="button" id="akRecBell" aria-label="Bildirim ayarları" aria-expanded="false" title="Bildirim ayarları" style="position:relative;width:38px;height:38px;min-width:38px;border-radius:12px;border:1px solid #46546a;background:#182637;color:#f0f5fc;display:grid;place-items:center;cursor:pointer;padding:0"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><i id="akRecDot" style="position:absolute;right:5px;top:5px;width:7px;height:7px;background:#9aa8b8;border:1px solid #182637;border-radius:50%"></i></button><section id="akRecMenu" hidden style="position:absolute;right:0;top:calc(100% + 10px);width:min(292px,calc(100vw - 28px));box-sizing:border-box;background:#142232;color:#f5f7fa;border:1px solid #34465a;border-radius:16px;padding:15px;box-shadow:0 16px 40px #0008;text-align:left"><div style="font-size:15px;font-weight:800;margin-bottom:4px">Bildirim Merkezi</div><div style="font-size:12px;color:#b7c6d6;margin-bottom:13px">Mal Kabul bildirim ayarları</div><div style="display:flex;gap:8px"><button type="button" id="akRecOn" style="flex:1;background:#dceafa;color:#102338;border:0;border-radius:9px;padding:10px 5px;font-size:12px;font-weight:750">🔔 Aç / Yenile</button><button type="button" id="akRecOff" style="flex:1;background:#293a4d;color:#fff;border:1px solid #45566b;border-radius:9px;padding:10px 5px;font-size:12px;font-weight:700">🔕 Kapat</button></div><small id="akRecMsg" aria-live="polite" style="display:block;margin-top:10px;color:#b9c9d9;font-size:11px;line-height:1.5"></small></section>`;
 header.insertBefore(panel,header.firstChild);
 const bell=panel.querySelector('#akRecBell'),menu=panel.querySelector('#akRecMenu'),msg=panel.querySelector('#akRecMsg'),dot=panel.querySelector('#akRecDot');
 const toggle=(open)=>{menu.hidden=!open;menu.style.display=open?'block':'none';bell.setAttribute('aria-expanded',String(open))};toggle(false);
 bell.onclick=(e)=>{e.stopPropagation();toggle(menu.hidden)};
 document.addEventListener('click',e=>{if(panel.isConnected&&!panel.contains(e.target))toggle(false)});
 if(!supported())msg.textContent='Bu cihazda bildirim desteği bulunmuyor.';
 else if(Notification.permission==='granted'){msg.textContent='Bildirim izni verilmiş. Cihaz kaydını kontrol etmek için Aç / Yenile seçin.';dot.style.background='#d3a65e'}
 else if(Notification.permission==='denied'){msg.textContent='Bildirim izni tarayıcı ayarlarından kapalı.';dot.style.background='#e58a8a'}
 for(const [id,enable] of [['akRecOn',true],['akRecOff',false]])panel.querySelector('#'+id).onclick=async()=>{
  if(busy)return;busy=true;const buttons=panel.querySelectorAll('#akRecOn,#akRecOff');buttons.forEach(b=>b.disabled=true);
  msg.textContent=enable?'Bildirim izni ve cihaz kaydı kontrol ediliyor…':'Bildirim aboneliği kapatılıyor…';
  try{const result=await sub(enable);if(panel.isConnected){msg.textContent=result;dot.style.background=enable?'#41ce99':'#9aa8b8'}}
  catch(e){if(panel.isConnected){msg.textContent='⚠️ '+e.message;dot.style.background='#e58a8a'}}
  finally{busy=false;if(panel.isConnected)buttons.forEach(b=>b.disabled=false)}
 };
}
document.addEventListener('DOMContentLoaded',render);document.addEventListener('aktiva:session-changed',render);render();
// Mal Kabul paneli yeniden çizildiğinde yalnızca zil kontrolünü yeniden bağla.
setInterval(()=>{if(current().role==='count')render();else document.getElementById('akReceivingPushPanel')?.remove()},1800);
})();