/* AKTİVA - Forkliftçi bildirim izni ve cihaz kaydı */
(() => {
  'use strict';
  const keyName = 'aktiva_vapid_public_key';
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
    localStorage.setItem('aktiva_fork_push_registered',s.user.id);
    return true;
  }
  async function render(){
    const s=current();let panel=document.getElementById('akForkPushPanel');
    if(s.role!=='fork'||!s.user){panel?.remove();return}
    const host=document.querySelector('#ak-fork-host .afv-main') || document.getElementById('ak-fork-host');
    if(!host)return;
    if(!panel){
      panel=document.createElement('section');panel.id='akForkPushPanel';
      panel.style.cssText='max-width:900px;margin:18px auto;padding:14px;border:1px solid #385a76;border-radius:14px;background:#0b2236;color:#fff';
      panel.innerHTML='<button id="akForkPushEnable" type="button" style="background:#ffd135!important;color:#0a1b2b!important;font-weight:800;border-radius:10px">🔔 Telefon Bildirimlerini Aç</button><p id="akForkPushInfo" style="color:#c5d5e4;font-size:12px;margin:9px 0 0"></p>';
      host.append(panel);
      const btn=panel.querySelector('button'),msg=panel.querySelector('p');
      btn.onclick=async()=>{btn.disabled=true;msg.textContent='Cihaz kaydediliyor…';try{await register();msg.textContent='Bildirim izni verildi ve cihaz kaydedildi.';btn.style.display='none'}catch(e){msg.textContent=e.message||String(e)}finally{btn.disabled=false}};
    }
    const btn=panel.querySelector('button'),msg=panel.querySelector('p');
    if(!isSupported()){btn.style.display='none';msg.textContent='Bildirim için HTTPS ve desteklenen tarayıcı gerekir. iPhone: Ana Ekrana Ekle.';return}
    if(Notification.permission==='denied'){btn.style.display='none';msg.textContent='Bildirim izni engellenmiş. Telefonun uygulama ayarlarından açın.';return}
    if(Notification.permission==='granted' && localStorage.getItem('aktiva_fork_push_registered')===s.user.id){btn.style.display='none';msg.textContent='🔔 Telefon bildirimleri bu cihazda etkin.';return}
    btn.style.display='inline-block';
    msg.textContent='İzin vermek için dokunun. iPhone’da uygulamayı Ana Ekrana Ekle ile açın.';
  }
  document.addEventListener('DOMContentLoaded',render);
  setInterval(render,2000);
})();
