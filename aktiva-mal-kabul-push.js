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
 if(s.role!=='count'||!s.user){panel?.remove();document.getElementById('akRecMenu')?.remove();return}
 const header=document.querySelector('#akd-dashboard .akd-header-actions');
 if(!header){if(panel)panel.style.display='none';return}
 if(panel){const r=header.getBoundingClientRect();panel.style.display='flex';panel.style.top=(r.top+(r.height-38)/2)+'px';panel.style.left=(r.left-44)+'px';return}
 if(panel&&document.getElementById('akRecMenu'))return;
 if(panel){panel.remove();panel=null}
 panel=document.createElement('div');panel.id='akReceivingPushPanel';
 panel.style.cssText='position:fixed;display:flex;align-items:center;z-index:2147483000';
 panel.innerHTML=`<button type="button" id="akRecBell" aria-label="Bildirim ayarları" aria-expanded="false" title="Bildirim ayarları" style="position:relative;width:38px;height:38px;min-width:38px;border-radius:12px;border:1px solid #46546a;background:#182637;color:#f0f5fc;display:grid;place-items:center;cursor:pointer;padding:0"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><i id="akRecDot" style="position:absolute;right:5px;top:5px;width:7px;height:7px;background:#9aa8b8;border:1px solid #182637;border-radius:50%"></i></button><section id="akRecMenu" hidden style="position:fixed;right:12px;top:72px;z-index:2147483000;width:min(292px,calc(100vw - 24px));box-sizing:border-box;background:#142232;color:#f5f7fa;border:1px solid #34465a;border-radius:16px;padding:15px;box-shadow:0 16px 40px #0008;text-align:left"><div style="font-size:15px;font-weight:800;margin-bottom:4px">Bildirim Merkezi</div><div style="font-size:12px;color:#b7c6d6;margin-bottom:13px">Mal Kabul bildirim ayarları</div><div style="display:flex;gap:8px"><button type="button" id="akRecOn" style="flex:1;background:#dceafa;color:#102338;border:0;border-radius:9px;padding:10px 5px;font-size:12px;font-weight:750">🔔 Aç / Yenile</button><button type="button" id="akRecOff" style="flex:1;background:#293a4d;color:#fff;border:1px solid #45566b;border-radius:9px;padding:10px 5px;font-size:12px;font-weight:700">🔕 Kapat</button></div><small id="akRecMsg" aria-live="polite" style="display:block;margin-top:10px;color:#b9c9d9;font-size:11px;line-height:1.5"></small></section>`;
 document.body.appendChild(panel);const hr=header.getBoundingClientRect();panel.style.top=(hr.top+(hr.height-38)/2)+'px';panel.style.left=(hr.left-44)+'px';
 const bell=panel.querySelector('#akRecBell'),menu=panel.querySelector('#akRecMenu'),msg=panel.querySelector('#akRecMsg'),dot=panel.querySelector('#akRecDot');
 document.body.appendChild(menu);menu.style.position='fixed';
 const toggle=(open)=>{menu.hidden=!open;menu.style.setProperty('display',open?'block':'none','important');if(open){const r=bell.getBoundingClientRect();menu.style.top=Math.min(window.innerHeight-40,r.bottom+10)+'px';menu.style.right=Math.max(12,window.innerWidth-r.right)+'px'}bell.setAttribute('aria-expanded',String(open))};toggle(false);
 const paint=(active)=>{dot.style.background=active?'#41ce99':'#9aa8b8';bell.style.background=active?'#123d32':'#182637';bell.style.borderColor=active?'#2fae7b':'#46546a';bell.style.color=active?'#7cf0bd':'#f0f5fc'};
 async function refreshState(){try{if(!supported()||Notification.permission!=='granted'){paint(false);return}const reg=await navigator.serviceWorker.ready;const existing=await reg.pushManager.getSubscription();if(!panel.isConnected)return;paint(!!existing);msg.textContent=existing?'Bildirimler açık · Cihaz aboneliği mevcut':'Bildirim izni var · Abonelik etkin değil'}catch{if(panel.isConnected)paint(false)}}
 bell.onclick=(e)=>{e.stopPropagation();toggle(menu.hidden)};
 document.addEventListener('click',e=>{if(panel.isConnected&&!panel.contains(e.target)&&!menu.contains(e.target))toggle(false)});
 if(!supported())msg.textContent='Bu cihazda bildirim desteği bulunmuyor.';
 else if(Notification.permission==='granted'){msg.textContent='Bildirim durumu kontrol ediliyor…';refreshState()}
 else if(Notification.permission==='denied'){msg.textContent='Bildirim izni tarayıcı ayarlarından kapalı.';dot.style.background='#e58a8a'}
 for(const [id,enable] of [['akRecOn',true],['akRecOff',false]])menu.querySelector('#'+id).onclick=async()=>{
  if(busy)return;busy=true;const buttons=menu.querySelectorAll('#akRecOn,#akRecOff');buttons.forEach(b=>b.disabled=true);
  msg.textContent=enable?'Bildirim izni ve cihaz kaydı kontrol ediliyor…':'Bildirim aboneliği kapatılıyor…';
  try{const result=await sub(enable);if(panel.isConnected){msg.textContent=result;paint(enable);toggle(false)}}
  catch(e){if(panel.isConnected){msg.textContent='⚠️ '+e.message;refreshState()}}
  finally{busy=false;if(panel.isConnected)buttons.forEach(b=>b.disabled=false)}
 };
}
document.addEventListener('DOMContentLoaded',render);document.addEventListener('aktiva:session-changed',render);render();
// Mal Kabul paneli yeniden çizildiğinde yalnızca zil kontrolünü yeniden bağla.
setInterval(()=>{if(current().role==='count')render();else {document.getElementById('akReceivingPushPanel')?.remove();document.getElementById('akRecMenu')?.remove()}},1800);
})();