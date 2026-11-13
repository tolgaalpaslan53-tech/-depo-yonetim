/* Pis 7'li Online — GitHub Pages + Supabase (no build step) */
(() => {
  'use strict';
  const $ = (sel) => document.querySelector(sel);
  const root = $('#app');
  const SUITS = {S:{symbol:'♠',name:'Maça',color:'black'},H:{symbol:'♥',name:'Kupa',color:'red'},D:{symbol:'♦',name:'Karo',color:'red'},C:{symbol:'♣',name:'Sinek',color:'black'}};
  const RANK_ORDER = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const cfg = window.P7_CONFIG || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.SUPABASE_URL || '') &&
      typeof cfg.SUPABASE_KEY === 'string' && cfg.SUPABASE_KEY.length > 35 &&
      !/BURAYA|PROJE|SECRET|SERVICE_ROLE/i.test(cfg.SUPABASE_KEY) && !!window.supabase?.createClient;
  const client = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  }) : null;

  const app = {
    screen:'home', room:null, code:null, token:null, name:localStorage.getItem('p7_name') || '',
    joinCode:new URLSearchParams(location.search).get('oda') || '', busy:false,
    preview:false, rulesOpen:false, suitPicker:false, selected:null,
    connection:'', error:'', sound:localStorage.getItem('p7_sound') !== 'off'
  };
  let channel = null, pollTimer = null, refreshBusy = false, toastTimer = null, lastSnapshot = 0;
  const escapeHTML = (v) => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const suit = s => SUITS[s] || SUITS.S;
  const isMe = (p) => p?.id === app.room?.my_id;
  const myTurn = () => app.room?.status==='playing' && app.room?.turn===app.room?.my_id;
  const isHost = () => app.room?.host_id===app.room?.my_id;
  const getTop = () => app.room?.top_card;
  const rankName = r => ({A:'As',J:'Vale',Q:'Kız',K:'Papaz'})[r] || r;
  const showToast = (msg, error=false) => {
    const el=$('#toast'); if (!el) return;
    el.textContent=msg; el.className=`toast-region show ${error?'error':''}`;
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.className='toast-region',3900);
  };
  const beep = () => {
    if (!app.sound) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      const ctx = new C(), o=ctx.createOscillator(), g=ctx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(620,ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(820,ctx.currentTime+.09);
      g.gain.setValueAtTime(.04,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.13);
      o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.14);
      o.onended=()=>ctx.close();
    }catch(_){}
  };
  const storageFor = (code) => 'p7_room_'+code;
  const randomToken = () => {
    if (crypto?.randomUUID) return crypto.randomUUID();
    const a=new Uint8Array(16); crypto.getRandomValues(a);
    a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
    const h=[...a].map(x=>x.toString(16).padStart(2,'0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  };
  const errorMessage = err => (err?.message || 'İşlem tamamlanamadı.').replace(/^P0001:\s*/,'').replace(/\s*\(SQLSTATE.*$/,'');

  function canPlay(card, r=app.room){
    if (!card || !r || r.status!=='playing') return false;
    if (r.opening_club) return card.s==='C' && !['7','J','A','10'].includes(card.r);
    if (r.my_first_turn && ['7','10','J','A'].includes(card.r)) return false;
    if (r.penalty>0) return card.r==='7';
    if (r.ace_chain) return card.r==='A' || card.s===r.active_suit;
    return card.r==='J' || card.s===r.active_suit || card.r===r.top_card?.r;
  }
  function canDraw(){
    // Kart çekme, kendi sırası boyunca her zaman kullanılabilir.
    return myTurn() && app.room?.status==='playing';
  }
  const findSelected = () => (app.room?.hand||[]).find(c=>c.id===app.selected);
  const cardName = c => c ? `${rankName(c.r)} ${suit(c.s).name}` : '';
  const byName = (id) => app.room?.players?.find(p=>p.id===id)?.name || 'Oyuncu';
  const roundTotal = r => Number(r?.round_total) || 5;
  const roundNo = r => Number(r?.round_no) || 1;
  const score = (r,id) => Number(r?.scores?.[id]) || 0;
  const lastPoints = (r,id) => Number(r?.last_points?.[id]) || 0;
  const standings = r => [...(r?.players||[])].sort((a,b)=>score(r,a.id)-score(r,b.id) || a.name.localeCompare(b.name,'tr'));
  function scoreRows(r,finished=false){
    return standings(r).map((p,i)=>`<div class="score-row ${p.id===r.my_id?'is-mine':''}">
      <span class="score-rank">${i+1}.</span><span class="score-name">${escapeHTML(p.name)}${p.id===r.my_id?' <small>(Sen)</small>':''}</span>
      ${finished?`<span class="score-hand">Bu el <b>+${lastPoints(r,p.id)}</b></span>`:''}
      <strong>${score(r,p.id)} <small>puan</small></strong></div>`).join('');
  }
  function historyHTML(r){
    const h=Array.isArray(r.history)?r.history:[];
    if(!h.length) return '<p class="no-history">Henüz tamamlanan el yok.</p>';
    return `<details class="score-history"><summary>Önceki elleri gör (${h.length})</summary><div class="history-list">${[...h].reverse().map(x=>
      `<div class="history-item"><b>${Number(x.round)}. el</b><span>${escapeHTML(byName(x.winner_id))} kazandı</span><small>${r.players.map(p=>`${escapeHTML(p.name)} +${Number(x.points?.[p.id]||0)}`).join(' · ')}</small></div>`).join('')}</div></details>`;
  }
  function cardHTML(card, options={}){
    const s=suit(card.s), classes=['card-face',s.color==='red'?'card-red':'card-black'];
    if (options.selectable) classes.push('in-hand');
    if (options.selected) classes.push('selected');
    if (options.legal) classes.push('legal');
    if (options.disabled) classes.push('unavailable');
    return `<button type="button" class="${classes.join(' ')}" ${options.selectable?`data-card="${escapeHTML(card.id)}"`:''} ${options.selectable?'':'disabled'} aria-label="${escapeHTML(cardName(card))}" aria-pressed="${options.selected?'true':'false'}">
      <span class="card-corner">${escapeHTML(card.r)}<span>${s.symbol}</span></span>
      <span class="card-center">${s.symbol}</span>
      <span class="card-corner inverse">${escapeHTML(card.r)}<span>${s.symbol}</span></span>
    </button>`;
  }
  function cardBacks(count){
    if (!count) return '<span class="no-cards">Kart yok</span>';
    const visible=Math.min(count,6);
    return `<span class="back-fan" aria-label="${count} kapalı kart">${Array.from({length:visible},(_,i)=>`<span class="card-back" style="--i:${i};--n:${visible}"><span>♠</span></span>`).join('')}</span>`;
  }
  function playerAvatar(name, extra='') {
    const palette=['#ad8151','#406f66','#566a9f','#a45d73','#80629c','#9a814e'];
    const code=Array.from(name||'X').reduce((a,c)=>a+c.charCodeAt(0),0);
    return `<span class="avatar ${extra}" style="--avatar-color:${palette[code%palette.length]}">${escapeHTML((name||'?').slice(0,1).toUpperCase())}</span>`;
  }
  function header(){
    return `<header class="topbar">
      <a href="#" data-action="home" class="brand" aria-label="Pis 7'li Online">
        <span class="brand-icon">♠</span><span class="brand-words">Pis <em>7'li</em><small>ONLINE</small></span>
      </a>
      <div class="topbar-right">
        ${app.room&&!app.preview?`<span class="connected-pill"><i></i>${escapeHTML(app.connection==='SUBSCRIBED'?'CANLI BAĞLANTI':'ONLINE OYUN')}</span>`:''}
        <button class="topbar-button" data-action="sound" title="Sesi aç/kapat">${app.sound?'♫':'♪'}<span class="desktop-only"> Ses ${app.sound?'Açık':'Kapalı'}</span></button>
        <button class="topbar-button" data-action="rules">ⓘ <span class="desktop-only">Kurallar</span></button>
        ${app.room&&!app.preview?`<button class="topbar-button quit" data-action="leave">Çıkış</button>`:''}
        ${app.preview?`<button class="topbar-button" data-action="close-preview">Önizlemeden Çık</button>`:''}
      </div>
    </header>`;
  }
  function decorCards(){return `<div class="hero-cards" aria-hidden="true"><div class="float-card card-one"><b>7</b><span>♥</span></div><div class="float-card card-two"><b>A</b><span>♣</span></div><div class="float-card card-three"><b>J</b><span>♠</span></div></div>`;}
  function home(){
    return `${header()}<main class="home-wrap">
      <section class="welcome-panel">
        <div class="hero-copy"><span class="eyebrow"><i></i> ARKADAŞLARINLA CANLI İSKAMBİL</span>
          <h1>MASA HAZIR.<br/><span>KARTLAR SENİ BEKLİYOR.</span></h1>
          <p>En fazla 4 kişiyle özel oda kur. Oda kodunu paylaş, rakiplerin bağlansın, eğlence başlasın!</p>
          <div class="feature-row"><span>♠ 4 Kişiye Kadar</span><span>⌁ Canlı Oyun</span><span>◇ Ücretsiz</span></div>
        </div>${decorCards()}
      </section>
      <section class="entry-grid">
        <form id="create-form" class="entry-card main-entry">
          <div class="entry-head"><span class="round-icon">✦</span><div><h2>Yeni Oda Oluştur</h2><p>Masayı kur, arkadaşlarını davet et</p></div></div>
          <label for="create-name">Oyuncu adın</label><input id="create-name" name="name" maxlength="20" minlength="2" autocomplete="nickname" placeholder="Örn. Tolga" value="${escapeHTML(app.name)}" required />
          <button class="primary-btn" type="submit" ${app.busy?'disabled':''}>${app.busy?'İşleniyor...':'Odayı Oluştur'} <span>→</span></button>
        </form>
        <form id="join-form" class="entry-card">
          <div class="entry-head"><span class="round-icon alt-icon">♣</span><div><h2>Odaya Katıl</h2><p>Arkadaşının 6 haneli oda kodunu gir</p></div></div>
          <label for="join-name">Oyuncu adın</label><input id="join-name" name="name" maxlength="20" minlength="2" autocomplete="nickname" placeholder="Örn. Mert" value="${escapeHTML(app.name)}" required />
          <label for="join-code">Oda kodu</label><input id="join-code" name="code" maxlength="6" minlength="6" inputmode="numeric" pattern="[0-9]{6}" placeholder="000000" value="${escapeHTML(app.joinCode)}" required />
          <button class="secondary-btn" type="submit" ${app.busy?'disabled':''}>Odaya Gir <span>→</span></button>
        </form>
      </section>
      ${!configured?`<div class="setup-notice"><strong>⚙️ Kurulum gerekli</strong><span>Canlı oyun için <code>supabase.sql</code> dosyasını çalıştırıp <code>config.js</code> içine Supabase URL ve publishable/anon anahtarını ekle. Bu sırada tasarımı önizleyebilirsin.</span></div>`:''}
      <div class="preview-line"><button type="button" class="link-button" data-action="preview">Örnek oyun masasını gör <span>↗</span></button></div>
      <p class="home-footer">Kayıt gerekmez · Sadece oda koduyla giriş · GitHub Pages + Supabase</p>
    </main>`;
  }
  function waiting(){
    const r=app.room, n=r.players.length;
    return `${header()}<main class="waiting-wrap"><div class="waiting-banner"><span class="eyebrow">✦ ÖZEL ODA HAZIR</span><h1>ARKADAŞLARINI DAVET ET</h1><p>En az 2 kişi olunca oda sahibi oyunu başlatabilir.</p>
      <div class="room-code-card"><span>ODA KODU</span><strong>${r.code}</strong><button data-action="copy-code" title="Kodu kopyala">⧉ Kopyala</button></div>
      <button class="share-link" data-action="share-room">↗ Davet bağlantısını paylaş</button>
    </div><div class="waiting-players"><div class="waiting-heading"><h2>Masadaki oyuncular</h2><span>${n} / 4</span></div>
      <div class="waiting-grid">${Array.from({length:4},(_,i)=>{
        const p=r.players[i];
        return `<div class="waiting-slot ${p?'occupied':''}">${p?playerAvatar(p.name):'<span class="empty-avatar">+</span>'}
          <strong>${p?escapeHTML(p.name):'Oyuncu bekleniyor'}</strong><small>${p?(p.id===r.host_id?'♛ Oda Sahibi':'✓ Hazır'):'Boş koltuk'}</small></div>`;
      }).join('')}</div>
      <section class="round-settings" aria-label="Maçın el sayısı">
        <div class="round-settings-title"><span>🏆 MAÇ AYARLARI</span><strong>${roundTotal(r)} EL</strong></div>
        <p>Kaç el oynayacağınızı seçin. Her el sonunda puanlar toplanır; en az puanı alan maçı kazanır.</p>
        ${isHost()?`<div class="round-presets">${[3,5,10,20].map(n=>`<button type="button" data-rounds="${n}" class="round-preset ${roundTotal(r)===n?'active':''}" ${app.busy?'disabled':''}>${n} El</button>`).join('')}</div>
          <div class="round-custom"><label for="custom-rounds">Özel el sayısı</label><input type="number" id="custom-rounds" min="1" max="50" step="1" value="${roundTotal(r)}" inputmode="numeric"/><button type="button" data-action="custom-rounds" ${app.busy?'disabled':''}>Uygula</button></div>
          <small>1–50 el seçilebilir. Oyun başladıktan sonra el sayısı değiştirilemez.</small>`:
          `<div class="rounds-readonly">Oda sahibi ${roundTotal(r)} el olarak ayarladı.</div>`}
      </section>
      ${isHost()?`<button data-action="start" class="primary-btn start-button" ${n<2||app.busy?'disabled':''}>${n<2?'En az 2 oyuncu bekleniyor':`${roundTotal(r)} Ellik Maçı Başlat`} <span>→</span></button>`:
      `<div class="waiting-hint"><span class="small-spinner"></span> Oda sahibi oyunu başlatınca masa açılacak.</div>`}
      <p class="waiting-caption">Her el 7 kartla başlar. İlk kart sinek ♣ olmalıdır. El sayısını oda sahibi belirler.</p>
    </div></main>`;
  }
  function playerSeat(p,position){
    return `<div class="player-seat seat-${position} ${app.room.turn===p.id&&app.room.status==='playing'?'seat-turn':''}">
      <div class="seat-info">${playerAvatar(p.name)}<span class="seat-text"><strong>${escapeHTML(p.name)}</strong><small>${p.count} kart ${app.room.host_id===p.id?'· ♛':''} ${p.count===1?'<em class="last-card-alert">SON KART!</em>':''}</small></span></div>
      ${cardBacks(p.count)}
    </div>`;
  }
  function game(){
    const r=app.room, mine=r.players.find(isMe)||{name:'Sen',count:0};
    const others=r.players.filter(p=>p.id!==r.my_id);
    const places=others.length===1?['top']:others.length===2?['left','right']:['left','top','right'];
    const seats=others.map((p,i)=>playerSeat(p,places[i])).join('');
    const ownTurn=myTurn(), penalty=r.penalty>0;
    const options=(r.hand||[]).map(c=>({...c,legal:canPlay(c)}));
    options.sort((a,b)=>a.s.localeCompare(b.s) || RANK_ORDER.indexOf(a.r)-RANK_ORDER.indexOf(b.r));
    const eligible=options.some(c=>c.legal);
    const selectedCard=findSelected();
    const top=getTop();
    const dynamicSuit=r.active_suit&&r.active_suit!==top?.s;
    const turnText=r.status==='finished'?`${escapeHTML(byName(r.winner_id))} ${roundNo(r)}. eli kazandı!`:
       ownTurn?(r.opening_club?'Açılış: Normal sinek ♣ at! 7, 10, As ve Vale yasak.':r.ace_chain?'As attın! Aynı türü veya başka As oyna.':penalty?`7 cezası: +${r.penalty} kart — 7 at veya çek.`:'Sıra sende, kartını oyna!'):
       `Sıra ${escapeHTML(byName(r.turn))} oyuncusunda`;
    const drawTitle=r.opening_club?'Sinek Bulana Kadar Çek':penalty?`${r.penalty} Kart Çek`:'Kart Çek';
    const roomCard=`<div class="panel-card room-panel"><div class="panel-heading"><h3>Oda: <span>${r.code}</span></h3><button data-action="copy-code" title="Oda kodunu kopyala">⧉</button><span class="count-pill">● ${r.players.length}/4</span></div>
      <div class="compact-players">${r.players.map(p=>`<div class="compact-person"><span class="person-status ${r.turn===p.id&&r.status==='playing'?'active':''}"></span><span>${escapeHTML(p.name)} ${p.id===r.my_id?'(Sen)':''}</span><b>${p.count} <small>kart</small>${p.count===1?'<small class="last-card-alert"> !</small>':''}</b></div>`).join('')}</div>
      <button class="tiny-action" data-action="share-room">Davet bağlantısını paylaş ↗</button></div>`;
    const scorePanel=`<div class="panel-card scoreboard"><div class="score-heading"><div><span>🏆 MAÇ PUANLARI</span><h3>${roundNo(r)} / ${roundTotal(r)}. El</h3></div><span class="score-low">↓ Az puan kazanır</span></div>
      <div class="score-progress"><span style="width:${Math.min(100,Math.round(((r.status==='finished'?roundNo(r):roundNo(r)-1)/roundTotal(r))*100))}%"></span></div>
      <div class="score-rows">${scoreRows(r)}</div>${historyHTML(r)}
      <small class="score-help">Özel kart (7, 10, Vale, As) ile bitirilirse rakiplerin o eldeki ceza puanları 2 katına çıkar.</small></div>`;
    const rulesShort=`<div class="panel-card rules-panel"><h3>♧ Özel Kartlar</h3><div class="rule-line"><b class="rule-icon red">7</b><span>Sonrakine +3 kart; 7'ler birikir.</span></div>
      <div class="rule-line"><b class="rule-icon blue">J</b><span>İstediğin türü seçersin.</span></div>
      <div class="rule-line"><b class="rule-icon purple">A</b><span>Aynı oyuncu aynı türü veya başka As'ı atar.</span></div>
      <div class="rule-line"><b class="rule-icon amber">10</b><span>Oyun yönünü değiştirir.</span></div></div>`;

    return `${header()}<main class="game-main ${app.preview?'is-preview':''}">
      ${app.preview?'<div class="preview-notice">👀 TASARIM ÖNİZLEMESİ — Bu masa çevrimiçi değil. Gerçek oyun için Supabase kurulumu gerekiyor.</div>':''}
      <section class="game-column">
        <div class="game-meta"><div><span class="eyebrow">♠ PİS 7’Lİ · CANLI MASA</span><h1>Oyun Masası <span class="round-pill">${roundNo(r)} / ${roundTotal(r)}. EL</span></h1></div>
          <div class="game-meta-right"><span class="room-small">ODA <b>${r.code}</b></span><span class="dir-tag">${r.direction===1?'↻ Saat yönü':'↺ Ters yön'}</span></div></div>
        <div class="round-progress">EL ${r.round_no||1} / ${r.round_total||5} <span>•</span> ${r.match_complete?'MAÇ TAMAMLANDI':'EN AZ PUAN KAZANIR'}</div>
        <div class="table-shell"><div class="felt-table"><div class="felt-emblem">♠ ♣</div>
          ${seats}
          <div class="middle-area">
            <div class="pile-group"><button ${ownTurn&&!app.preview&&canDraw()?'data-action="draw"':''} class="deck-stack ${ownTurn&&canDraw()?'pile-ready':''}" type="button" title="Kart çek" ${ownTurn&&!app.preview&&canDraw()?'':'disabled'}><span class="back-pattern">♠</span></button><span class="pile-label">ÇEKME DESTESİ <b>${r.deck_count}</b></span></div>
            <div class="played-group">${top?cardHTML(top):''}<span class="pile-label">YERDEKİ KART</span>${dynamicSuit?`<div class="chosen-suit ${suit(r.active_suit).color}">${suit(r.active_suit).symbol} ${suit(r.active_suit).name}</div>`:''}</div>
          </div>
          <div class="turn-indicator ${ownTurn?'my-turn':''}"><span class="spark-dot"></span>${turnText}</div>
          <div class="my-seat-info">${playerAvatar(mine.name)}<span><strong>${escapeHTML(mine.name)} <span>(Sen)</span></strong><small>${r.hand.length} kart</small></span>${ownTurn?'<i>● SIRA SENDE</i>':''}</div>
        </div></div>
        <div class="hand-zone"><div class="hand-heading"><span>ELİNDEKİ KARTLAR <b>${r.hand.length}</b></span><small>${ownTurn?'Bir kart seçerek oyna':'Rakibin hamlesi bekleniyor'}</small></div>
          <div class="my-hand" role="group" aria-label="Elindeki kartlar">${options.map(c=>cardHTML(c,{selectable:!app.preview,selected:app.selected===c.id,legal:ownTurn&&c.legal,disabled:!ownTurn||!c.legal})).join('')||'<div class="empty-hand">Elinde kart kalmadı.</div>'}</div>
          <div class="action-bar">
            <button class="draw-btn" type="button" data-action="draw" ${!ownTurn||!canDraw()||app.busy||app.preview?'disabled':''}>▣ <span>${drawTitle}</span></button>
            <div class="action-hint">${ownTurn?(selectedCard?`Seçilen: <b>${escapeHTML(cardName(selectedCard))}</b>`:r.opening_club?'♣ İlk hamlede özel olmayan sinek zorunlu':r.my_first_turn?'İlk sıranda özel kart oynanamaz':r.ace_chain?'As serisini tamamla':penalty?'7 cezası birikiyor':eligible?'Uygun kartı seç':'Atılacak kart yok, çek'):'Sıranı bekle'}</div>
            ${r.drawn&&ownTurn?`<button class="pass-btn" data-action="pass" ${app.busy||app.preview?'disabled':''}>Pas Geç</button>`:''}
            <button class="play-btn" data-action="play" ${!ownTurn||!selectedCard||!canPlay(selectedCard)||app.busy||app.preview?'disabled':''}>▶ <span>Kartı Oyna</span></button>
          </div>
        </div>
      </section>
      <aside class="side-column">${scorePanel}${roomCard}${rulesShort}<div class="panel-card activity-panel"><h3>◎ Son Hamle</h3><p>${escapeHTML(r.last_action || 'Oyun başlamak üzere.')}</p><span class="activity-foot">Diğer oyuncuların kartları gizlidir.</span></div></aside>
      ${r.status==='finished'?`<div class="winner-overlay"><div class="winner-panel score-finish"><div class="winner-cup">🏆</div>
        <span class="finish-kicker">${r.match_complete?`${roundTotal(r)} ELLİK MAÇ TAMAMLANDI`:`${roundNo(r)}. EL TAMAMLANDI`}</span>
        <h2>${r.match_complete?(()=>{const sorted=standings(r),leaders=sorted.filter(p=>score(r,p.id)===score(r,sorted[0].id));return leaders.length>1?`BERABERE: ${leaders.map(p=>escapeHTML(p.name)).join(' & ')}`:`${escapeHTML(sorted[0].name)} MAÇI KAZANDI!`;})():r.winner_id===r.my_id?'BU ELİ KAZANDIN!':`${escapeHTML(byName(r.winner_id))} ELİ KAZANDI!`}</h2>
        <p>${r.match_complete?'Maç bitti! Toplamda en az ceza puanı alan kazanır.':'El sonu puanları hesaplandı. Oda sahibi sıradaki eli başlatabilir.'}</p>
        <div class="finish-table"><div class="finish-table-title"><span>OYUNCU</span><span>EL / TOPLAM PUAN</span></div>${scoreRows(r,true)}</div>
        ${isHost()&&!app.preview?`<button class="primary-btn" data-action="start">${r.match_complete?'Yeni Maç Başlat ↻':`${roundNo(r)+1}. Ele Geç →`}</button>`:
        `<div class="waiting-hint">${app.preview?'':'Oda sahibinin devam etmesi bekleniyor.'}</div>`}
        <button class="secondary-btn" data-action="${app.preview?'close-preview':'leave'}">${app.preview?'Önizlemeden Çık':'Odadan Ayrıl'}</button></div></div>`:''}
    </main>`;
  }
  function rulesModal(){
    return `<div class="modal-backdrop" data-action="close-modal"><div class="modal-card" role="dialog" aria-modal="true" aria-label="Oyun kuralları"><div class="modal-title"><h2>🃏 Oyun Kuralları</h2><button data-action="close-modal" aria-label="Kapat">✕</button></div>
      <p>2–4 oyuncu; 52 kartlık deste. Her el herkes 7 kartla başlar. Oda sahibi 1–50 el seçebilir.</p>
      <ul><li><b>Açılış:</b> İlk oyuncu özel olmayan sinek ♣ atmak zorundadır (7, 10, As ve Vale yasak). Uygun sinek yoksa uygun sinek gelene kadar çeker. İlk hamleden sonra aynı tür veya aynı değer atılır.</li>
        <li><b>7:</b> Sonraki oyuncuya +3 kart. Üst üste 7 atılırsa ceza +6, +9, +12 olarak birikir. Ceza çekilince sıra geçer.</li>
        <li><b>Vale (J):</b> Oyuncu sinek ♣, karo ♦, kupa ♥ veya maça ♠ seçer.</li>
        <li><b>As (A):</b> As'ı atan kişi yeniden oynar. Son As'ın türünden bir kart veya başka herhangi bir As atabilir. Kart yoksa 1 çeker; uygunsa oynar, değilse sıra geçer.</li>
        <li><b>10:</b> Oyun yönünü tersine çevirir.</li>
        <li><b>Normal tur:</b> Kendi sırasında kart çekme her zaman açıktır. Çekilen kart uygunsa oynanabilir veya pas geçilebilir; uygun değilse sıra geçer.</li>
        <li><b>Elin bitişi:</b> As dışındaki son kartını atan oyuncu eli kazanır. Son kart As ise takip kartını oynama kuralı devam eder.</li>
        <li><b>Puan:</b> Eli bitiren 0 puan alır. Özel kartla bitişte rakiplerin cezası 2 katına çıkar. Diğerlerinin elinde kalan 2–10 değerindeki kartlar üzerindeki sayı kadar (7 hariç), 7 = 20, Vale/Kız/Papaz = 10, As = 15 ceza puanı getirir.</li>
        <li><b>Maç sonucu:</b> Seçilen tüm eller bitince toplam ceza puanı en düşük olan kazanır. Eşitlik varsa beraberlik olur.</li>
      </ul><p class="rules-note">Son kart uyarısı otomatik yapılır. Oda sahibi maç başlamadan önce 3, 5, 10, 20 veya özel el sayısı seçebilir.</p>
      <button class="primary-btn" data-action="close-modal">Anladım</button></div></div>`;
  }
  function suitModal(){
    return `<div class="modal-backdrop"><div class="modal-card suit-card" role="dialog" aria-modal="true" aria-label="Vale türü seç"><div class="modal-title"><h2>Vale — Tür Seç</h2><button data-action="cancel-suit" aria-label="Kapat">✕</button></div>
      <p>Sonraki oyuncu hangi türden kart oynasın?</p><div class="suit-grid">${Object.entries(SUITS).map(([key,v])=>`<button data-suit="${key}" class="pick-suit ${v.color}"><b>${v.symbol}</b><span>${v.name}</span></button>`).join('')}</div>
    </div></div>`;
  }
  function render(){
    let body = app.screen==='home' ? home() : app.screen==='room'&&app.room ?
      (app.room.status==='lobby' ? waiting() : game()) : `${header()}<div class="load-screen"><span class="small-spinner"></span> Odaya bağlanılıyor...</div>`;
    if(app.rulesOpen) body+=rulesModal();
    if(app.suitPicker) body+=suitModal();
    const oldHand=root.querySelector('.my-hand');
    const handLeft=oldHand ? oldHand.scrollLeft : null;
    const handWasAtEnd=oldHand ? oldHand.scrollLeft + oldHand.clientWidth >= oldHand.scrollWidth-3 : false;
    root.innerHTML=body;
    const newHand=root.querySelector('.my-hand');
    if(newHand && handLeft !== null){
      newHand.scrollLeft=handWasAtEnd ? newHand.scrollWidth-newHand.clientWidth : handLeft;
    }
  }

  async function rpc(name,args){
    if(!client) throw new Error('Önce Supabase kurulumunu tamamla (README.md).');
    const {data,error}=await client.rpc(name,args);
    if(error) throw new Error(errorMessage(error));
    return data;
  }
  function updateRoom(data){
    if (!data || !data.code || app.preview) return;
    const updated=Date.parse(data.updated_at||'') || 0;
    if (app.room && data.code===app.room.code && updated < lastSnapshot) return;
    const wasMyTurn=myTurn(), oldStatus=app.room?.status;
    app.room=data; app.screen='room'; lastSnapshot=updated;
    if (!data.hand.some(c=>c.id===app.selected)) app.selected=null;
    if (!wasMyTurn && myTurn() && oldStatus==='playing') beep();
    render();
  }
  async function refresh(){
    if(refreshBusy||app.busy||!app.code||!app.token||app.preview)return;
    refreshBusy=true;
    try{updateRoom(await rpc('p7_get_room',{p_code:app.code,p_token:app.token}));}
    catch(e){if(/bulunamadı|erişim iznin/i.test(e.message)) {cleanupConnection();resetRoom();showToast(e.message,true);}}
    finally{refreshBusy=false;}
  }
  function cleanupConnection(){
    if(channel&&client){client.removeChannel(channel).catch(()=>{});channel=null;}
    if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
    app.connection='';
  }
  function subscribeRoom(){
    if(!client||app.preview||!app.code) return;
    cleanupConnection();
    channel=client.channel(`pis7li:${app.code}`,{config:{broadcast:{self:false}}});
    channel.on('broadcast',{event:'changed'},()=>refresh()).subscribe(status=>{app.connection=status;});
    pollTimer=setInterval(refresh,3500); // WebSocket koparsa otomatik telafi eder.
  }
  async function announce(){
    if(channel){try{await channel.send({type:'broadcast',event:'changed',payload:{changed:true}});}catch(_){}}
  }
  function roomEntered(data,token){
    app.preview=false; app.code=data.code; app.token=token; app.selected=null;
    localStorage.setItem(storageFor(data.code),token);
    localStorage.setItem('p7_last_room',data.code);
    history.replaceState({},'',`${location.pathname}?oda=${encodeURIComponent(data.code)}`);
    updateRoom(data);subscribeRoom();
  }
  function resetRoom(){
    app.screen='home';app.code=null;app.token=null;app.room=null;app.preview=false;
    app.selected=null;app.suitPicker=false;app.rulesOpen=false;app.busy=false;lastSnapshot=0;
    history.replaceState({},'',location.pathname);
    render();
  }
  async function busyTask(fn){
    if(app.busy)return;
    app.busy=true;render();
    try{await fn();}catch(e){showToast(errorMessage(e),true);}finally{app.busy=false;render();}
  }
  async function create(name){
    if(!configured) throw new Error('Canlı oyun için önce Supabase ayarlarını tamamla.');
    const token=randomToken();
    const data=await rpc('p7_create_room',{p_name:name,p_token:token});
    localStorage.setItem('p7_name',name);app.name=name;roomEntered(data,token);showToast('Oda açıldı! Kodu arkadaşlarına gönder.');
  }
  async function join(name,code){
    if(!configured) throw new Error('Canlı oyun için önce Supabase ayarlarını tamamla.');
    const token=localStorage.getItem(storageFor(code))||randomToken();
    const data=await rpc('p7_join_room',{p_code:code,p_name:name,p_token:token});
    localStorage.setItem('p7_name',name);app.name=name;roomEntered(data,token);showToast('Odaya katıldın!');
    await announce();
  }
  async function setRounds(count){
    if(!Number.isInteger(count)||count<1||count>50){showToast('El sayısı 1 ile 50 arasında olmalı.',true);return;}
    await busyTask(async()=>{
      const r=await rpc('p7_set_rounds',{p_code:app.code,p_token:app.token,p_rounds:count});
      updateRoom(r);await announce();showToast(`Maç ${count} el olarak ayarlandı.`);
    });
  }
  async function move(kind,card=null,suitValue=null){
    await busyTask(async()=>{
      const r=await rpc('p7_move',{p_code:app.code,p_token:app.token,p_kind:kind,p_card_id:card,p_suit:suitValue});
      app.selected=null;app.suitPicker=false;updateRoom(r);await announce();
    });
  }
  async function leave(){
    if (app.preview){resetRoom();return;}
    const code=app.code,token=app.token;
    await busyTask(async()=>{
      await rpc('p7_leave_room',{p_code:code,p_token:token});
      localStorage.removeItem(storageFor(code));localStorage.removeItem('p7_last_room');
      await announce();cleanupConnection();resetRoom();
    });
  }
  function preview(){
    cleanupConnection();app.preview=true;app.screen='room';app.selected=null;
    app.room={code:'482931',status:'playing',my_id:'me',host_id:'mert',players:[
      {id:'mert',name:'Mert',count:7},{id:'elif',name:'Elif',count:7},
      {id:'emre',name:'Emre',count:7},{id:'me',name:app.name||'Sen',count:7}],
      hand:[{id:'S_A',r:'A',s:'S'},{id:'H_A',r:'A',s:'H'},{id:'H_7',r:'7',s:'H'},
        {id:'C_10',r:'10',s:'C'},{id:'C_J',r:'J',s:'C'}, {id:'D_8',r:'8',s:'D'}, {id:'S_K',r:'K',s:'S'}],
      top_card:{id:'C_A',r:'A',s:'C'},active_suit:'C',turn:'me',direction:1,
      penalty:0,ace_chain:true,drawn:false,deck_count:23,winner_id:null,round_no:2,round_total:5,scores:{mert:32,elif:18,emre:45,me:11},opening_club:false,match_complete:false,
      last_points:{},history:[{round:1,winner_id:'me',points:{mert:32,elif:18,emre:45,me:0}}],
      last_action:'Sen Sinek As attın. Üzerine sinek veya başka bir As atabilirsin.'};
    render();
  }
  async function copyText(str){
    try{
      if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(str);}
      else{const temp=document.createElement('textarea');temp.value=str;document.body.append(temp);temp.select();document.execCommand('copy');temp.remove();}
      showToast('Kopyalandı!');
    }catch(_){showToast('Kopyalanamadı, kodu elle seçebilirsin.',true);}
  }
  async function share(){
    const link=new URL(location.href);link.searchParams.set('oda',app.room?.code||app.code);
    const url=link.toString();
    if(navigator.share){try{await navigator.share({title:"Pis 7'li Online",text:`Oda kodum: ${app.room.code}. Gel oynayalım!`,url});return;}catch(_){}}
    await copyText(url);
  }
  // Tek noktadan olay yönetimi: ekran yenilense bile dinleyiciler kaybolmaz.
  root.addEventListener('submit',(e)=>{
    if(e.target.id==='create-form'){
      e.preventDefault();const name=e.target.elements.name.value.trim();
      if(name.length<2||name.length>20) {showToast('İsmin 2–20 karakter olmalı.',true);return;}
      busyTask(()=>create(name));
    }
    if(e.target.id==='join-form'){
      e.preventDefault();const name=e.target.elements.name.value.trim(),code=e.target.elements.code.value.trim();
      app.joinCode=code;
      if(!/^\d{6}$/.test(code)){showToast('6 haneli oda kodunu gir.',true);return;}
      if(name.length<2||name.length>20){showToast('İsmin 2–20 karakter olmalı.',true);return;}
      busyTask(()=>join(name,code));
    }
  });
  root.addEventListener('click',(e)=>{
    const roundsButton=e.target.closest('[data-rounds]');
    if(roundsButton){e.preventDefault();if(isHost()&&app.room?.status==='lobby')setRounds(Number(roundsButton.dataset.rounds));return;}
    const suitButton=e.target.closest('[data-suit]');
    if(suitButton){e.preventDefault();const card=findSelected();if(card&&card.r==='J')move('play',card.id,suitButton.dataset.suit);return;}
    const cardButton=e.target.closest('[data-card]');
    if(cardButton){
      if(!myTurn()||app.busy)return;
      const card=app.room.hand.find(c=>c.id===cardButton.dataset.card);
      if(!card||!canPlay(card)){showToast('Bu kart şu anda atılamaz.',true);return;}
      app.selected=app.selected===card.id?null:card.id;render();return;
    }
    const el=e.target.closest('[data-action]');if(!el)return;
    const action=el.dataset.action;
    if(action==='close-modal' && e.target!==el && el.classList.contains('modal-backdrop'))return;
    e.preventDefault();
    if(action==='rules'){app.rulesOpen=true;render();}
    if(action==='close-modal'){app.rulesOpen=false;render();}
    if(action==='cancel-suit'){app.suitPicker=false;render();}
    if(action==='sound'){app.sound=!app.sound;localStorage.setItem('p7_sound',app.sound?'on':'off');render();}
    if(action==='preview'){preview();}
    if(action==='close-preview'){resetRoom();}
    if(action==='home'){
      if(app.room&&!app.preview)showToast('Odadan ayrılmak için Çıkış düğmesini kullan.');
      else resetRoom();
    }
    if(action==='copy-code')copyText(app.room.code);
    if(action==='share-room')share();
    if(action==='start')move('start');
    if(action==='custom-rounds'){
      const n=Number(document.querySelector('#custom-rounds')?.value);
      if(!Number.isInteger(n)||n<1||n>50){showToast('1 ile 50 arasında tam sayı gir.',true);return;}
      if(isHost()&&app.room?.status==='lobby')setRounds(n);
    }
    if(action==='draw')move('draw');
    if(action==='pass')move('pass');
    if(action==='play'){
      const card=findSelected();if(!card)return;
      if(card.r==='J'){app.suitPicker=true;render();}else move('play',card.id);
    }
    if(action==='leave'){
      if(confirm('Odadan ayrılmak istiyor musun?'))leave();
    }
  });
  async function boot(){
    render();
    const candidate=new URLSearchParams(location.search).get('oda') || localStorage.getItem('p7_last_room');
    if(configured&&candidate&&/^\d{6}$/.test(candidate)){
      const token=localStorage.getItem(storageFor(candidate));
      if(token){
        app.screen='loading';render();
        try{const data=await rpc('p7_get_room',{p_code:candidate,p_token:token});roomEntered(data,token);}
        catch(_){localStorage.removeItem(storageFor(candidate));localStorage.removeItem('p7_last_room');resetRoom();app.joinCode=candidate;render();}
      }
    }
  }
  window.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  boot();
})();
