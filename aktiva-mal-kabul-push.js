/* AKTİVA — Mal Kabul bildirimleri / cihaz aboneliği (28.10.2026).
   Yalnızca count rolünün arayüzü ve aboneliği; forkliftçi akışını değiştirmez.
   Bildirim geçmişi uydurulmaz: panel cihaz ayarlarını gösterir. */
(() => {
  'use strict';
  const keyName = 'aktiva_vapid_public_key';
  const $ = id => document.getElementById(id);
  const current = () => {
    try {return {user: session?.user, role: profile?.role, token: session?.access_token, url: cfg?.url, key: cfg?.key};}
    catch {return {};}
  };
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol === 'https:';
  const publicKey = () => (window.AKTIVA_VAPID_PUBLIC_KEY || localStorage.getItem(keyName) || '').trim();
  const b64 = v => Uint8Array.from(atob(v.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - v.length % 4) % 4)), c => c.charCodeAt(0));
  let busy = false, open = false, statusUser = '', checkId = 0;
  let panel = null, menu = null, bell = null;
  let verifyAt = 0;

  // Genel button stilleri kırmızı !important olabildiği için yalnızca bu paneli yalıt.
  function installStyle() {
    if ($('akRecStyles20261028')) return;
    const style = document.createElement('style');
    style.id = 'akRecStyles20261028';
    style.textContent = `
      #akReceivingPushPanel {position:relative;display:flex;align-items:center;flex:0 0 40px;z-index:3}
      #akReceivingPushPanel #akRecBell {position:relative;display:grid!important;place-items:center!important;width:40px!important;min-width:40px!important;height:40px!important;padding:0!important;border-radius:12px!important;border:1px solid #53667a!important;background:#263952!important;background-image:none!important;color:#fff!important;box-shadow:none!important;cursor:pointer!important}
      #akReceivingPushPanel #akRecBell:hover,#akReceivingPushPanel #akRecBell[aria-expanded="true"] {border-color:#92a9c0!important;background:#324863!important}
      #akReceivingPushPanel #akRecBell svg {display:block;width:21px;height:21px;stroke:currentColor}
      #akReceivingPushPanel #akRecDot {position:absolute;right:5px;top:4px;width:8px;height:8px;border-radius:50%;background:#a4b2c3;border:1.5px solid #24374c}
      #akRecMenu {position:fixed!important;z-index:2147483000!important;width:min(354px,calc(100vw - 24px))!important;max-height:min(70dvh,520px)!important;overflow:auto!important;overscroll-behavior:contain;box-sizing:border-box!important;border:1px solid #405873!important;border-radius:18px!important;background:#15263b!important;color:#f6f9fd!important;box-shadow:0 18px 48px #03091488!important;padding:18px!important;text-align:left!important;font-family:system-ui,-apple-system,'Segoe UI',sans-serif!important;line-height:1.4!important;color-scheme:dark}
      #akRecMenu[hidden] {display:none!important}
      #akRecMenu .akrec-head {display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
      #akRecMenu .akrec-overline {display:block;color:#91b8d6!important;font-size:10px!important;letter-spacing:1.6px;font-weight:800;text-transform:uppercase;margin-bottom:3px}
      #akRecMenu h2 {margin:0!important;color:#fff!important;font-size:19px!important;font-weight:800!important;line-height:1.3!important}
      #akRecMenu .akrec-sub {font-size:12px;color:#b2c5d9!important;margin:8px 0 14px!important;line-height:1.6!important}
      #akRecMenu .akrec-close {display:grid!important;place-items:center!important;flex:0 0 32px!important;width:32px!important;height:32px!important;padding:0!important;color:#e1eaf3!important;border:1px solid #48627a!important;border-radius:10px!important;background:#263b53!important;background-image:none!important;box-shadow:none!important;font-size:19px!important;line-height:1!important}
      #akRecMenu .akrec-status {border:1px solid #415873!important;border-radius:12px;padding:12px;background:#20354c!important;margin-bottom:12px}
      #akRecMenu .akrec-status-head {display:flex;align-items:center;gap:9px;color:#f3f8ff;font-size:14px;font-weight:750}
      #akRecMenu .akrec-signal {width:9px;height:9px;flex:0 0 9px;border-radius:50%;background:#e4a844}
      #akRecMenu[data-state="active"] .akrec-signal {background:#35c68d}
      #akRecMenu[data-state="blocked"] .akrec-signal,#akRecMenu[data-state="error"] .akrec-signal {background:#ff8186}
      #akRecMenu .akrec-status-desc {color:#c3d0df;font-size:12px;line-height:1.55;margin:6px 0 0!important}
      #akRecMenu .akrec-actions {display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:9px}
      #akRecMenu button.akrec-primary {background:#dfeaf6!important;background-image:none!important;color:#182e45!important;border:1px solid #dfeaf6!important;border-radius:11px!important;box-shadow:none!important;padding:11px 8px!important;font-size:12px!important;font-weight:800!important;line-height:1.35!important;min-height:46px!important;white-space:normal!important}
      #akRecMenu button.akrec-secondary {background:#2b3f56!important;background-image:none!important;color:#e5edf6!important;border:1px solid #526b83!important;border-radius:11px!important;box-shadow:none!important;padding:11px 8px!important;font-size:12px!important;font-weight:700!important;line-height:1.35!important;min-height:46px!important;white-space:normal!important}
      #akRecMenu button:disabled {opacity:.47!important;cursor:not-allowed!important}
      #akRecMenu #akRecMsg {display:block;min-height:0;margin-top:12px!important;color:#d1dfec!important;font-size:12px!important;line-height:1.55!important;overflow-wrap:anywhere}
      #akRecMenu #akRecMsg:empty {display:none!important}
      #akRecMenu .akrec-foot {border-top:1px solid #364c64;padding-top:12px;margin-top:13px!important;color:#a9bdd1!important;font-size:11px!important;line-height:1.55!important}
      @media(max-width:380px){#akRecMenu{padding:14px!important}#akRecMenu .akrec-actions{grid-template-columns:1fr}}
      @media(prefers-reduced-motion:no-preference){#akRecMenu{animation:akrec-enter .15s ease-out}@keyframes akrec-enter{from{opacity:.3;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}}
    `;
    document.head.appendChild(style);
  }

  function showMessage(text) {const el = $('akRecMsg'); if (el) el.textContent = text || '';}
  function state(type, title, description, message) {
    if (!menu || !bell) return;
    menu.dataset.state = type;
    $('akRecStateTitle').textContent = title;
    $('akRecStateDesc').textContent = description;
    bell.setAttribute('aria-label', 'Mal Kabul bildirimleri: ' + title);
    $('akRecDot').style.background = type === 'active' ? '#35c68d' : (type === 'blocked' || type === 'error') ? '#ff8186' : '#e4a844';
    const on = $('akRecOn'), off = $('akRecOff');
    on.textContent = type === 'active' ? '↻ Kaydı Yenile' : 'Bildirimleri Aç';
    on.hidden = type === 'blocked';
    on.style.display = type === 'blocked' ? 'none' : '';
    off.hidden = type !== 'active';
    off.style.display = type === 'active' ? '' : 'none';
    if (message !== undefined) showMessage(message);
  }
  function setBusy(value) {
    busy = value;
    for (const id of ['akRecOn', 'akRecOff', 'akRecClose']) {const btn = $(id); if (btn) btn.disabled = value || (id === 'akRecOn' && menu?.dataset.state === 'blocked');}
  }
  function position() {
    if (!open || !panel?.isConnected || !menu) return;
    const r = bell.getBoundingClientRect();
    const menuWidth = Math.min(354, window.innerWidth - 24);
    const right = Math.min(Math.max(12, window.innerWidth - r.right), Math.max(12, window.innerWidth - menuWidth - 12));
    menu.style.right = right + 'px';
    // Açılır panel ekranın dışına taşmasın; iOS güvenli alanını da koru.
    const height = Math.min(520, window.innerHeight * .7);
    menu.style.top = Math.max(10, Math.min(r.bottom + 10, window.innerHeight - height - 10)) + 'px';
  }
  function toggle(value) {
    if (!menu || !bell) return;
    open = Boolean(value);
    menu.hidden = !open;
    bell.setAttribute('aria-expanded', String(open));
    if (open) {position(); void checkStatus(true);}
  }
  function cleanup() {
    ++checkId;
    open = false; statusUser = ''; verifyAt = 0;
    if (panel) panel.remove();
    if (menu) menu.remove();
    panel = menu = bell = null;
  }
  async function registerOnServer(s, subscription) {
    const response = await fetch(s.url + '/rest/v1/dx_push_subscriptions?on_conflict=user_id,endpoint', {
      method: 'POST', headers: {apikey: s.key, Authorization: 'Bearer ' + s.token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal'},
      body: JSON.stringify({user_id: s.user.id, subscription: subscription.toJSON()})
    });
    if (!response.ok) throw Error('Sunucu cihaz kaydını doğrulayamadı (' + response.status + '). Oturumu ve internet bağlantısını kontrol edin.');
  }
  async function checkStatus(force = false) {
    const s = current(), serial = ++checkId;
    if (!panel?.isConnected || s.role !== 'count' || !s.user || !s.token) return;
    if (!supported()) {state('blocked', 'Bu cihaz desteklemiyor', 'iPhone’da bildirim için AKTİVA’yı Ana Ekrana Ekle ile açın.');return;}
    if (Notification.permission === 'denied') {state('blocked', 'Bildirim izni engelli', 'Telefon veya uygulama ayarlarından bildirim iznini açmanız gerekiyor.');return;}
    if (Notification.permission !== 'granted') {state('off', 'Bildirim izni gerekli', 'Bu cihazda bildirim almak için aşağıdaki düğmeden izin verin.');return;}
    if (!force && statusUser === s.user.id && Date.now() - verifyAt < 60000) return;
    state('checking', 'Cihaz kontrol ediliyor', 'Bildirim aboneliği ve sunucu kaydı denetleniyor…');
    try {
      // getRegistration: daha önce hiç açılmamış cihazda ready bekleyip kilitlenmeyi önler.
      const registration = await navigator.serviceWorker.getRegistration('./');
      const subscription = await registration?.pushManager.getSubscription();
      if (serial !== checkId || !panel?.isConnected || current().user?.id !== s.user.id) return;
      if (!subscription) {
        statusUser = s.user.id; verifyAt = Date.now();
        state('off', 'Cihaz aboneliği kapalı', 'Bildirim izni var, ancak bu cihaz henüz bildirime kayıtlı değil.');
        return;
      }
      // Salt yerel abonelik aktiflik kanıtı değildir: cihazı sunucuya tekrar doğrula.
      await registerOnServer(s, subscription);
      if (serial !== checkId || !panel?.isConnected || current().user?.id !== s.user.id) return;
      statusUser = s.user.id; verifyAt = Date.now();
      state('active', 'Bildirimler aktif', 'Bu cihazın Mal Kabul aboneliği sunucuda doğrulandı.');
    } catch (error) {
      if (serial !== checkId || !panel?.isConnected) return;
      verifyAt = 0;
      state('error', 'Kayıt doğrulanamadı', 'Telefon izni açık; sunucu aboneliği kontrol edilemedi.', error?.message || 'İnternet bağlantısını kontrol edin.');
    }
  }
  async function enable() {
    const s = current();
    if (s.role !== 'count' || !s.user || !s.token || !s.url || !s.key) throw Error('Mal Kabul oturumu veya Supabase bağlantısı bulunamadı.');
    if (!supported()) throw Error('Bu cihazda Web Push desteklenmiyor. iPhone için Ana Ekrana Ekle ile açın.');
    const key = publicKey();
    if (!/^[A-Za-z0-9_-]{87,88}$/.test(key)) throw Error('Bildirim sisteminin VAPID açık anahtarı eksik.');
    // iOS: izin talebi kullanıcı dokunuşuna doğrudan bağlı olmalı (önce async SW bekleme yok).
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw Error('Bildirim izni verilmedi. Telefon ayarlarından izin verebilirsiniz.');
    }
    if (current().user?.id !== s.user.id || current().role !== 'count') throw Error('Oturum değişti; yeniden giriş yapın.');
    await navigator.serviceWorker.register('./sw.js', {scope:'./'});
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) subscription = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64(key)});
    await registerOnServer(s, subscription);
    if (current().user?.id !== s.user.id || current().role !== 'count') return;
    statusUser = s.user.id; verifyAt = Date.now();
    state('active', 'Bildirimler aktif', 'Bu cihazın Mal Kabul aboneliği sunucuda doğrulandı.', 'Cihaz kaydı güncellendi. Yeni bildirimler bu cihaza gönderilebilir.');
  }
  async function disable() {
    const s = current();
    if (s.role !== 'count' || !s.user || !s.token || !s.url || !s.key) throw Error('Mal Kabul oturumu veya Supabase bağlantısı bulunamadı.');
    const reg = await navigator.serviceWorker.getRegistration('./');
    const subscription = await reg?.pushManager.getSubscription();
    if (subscription) {
      const url = s.url + '/rest/v1/dx_push_subscriptions?user_id=eq.' + encodeURIComponent(s.user.id) + '&endpoint=eq.' + encodeURIComponent(subscription.endpoint);
      const response = await fetch(url, {method:'DELETE',headers:{apikey:s.key, Authorization:'Bearer ' + s.token, Prefer:'return=minimal'}});
      if (!response.ok) throw Error('Sunucudaki cihaz kaydı silinemedi (' + response.status + ').');
      if (!await subscription.unsubscribe()) throw Error('Telefon aboneliği kapatılamadı. Tekrar deneyin.');
    }
    statusUser = s.user.id;verifyAt = Date.now();
    state('off', 'Cihaz aboneliği kapalı', 'Mal Kabul bildirimleri bu cihazda kapalı.', 'Bildirimleri yeniden açmak için üstteki düğmeyi kullanın.');
  }
  async function onAction(enableAction) {
    if (busy) return;
    setBusy(true);
    showMessage(enableAction ? 'Bildirim izni ve cihaz kaydı kontrol ediliyor…' : 'Bu cihazın bildirim aboneliği kapatılıyor…');
    try {if (enableAction) await enable(); else await disable();}
    catch (error) {
      state('error', 'İşlem tamamlanamadı', 'Bildirim durumu tekrar kontrol edilmeli.', error?.message || 'Bilinmeyen hata.');
      verifyAt = 0;
    }
    finally {setBusy(false);}
  }
  function mount() {
    const s = current();
    const header = document.querySelector('#akd-dashboard .akd-header-actions');
    if (s.role !== 'count' || !s.user || !s.token || !header) {
      if (s.role !== 'count' || !s.user || !s.token) cleanup();
      else if (panel) {panel.style.display = 'none';toggle(false);}
      return;
    }
    installStyle();
    if (panel?.isConnected && menu?.isConnected) {
      if (panel.parentElement !== header) header.insertBefore(panel, header.firstChild);
      panel.style.display = 'flex';
      if (statusUser && statusUser !== s.user.id) {statusUser = '';verifyAt = 0;toggle(false);void checkStatus(true);}
      return;
    }
    cleanup();
    installStyle();
    panel = document.createElement('div');panel.id = 'akReceivingPushPanel';
    panel.innerHTML = `<button type="button" id="akRecBell" aria-label="Mal Kabul bildirim ayarları" aria-expanded="false" aria-controls="akRecMenu" title="Mal Kabul bildirimleri"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><i id="akRecDot" aria-hidden="true"></i></button>`;
    menu = document.createElement('section');menu.id = 'akRecMenu';menu.hidden = true;menu.dataset.state = 'checking';menu.setAttribute('aria-label','Mal Kabul bildirim ayarları');
    menu.innerHTML = `<div class="akrec-head"><div><span class="akrec-overline">AKTİVA · MAL KABUL</span><h2>Bildirim Ayarları</h2></div><button class="akrec-close" type="button" id="akRecClose" aria-label="Bildirim panelini kapat">×</button></div><p class="akrec-sub">Forkliftçi palet iade yüklemesini tamamladığında seçilen Mal Kabul personeline gönderilen cihaz bildirimlerini yönetin.</p><div class="akrec-status" role="status"><div class="akrec-status-head"><i class="akrec-signal" aria-hidden="true"></i><span id="akRecStateTitle">Cihaz kontrol ediliyor</span></div><p class="akrec-status-desc" id="akRecStateDesc">Bildirim durumunuz denetleniyor…</p></div><div class="akrec-actions"><button type="button" class="akrec-primary" id="akRecOn">Bildirimleri Aç</button><button type="button" class="akrec-secondary" id="akRecOff" hidden>Cihazda Kapat</button></div><div id="akRecMsg" role="status" aria-live="polite"></div><p class="akrec-foot">Bildirim izni telefon ayarıdır. Bu panel yalnızca bu cihazın Mal Kabul aboneliğini yönetir; geçmiş bildirim listesi değildir.</p>`;
    header.insertBefore(panel,header.firstChild);
    document.body.appendChild(menu);
    bell = $('akRecBell');
    bell.addEventListener('click', event => {event.preventDefault();event.stopPropagation();toggle(!open);});
    $('akRecClose').addEventListener('click', () => toggle(false));
    $('akRecOn').addEventListener('click', () => void onAction(true));
    $('akRecOff').addEventListener('click', () => void onAction(false));
    statusUser = '';verifyAt = 0;
    void checkStatus(true);
  }
  document.addEventListener('click', event => {
    if (open && menu && panel && !menu.contains(event.target) && !panel.contains(event.target)) toggle(false);
  });
  document.addEventListener('keydown', event => {if (event.key === 'Escape' && open) toggle(false);});
  window.addEventListener('resize',position);
  document.addEventListener('aktiva:session-changed',mount);
  document.addEventListener('DOMContentLoaded',mount);
  mount();
  // Mal Kabul dashboard'u gerektiğinde yeniden oluşturulur. Diğer rolleri etkilemez.
  setInterval(mount,1800);
})();
