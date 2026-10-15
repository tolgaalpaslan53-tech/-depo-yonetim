/* DepoX - Supabase dx_push_subscriptions uyumlu cihaz kaydı */
(() => {
  'use strict';
  const key = (window.DEPOX_VAPID_PUBLIC_KEY || '').trim();
  const base64ToUint8Array = (base64) => {
    const padded = base64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - base64.length % 4) % 4);
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  };
  const current = () => {
    try { return { user: session?.user, role: profile?.role, token: session?.access_token, url: cfg?.url, apikey: cfg?.key }; }
    catch { return {}; }
  };
  async function register() {
    const s = current();
    if (!s.user || !s.token || !s.url || !s.apikey) throw Error('Önce DepoX hesabınıza giriş yapın.');
    if (!key || key.includes('BURAYA')) throw Error('VAPID açık anahtarı henüz ayarlanmadı.');
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw Error('Bu cihaz Web Push desteklemiyor.');
    if (location.protocol !== 'https:') throw Error('Bildirim için HTTPS gerekir.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw Error('Bildirim izni verilmedi.');
    const sw = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    const ready = await navigator.serviceWorker.ready;
    let sub = await ready.pushManager.getSubscription();
    if (!sub) sub = await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(key) });
    const data = { user_id: s.user.id, subscription: sub.toJSON() };
    const response = await fetch(`${s.url}/rest/v1/dx_push_subscriptions?on_conflict=user_id,endpoint`, {
      method: 'POST',
      headers: { 'apikey': s.apikey, 'Authorization': `Bearer ${s.token}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw Error(`Cihaz kaydedilemedi (${response.status}): ${(await response.text()).slice(0, 250)}`);
    return true;
  }
  function render() {
    const s = current();
    let panel = document.getElementById('dxPushSetup');
    if (!s.user || !s.role || s.role === 'admin') { if (panel) panel.remove(); return; }
    if (panel) return;
    const parent = document.getElementById('app');
    if (!parent) return;
    panel = document.createElement('div');
    panel.id = 'dxPushSetup'; panel.className = 'card';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'alt';
    btn.textContent = '🔔 Telefon bildirimlerini aç';
    const msg = document.createElement('p'); msg.className = 'small';
    msg.textContent = 'iPhone: Safari > Paylaş > Ana Ekrana Ekle. Bildirim iznini bu butonla verin.';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await register(); msg.textContent = 'Bu cihaz bildirim almak için kaydedildi.'; }
      catch (e) { msg.textContent = e.message || String(e); }
      finally { btn.disabled = false; }
    });
    panel.append(btn, msg); parent.append(panel);
  }
  document.addEventListener('DOMContentLoaded', render);
  setInterval(render, 2000);
})();
