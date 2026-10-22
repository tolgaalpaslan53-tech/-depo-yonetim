/* AKTİVA - Forkliftçi bildirim izni ve cihaz kaydı */
(() => {
  'use strict';
  const keyName = 'aktiva_vapid_public_key';
  let busy = false;
  let panelOpen = false;
  const positionPanel = () => {const bell=document.getElementById('akForkBell'), panel=document.getElementById('akForkPushPanel');if(!panel)return;if(bell){const rect=bell.getBoundingClientRect();panel.style.top=Math.min(window.innerHeight-120,rect.bottom+10)+'px';panel.style.right=Math.max(10,window.innerWidth-rect.right)+'px';}else{panel.style.top='76px';panel.style.right='12px';}};
  document.addEventListener('click',e=>{const bell=e.target.closest?.('#akForkBell');const close=e.target.closest?.('#akForkPushClose');const panel=document.getElementById('akForkPushPanel');if(bell){panelOpen=!panelOpen;positionPanel();if(panel)panel.style.display=panelOpen?'block':'none';bell.setAttribute('aria-expanded',String(panelOpen));if(panelOpen)void render();return;}if(close||(panelOpen&&panel&&!e.target.closest?.('#akForkPushPanel'))){panelOpen=false;if(panel)panel.style.display='none';document.getElementById('akForkBell')?.setAttribute('aria-expanded','false');}});
  let lastChecked = 0;
  let status = null;
  const marker = 'aktiva_fork_push_registered';
  const b64 = v => Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-v.length%4)%4)), c=>c.charCodeAt(0));
  const current = () => {try {return {user:session?.user,role:profile?.role,token:session?.access_token,url:cfg?.url,apikey:cfg?.key};}catch{return {}}};
  const isSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol==='https:';
  const publicKey = () => (window.AKTIVA_VAPID_PUBLIC_KEY || localStorage.getItem(keyName) || '').trim();
  async function register(){
    const s=current();
    if(!s.user || s.role!=='fork' || !s.token)throw Error('Forkliftçi hesabıyla giriş yapın.');
    if(!isSupported())throw Error('Bu tarayıcıda Web Push desteklenmiyor. iPhone için Ana Ekrana Ekle ile açın.');
    const key=publicKey();if(!/^[A-Za-z0-9_-]{87,88}$/.test(key))throw Error('Bildirim sunucusunun VAPID açık anahtarı henüz ayarlanmamış.');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw Error('Bildirim izni verilmedi. Telefon ayarlarından izin vermeniz gerekiyor.');
    await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    const ready=await navigator.serviceWorker.ready;
    let sub=await ready.pushManager.getSubscription();
    if(!sub)sub=await ready.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(key)});
    const res=await fetch(s.url+'/rest/v1/dx_push_subscriptions?on_conflict=user_id,endpoint',{
      method:'POST',headers:{apikey:s.apikey,Authorization:'Bearer '+s.token,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({user_id:s.user.id,subscription:sub.toJSON()})
    });
    if(!res.ok)throw Error('Cihaz kaydedilemedi ('+res.status+'): '+(await res.text()).slice(0,160));
    localStorage.setItem(marker,s.user.id);
    status={userId:s.user.id,active:true};lastChecked=Date.now();
    return true;
  }
  async function checkSubscription(s){
    if(!isSupported() || Notification.permission!=='granted')return false;
    const registration=await navigator.serviceWorker.getRegistration('./');
    const sub=await registration?.pushManager.getSubscription();
    if(!sub)return false;
    // An existing device subscription may be missing on the server. Refresh its
    // server registration, without requesting permission or changing the endpoint.
    const res=await fetch(s.url+'/rest/v1/dx_push_subscriptions?on_conflict=user_id,endpoint',{
      method:'POST',headers:{apikey:s.apikey,Authorization:'Bearer '+s.token,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({user_id:s.user.id,subscription:sub.toJSON()})
    });
    if(!res.ok)throw Error('Cihaz kaydı doğrulanamadı ('+res.status+'): '+(await res.text()).slice(0,130));
    localStorage.setItem(marker,s.user.id);
    return true;
  }
  async function disable(){
    const s=current();
    if(!s.user || s.role!=='fork'||!s.token)throw Error('Forkliftçi hesabıyla giriş yapın.');
    const registration=await navigator.serviceWorker.getRegistration('./');
    const sub=await registration?.pushManager.getSubscription();
    if(sub){
      const url=s.url+'/rest/v1/dx_push_subscriptions?user_id=eq.'+encodeURIComponent(s.user.id)+'&endpoint=eq.'+encodeURIComponent(sub.endpoint);
      const res=await fetch(url,{method:'DELETE',headers:{apikey:s.apikey,Authorization:'Bearer '+s.token,Prefer:'return=minimal'}});
      if(!res.ok)throw Error('Sunucu kaydı silinemedi ('+res.status+'): '+(await res.text()).slice(0,130));
      const ok=await sub.unsubscribe();
      if(!ok)throw Error('Telefon aboneliği kapatılamadı.');
    }
    localStorage.removeItem(marker);
    status={userId:s.user.id,active:false};lastChecked=Date.now();
  }
  async function render(){
    const s=current();let panel=document.getElementById('akForkPushPanel');
    if(s.role!=='fork'||!s.user||!s.token){panelOpen=false;if(panel)panel.style.display='none';status=null;return}
    if(!document.body)return;
    if(!panel){
      panel=document.createElement('section');panel.id='akForkPushPanel';
      panel.style.cssText='display:none;position:fixed;right:12px;top:76px;z-index:100000;width:min(330px,calc(100vw - 24px));max-height:min(70vh,480px);overflow:auto;padding:15px;border:1px solid #52738f;border-radius:16px;background:#0c2236;color:#fff;box-shadow:0 16px 38px #000a';
      panel.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px"><strong style="font-size:15px;color:#f4f8ff">Bildirim Ayarları</strong><button type="button" id="akForkPushClose" aria-label="Kapat" style="background:#253d54!important;color:#fff!important;border:1px solid #52738f!important;border-radius:8px;padding:5px 10px;box-shadow:none!important">✕</button></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button id="akForkPushEnable" type="button" style="background:#ffd135!important;color:#0a1b2b!important;font-weight:800;border-radius:10px">🔔 Bildirimleri Aç / Yenile</button><button id="akForkPushDisable" type="button" style="background:#35475b!important;color:#fff!important;font-weight:750;border-radius:10px">🔕 Bildirimleri Kapat</button></div><p id="akForkPushInfo" style="color:#c5d5e4;font-size:12px;margin:9px 0 0"></p>';
      document.body.append(panel);
      const on=panel.querySelector('#akForkPushEnable'),off=panel.querySelector('#akForkPushDisable'),msg=panel.querySelector('#akForkPushInfo');
      on.onclick=async()=>{if(busy)return;busy=true;on.disabled=off.disabled=true;msg.textContent='Cihaz kaydı yenileniyor…';try{await register();msg.textContent='🟢 Bildirimler açık · Cihaz yeniden kaydedildi'}catch(e){status=null;msg.textContent=e.message||String(e)}finally{busy=false;on.disabled=off.disabled=false;await render()}};
      off.onclick=async()=>{if(busy)return;busy=true;on.disabled=off.disabled=true;msg.textContent='Bildirimler kapatılıyor…';try{await disable();msg.textContent='🔕 Bildirimler bu cihazda kapalı'}catch(e){msg.textContent=e.message||String(e)}finally{busy=false;on.disabled=off.disabled=false;await render()}};
    }
    panel.style.display=panelOpen?'block':'none';if(panelOpen)positionPanel();
    if(busy)return;
    const on=panel.querySelector('#akForkPushEnable'),off=panel.querySelector('#akForkPushDisable'),msg=panel.querySelector('#akForkPushInfo');
    if(!isSupported()){on.style.display=off.style.display='none';msg.textContent='Bu cihazda bildirim desteği yok. iPhone: Ana Ekrana Ekle.';return}
    if(Notification.permission==='denied'){on.style.display=off.style.display='none';msg.textContent='Bildirim izni telefon ayarlarında engellenmiş.';return}
    on.style.display='inline-block';
    off.style.display='none';
    if(Notification.permission!=='granted'){msg.textContent='Bildirim izni vermek için Bildirimleri Aç butonuna basın.';return}
    if(status?.userId===s.user.id && Date.now()-lastChecked<60000){
      if(status.active){off.style.display='inline-block';msg.textContent='🟢 Bildirimler açık · Cihaz kaydı doğrulandı'}
      else msg.textContent='🔕 Bildirimler bu cihazda kapalı';
      return;
    }
    // Do not trust localStorage as proof of a valid server subscription.
    busy=true;msg.textContent='Bildirim aboneliği kontrol ediliyor…';
    try{const active=await checkSubscription(s);status={userId:s.user.id,active};lastChecked=Date.now();
      if(active){off.style.display='inline-block';msg.textContent='🟢 Bildirimler açık · Cihaz kaydı doğrulandı'}
      else msg.textContent='Abonelik bulunamadı. Bildirimleri Aç / Yenile butonuna basın.';
    }catch(e){status=null;lastChecked=Date.now();msg.textContent='⚠️ '+(e.message||String(e))+' · Yenile butonuna basabilirsiniz.'}
    finally{busy=false}
  }
  document.addEventListener('DOMContentLoaded',render);
  setInterval(render,15000);
})();
