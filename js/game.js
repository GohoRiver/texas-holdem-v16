(function(){
'use strict';

const G = {
  players: [], deck: [], community: [], pot: 0, currentBet: 0,
  lastRaiseAmount: 20, stage: 'preflop', dealerIndex: 0, currentPlayerIndex: 0,
  smallBlind: 1, bigBlind: 2, tableMode: 'nano', tableLabel: 'Nano',
  gameMode: 'ai',
  handNumber: 0, totalPlayers: 6, aiSeats: 6,
  gameOver: false, busy: false, soundOn: true,
  playerHandStartChips: 0, sessionBuyIn: 0, sessionHands: 0,
  raiseMin: 0, raiseMax: 0, seatPositions: [],
  _renderedCards: new WeakSet(), turnTimer: null, turnTimeLeft: 30,
  online: { active:false, isHost:false, roomId:'', mySeat:0, started:false, broadcastTimer:null },
  _lastStateSig:'', _lastActionSig:'', _lastBoardSig:'', _lastHandSig:'',
  _timerKey:null, _hostTimeout:null, _nextHandTimer:null,
  _nextHandEndsAt:0, _turnEndsAt:0, _nextHandToastTimer:null,
  _turnTickTimer:null, _lastTickSecond:0, _currentHandMyCards:[],
  _busySince: 0,
  _aiActionTimer: null,
  _busyWatchdogTimer: null,
  isMobile: false, orientation: 'landscape',
  _showCardsTimer: null,
  _showCardsEndsAt: 0,
  _chatMessages: [],
  _chatOpen: false,
  _rebuyMultiplier: 0,
  _onlineLv: null
};

const STAGE_KEYS = {
  preflop:"stagePreflop", flop:"stageFlop", turn:"stageTurn",
  river:"stageRiver", showdown:"stageShowdown"
};

const LEVELS = [
  { key:"nano",  name:"Nano",  sb:1,     bb:2,     buyMin:100,    buyMax:500 },
  { key:"micro", name:"Micro", sb:100,   bb:200,   buyMin:4000,   buyMax:20000 },
  { key:"low",   name:"Low",   sb:500,   bb:1000,  buyMin:20000,  buyMax:100000 },
  { key:"mid",   name:"Mid",   sb:2500,  bb:5000,  buyMin:100000, buyMax:500000 },
  { key:"high",  name:"High",  sb:10000, bb:20000, buyMin:400000, buyMax:2000000 }
];

const ONLINE_MAX_SEATS = 7;
const ONLINE_MIN_SEATS = 2;
const CHIP_TO_BEM = 0.0001;
const NEXT_HAND_DELAY = 8;
const BUSY_TIMEOUT = 8000;
const AI_ACTION_TIMEOUT = 5000;
const PLAYER_ACTION_TIMEOUT = 30000;
const SHOW_CARDS_WINDOW = 8000;
const BUSY_WATCHDOG_INTERVAL = 1500;
const MIN_DEPOSIT_BEM = 0.001;
const MIN_WITHDRAW_BEM = 0.0001;

const CHIP_DENOMS = [5000, 1000, 500, 100, 25, 5, 1];

/* ================= 设备 & 方向 ================= */
function detectDevice(){
  const ua = navigator.userAgent || '';
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 900;
  const isMobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return (isMobileUA && isSmall) || (isTouch && isSmall);
}
function detectOrientation(){
  if(!G.isMobile) return 'landscape';
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}
function applyDeviceClass(){
  const mobile = detectDevice();
  G.isMobile = mobile;
  document.body.classList.toggle('is-mobile', mobile);
  document.body.classList.toggle('is-desktop', !mobile);
  const ori = detectOrientation();
  const changed = (G.orientation !== ori);
  G.orientation = ori;
  document.body.classList.toggle('orientation-portrait',  ori === 'portrait');
  document.body.classList.toggle('orientation-landscape', ori === 'landscape');
  const hint = document.getElementById('portraitHint');
  if(hint){
    if(mobile && ori === 'portrait') hint.classList.remove('hidden');
    else hint.classList.add('hidden');
  }
  if(changed && G.players.length){
    G.seatPositions = computeSeatPositions(G.players.length);
    render();
  }
}

/* ================= 牌对象缓存 ================= */
const _cardCache = new Map();
function normalizeCard(c){
  if(!c || !c.rank || !c.suit) return c;
  const key = c.suit + c.rank;
  let card = _cardCache.get(key);
  if(card) return card;
  card = { rank:c.rank, suit:c.suit, value:c.value, display:c.display || (c.rank+' '+c.suit), red:!!c.red };
  _cardCache.set(key, card);
  return card;
}
function normalizeCards(arr){ return arr && arr.length ? arr.map(normalizeCard) : []; }

/* ================= 状态指纹 ================= */
function cardKey(c){ return c ? String(c.suit||'')+String(c.rank||'') : ''; }
function cardsSig(arr){ return arr && arr.length ? arr.map(cardKey).join(',') : ''; }
function buildStateSig(state){
  if(!state) return '';
  const players = (state.players || []).map(function(p){
    return [p.peerId || p.id, p.chips, p.folded?1:0, p.allIn?1:0,
      p.seated === false ? 0 : 1, p.currentBet||0, p.lastAction||'',
      p.position||'', p.revealCards?1:0, cardsSig(p.holeCards)].join(':');
  }).join('|');
  return [state.handNumber, state.stage, state.currentPlayerIndex,
    state.pot, state.currentBet, state.dealerIndex, state.gameOver?1:0,
    state.phase||'', state.nextHandEndsAt||0, cardsSig(state.community), players].join('/');
}
function buildActionSig(){
  const me = G.players[myIndex()];
  if(!me) return '';
  const toCall = Math.max(0, G.currentBet - (me.currentBet || 0));
  return [G.handNumber, G.stage, G.currentPlayerIndex, myIndex(),
    me.folded?1:0, me.allIn?1:0, me.chips, toCall, G.currentBet].join(':');
}

/* ================= 工具 ================= */
function $(id){ return document.getElementById(id); }
function t(k,v){ return window.PokerI18n.t(k,v); }
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function fmtNum(n){ return (Math.floor(n)||0).toLocaleString('en-US'); }
function toBem(chips){ return (chips * CHIP_TO_BEM).toFixed(4); }
function isEn(){ return PokerI18n.getLang() === 'en'; }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

/* ★ Toast 提示（替代 alert，手机/电脑通用） */
function appToast(msg, type){
  let el = document.getElementById('appToast');
  if(!el){
    el = document.createElement('div');
    el.id = 'appToast';
    el.className = 'app-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'app-toast show' + (type ? ' ' + type : '');
  clearTimeout(el._timer);
  el._timer = setTimeout(function(){
    el.classList.remove('show');
  }, 2600);
}

/* ================= 筹码面额拆分 ================= */
function amountToChips(amount, denoms){
  denoms = denoms || CHIP_DENOMS;
  const result = [];
  let remain = Math.floor(amount || 0);
  for(let i = 0; i < denoms.length; i++){
    const d = denoms[i];
    const count = Math.floor(remain / d);
    if(count > 0){
      result.push({ value: d, count: count });
      remain -= count * d;
    }
  }
  return result;
}
function buildVisualStacks(chipGroups, maxPerColumn, maxColumns){
  maxPerColumn = maxPerColumn || 8;
  maxColumns = maxColumns || 4;
  const columns = [];
  for(let i = 0; i < chipGroups.length && columns.length < maxColumns; i++){
    const g = chipGroups[i];
    let left = g.count;
    while(left > 0 && columns.length < maxColumns){
      const n = Math.min(left, maxPerColumn);
      columns.push({ value: g.value, count: n });
      left -= n;
    }
  }
  return columns;
}
function chipLabel(v){
  if(v >= 1000000) return (v/1000000) + 'M';
  if(v >= 1000) return (v/1000) + 'k';
  return String(v);
}
function renderChipStackHtml(amount, opts){
  opts = opts || {};
  const maxPerColumn = opts.maxPerColumn || 8;
  const maxColumns = opts.maxColumns || 4;
  const wrapClass = opts.wrapClass || 'chip-stack-wrap';
  const showLabels = opts.showLabels !== false;
  const groups = amountToChips(amount);
  if(!groups.length) return '<div class="' + wrapClass + ' empty"></div>';
  const cols = buildVisualStacks(groups, maxPerColumn, maxColumns);
  let html = '<div class="' + wrapClass + '">';
  for(let i = 0; i < cols.length; i++){
    const col = cols[i];
    html += '<div class="chip-column">';
    for(let j = 0; j < col.count; j++){
      html += '<div class="chip-piece chip-' + col.value + '"></div>';
    }
    if(showLabels) html += '<div class="chip-label">' + chipLabel(col.value) + '</div>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function playActionSound(action){
  if(!window.PokerAudio || !action) return;
  if(action.type === 'fold'){ PokerAudio.play('fold'); return; }
  if(action.type === 'check'){ PokerAudio.play('check'); return; }
  if(action.type === 'call'){ PokerAudio.play('call'); return; }
  if(action.type === 'raise'){
    const me = G.players[myIndex()];
    const maxTotal = me ? me.chips + (me.currentBet || 0) : 0;
    const isAllIn = action.target != null && action.target >= maxTotal;
    if(isAllIn) PokerAudio.play('allin');
    else if(G.currentBet === 0) PokerAudio.play('bet');
    else PokerAudio.play('raise');
  }
}

function log(msg, cls){
  const areas = [$("logArea"), $("mobileLogArea")].filter(Boolean);
  areas.forEach(function(el){
    const div = document.createElement("div");
    div.className = "log-line" + (cls ? " " + cls : "");
    div.textContent = msg;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
    while(el.childNodes.length > 200) el.removeChild(el.firstChild);
  });
  updateHandInfo();
}
function clearLog(){
  const areas = [$("logArea"), $("mobileLogArea")].filter(Boolean);
  areas.forEach(function(el){ el.innerHTML = ""; });
}

function showScreen(name){
  ["lobbyScreen","rulesScreen","myNumbersScreen","gameScreen"].forEach(function(id){
    const el = $(id); if(el) el.classList.add("hidden");
  });
  const target = $(name + "Screen");
  if(target) target.classList.remove("hidden");
  document.querySelectorAll(".nav-link").forEach(function(a){
    a.classList.toggle("active", a.getAttribute("data-nav") === name);
  });
  if(name === "lobby") refreshBalanceUI();
  if(name === "myNumbers") renderNumbers();
}

/* ================= 大厅数据 ================= */
function refreshBalanceUI(){
  const r = PokerStorage.getRealChips();
  const pts = PokerStorage.getPoints();
  const ai = PokerStorage.getAiChips();
  const rEl = $("realBalance"); if(rEl) rEl.textContent = fmtNum(r);
  const pEl = $("pointsBalance"); if(pEl) pEl.textContent = fmtNum(pts);
  const aiEl = $("aiTotalChips"); if(aiEl) aiEl.textContent = fmtNum(ai);

  const s = PokerStorage.getStats();
  const pwEl = $("pointsTotalWon");
  if(pwEl){
    pwEl.textContent = (s.netGain >= 0 ? "+" : "") + fmtNum(s.netGain);
    pwEl.style.color = s.netGain >= 0 ? 'var(--green)' : 'var(--red)';
  }
  const aiWon = $("aiTotalWon");
  if(aiWon){
    aiWon.textContent = (s.netGain >= 0 ? "+" : "") + fmtNum(s.netGain);
    aiWon.style.color = s.netGain >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if(window.PokerWallet && PokerWallet.isConnected()) PokerWallet.updateUI();
}

function renderNumbers(){
  const s = PokerStorage.getStats();
  const th = $("numTotalHands"); if(th) th.textContent = s.hands;
  const twr = $("numWinRate");
  if(twr) twr.textContent = s.hands > 0 ? Math.round(s.wins / s.hands * 100) + "%" : "0%";
  const tb = $("numBiggest"); if(tb) tb.textContent = fmtNum(s.biggestPot);
  const tn = $("numNet");
  if(tn){
    tn.textContent = (s.netGain >= 0 ? "+" : "") + fmtNum(s.netGain);
    tn.classList.toggle('positive', s.netGain >= 0);
    tn.classList.toggle('negative', s.netGain < 0);
  }
  const sessions = s.sessions || [];
  let totalBuyIn = 0, totalCashout = 0;
  sessions.forEach(function(r){ totalBuyIn += (r.buyIn || 0); totalCashout += (r.buyIn || 0) + (r.pnl || 0); });
  const tt = $("numTables"); if(tt) tt.textContent = sessions.length;
  const tbi = $("numTotalBuyIn"); if(tbi) tbi.textContent = fmtNum(totalBuyIn);
  const tco = $("numTotalCashout"); if(tco) tco.textContent = fmtNum(totalCashout);
  const wa = $("numbersWallet");
  if(wa){
    if(window.PokerWallet && PokerWallet.isConnected()){
      const a = PokerWallet.getAddress();
      wa.textContent = a.slice(0,6) + '...' + a.slice(-4);
    } else { wa.textContent = isEn() ? "Not connected" : "未连接"; }
  }
  renderHandHistory();
  const body = $("sessionsBody");
  if(!body) return;
  body.innerHTML = "";
  if(sessions.length === 0){
    const empty = document.createElement("div");
    empty.className = "session-empty";
    empty.textContent = isEn() ? "No sessions yet" : "还没坐过桌";
    body.appendChild(empty);
    return;
  }
  sessions.forEach(function(rec){
    const row = document.createElement("div");
    row.className = "session-row";
    const pnlCls = rec.pnl >= 0 ? "pos" : "neg";
    const pnlText = (rec.pnl >= 0 ? "+" : "") + fmtNum(rec.pnl);
    const cashout = (rec.buyIn || 0) + (rec.pnl || 0);
    const modeTag = rec.mode === 'real' ? (isEn() ? ' · Chain' : ' · 链上')
                    : (rec.mode === 'points' ? (isEn() ? ' · Points' : ' · 积分') : ' · AI');
    row.innerHTML =
      '<span>' + rec.table + modeTag + '</span>' +
      '<span>' + rec.blinds + '</span>' +
      '<span>' + fmtNum(rec.buyIn) + '</span>' +
      '<span>' + fmtNum(cashout) + '</span>' +
      '<span class="' + pnlCls + '">' + pnlText + '</span>' +
      '<span>' + (rec.hands || 0) + '</span>' +
      '<span>' + (rec.pnl > 0 ? '✓' : '—') + '</span>' +
      '<span>' + (isEn() ? 'Left' : '已离桌') + '</span>';
    body.appendChild(row);
  });
}

function renderHandHistory(){
  const body = document.getElementById('handHistoryBody');
  if(!body) return;
  const list = PokerStorage.getHandHistory ? PokerStorage.getHandHistory() : [];
  body.innerHTML = "";
  if(!list.length){
    const empty = document.createElement('div');
    empty.className = 'hand-history-empty';
    empty.textContent = isEn() ? 'No hands recorded yet' : '还没有记录（打一手后自动出现）';
    body.appendChild(empty);
    return;
  }
  list.forEach(function(rec){
    const item = document.createElement('div');
    item.className = 'hand-history-item';
    const myCardsHtml = (rec.myCards || []).map(function(s){
      const red = s.indexOf('♥') >= 0 || s.indexOf('♦') >= 0;
      return '<div class="mini-card face ' + (red ? 'red' : 'black') + '">' +
        '<div class="v">' + s.slice(0, -1) + '</div>' +
        '<div class="s">' + s.slice(-1) + '</div></div>';
    }).join('');
    const commHtml = (rec.community || []).map(function(s){
      const red = s.indexOf('♥') >= 0 || s.indexOf('♦') >= 0;
      return '<div class="mini-card face ' + (red ? 'red' : 'black') + '">' +
        '<div class="v">' + s.slice(0, -1) + '</div>' +
        '<div class="s">' + s.slice(-1) + '</div></div>';
    }).join('');
    const deltaCls = rec.delta >= 0 ? 'pos' : 'neg';
    const deltaText = (rec.delta >= 0 ? '+' : '') + fmtNum(rec.delta);
    item.innerHTML =
      '<span class="hh-hand">#' + rec.handNumber + '</span>' +
      '<span class="hh-cards">' + myCardsHtml + '</span>' +
      '<span class="hh-community">' + commHtml + '</span>' +
      '<span class="hh-result ' + deltaCls + '">' + deltaText + '</span>';
    body.appendChild(item);
  });
}

/* ================= 定时器清理工具 ================= */
function clearAiActionTimer(){
  if(G._aiActionTimer){ clearTimeout(G._aiActionTimer); G._aiActionTimer = null; }
}
function clearHostTimeout(){
  if(G._hostTimeout){ clearTimeout(G._hostTimeout); G._hostTimeout = null; }
}
function clearBusyWatchdog(){
  if(G._busyWatchdogTimer){ clearTimeout(G._busyWatchdogTimer); G._busyWatchdogTimer = null; }
}
function clearShowCardsTimer(){
  if(G._showCardsTimer){ clearTimeout(G._showCardsTimer); G._showCardsTimer = null; }
}
function clearAllGameTimers(){
  clearAiActionTimer();
  clearHostTimeout();
  clearBusyWatchdog();
}

/* ================= 会话重置 ================= */
function resetSessionState(){
  if(G.turnTimer){ clearInterval(G.turnTimer); G.turnTimer = null; }
  clearAllGameTimers();
  clearShowCardsTimer();
  if(G._nextHandTimer){ clearInterval(G._nextHandTimer); G._nextHandTimer = null; }
  if(G._nextHandToastTimer){ clearInterval(G._nextHandToastTimer); G._nextHandToastTimer = null; }
  if(G._turnTickTimer){ clearInterval(G._turnTickTimer); G._turnTickTimer = null; }
  if(G.online.broadcastTimer){ clearInterval(G.online.broadcastTimer); G.online.broadcastTimer = null; }
  G.players = []; G.community = []; G.deck = [];
  G.pot = 0; G.currentBet = 0; G.lastRaiseAmount = G.bigBlind;
  G.stage = 'preflop'; G.handNumber = 0; G.dealerIndex = 0; G.currentPlayerIndex = 0;
  G.gameOver = false; G.busy = false; G._busySince = 0;
  G.seatPositions = []; G.raiseMin = 0; G.raiseMax = 0;
  G.sessionBuyIn = 0; G.sessionHands = 0; G.playerHandStartChips = 0;
  G._renderedCards = new WeakSet();
  G._lastStateSig = ''; G._lastActionSig = ''; G._lastBoardSig = ''; G._lastHandSig = '';
  G._timerKey = null; G._nextHandEndsAt = 0; G._turnEndsAt = 0;
  G._lastTickSecond = 0; G._currentHandMyCards = [];
  G._showCardsEndsAt = 0;
}

function resetTableDom(){
  ['seatsLayer','boardCards','handCardsLarge','logArea','humanActions'].forEach(function(id){
    const el = document.getElementById(id); if(el) el.innerHTML = '';
  });
  const pot = document.getElementById('potMain'); if(pot) pot.textContent = '0';
  const psw = document.getElementById('potSideWrap'); if(psw) psw.classList.add('hidden');
  const ps = document.getElementById('potSide'); if(ps) ps.textContent = '0';
  const potChips = document.getElementById('potChips'); if(potChips) potChips.innerHTML = '';
  const panel = document.getElementById('raisePanel'); if(panel) panel.classList.add('hidden');
  const nextBtn = document.getElementById('nextHandBtn'); if(nextBtn) nextBtn.classList.add('hidden');
  const showBtn = document.getElementById('showCardsBtn'); if(showBtn) showBtn.classList.add('hidden');
  const timer = document.getElementById('turnTimer'); if(timer) timer.classList.add('hidden');
  const stage = document.getElementById('stageLabel'); if(stage) stage.textContent = '';
  const hand = document.getElementById('gameHandLabel'); if(hand) hand.textContent = '';
  const handInfo = document.getElementById('handInfo'); if(handInfo) handInfo.innerHTML = '';
  const toast = document.getElementById('nextHandToast'); if(toast) toast.remove();
  const tng = document.getElementById('turnRing'); if(tng) tng.remove();
  const tie = document.getElementById('tieDisplay'); if(tie) tie.classList.add('hidden');
  const chat = document.getElementById('chatMessages'); if(chat) chat.innerHTML = '';
  const chatPanel = document.getElementById('chatPanel'); if(chatPanel) chatPanel.classList.add('hidden');
  const fab = document.getElementById('chatFab'); if(fab) fab.classList.add('hidden');
  const ih = document.getElementById('inGameHistory'); if(ih) ih.classList.add('hidden');
  const mlogArea = document.getElementById('mobileLogArea'); if(mlogArea) mlogArea.innerHTML = '';
  const mlogHist = document.getElementById('mobileLogHistoryBody'); if(mlogHist) mlogHist.innerHTML = '';
  const mlogPanel = document.getElementById('mobileLogPanel'); if(mlogPanel) mlogPanel.classList.add('hidden');
}

function hideHumanActions(){
  const box = $("humanActions"); if(box) box.innerHTML = "";
  const panel = $("raisePanel"); if(panel) panel.classList.add("hidden");
  G._lastActionSig = "";
  if(G.turnTimer) stopTurnTimer();
}

function awardUncontestedPot(){
  const alive = G.players.filter(function(p){ return p.seated !== false && !p.folded; });
  const pot = G.pot;
  if(alive.length === 1 && pot > 0){
    const w = alive[0];
    w.chips += pot;
    log(t("winsPot", { name: w.name, pot: fmtNum(pot) }), "win");
    PokerAudio.play("win");
  }
  G.pot = 0;
  G.stage = "showdown";
  G.busy = false; G._busySince = 0;
  clearAllGameTimers();
}

/* ================= 等待栏 ================= */
function ensureWaitingBar(){
  let bar = document.getElementById('waitingBar');
  if(bar) return bar;
  bar = document.createElement('div');
  bar.id = 'waitingBar';
  bar.className = 'waiting-bar hidden';
  const tableArea = document.querySelector('.table-area');
  if(tableArea) tableArea.appendChild(bar);
  return bar;
}
function showWaitingBar(){
  const bar = ensureWaitingBar();
  if(!bar) return;
  const code = (window.PokerOnline && PokerOnline.getRoomId) ? PokerOnline.getRoomId() : '';
  bar.innerHTML =
    '<div class="waiting-room">' + (isEn() ? 'Room ' : '房间号 ') + '<b>' + (code || '—') + '</b></div>' +
    '<div class="waiting-info" id="waitingInfo">0 / 7</div>' +
    '<button class="mini-btn" id="waitingReadyBtn" type="button">' + (isEn() ? 'Ready' : '准备好了') + '</button>' +
    '<button class="mini-btn ghost" id="waitingLeaveBtn" type="button">' + (isEn() ? 'Leave' : '离桌') + '</button>';
  bar.classList.remove('hidden');
  const readyBtn = document.getElementById('waitingReadyBtn');
  if(readyBtn){
    const me = (window.PokerOnline && PokerOnline.getRoomPlayers) ? PokerOnline.getRoomPlayers()[PokerOnline.getMyId()] : null;
    if(me && me.ready) readyBtn.textContent = isEn() ? 'Cancel ready' : '取消准备';
    readyBtn.onclick = function(){
      if(window.PokerAudio) PokerAudio.play('click');
      const isReady = PokerOnline.toggleReady();
      readyBtn.textContent = isReady ? (isEn() ? 'Cancel ready' : '取消准备') : (isEn() ? 'Ready' : '准备好了');
      updateWaitingBar();
    };
  }
  const leaveBtn = document.getElementById('waitingLeaveBtn');
  if(leaveBtn) leaveBtn.onclick = function(){
    if(window.PokerAudio) PokerAudio.play('click');
    backToLobby();
  };
  updateWaitingBar();
}
function updateWaitingBar(){
  const info = document.getElementById('waitingInfo');
  if(!info) return;
  const players = (window.PokerOnline && PokerOnline.getRoomPlayers) ? PokerOnline.getRoomPlayers() : {};
  const ids = Object.keys(players);
  const ready = ids.filter(function(id){ return players[id].ready; }).length;
  info.textContent = ids.length + ' / ' + ONLINE_MAX_SEATS + ' · ' + ready + (isEn() ? ' ready' : ' 已准备');
}
function hideWaitingBar(){
  const bar = document.getElementById('waitingBar');
  if(bar) bar.classList.add('hidden');
}

function syncWaitingSeatsFromRoom(){
  if(!G.online.active) return;
  if(G.online.started && G.stage !== 'waiting') return;
  const players = (window.PokerOnline && PokerOnline.getRoomPlayers) ? PokerOnline.getRoomPlayers() : {};
  const myId = window.PokerOnline ? PokerOnline.getMyId() : null;
  const ids = Object.keys(players);
  ids.sort(function(a, b){ return (players[a].seat || 0) - (players[b].seat || 0); });
  const existing = {};
  G.players.forEach(function(p){ if(p.peerId) existing[p.peerId] = p; });
  G.players = ids.map(function(pid){
    const info = players[pid];
    const isSelf = pid === myId;
    const old = existing[pid];
    if(old){
      old.id = info.seat; old.name = info.name; old.isHuman = isSelf;
      old.ready = !!info.ready; old.seated = true;
      old.holeCards = []; old.folded = false; old.allIn = false;
      old.currentBet = 0; old.lastAction = ''; old.revealCards = false; old._highlight = null;
      return old;
    }
    return {
      id: info.seat, peerId: pid, name: info.name,
      emoji: isSelf ? PokerAvatars.HUMAN.emoji : '🎮',
      bg: isSelf ? PokerAvatars.HUMAN.bg : 'linear-gradient(135deg,#a855f7,#6d28d9)',
      isHuman: isSelf, chips: 10000, seated: true,
      holeCards: [], folded: false, allIn: false,
      currentBet: 0, totalContributed: 0, needsToAct: false,
      position:'', positionKey:'', lastAction:'', styleKey:null,
      revealCards:false, _highlight:null, preflopOrder:0, postflopOrder:0,
      ready: !!info.ready
    };
  });
  G.online.mySeat = G.players.findIndex(function(p){ return p.peerId === myId; });
  G.seatPositions = computeSeatPositions(ONLINE_MAX_SEATS);
  render();
}

function returnToWaiting(){
  clearAllGameTimers();
  clearShowCardsTimer();
  if(G._nextHandTimer){ clearInterval(G._nextHandTimer); G._nextHandTimer = null; }
  if(G._nextHandToastTimer){ clearInterval(G._nextHandToastTimer); G._nextHandToastTimer = null; }
  stopTurnTimer();
  hideNextHandToast();
  G.online.started = false; G.stage = 'waiting';
  G.pot = 0; G.currentBet = 0; G.community = []; G.handNumber = 0;
  G.gameOver = false; G.busy = false; G._busySince = 0;
  G.dealerIndex = 0; G.currentPlayerIndex = 0;
  G._nextHandEndsAt = 0; G._turnEndsAt = 0;
  G.players.forEach(function(p){
    p.holeCards = []; p.folded = false; p.allIn = false;
    p.currentBet = 0; p.totalContributed = 0; p.lastAction = '';
    p.revealCards = false; p._highlight = null; p.needsToAct = false;
  });
  syncWaitingSeatsFromRoom();
  showWaitingBar();
  hideHumanActions();
  const bc = document.getElementById('boardCards'); if(bc) bc.innerHTML = '';
  const pm = document.getElementById('potMain'); if(pm) pm.textContent = '0';
  const pc = document.getElementById('potChips'); if(pc) pc.innerHTML = '';
  const handArea = document.getElementById('handCardsLarge'); if(handArea) handArea.innerHTML = '';
  render();
  if(G.online.active && G.online.isHost) broadcastFullState();
}

/* ================= 8 秒下一手 ================= */
function beginNextHandCountdown(startFn){
  if(G._nextHandTimer){ clearInterval(G._nextHandTimer); G._nextHandTimer = null; }
  const seated = G.players.filter(function(p){ return p.seated !== false; });
  if(seated.length < 2){
    if(G.online.active && G.online.isHost){
      log(isEn() ? "Not enough players — waiting" : "人数不足，等待更多玩家", "hl");
    }
    returnToWaiting();
    return;
  }
  const duration = NEXT_HAND_DELAY * 1000;
  G._nextHandEndsAt = Date.now() + duration;
  showNextHandToast(G._nextHandEndsAt);
  if(G.online.active && G.online.isHost) broadcastFullState();
  const btn = $("nextHandBtn");
  if(btn){ btn.classList.remove('hidden'); btn.disabled = false; btn.onclick = fire; }
  function fire(){
    if(G._nextHandTimer){ clearInterval(G._nextHandTimer); G._nextHandTimer = null; }
    G._nextHandEndsAt = 0;
    if(btn) btn.classList.add('hidden');
    hideNextHandToast();
    if(window.PokerAudio) PokerAudio.play('click');
    const still = G.players.filter(function(p){ return p.seated !== false && p.chips > 0; });
    if(still.length < 2){ returnToWaiting(); return; }
    rotateDealerAndStart(startFn);
  }
  function tick(){
    const left = Math.max(0, Math.ceil((G._nextHandEndsAt - Date.now()) / 1000));
    if(btn) btn.textContent = '▶ ' + (isEn() ? ('Next (' + left + 's)') : ('下一手（' + left + 's）'));
    if(left > 0 && left <= 3 && left !== G._lastTickSecond){
      G._lastTickSecond = left;
      if(window.PokerAudio) PokerAudio.play('tick');
    }
    if(left <= 0){ fire(); }
  }
  tick();
  G._nextHandTimer = setInterval(tick, 500);
}
function rotateDealerAndStart(startFn){
  if(!G.players.length) return;
  let tries = 0;
  do {
    G.dealerIndex = (G.dealerIndex + 1) % G.players.length;
    tries++;
  } while(
    (G.players[G.dealerIndex].seated === false || G.players[G.dealerIndex].chips <= 0) &&
    tries < G.players.length
  );
  startFn();
}
function showNextHandToast(endsAt){
  let toast = document.getElementById('nextHandToast');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'nextHandToast';
    toast.className = 'next-hand-toast';
    const center = document.querySelector('.table-center');
    if(center) center.appendChild(toast); else document.body.appendChild(toast);
  }
  toast.classList.remove('hidden');
  if(G._nextHandToastTimer){ clearInterval(G._nextHandToastTimer); }
  const update = function(){
    const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    toast.textContent = (isEn() ? 'Next hand ' : '下一手 ') + left;
    if(left <= 0){
      clearInterval(G._nextHandToastTimer);
      G._nextHandToastTimer = null;
      toast.classList.add('hidden');
    }
  };
  update();
  G._nextHandToastTimer = setInterval(update, 200);
}
function hideNextHandToast(){
  const toast = document.getElementById('nextHandToast');
  if(toast) toast.classList.add('hidden');
  if(G._nextHandToastTimer){ clearInterval(G._nextHandToastTimer); G._nextHandToastTimer = null; }
}

/* ================= 兜底同步 ================= */
function checkRosterSync(){
  if(!G.online.active || !G.online.isHost) return false;
  if(!window.PokerOnline || !PokerOnline.getRoomPlayers) return false;
  if(!G.online.started && G.stage === 'waiting') return false;
  const players = PokerOnline.getRoomPlayers();
  const leftPeers = [];
  G.players.forEach(function(p){
    if(!p.peerId) return;
    if(p.seated === false) return;
    if(!players[p.peerId]) leftPeers.push(p.peerId);
  });
  if(!leftPeers.length) return false;
  leftPeers.forEach(function(peerId){
    const idx = G.players.findIndex(function(p){ return p.peerId === peerId; });
    if(idx < 0) return;
    const p = G.players[idx];
    if(p.seated === false) return;
    p.seated = false; p.folded = true; p.needsToAct = false;
    p.holeCards = []; p._highlight = null; p.revealCards = false;
    p.lastAction = isEn() ? 'Left' : '已离桌';
    log((p.name || 'Player') + (isEn() ? " left the table" : " 离桌了"), "action");
    if(G.currentPlayerIndex === idx){
      stopTurnTimer();
      clearHostTimeout();
    }
  });
  render();
  return true;
}
function handlePlayerLeave(peerId){
  const idx = G.players.findIndex(function(p){ return p.peerId === peerId; });
  if(idx < 0) return;
  const p = G.players[idx];
  if(p.seated === false) return;
  p.seated = false; p.folded = true; p.needsToAct = false;
  p.holeCards = []; p._highlight = null; p.revealCards = false;
  p.lastAction = isEn() ? 'Left' : '已离桌';
  log((p.name || 'Player') + (isEn() ? " left the table" : " 离桌了"), "action");
  if(G.currentPlayerIndex === idx){
    stopTurnTimer();
    clearHostTimeout();
  }
  render();
}

/* ================= 大厅渲染 ================= */
function renderLobby(){
  renderTableGrid("aiTableGrid", "ai");
  renderTableGrid("pointsTableGrid", "points");
  renderTableGrid("realTableGrid", "real");
  renderRoomLists();
  refreshBalanceUI();
}
function renderRoomLists(){
  if(!window.PokerOnline || !PokerOnline.getKnownRooms) return;
  const currentId = PokerOnline.getRoomId();
  const rooms = PokerOnline.getKnownRooms().filter(function(r){ return r.roomId !== currentId; });
  const pointsRooms = rooms.filter(function(r){ return r.mode === 'points'; });
  const realRooms   = rooms.filter(function(r){ return r.mode === 'real'; });
  fillRoomList('pointsRoomList', pointsRooms);
  fillRoomList('realRoomList',   realRooms);
  updateRoomCount('pointsRoomCount', pointsRooms.length);
  updateRoomCount('realRoomCount',   realRooms.length);
  const total = pointsRooms.length + realRooms.length;
  const sl = document.getElementById('statusLabel');
  if(sl) sl.textContent = isEn() ? (total + (total === 1 ? ' table' : ' tables')) : (total + ' 桌开放');
}
function updateRoomCount(id, n){
  const el = document.getElementById(id);
  if(!el) return;
  el.innerHTML = '<span class="pulse"></span><span>' + n + (isEn() ? (n === 1 ? ' table' : ' tables') : ' 桌') + '</span>';
  if(n > 0) el.classList.remove('zero'); else el.classList.add('zero');
}
function fillRoomList(containerId, rooms){
  const el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = "";
  if(!rooms.length) return;
  rooms.forEach(function(r){
    const lv = LEVELS.find(function(l){ return l.key === r.level; }) || LEVELS[0];
    const item = document.createElement('div');
    item.className = 'room-item';
    const initial = (r.hostName || 'R').charAt(0).toUpperCase();
    const isFull = (r.count || 1) >= (r.maxSeats || 7);
    item.innerHTML =
      '<div class="room-item-avatar">' + initial + '</div>' +
      '<div class="room-item-info">' +
        '<div class="room-item-name">' + (r.hostName || 'Host') + (isEn() ? "'s room" : ' 的房间') + '</div>' +
        '<div class="room-item-meta">' + lv.name + ' · ' + lv.sb + '/' + lv.bb + ' · ' + r.roomId + '</div>' +
      '</div>' +
      '<div class="room-item-players">' + (r.count || 1) + '/' + (r.maxSeats || 7) + '</div>' +
      '<button class="room-item-join"' + (isFull ? ' disabled' : '') + '>' +
        (isFull ? (isEn() ? 'Full' : '已满') : (isEn() ? 'Join' : '加入')) +
      '</button>';
    if(!isFull){
      const handler = function(e){ if(e && e.stopPropagation) e.stopPropagation(); doJoinRoom(lv, r.mode, r.roomId); };
      item.querySelector('.room-item-join').onclick = handler;
      item.onclick = handler;
    }
    el.appendChild(item);
  });
}
function renderTableGrid(containerId, mode){
  const grid = $(containerId);
  if(!grid) return;
  grid.innerHTML = "";
  LEVELS.forEach(function(lv){
    const card = document.createElement("div");
    card.className = "table-card";
    let totalSeats = mode === 'ai' ? G.aiSeats : ONLINE_MAX_SEATS;
    let seatDots = "";
    for(let i = 0; i < totalSeats; i++){
      const angle = -90 + (360 / totalSeats) * i;
      const rad = angle * Math.PI / 180;
      const x = 50 + 40 * Math.cos(rad);
      const y = 50 + 40 * Math.sin(rad);
      const isEmpty = mode === 'ai' ? (i >= totalSeats - 1) : true;
      seatDots += '<div class="dot-seat' + (isEmpty ? ' empty' : '') + '" style="left:' + x + '%;top:' + y + '%;transform:translate(-50%,-50%);"></div>';
    }
    const preview =
      '<div class="table-card-preview">' +
        '<div class="seats">' + seatDots + '</div>' +
        '<div class="card-row">' +
          '<div class="mini-blank"></div><div class="mini-blank"></div>' +
          '<div class="mini-blank"></div><div class="mini-blank"></div>' +
          '<div class="mini-blank"></div>' +
        '</div>' +
      '</div>';
    const nameText = lv.name + (isEn() ? ' Table' : ' 桌');
    const blindsLabel = isEn() ? ('Blinds ' + lv.sb + '/' + lv.bb) : ('盲注 ' + lv.sb + '/' + lv.bb);
    const buyInLabel = isEn() ? 'Buy-in' : '买入';
    const buyInText = fmtNum(lv.buyMin) + '–' + fmtNum(lv.buyMax);
    const rightText = mode === 'real' ? ('≈ ' + toBem(lv.buyMin) + ' BEM') : (mode === 'points' ? (isEn() ? 'Points' : '积分') : (isEn() ? 'Free' : '免费'));
    let actionsHtml;
    if(mode === 'ai'){
      actionsHtml = '<button class="btn-seat">' + (isEn() ? 'Take a seat' : '立即入座') + '</button>';
    } else {
      actionsHtml =
        '<button class="btn-create">' + (isEn() ? 'Create room' : '创建房间') + '</button>' +
        '<button class="btn-join">' + (isEn() ? 'Join room' : '加入房间') + '</button>';
    }
    card.innerHTML =
      '<div class="table-card-head">' +
        '<div class="table-card-avatar">' + lv.name.charAt(0) + '</div>' +
        '<div class="table-card-title">' +
          '<div class="table-card-name">' + nameText + '</div>' +
          '<div class="table-card-blinds">' + blindsLabel + '</div>' +
        '</div>' +
      '</div>' + preview +
      '<div class="table-card-meta">' +
        '<span>' + buyInLabel + ' <strong>' + buyInText + '</strong></span>' +
        '<span>' + rightText + '</span>' +
      '</div>' +
      '<div class="table-card-actions">' + actionsHtml + '</div>';

    /* ★ 手机兼容：click + touchend 双绑定，防止手机浏览器漏点 */
    function bindTap(el, fn){
      if(!el) return;
      let lastFire = 0;
      function fire(e){
        const now = Date.now();
        if(now - lastFire < 400) return;
        lastFire = now;
        if(e && e.preventDefault) e.preventDefault();
        if(window.PokerAudio) PokerAudio.play('click');
        fn();
      }
      el.addEventListener('touchend', fire, { passive: false });
      el.addEventListener('click', fire);
    }

    if(mode === 'ai'){
      bindTap(card.querySelector(".btn-seat"), function(){ openAiLevel(lv); });
    } else {
      bindTap(card.querySelector(".btn-create"), function(){ createRoom(lv, mode); });
      bindTap(card.querySelector(".btn-join"), function(){ joinRoomByCode(lv, mode); });
    }
    grid.appendChild(card);
  });
}

/* ================= AI 场 ================= */
function openAiLevel(lv){
  resetSessionState();
  resetTableDom();
  hideWaitingBar();
  G.gameMode = 'ai';
  let ai = PokerStorage.getAiChips();
  if(ai < lv.buyMin){ PokerStorage.addAiChips(10000); ai = PokerStorage.getAiChips(); }
  const buyIn = Math.min(lv.buyMax, ai);
  PokerStorage.setAiChips(ai - buyIn);
  G.sessionBuyIn = buyIn;
  G.totalPlayers = G.aiSeats;
  G.tableMode = lv.key; G.tableLabel = lv.name;
  G.smallBlind = lv.sb; G.bigBlind = lv.bb;
  G.lastRaiseAmount = lv.bb;
  G.sessionHands = 0;
  G.online.active = false;
  G._onlineLv = lv;
  const human = PokerAvatars.HUMAN;
  G.players = [{
    id:0, name:PokerStorage.getNickname() || human.name, emoji:human.emoji, bg:human.bg,
    isHuman:true, chips:G.sessionBuyIn, seated:true,
    holeCards:[], folded:false, allIn:false, currentBet:0,
    totalContributed:0, needsToAct:false,
    position:"", positionKey:"", lastAction:"", styleKey:null,
    revealCards:false, _highlight:null, preflopOrder:0, postflopOrder:0
  }];
  const profiles = PokerAvatars.pickProfiles(G.totalPlayers - 1);
  const styleKeys = Object.keys(PokerAI.STYLES);
  const shuffled = styleKeys.slice().sort(function(){ return Math.random() - 0.5; });
  for(let i = 1; i < G.totalPlayers; i++){
    const aiBuy = Math.floor(lv.buyMin + Math.random() * (lv.buyMax - lv.buyMin));
    G.players.push({
      id:i, name:profiles[i-1].name, emoji:profiles[i-1].emoji, bg:profiles[i-1].bg,
      isHuman:false, chips:aiBuy, seated:true,
      holeCards:[], folded:false, allIn:false, currentBet:0,
      totalContributed:0, needsToAct:false,
      position:"", positionKey:"", lastAction:"", styleKey:shuffled[(i-1) % shuffled.length],
      revealCards:false, _highlight:null, preflopOrder:0, postflopOrder:0
    });
  }
  G.seatPositions = computeSeatPositions(G.players.length);
  G.dealerIndex = Math.floor(Math.random() * G.players.length);
  G.handNumber = 0; G.gameOver = false;
  $("lobbyScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  document.body.classList.add('game-active');
  if(PokerStorage.clearHandHistory) PokerStorage.clearHandHistory();
  $("onlineLobby").classList.add("hidden");
  if($("gameLevelLabel")) $("gameLevelLabel").textContent = lv.name + " " + lv.sb + "/" + lv.bb + " · " + G.players.length + (isEn() ? "P" : "人");
  if($("gameModeLabel")){ $("gameModeLabel").textContent = isEn() ? "AI" : "AI 练习"; $("gameModeLabel").classList.remove('real'); }
  if($("gameWalletPill")) $("gameWalletPill").innerHTML = '<span class="dot"></span><span>' + (isEn() ? "AI practice" : "AI 练习模式") + '</span>';
  const fab = document.getElementById('chatFab');
  if(fab) fab.classList.remove('hidden');
  const mlogFab = document.getElementById('mobileLogFab');
  if(mlogFab) mlogFab.classList.remove('hidden');
  startNewHandAi();
}

/* ================= 联机 ================= */
function checkOnlinePreconditions(lv, mode){
  if(mode === 'real'){
    if(!window.PokerWallet || !PokerWallet.isConnected()){
      appToast(isEn() ? "Connect wallet first" : "请先连接钱包", "error");
      $("walletOverlay").classList.remove("hidden");
      return false;
    }
    if(PokerStorage.getRealChips() < lv.buyMax){
      appToast(isEn() ? ("Not enough chips. Need " + lv.buyMax.toLocaleString())
                      : ("对战场筹码不足，需要 " + lv.buyMax.toLocaleString() + " 筹码"), "error");
      return false;
    }
  } else {
    if(PokerStorage.getPoints() < lv.buyMax){
      appToast(isEn() ? ("Not enough points. Need " + lv.buyMax.toLocaleString())
                      : ("积分不足，需要 " + lv.buyMax.toLocaleString() + " 积分"), "error");
      return false;
    }
  }
  return true;
}
function generateRoomId(lv, mode){
  const rand = Math.random().toString(36).slice(2, 7);
  return lv.key + '-' + (mode === 'real' ? 'ch' : 'pt') + '-' + rand;
}
function createRoom(lv, mode){
  if(!checkOnlinePreconditions(lv, mode)) return;
  const roomId = generateRoomId(lv, mode);
  appToast(isEn() ? "Creating room..." : "正在创建房间...", "");
  PokerOnline.createRoom(roomId, { level: lv.key, mode: mode }).then(function(){
    enterOnlineRoom(lv, mode, roomId, true);
  }).catch(function(err){
    console.error('[createRoom]', err);
    appToast((isEn() ? "Connection failed: " : "连接失败：") + (err && err.message ? err.message : err), "error");
  });
}
function joinRoomByCode(lv, mode){
  if(!checkOnlinePreconditions(lv, mode)) return;
  const overlay = $("joinRoomOverlay");
  overlay.classList.remove("hidden");
  const input = $("joinRoomInput");
  input.value = '';
  $("joinRoomConfirmBtn").onclick = function(){
    const code = input.value.trim();
    if(!code){ appToast(isEn() ? "Enter a room code" : "请输入房间号", "error"); return; }
    overlay.classList.add("hidden");
    doJoinRoom(lv, mode, code);
  };
  $("joinRoomCancelBtn").onclick = function(){ overlay.classList.add("hidden"); };
  setTimeout(function(){ try { input.focus(); } catch(e){} }, 100);
}
function doJoinRoom(lv, mode, roomId){
  appToast(isEn() ? "Joining..." : "正在加入...", "");
  PokerOnline.joinRoom(roomId).then(function(){
    enterOnlineRoom(lv, mode, roomId, false);
  }).catch(function(err){
    console.error('[doJoinRoom]', err);
    appToast((isEn() ? "Join failed: " : "加入失败：") + (err && err.message ? err.message : err), "error");
  });
}
function enterOnlineRoom(lv, mode, roomId, isHost){
  resetSessionState();
  resetTableDom();
  G.gameMode = mode;
  G.tableMode = lv.key;
  G.tableLabel = lv.name;
  G.smallBlind = lv.sb;
  G.bigBlind = lv.bb;
  G.lastRaiseAmount = lv.bb;
  G.gameOver = false;
  G.stage = 'waiting';
  G.sessionBuyIn = lv.buyMax;
  G.sessionHands = 0;
  G._onlineLv = lv;
  G.online = { active:true, isHost:isHost, roomId:roomId, mySeat:0, started:false, broadcastTimer:null };
  G._lastStateSig = ''; G._lastActionSig = ''; G._lastBoardSig = ''; G._lastHandSig = '';
  G._timerKey = null; G._nextHandEndsAt = 0; G._turnEndsAt = 0;
  $("lobbyScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  document.body.classList.add('game-active');
  if(PokerStorage.clearHandHistory) PokerStorage.clearHandHistory();
  $("onlineLobby").classList.add("hidden");
  if($("gameLevelLabel")) $("gameLevelLabel").textContent = lv.name + " " + lv.sb + "/" + lv.bb + " · " + (isEn() ? "Online" : "联机");
  if($("gameModeLabel")){
    if(mode === 'real'){ $("gameModeLabel").textContent = isEn() ? "On-chain" : "链上"; $("gameModeLabel").classList.add('real'); }
    else { $("gameModeLabel").textContent = isEn() ? "Points" : "积分"; $("gameModeLabel").classList.remove('real'); }
  }
  if($("gameWalletPill")) $("gameWalletPill").innerHTML = '<span class="dot" style="background:#a855f7;"></span><span>' + (isEn() ? "Waiting" : "等待中") + '</span>';
  clearLog();
  log((isEn() ? "Room: " : "房间号：") + roomId, "hl");
  log(isEn() ? "Waiting for players..." : "等待其他玩家加入...", "hl");
  showWaitingBar();
  syncWaitingSeatsFromRoom();
  hideHumanActions();
  const fab = document.getElementById('chatFab');
  if(fab) fab.classList.remove('hidden');
  const mlogFab = document.getElementById('mobileLogFab');
  if(mlogFab) mlogFab.classList.remove('hidden');
}
function updateOnlineLobbyUI(){ updateWaitingBar(); }
function hostStartGame(playerOrder, playersInfo){
  if(!G.online.isHost) return;
  if(G.online.started) return;
  const myId = PokerOnline.getMyId();
  const ordered = playerOrder.slice().sort(function(a, b){
    const ia = playersInfo.find(function(p){ return p.peerId === a; });
    const ib = playersInfo.find(function(p){ return p.peerId === b; });
    return (ia && ia.seat || 0) - (ib && ib.seat || 0);
  });
  const lv = G._onlineLv || LEVELS[0];
  const buyInChips = lv.buyMax;
  console.log('[hostStartGame] lv =', lv.key, 'buyInChips =', buyInChips);

  G.players = ordered.map(function(pid){
    const info = playersInfo.find(function(p){ return p.peerId === pid; }) || { name:'Player', seat: 0 };
    const isSelf = pid === myId;
    if(isSelf){
      let have = PokerStorage.getPoints();
      if(have < buyInChips){
        PokerStorage.addPoints(buyInChips - have + 10000);
        have = PokerStorage.getPoints();
      }
      PokerStorage.setPoints(have - buyInChips);
    }
    return {
      id: info.seat || 0, peerId: pid, name: info.name,
      emoji: isSelf ? PokerAvatars.HUMAN.emoji : '🎮',
      bg: isSelf ? PokerAvatars.HUMAN.bg : 'linear-gradient(135deg,#a855f7,#6d28d9)',
      isHuman: isSelf,
      chips: buyInChips,
      seated: true,
      holeCards: [], folded:false, allIn:false, currentBet:0,
      totalContributed:0, needsToAct:false,
      position:"", positionKey:"", lastAction:"", styleKey:null,
      revealCards:false, _highlight:null, preflopOrder:0, postflopOrder:0
    };
  });
  G.sessionBuyIn = buyInChips;
  G.online.mySeat = G.players.findIndex(function(p){ return p.peerId === myId; });
  G.totalPlayers = G.players.length;
  G.seatPositions = computeSeatPositions(ONLINE_MAX_SEATS);
  G.dealerIndex = Math.floor(Math.random() * G.players.length);
  G.handNumber = 0;
  G.gameOver = false;
  G.online.started = true;
  G.stage = 'preflop';
  G._lastStateSig = ''; G._lastActionSig = ''; G._lastBoardSig = ''; G._lastHandSig = '';
  hideWaitingBar();
  if($("gameWalletPill")) $("gameWalletPill").innerHTML = '<span class="dot" style="background:#a855f7;"></span><span>' + G.players.length + (isEn() ? " players" : " 人联机") + '</span>';
  const startPayload = {
    playerOrder: ordered,
    players: G.players.map(function(p){ return { id: p.id, peerId: p.peerId, name: p.name, seat: p.id }; })
  };
  PokerOnline.sendGameStart(startPayload);
  startNewHandHost();
}

async function startNewHandHost(){
  clearAllGameTimers();
  clearShowCardsTimer();
  if(G._nextHandTimer){ clearInterval(G._nextHandTimer); G._nextHandTimer = null; }
  if(G._nextHandToastTimer){ clearInterval(G._nextHandToastTimer); G._nextHandToastTimer = null; }
  hideNextHandToast();
  const showBtn = document.getElementById('showCardsBtn');
  if(showBtn) showBtn.classList.add('hidden');
  G.handNumber++; G.sessionHands++;
  G.pot = 0; G.community = [];
  G.currentBet = 0; G.lastRaiseAmount = G.bigBlind;
  G.stage = "preflop"; G.busy = false; G._busySince = 0;
  G._nextHandEndsAt = 0;
  G.deck = PokerDeck.create();
  PokerDeck.shuffle(G.deck);
  G._renderedCards = new WeakSet();
  G._lastBoardSig = ''; G._lastHandSig = ''; G._lastActionSig = '';
  stopTurnTimer();
  G.players.forEach(function(p){
    p.folded = p.chips <= 0 || p.seated === false;
    p.allIn = false; p.currentBet = 0; p.totalContributed = 0;
    p.needsToAct = false; p.lastAction = ""; p.holeCards = [];
    p.revealCards = false; p._highlight = null; p._score = null;
    p._intentReveal = false;
  });
  assignPositions();
  computeActionOrders();
  const n = G.players.length;
  for(let r = 0; r < 2; r++){
    for(let i = 1; i <= n; i++){
      const idx = (G.dealerIndex + i) % n;
      const p = G.players[idx];
      if(!p.folded) p.holeCards.push(G.deck.pop());
    }
  }
  if(G.players[G.online.mySeat]){
    G._currentHandMyCards = G.players[G.online.mySeat].holeCards.map(function(c){ return c.suit + c.rank; });
  }
  clearLog();
  log(t("handNum", { n:G.handNumber }) + " · " + t("dealerIs", { name:G.players[G.dealerIndex].name }), "hl");
  log(t("blindsAre", { sb:G.smallBlind, bb:G.bigBlind }), "hl");
  const gh = $("gameHandLabel");
  if(gh) gh.textContent = t("handShortLabel", { n:G.handNumber });
  render();
  await playDealAnimation();
  postBlinds();
  render();
  startPreflopHost();
  broadcastFullState();
  runHostTurn();
}
function startPreflopHost(){
  const n = G.players.length;
  G.players.forEach(function(p){
    p.needsToAct = p.seated !== false && !p.folded && !p.allIn && p.chips > 0;
  });
  let idx = n === 2 ? G.dealerIndex : (G.dealerIndex + 3) % n;
  let tries = 0;
  while((G.players[idx].folded || G.players[idx].allIn || G.players[idx].seated === false) && tries < n){
    idx = (idx + 1) % n; tries++;
  }
  G.currentPlayerIndex = idx;
  render();
}

function runHostTurn(){
  if(G.gameOver) return;
  checkRosterSync();
  if(countActive() <= 1){
    const pot = G.pot;
    awardUncontestedPot();
    render();
    if(G.online.isHost) broadcastFullState();
    endHandHost(pot);
    return;
  }
  const notAllIn = G.players.filter(function(p){ return p.seated !== false && !p.folded && !p.allIn; });
  if(notAllIn.length === 0){ advanceStageHost(); return; }
  if(notAllIn.length === 1 && notAllIn.every(function(p){ return !p.needsToAct; })){ advanceStageHost(); return; }
  if(!findNextToAct()){ advanceStageHost(); return; }
  const p = G.players[G.currentPlayerIndex];
  G._turnEndsAt = Date.now() + 30000;
  render();
  broadcastFullState();
  if(p.isHuman){
    showHumanControls();
    startTurnTimer(p);
    clearHostTimeout();
  } else {
    stopTurnTimer();
    clearHostTimeout();
    const curIdx = G.currentPlayerIndex;
    G._hostTimeout = setTimeout(function(){
      G._hostTimeout = null;
      if(G.gameOver) return;
      if(G.currentPlayerIndex !== curIdx) return;
      const cur = G.players[curIdx];
      if(!cur || cur.folded || cur.allIn || !cur.needsToAct) return;
      const toCall = Math.max(0, G.currentBet - cur.currentBet);
      const fallback = toCall > 0 ? { type: 'fold' } : { type: 'check' };
      log(cur.name + (isEn() ? " timed out, auto-act" : " 超时自动行动"), "action");
      try { executeAction(cur, fallback); } catch(e){ console.error(e); }
      render();
      broadcastFullState();
      runHostTurn();
    }, PLAYER_ACTION_TIMEOUT);
  }
}

function advanceStageHost(){
  stopTurnTimer();
  clearAllGameTimers();
  checkRosterSync();

  if(countActive() <= 1){
    const pot = G.pot;
    awardUncontestedPot();
    render();
    if(G.online.isHost) broadcastFullState();
    endHandHost(pot);
    return;
  }

  const boardLen = G.community.length;

  if(boardLen >= 5){
    showdownHost();
    return;
  }

  G.players.forEach(function(p){ p.currentBet = 0; p.lastAction = ""; });
  G.currentBet = 0; G.lastRaiseAmount = G.bigBlind;

  if(boardLen === 0){
    G.stage = "flop";
    G.community.push(G.deck.pop(), G.deck.pop(), G.deck.pop());
    log(t("flopIs",{cards:G.community.map(function(c){return c.display;}).join("  ")}), "hl");
  } else if(boardLen === 3){
    G.stage = "turn";
    G.community.push(G.deck.pop());
    log(t("turnIs",{card:G.community[G.community.length-1].display}), "hl");
  } else if(boardLen === 4){
    G.stage = "river";
    G.community.push(G.deck.pop());
    log(t("riverIs",{card:G.community[G.community.length-1].display}), "hl");
  } else {
    showdownHost();
    return;
  }

  PokerAudio.play('deal');
  G.players.forEach(function(p){
    p.currentBet = 0; p.lastAction = "";
    p.needsToAct = p.seated !== false && !p.folded && !p.allIn && p.chips > 0;
  });
  G.currentBet = 0; G.lastRaiseAmount = G.bigBlind;
  const n = G.players.length;
  let idx = (G.dealerIndex + 1) % n;
  let tries = 0;
  while((G.players[idx].folded || G.players[idx].allIn || G.players[idx].seated === false) && tries < n){
    idx = (idx + 1) % n; tries++;
  }
  G.currentPlayerIndex = idx;
  render();
  broadcastFullState();
  runHostTurn();
}

function showdownHost(){
  stopTurnTimer();
  clearAllGameTimers();
  G.stage = "showdown";
  G.busy = true;
  log(t("showdownHeader"), "hl");
  PokerAudio.play('showdown');
  const cont = G.players.filter(function(p){ return p.seated !== false && !p.folded; });
  cont.forEach(function(p){ p.revealCards = false; p._highlight = null; });
  render();
  broadcastFullState();
  let idx = 0;
  function next(){
    if(idx >= cont.length){ setTimeout(function(){ resolveHost(cont); }, 800); return; }
    const p = cont[idx];
    p.revealCards = true;
    render();
    broadcastFullState();
    PokerAudio.play('deal');
    log(t("reveals",{name:p.name,cards:p.holeCards.map(function(c){return c.display;}).join("  ")}), "showdown");
    idx++;
    setTimeout(next, 650);
  }
  next();
}

function resolveHost(cont){
  let totalPot = G.pot;
  try {
    cont.forEach(function(p){
      const r = PokerEval.bestHand(p.holeCards.concat(G.community));
      p._score = r.score; p._bestCards = r.cards;
      log(t("handResult",{
        name:p.name,
        cards:p.holeCards.map(function(c){return c.display;}).join(" "),
        hand:PokerEval.nameOf(r.score)
      }), "showdown");
    });
    const pots = calculateSidePots();
    const n = pots.length;
    let anyTie = false;
    pots.forEach(function(pot, i){
      if(!pot.eligible.length) return;
      let best = null, ws = [];
      pot.eligible.forEach(function(p){
        if(best === null || PokerEval.compare(p._score, best) > 0){ best = p._score; ws = [p]; }
        else if(PokerEval.compare(p._score, best) === 0) ws.push(p);
      });
      if(ws.length > 1) anyTie = true;
      const each = Math.floor(pot.amount / ws.length);
      const rem = pot.amount - each * ws.length;
      ws.forEach(function(w, k){ w.chips += each + (k === 0 ? rem : 0); });
      const lbl = n === 1 ? t("pot") : (i === 0 ? t("mainPot") : t("sidePot") + " " + i);
      log(t("winsPotSide",{
        name:ws.map(function(x){return x.name;}).join(", "),
        potLabel:lbl, amt:fmtNum(pot.amount), hand:PokerEval.nameOf(best)
      }), "win");
      if(!ws[0]._highlight && ws[0]._bestCards) ws[0]._highlight = new Set(ws[0]._bestCards);
    });
    if(anyTie) showTieDisplay();
    totalPot = pots.reduce(function(s,p){ return s + p.amount; }, 0);
  } catch(e){
    console.error('resolveHost error', e);
  } finally {
    G.pot = 0; G.busy = false; G._busySince = 0;
    PokerAudio.play('win');
    render();
    if(G.online.isHost) broadcastFullState();
    endHandHost(totalPot);
  }
}

function endHandHost(totalPot){
  clearAllGameTimers();
  const me = G.players[G.online.mySeat];
  if(me){
    const delta = me.chips - G.playerHandStartChips;
    PokerStorage.recordHand(delta, totalPot || 0);
    try {
      let result = '';
      if(me.holeCards && me.holeCards.length >= 2 && G.community && G.community.length >= 3){
        const r = PokerEval.bestHand(me.holeCards.concat(G.community));
        if(r && r.score) result = PokerEval.nameOf(r.score);
      }
      PokerStorage.addHandHistory({
        handNumber: G.handNumber,
        myCards: (G._currentHandMyCards || []).slice(),
        community: (G.community || []).map(function(c){ return c.suit + c.rank; }),
        result: result, delta: delta, pot: totalPot || 0
      });
    } catch(e){ console.warn('save hand history failed', e); }
  }
  refreshHistoryPanelsIfOpen();
  render();
  if(G.online.isHost) broadcastFullState();
  offerShowCards();
  beginNextHandCountdown(startNewHandHost);
}

function broadcastFullState(){
  if(!G.online.isHost) return;
  const state = {
    players: G.players.map(function(p){
      return {
        id: p.id, peerId: p.peerId, name: p.name,
        chips: p.chips, folded: p.folded, allIn: p.allIn,
        seated: p.seated !== false,
        currentBet: p.currentBet, holeCards: p.holeCards,
        lastAction: p.lastAction,
        position: p.position, positionKey: p.positionKey,
        revealCards: p.revealCards,
        _intentReveal: p._intentReveal || false,
        preflopOrder: p.preflopOrder, postflopOrder: p.postflopOrder,
        _highlight: p._highlight ? Array.from(p._highlight) : null
      };
    }),
    pot: G.pot, currentBet: G.currentBet, stage: G.stage,
    dealerIndex: G.dealerIndex, currentPlayerIndex: G.currentPlayerIndex,
    community: G.community, handNumber: G.handNumber,
    smallBlind: G.smallBlind, bigBlind: G.bigBlind,
    gameOver: G.gameOver,
    phase: G.online.started ? 'playing' : 'waiting',
    nextHandEndsAt: G._nextHandEndsAt || 0,
    turnEndsAt: G._turnEndsAt || 0
  };
  PokerOnline.sendFullState(state);
}

function applyFullState(state){
  if(!state || !state.players) return;
  const sig = buildStateSig(state);
  if(sig && sig === G._lastStateSig && G.players.length === state.players.length){
    syncCountdownFromState(state);
    return;
  }
  G._lastStateSig = sig;

  if(state.phase === 'playing' || (state.handNumber && state.handNumber > 0)){
    hideWaitingBar();
    G.online.started = true;
  }

  if(state.phase === 'waiting' || (!G.online.started && !state.handNumber)){
    G.stage = 'waiting';
    G.online.started = false;
    showWaitingBar();
    syncCountdownFromState(state);
    return;
  }

  const myId = PokerOnline.getMyId();
  const sameRoster =
    G.players.length === state.players.length &&
    G.players.every(function(p, i){
      return state.players[i] && state.players[i].peerId === p.peerId;
    });
  if(!sameRoster){
    const existingByPeer = {};
    G.players.forEach(function(p){ if(p.peerId) existingByPeer[p.peerId] = p; });
    G.players = state.players.map(function(p){
      const isSelf = p.peerId === myId;
      const existing = existingByPeer[p.peerId];
      if(existing){ existing.id = p.id; existing.name = p.name; existing.isHuman = isSelf; return existing; }
      return {
        id: p.id, peerId: p.peerId, name: p.name,
        emoji: isSelf ? PokerAvatars.HUMAN.emoji : '🎮',
        bg: isSelf ? PokerAvatars.HUMAN.bg : 'linear-gradient(135deg,#a855f7,#6d28d9)',
        isHuman: isSelf,
        chips: p.chips, seated: p.seated !== false,
        holeCards: [], folded:false, allIn:false, currentBet:0,
        totalContributed:0, needsToAct:false,
        position:"", positionKey:"", lastAction:"", styleKey:null,
        revealCards:false, _highlight:null, preflopOrder:0, postflopOrder:0
      };
    });
    G.online.mySeat = G.players.findIndex(function(p){ return p.peerId === myId; });
    G.totalPlayers = G.players.length;
    G.seatPositions = computeSeatPositions(ONLINE_MAX_SEATS);
    G.online.started = true;
    hideWaitingBar();
    if($("gameWalletPill")) $("gameWalletPill").innerHTML = '<span class="dot" style="background:#a855f7;"></span><span>' + G.players.length + (isEn() ? " players" : " 人联机") + '</span>';
    G._lastBoardSig = ''; G._lastHandSig = ''; G._lastActionSig = '';
  }
  if(state.handNumber !== G.handNumber){
    G._renderedCards = new WeakSet();
    G._lastBoardSig = ''; G._lastHandSig = ''; G._lastActionSig = '';
  }
  state.players.forEach(function(sp, i){
    if(!G.players[i]) return;
    const p = G.players[i];
    p.chips = sp.chips; p.folded = sp.folded; p.allIn = sp.allIn;
    p.seated = sp.seated !== false;
    p.currentBet = sp.currentBet;
    p.holeCards = normalizeCards(sp.holeCards);
    p.lastAction = sp.lastAction;
    p.position = sp.position; p.positionKey = sp.positionKey;
    p.revealCards = sp.revealCards;
    p._intentReveal = sp._intentReveal || false;
    p.preflopOrder = sp.preflopOrder; p.postflopOrder = sp.postflopOrder;
    if(sp._highlight) p._highlight = new Set(normalizeCards(sp._highlight));
    else p._highlight = null;
  });
  G.pot = state.pot; G.currentBet = state.currentBet; G.stage = state.stage;
  G.dealerIndex = state.dealerIndex; G.currentPlayerIndex = state.currentPlayerIndex;
  G.community = normalizeCards(state.community);
  G.handNumber = state.handNumber;
  G.smallBlind = state.smallBlind; G.bigBlind = state.bigBlind;
  G.gameOver = state.gameOver || false;
  const gh = $("gameHandLabel");
  if(gh) gh.textContent = t("handShortLabel", { n:G.handNumber });
  syncCountdownFromState(state);
  render();
  const meIdx = G.online.mySeat;
  if(G.currentPlayerIndex === meIdx && !G.gameOver && G.stage !== 'showdown'){
    const me = G.players[meIdx];
    if(me && me.seated !== false && !me.folded && !me.allIn){
      G._lastActionSig = "";
      showHumanControls();
      const timerKey = G.handNumber + ':' + G.currentPlayerIndex + ':' + G.stage;
      if(!G.turnTimer || G._timerKey !== timerKey){
        G._timerKey = timerKey;
        startTurnTimer(me);
      }
    } else { hideHumanActions(); }
  } else { hideHumanActions(); }
}

function syncCountdownFromState(state){
  if(state.nextHandEndsAt && state.nextHandEndsAt > Date.now()){
    G._nextHandEndsAt = state.nextHandEndsAt;
    showNextHandToast(state.nextHandEndsAt);
  } else {
    if(G._nextHandEndsAt){ G._nextHandEndsAt = 0; hideNextHandToast(); }
  }
  if(state.turnEndsAt && state.turnEndsAt > Date.now() && !G.turnTimer){
    const el = document.getElementById('turnTimer');
    if(el) el.classList.remove('hidden');
    if(G._turnTickTimer){ clearInterval(G._turnTickTimer); }
    const endAt = state.turnEndsAt;
    const update = function(){
      const left = Math.max(0, endAt - Date.now());
      const f = document.getElementById('timerFill');
      const txt = document.getElementById('timerText');
      if(f) f.style.width = (left / 30000 * 100) + '%';
      if(txt) txt.textContent = Math.ceil(left / 1000) + 's';
      if(left <= 0){
        clearInterval(G._turnTickTimer);
        G._turnTickTimer = null;
        const el2 = document.getElementById('turnTimer');
        if(el2) el2.classList.add('hidden');
      }
    };
    update();
    G._turnTickTimer = setInterval(update, 200);
  }
}

/* ================= 消息处理 ================= */
function handleOnlineMessage(msg){
  if(!msg || !msg.type) return;

  if(msg.type === 'chat'){
    const isSelf = msg.peerId === (window.PokerOnline ? PokerOnline.getMyId() : null);
    appendChat(msg.name || 'Player', msg.text || '', isSelf);
    showSeatBubble(msg.peerId, msg.text || '', true);
    return;
  }
  if(msg.type === 'show_cards'){
    const p = G.players.find(function(x){ return x.peerId === msg.peerId; });
    if(p){
      p.revealCards = true;
      if(msg.intent) p._intentReveal = true;
      render();
    }
    if(G.online.isHost) broadcastFullState();
    return;
  }

  if(G.online.isHost){
    switch(msg.type){
      case 'host_start_game': hostStartGame(msg.playerOrder, msg.players); break;
      case 'player_action': {
        const player = G.players.find(function(p){ return p.peerId === msg.playerId; });
        if(!player) return;
        if(G.players[G.currentPlayerIndex] !== player) return;
        clearHostTimeout();
        executeAction(player, msg.action);
        render();
        broadcastFullState();
        runHostTurn();
        break;
      }
      case 'sync_request': if(G.online.started) broadcastFullState(); break;
      case 'player_leave': {
        handlePlayerLeave(msg.peerId);
        if(G.online.started && G.stage !== 'showdown'){
          const alive = G.players.filter(function(x){ return x.seated !== false && !x.folded; });
          if(alive.length <= 1){
            const pot = G.pot;
            awardUncontestedPot();
            render();
            broadcastFullState();
            endHandHost(pot);
          } else {
            broadcastFullState();
            runHostTurn();
          }
        } else { broadcastFullState(); }
        break;
      }
      case 'became_host':
        break;
    }
    return;
  }

  switch(msg.type){
    case 'game_start': break;
    case 'full_state': applyFullState(msg.state); break;
    case 'player_leave': handlePlayerLeave(msg.peerId); break;
    case 'became_host': {
      G.online.isHost = true;
      if(window.PokerOnline && PokerOnline.becomeHost){
        try { PokerOnline.becomeHost(); } catch(e){}
      }
      if($("gameWalletPill")) $("gameWalletPill").innerHTML = '<span class="dot" style="background:#fbbf24;"></span><span>' + (isEn() ? "Host" : "房主") + '</span>';
      setTimeout(function(){ if(G.online.started) broadcastFullState(); }, 200);
      break;
    }
    case 'host_left': {
      const players = (window.PokerOnline && PokerOnline.getRoomPlayers) ? PokerOnline.getRoomPlayers() : {};
      const ids = Object.keys(players);
      if(ids.length === 0){
        appToast(isEn() ? "Room closed" : "房间已关闭", "error");
        G.online.active = false;
        resetSessionState(); resetTableDom(); hideWaitingBar();
        document.body.classList.remove('game-active');
        $("gameScreen").classList.add("hidden");
        $("lobbyScreen").classList.remove("hidden");
        showScreen("lobby");
        renderRoomLists();
      }
      break;
    }
    case 'room_full':
      appToast(isEn() ? "Room is full (max 7)" : "房间已满（最多 7 人）", "error");
      try { PokerOnline.leaveRoom(); } catch(e){}
      G.online.active = false;
      resetSessionState(); resetTableDom(); hideWaitingBar();
      document.body.classList.remove('game-active');
      $("gameScreen").classList.add("hidden");
      $("lobbyScreen").classList.remove("hidden");
      showScreen("lobby");
      break;
  }
}

/* ================= 座位位置 ================= */
function computeSeatPositions(n){
  if(G.isMobile && G.orientation === 'portrait') return computePortraitSeats(n);
  return computeLandscapeSeats(n);
}
function computeLandscapeSeats(n){
  const pos = [{ x:50, y:50 + 40 }];
  const ai = n - 1;
  if(ai === 0) return pos;
  const R = 40;
  const right = Math.ceil(ai / 2);
  const left = ai - right;
  if(right === 1){ pos.push({ x:50 + R, y:50 }); }
  else {
    for(let i = 0; i < right; i++){
      const tt = i / (right - 1);
      const d = -60 + tt * 120;
      const r = d * Math.PI / 180;
      pos.push({ x:50 + R*Math.cos(r), y:50 + R*Math.sin(r) });
    }
  }
  if(left === 1){ pos.push({ x:50 - R, y:50 }); }
  else if(left > 1){
    for(let i = 0; i < left; i++){
      const tt = i / (left - 1);
      const d = 120 + tt * 120;
      const r = d * Math.PI / 180;
      pos.push({ x:50 + R*Math.cos(r), y:50 + R*Math.sin(r) });
    }
  }
  return pos;
}
function computePortraitSeats(n){
  const pos = [{ x:50, y:86 }];
  if(n === 1) return pos;
  const others = n - 1;
  const cx = 50, cy = 40, rx = 38, ry = 30;
  for(let i = 0; i < others; i++){
    const tt = others === 1 ? 0.5 : (i / (others - 1));
    const angle = Math.PI + tt * Math.PI;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    pos.push({ x: x, y: y });
  }
  return pos;
}
function computeActionOrders(){
  const n = G.players.length; if(!n) return;
  let start = (n === 2) ? G.dealerIndex : (G.dealerIndex + 3) % n;
  for(let i = 0; i < n; i++) G.players[(start+i)%n].preflopOrder = i + 1;
  if(n === 2){
    G.players[(G.dealerIndex+1)%n].postflopOrder = 1;
    G.players[G.dealerIndex].postflopOrder = 2;
  } else {
    const s = (G.dealerIndex + 1) % n;
    for(let i = 0; i < n; i++) G.players[(s+i)%n].postflopOrder = i + 1;
  }
}

/* ================= 发牌动画 ================= */
function flyCard(from, to, delay){
  return new Promise(function(res){
    setTimeout(function(){
      if(!from || !to){ res(); return; }
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = 'flying-card';
      el.style.left = (a.left + a.width/2 - 12) + 'px';
      el.style.top = (a.top + a.height/2 - 17) + 'px';
      document.body.appendChild(el);
      void el.offsetWidth;
      const dx = (b.left + b.width/2) - (a.left + a.width/2);
      const dy = (b.top + b.height/2) - (a.top + a.height/2);
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.65)';
      el.style.opacity = '0';
      setTimeout(function(){ el.remove(); res(); }, 520);
    }, delay || 0);
  });
}
async function playDealAnimation(){
  const dealer = $("dealerSeat");
  const deck = $("shuffleDeck");
  if(!dealer) return;
  if(deck && !G.isMobile){
    deck.classList.add("shuffling");
    PokerAudio.play('deal');
    await sleep(560);
    deck.classList.remove("shuffling");
  } else if(G.isMobile){
    PokerAudio.play('deal');
    await sleep(200);
  }
  const proms = [];
  let idx = 0;
  for(let r = 0; r < 2; r++){
    for(let i = 0; i < G.players.length; i++){
      const p = G.players[i];
      if(p.folded) continue;
      const tgt = document.querySelector('.seat[data-pid="' + p.id + '"]');
      if(tgt) proms.push(flyCard(dealer, tgt, idx * (G.isMobile ? 40 : 60)));
      idx++;
    }
  }
  await Promise.all(proms);
  await sleep(100);
}

/* ================= AI 单机主流程 ================= */
async function startNewHandAi(){
  clearAllGameTimers();
  clearShowCardsTimer();
  if(G._nextHandTimer){ clearInterval(G._nextHandTimer); G._nextHandTimer = null; }
  if(G._nextHandToastTimer){ clearInterval(G._nextHandToastTimer); G._nextHandToastTimer = null; }
  hideNextHandToast();
  const showBtn = document.getElementById('showCardsBtn');
  if(showBtn) showBtn.classList.add('hidden');
  G.handNumber++; G.sessionHands++;
  G.pot = 0; G.community = [];
  G.currentBet = 0; G.lastRaiseAmount = G.bigBlind;
  G.stage = "preflop"; G.busy = false; G._busySince = 0;
  G._nextHandEndsAt = 0;
  G.deck = PokerDeck.create();
  PokerDeck.shuffle(G.deck);
  G._renderedCards = new WeakSet();
  G._lastBoardSig = ''; G._lastHandSig = ''; G._lastActionSig = '';
  stopTurnTimer();
  G.players.forEach(function(p){
    p.folded = p.chips <= 0; p.allIn = false; p.currentBet = 0;
    p.totalContributed = 0; p.needsToAct = false; p.lastAction = "";
    p.holeCards = []; p.revealCards = false; p._highlight = null; p._score = null;
    p._intentReveal = false;
  });
  G.playerHandStartChips = G.players[0].chips;
  assignPositions();
  computeActionOrders();
  const n = G.players.length;
  for(let r = 0; r < 2; r++){
    for(let i = 1; i <= n; i++){
      const idx = (G.dealerIndex + i) % n;
      const p = G.players[idx];
      if(!p.folded) p.holeCards.push(G.deck.pop());
    }
  }
  if(G.players[0]){
    G._currentHandMyCards = G.players[0].holeCards.map(function(c){ return c.suit + c.rank; });
  }
  clearLog();
  log(t("handNum", { n:G.handNumber }) + " · " + t("dealerIs", { name:G.players[G.dealerIndex].name }), "hl");
  log(t("blindsAre", { sb:G.smallBlind, bb:G.bigBlind }), "hl");
  const gh = $("gameHandLabel");
  if(gh) gh.textContent = t("handShortLabel", { n:G.handNumber });
  render();
  await playDealAnimation();
  postBlinds();
  render();
  startPreflopAi();
}
function startPreflopAi(){
  const n = G.players.length;
  G.players.forEach(function(p){ p.needsToAct = !p.folded && !p.allIn && p.chips > 0; });
  let idx = n === 2 ? G.dealerIndex : (G.dealerIndex + 3) % n;
  let tries = 0;
  while((G.players[idx].folded || G.players[idx].allIn) && tries < n){ idx = (idx + 1) % n; tries++; }
  G.currentPlayerIndex = idx;
  render();
  runTurnAi();
}
function assignPositions(){
  const n = G.players.length;
  const names = {
    2:["posBTNSB","posBB"], 3:["posBTN","posSB","posBB"],
    4:["posBTN","posSB","posBB","posUTG"],
    5:["posBTN","posSB","posBB","posUTG","posCO"],
    6:["posBTN","posSB","posBB","posUTG","posHJ","posCO"],
    7:["posBTN","posSB","posBB","posUTG","posUTG1","posHJ","posCO"]
  }[n] || ["posBTN","posSB","posBB","posUTG","posUTG1","posHJ","posCO"];
  for(let i = 0; i < n; i++){
    const idx = (G.dealerIndex + i) % n;
    G.players[idx].positionKey = names[i];
    G.players[idx].position = t(names[i]);
  }
}
function postBlinds(){
  const n = G.players.length;
  const sbIdx = n === 2 ? G.dealerIndex : (G.dealerIndex + 1) % n;
  const bbIdx = n === 2 ? (G.dealerIndex + 1) % n : (G.dealerIndex + 2) % n;
  const sbP = G.players[sbIdx], bbP = G.players[bbIdx];
  const sb = Math.min(G.smallBlind, sbP.chips);
  sbP.chips -= sb; sbP.currentBet = sb; sbP.totalContributed += sb; G.pot += sb;
  if(sbP.chips === 0) sbP.allIn = true;
  const bb = Math.min(G.bigBlind, bbP.chips);
  bbP.chips -= bb; bbP.currentBet = bb; bbP.totalContributed += bb; G.pot += bb;
  if(bbP.chips === 0) bbP.allIn = true;
  G.currentBet = bb; G.lastRaiseAmount = G.bigBlind;
  log(t("sbBet", { name:sbP.name, amt:sb, name2:bbP.name, amt2:bb }), "action");
}
function countActive(){
  return G.players.filter(function(p){ return p.seated !== false && !p.folded; }).length;
}
function findNextToAct(){
  const n = G.players.length;
  for(let k = 0; k < n; k++){
    const idx = (G.currentPlayerIndex + k) % n;
    const p = G.players[idx];
    if(p.seated !== false && !p.folded && !p.allIn && p.needsToAct && p.chips > 0){
      G.currentPlayerIndex = idx; return true;
    }
  }
  return false;
}
function myIndex(){
  if(G.online.active) return G.online.mySeat;
  return 0;
}

function runTurnAi(){
  if(G.gameOver) return;

  if(G.busy){
    const elapsed = G._busySince ? Date.now() - G._busySince : 0;
    if(elapsed > BUSY_TIMEOUT){
      console.warn('[AI] busy timeout, force reset');
      G.busy = false; G._busySince = 0;
      clearAiActionTimer();
    } else {
      if(!G._busyWatchdogTimer){
        G._busyWatchdogTimer = setTimeout(function(){
          G._busyWatchdogTimer = null;
          if(G.gameOver) return;
          runTurnAi();
        }, BUSY_WATCHDOG_INTERVAL);
      }
      return;
    }
  } else {
    G._busySince = 0;
    clearBusyWatchdog();
  }

  if(countActive() <= 1){
    const pot = G.pot;
    awardUncontestedPot();
    render();
    endHandAi(pot);
    return;
  }
  const notAllIn = G.players.filter(function(p){ return !p.folded && !p.allIn; });
  if(notAllIn.length === 0){ advanceStageAi(); return; }
  if(!findNextToAct()){ advanceStageAi(); return; }
  const p = G.players[G.currentPlayerIndex];

  if(!p || p.folded || p.allIn || !p.needsToAct || p.chips <= 0){
    advanceStageAi();
    return;
  }

  render();
  if(p.isHuman){
    showHumanControls();
    PokerAudio.play('turn');
    startTurnTimer(p);
    clearAiActionTimer();
  } else {
    stopTurnTimer();
    clearAiActionTimer();
    G.busy = true;
    G._busySince = Date.now();
    const curIdx = G.currentPlayerIndex;

    G._aiActionTimer = setTimeout(function(){
      G._aiActionTimer = null;
      if(G.gameOver) return;
      if(G.currentPlayerIndex !== curIdx) return;
      const cur = G.players[curIdx];
      if(!cur || cur.folded || cur.allIn || !cur.needsToAct) return;
      const toCall = Math.max(0, G.currentBet - cur.currentBet);
      const fallback = toCall > 0 ? { type: 'fold' } : { type: 'check' };
      console.warn('[AI] 5s timeout, auto-act:', cur.name, fallback.type);
      log(cur.name + (isEn() ? " timed out, auto-act" : " 超时自动行动"), "action");
      G.busy = false; G._busySince = 0;
      try { executeAction(cur, fallback); } catch(e){ console.error('[AI] fallback error', e); }
      render();
      runTurnAi();
    }, AI_ACTION_TIMEOUT);

    const ms = 800 + Math.random() * 2200;
    setTimeout(function(){
      if(G.currentPlayerIndex !== curIdx) return;
      if(G.gameOver) return;
      clearAiActionTimer();
      G.busy = false;
      G._busySince = 0;
      clearBusyWatchdog();

      let action = null;
      try {
        action = PokerAI.decide(p, G);
      } catch(e){
        console.warn('[AI] decide error', e);
      }
      if(!action || !action.type){
        const toCall = Math.max(0, G.currentBet - p.currentBet);
        action = toCall > 0 ? { type: 'fold' } : { type: 'check' };
      }
      try { executeAction(p, action); }
      catch(e){ console.error('[AI] execute error', e); }
      render();
      runTurnAi();
    }, ms);
  }
}

function advanceStageAi(){
  stopTurnTimer();
  clearAllGameTimers();
  G.busy = false; G._busySince = 0;

  if(countActive() <= 1){
    const pot = G.pot;
    awardUncontestedPot();
    render();
    endHandAi(pot);
    return;
  }

  const boardLen = G.community.length;

  if(boardLen >= 5){
    showdownAi();
    return;
  }

  G.players.forEach(function(p){ p.currentBet = 0; p.lastAction = ""; });
  G.currentBet = 0; G.lastRaiseAmount = G.bigBlind;

  if(boardLen === 0){
    G.stage = "flop";
    G.community.push(G.deck.pop(), G.deck.pop(), G.deck.pop());
    log(t("flopIs",{cards:G.community.map(function(c){return c.display;}).join("  ")}), "hl");
  } else if(boardLen === 3){
    G.stage = "turn";
    G.community.push(G.deck.pop());
    log(t("turnIs",{card:G.community[G.community.length-1].display}), "hl");
  } else if(boardLen === 4){
    G.stage = "river";
    G.community.push(G.deck.pop());
    log(t("riverIs",{card:G.community[G.community.length-1].display}), "hl");
  } else {
    showdownAi();
    return;
  }

  PokerAudio.play('deal');
  G.players.forEach(function(p){
    p.currentBet = 0; p.lastAction = "";
    p.needsToAct = !p.folded && !p.allIn && p.chips > 0;
  });
  G.currentBet = 0; G.lastRaiseAmount = G.bigBlind;
  const n = G.players.length;
  let idx = (G.dealerIndex + 1) % n;
  let tries = 0;
  while((G.players[idx].folded || G.players[idx].allIn || G.players[idx].seated === false) && tries < n){
    idx = (idx + 1) % n; tries++;
  }
  G.currentPlayerIndex = idx;
  render();
  runTurnAi();
}

function executeAction(player, action){
  if(!player || player.folded || player.allIn || player.seated === false) return;

  if(action.type === "fold"){
    player.folded = true;
    player.needsToAct = false;
    player.lastAction = t("actionFold");
    log(t("playerFolds", { name:player.name }), "action");
    PokerAudio.play('fold');
    return;
  }

  if(action.type === "check"){
    if(G.currentBet > player.currentBet){
      player.folded = true;
      player.needsToAct = false;
      player.lastAction = t("actionFold");
      log(t("playerFolds", { name:player.name }), "action");
      PokerAudio.play('fold');
      return;
    }
    player.needsToAct = false;
    player.lastAction = t("actionCheck");
    log(t("playerChecks", { name:player.name }), "action");
    PokerAudio.play('check');
    return;
  }

  if(action.type === "call"){
    const toCall = Math.min(player.chips, G.currentBet - player.currentBet);
    player.chips -= toCall;
    player.currentBet += toCall;
    player.totalContributed += toCall;
    G.pot += toCall;
    if(player.chips === 0) player.allIn = true;
    player.needsToAct = false;
    player.lastAction = toCall === 0 ? t("actionCheck") : (t("actionCall") + " " + fmtNum(toCall));
    log(toCall === 0 ? t("playerChecks",{name:player.name}) : t("playerCalls",{name:player.name,amt:fmtNum(toCall)}), "action");
    PokerAudio.play(toCall === 0 ? 'check' : 'call');
    return;
  }

  if(action.type === "raise"){
    const oldBet = G.currentBet;
    const max = player.chips + player.currentBet;
    const minTarget = oldBet === 0 ? G.bigBlind : oldBet * 2;
    let target;
    if(action.target != null && isFinite(action.target)){
      target = Math.min(action.target, max);
    } else if(G.currentBet === 0){
      target = Math.max(G.bigBlind, Math.floor(G.pot * 0.5));
    } else {
      const potT = G.currentBet + Math.floor(G.pot * 0.6);
      target = Math.min(max, Math.max(minTarget, potT));
    }

    if(target <= G.currentBet){
      const toCall = Math.min(player.chips, G.currentBet - player.currentBet);
      if(toCall > 0 && toCall <= player.chips){
        player.chips -= toCall;
        player.currentBet += toCall;
        player.totalContributed += toCall;
        G.pot += toCall;
        if(player.chips === 0) player.allIn = true;
        player.needsToAct = false;
        player.lastAction = t("actionCall") + " " + fmtNum(toCall);
        log(t("playerCalls",{name:player.name,amt:fmtNum(toCall)}), "action");
        PokerAudio.play('call');
      } else {
        player.folded = true;
        player.needsToAct = false;
        player.lastAction = t("actionFold");
        log(t("playerFolds", { name:player.name }), "action");
        PokerAudio.play('fold');
      }
      return;
    }

    const delta = target - player.currentBet;
    if(delta <= 0 || delta > player.chips){
      const toCall = Math.min(player.chips, G.currentBet - player.currentBet);
      if(toCall > 0){
        player.chips -= toCall;
        player.currentBet += toCall;
        player.totalContributed += toCall;
        G.pot += toCall;
        if(player.chips === 0) player.allIn = true;
        player.needsToAct = false;
        player.lastAction = t("actionCall") + " " + fmtNum(toCall);
        log(t("playerCalls",{name:player.name,amt:fmtNum(toCall)}), "action");
        PokerAudio.play('call');
      } else {
        player.needsToAct = false;
        player.lastAction = t("actionCheck");
        log(t("playerChecks", { name:player.name }), "action");
        PokerAudio.play('check');
      }
      return;
    }

    const wasAllIn = (player.chips === delta);
    player.chips -= delta;
    player.currentBet = target;
    player.totalContributed += delta;
    G.pot += delta;
    if(player.chips === 0) player.allIn = true;
    if(target - oldBet > G.lastRaiseAmount) G.lastRaiseAmount = target - oldBet;
    if(target > G.currentBet) G.currentBet = target;
    player.needsToAct = false;
    player.lastAction = (oldBet === 0 ? t("actionBet") : t("actionRaiseTo")) + " " + fmtNum(target);
    log(oldBet === 0 ? t("playerBets",{name:player.name,amt:fmtNum(target)}) : t("playerRaises",{name:player.name,amt:fmtNum(target)}), "action");
    PokerAudio.play(wasAllIn ? 'allin' : (oldBet === 0 ? 'bet' : 'raise'));
    G.players.forEach(function(p){
      if(p !== player && !p.folded && !p.allIn && p.chips > 0 && p.seated !== false) p.needsToAct = true;
    });
  }
}

function endHandAi(totalPot){
  stopTurnTimer();
  clearAllGameTimers();
  const alive = G.players.filter(function(p){ return p.seated !== false && !p.folded; });
  const w = alive[0];
  if(!w) return;
  const pot = G.pot;
  if(pot > 0){
    w.chips += pot;
    log(t("winsPot",{name:w.name,pot:fmtNum(pot)}), "win");
    PokerAudio.play('win');
  }
  G.pot = 0; G.stage = "showdown";
  const me = G.players[0];
  const delta = me.chips - G.playerHandStartChips;
  PokerStorage.recordHand(delta, (totalPot || pot));
  try {
    let result = '';
    if(me.holeCards && me.holeCards.length >= 2 && G.community && G.community.length >= 3){
      const r = PokerEval.bestHand(me.holeCards.concat(G.community));
      if(r && r.score) result = PokerEval.nameOf(r.score);
    }
    PokerStorage.addHandHistory({
      handNumber: G.handNumber,
      myCards: (G._currentHandMyCards || []).slice(),
      community: (G.community || []).map(function(c){ return c.suit + c.rank; }),
      result: result, delta: delta, pot: (totalPot || pot)
    });
  } catch(e){ console.warn('save hand history failed', e); }
  refreshHistoryPanelsIfOpen();
  render();
  if(me.chips <= 0){ setTimeout(showRebuy, 800); return; }
  offerShowCards();
  beginNextHandCountdown(startNewHandAi);
}

function calculateSidePots(){
  const contributors = G.players
    .filter(function(p){ return (p.totalContributed || 0) > 0; })
    .map(function(p){ return { player: p, amount: p.totalContributed, folded: p.folded }; });
  const pots = [];
  let guard = 0;
  while(contributors.some(function(x){ return x.amount > 0; }) && guard < 20){
    guard++;
    const active = contributors.filter(function(x){ return x.amount > 0; });
    if(!active.length) break;
    const minA = Math.min.apply(null, active.map(function(x){ return x.amount; }));
    let amt = 0;
    const eligible = [];
    active.forEach(function(x){
      amt += minA;
      x.amount -= minA;
      if(!x.folded) eligible.push(x.player);
    });
    pots.push({ amount: amt, eligible: eligible });
  }
  return pots;
}

function showdownAi(){
  stopTurnTimer();
  clearAllGameTimers();
  G.stage = "showdown";
  G.busy = true; G._busySince = Date.now();
  log(t("showdownHeader"), "hl");
  PokerAudio.play('showdown');
  const cont = G.players.filter(function(p){ return !p.folded; });
  cont.forEach(function(p){ p.revealCards = false; p._highlight = null; });
  render();
  let idx = 0;
  function next(){
    if(idx >= cont.length){ setTimeout(function(){ resolveAi(cont); }, 800); return; }
    const p = cont[idx];
    p.revealCards = true;
    render();
    PokerAudio.play('deal');
    log(t("reveals",{name:p.name,cards:p.holeCards.map(function(c){return c.display;}).join("  ")}), "showdown");
    idx++;
    setTimeout(next, 650);
  }
  next();
}

function resolveAi(cont){
  let totalPot = G.pot;
  try {
    cont.forEach(function(p){
      const r = PokerEval.bestHand(p.holeCards.concat(G.community));
      p._score = r.score; p._bestCards = r.cards;
      log(t("handResult",{
        name:p.name,
        cards:p.holeCards.map(function(c){return c.display;}).join(" "),
        hand:PokerEval.nameOf(r.score)
      }), "showdown");
    });
    const pots = calculateSidePots();
    const n = pots.length;
    let anyTie = false;
    pots.forEach(function(pot, i){
      if(!pot.eligible.length) return;
      let best = null, ws = [];
      pot.eligible.forEach(function(p){
        if(best === null || PokerEval.compare(p._score, best) > 0){ best = p._score; ws = [p]; }
        else if(PokerEval.compare(p._score, best) === 0) ws.push(p);
      });
      if(ws.length > 1) anyTie = true;
      const each = Math.floor(pot.amount / ws.length);
      const rem = pot.amount - each * ws.length;
      ws.forEach(function(w, k){ w.chips += each + (k === 0 ? rem : 0); });
      const lbl = n === 1 ? t("pot") : (i === 0 ? t("mainPot") : t("sidePot") + " " + i);
      log(t("winsPotSide",{
        name:ws.map(function(x){return x.name;}).join(", "),
        potLabel:lbl, amt:fmtNum(pot.amount), hand:PokerEval.nameOf(best)
      }), "win");
      if(!ws[0]._highlight && ws[0]._bestCards) ws[0]._highlight = new Set(ws[0]._bestCards);
    });
    if(anyTie) showTieDisplay();
    totalPot = pots.reduce(function(s,p){ return s + p.amount; }, 0);
  } catch(e){
    console.error('resolveAi error', e);
  } finally {
    G.pot = 0; G.busy = false; G._busySince = 0;
    PokerAudio.play('win');
    const me = G.players[0];
    const delta = me.chips - G.playerHandStartChips;
    PokerStorage.recordHand(delta, totalPot);
    try {
      let result = '';
      if(me.holeCards && me.holeCards.length >= 2 && G.community && G.community.length >= 3){
        const r = PokerEval.bestHand(me.holeCards.concat(G.community));
        if(r && r.score) result = PokerEval.nameOf(r.score);
      }
      PokerStorage.addHandHistory({
        handNumber: G.handNumber,
        myCards: (G._currentHandMyCards || []).slice(),
        community: (G.community || []).map(function(c){ return c.suit + c.rank; }),
        result: result, delta: delta, pot: totalPot
      });
    } catch(e){ console.warn('save hand history failed', e); }
    refreshHistoryPanelsIfOpen();
    render();
    if(me.chips <= 0){ setTimeout(showRebuy, 800); return; }
    offerShowCards();
    beginNextHandCountdown(startNewHandAi);
  }
}

function showTieDisplay(){
  const el = document.getElementById('tieDisplay');
  if(!el) return;
  el.textContent = isEn() ? "TIE" : "平局";
  el.classList.remove('hidden');
  setTimeout(function(){ el.classList.add('hidden'); }, 3500);
}

function offerShowCards(){
  const me = G.players[myIndex()];
  if(!me) return;
  if(!me.folded) return;
  if(!me.holeCards || me.holeCards.length < 2) return;
  if(!G.community || G.community.length === 0) return;
  const btn = document.getElementById('showCardsBtn');
  if(!btn) return;
  btn.classList.remove('hidden');
  btn.textContent = isEn() ? 'Show cards' : '秀牌';
  btn.onclick = function(){
    btn.classList.add('hidden');
    if(window.PokerAudio) PokerAudio.play('click');
    me.revealCards = true;
    me._intentReveal = true;
    render();
    if(G.online.active && window.PokerOnline){
      PokerOnline.sendShowCards({ peerId: PokerOnline.getMyId(), intent: true });
    }
  };
  if(G._showCardsTimer) clearTimeout(G._showCardsTimer);
  G._showCardsEndsAt = Date.now() + SHOW_CARDS_WINDOW;
  G._showCardsTimer = setTimeout(function(){
    btn.classList.add('hidden');
    G._showCardsTimer = null;
    G._showCardsEndsAt = 0;
  }, SHOW_CARDS_WINDOW);
}

function showRebuy(){
  stopTurnTimer();
  const lv = G._onlineLv || LEVELS.find(function(l){ return l.key === G.tableMode; }) || LEVELS[0];
  const minBuy = lv.buyMin;
  G._rebuyMultiplier = minBuy;

  const overlay = $("rebuyOverlay");
  overlay.classList.remove("hidden");
  updateRebuyMsg(lv);

  const row = document.querySelector('.rebuy-amount-row');
  if(row){
    row.innerHTML =
      '<button type="button" class="rebuy-amount-btn active" data-rebuy="' + minBuy + '">1×最低<br>(' + fmtNum(minBuy) + ')</button>' +
      '<button type="button" class="rebuy-amount-btn" data-rebuy="' + lv.buyMax + '">1×最高<br>(' + fmtNum(lv.buyMax) + ')</button>' +
      '<button type="button" class="rebuy-amount-btn" data-rebuy="' + (lv.buyMax * 2) + '">2×最高<br>(' + fmtNum(lv.buyMax * 2) + ')</button>';
    row.querySelectorAll('.rebuy-amount-btn').forEach(function(b){
      b.onclick = function(){
        G._rebuyMultiplier = parseInt(b.getAttribute('data-rebuy'), 10);
        row.querySelectorAll('.rebuy-amount-btn').forEach(function(x){
          x.classList.toggle('active', parseInt(x.getAttribute('data-rebuy'), 10) === G._rebuyMultiplier);
        });
        updateRebuyMsg(lv);
        if(window.PokerAudio) PokerAudio.play('click');
      };
    });
  }

  $("rebuyGameBtn").onclick = function(){
    let amount = G._rebuyMultiplier;
    if(amount < minBuy) amount = minBuy;
    $("rebuyOverlay").classList.add("hidden");
    const me = G.players[myIndex()];
    if(G.gameMode === 'ai'){
      let ai = PokerStorage.getAiChips();
      if(ai < amount){ PokerStorage.addAiChips(amount - ai + 5000); ai = PokerStorage.getAiChips(); }
      PokerStorage.setAiChips(ai - amount);
    } else if(G.gameMode === 'points'){
      let pts = PokerStorage.getPoints();
      if(pts < amount){ PokerStorage.addPoints(amount - pts + 10000); pts = PokerStorage.getPoints(); }
      PokerStorage.setPoints(pts - amount);
    } else if(G.gameMode === 'real'){
      if(PokerStorage.getRealChips() < amount){
        appToast(isEn() ? "Not enough chips. Please deposit BEM." : "对战场筹码不足，请充值 BEM", "error");
        return;
      }
      PokerStorage.setRealChips(PokerStorage.getRealChips() - amount);
    }
    me.chips = amount;
    G.sessionBuyIn += amount;
    PokerAudio.play('chip');
    rotateDealerAndStart(function(){
      if(G.gameMode === 'ai') startNewHandAi(); else startNewHandHost();
    });
  };
  $("leaveGameBtn").onclick = function(){
    $("rebuyOverlay").classList.add("hidden");
    backToLobby();
  };
}
function updateRebuyMsg(lv){
  const amt = G._rebuyMultiplier;
  const el = $("rebuyMsg");
  if(el) el.textContent = isEn()
    ? ("Out of chips. Rebuy " + fmtNum(amt) + " chips? (min " + fmtNum(lv.buyMin) + ")")
    : ("你的筹码用完了。补码 " + fmtNum(amt) + " 筹码？（最低 " + fmtNum(lv.buyMin) + "）");
}

function backToLobby(){
  stopTurnTimer();
  clearAllGameTimers();
  clearShowCardsTimer();
  if(G.online.active && G.online.isHost && G.online.started && window.PokerOnline.sendHostLeft){
    try { PokerOnline.sendHostLeft(); } catch(e){}
  }
  const me = G.players[myIndex()];
  if(me && G.sessionBuyIn > 0){
    const pnl = me.chips - G.sessionBuyIn;
    if(G.gameMode === 'ai') PokerStorage.addAiChips(me.chips);
    else if(G.gameMode === 'points') PokerStorage.addPoints(me.chips);
    else if(G.gameMode === 'real') PokerStorage.addRealChips(me.chips);
    PokerStorage.addSession({
      table: G.tableLabel, blinds: G.smallBlind + "/" + G.bigBlind,
      buyIn: G.sessionBuyIn, pnl: pnl, hands: G.sessionHands,
      status: 'left', mode: G.gameMode
    });
  }
  if(G.online.active){
    try { PokerOnline.leaveRoom(); } catch(e){}
    G.online.active = false;
  }
  resetSessionState();
  resetTableDom();
  hideWaitingBar();
  hideNextHandToast();
  clearAllBubbles();
  G.gameOver = true;
  document.body.classList.remove('game-active');
  $("gameScreen").classList.add("hidden");
  $("lobbyScreen").classList.remove("hidden");
  $("onlineLobby").classList.add("hidden");
  $("nextHandBtn").classList.add("hidden");
  $("showCardsBtn").classList.add("hidden");
  $("humanActions").innerHTML = "";
  $("raisePanel").classList.add("hidden");
  $("handCardsLarge").innerHTML = "";
  const fab = document.getElementById('chatFab');
  if(fab) fab.classList.add('hidden');
  const chatPanel = document.getElementById('chatPanel');
  if(chatPanel) chatPanel.classList.add('hidden');
  const mlogFab = document.getElementById('mobileLogFab');
  if(mlogFab) mlogFab.classList.add('hidden');
  const mlogPanel = document.getElementById('mobileLogPanel');
  if(mlogPanel) mlogPanel.classList.add('hidden');
  showScreen("lobby");
  renderRoomLists();
}

/* ================= 渲染 ================= */
function renderCardEl(card, mini, hl){
  const d = document.createElement("div");
  const isNew = !G._renderedCards.has(card);
  if(isNew) G._renderedCards.add(card);
  const cls = "face " + (card.red ? "red" : "black") + (hl ? " highlight" : "") + (isNew ? " card-new" : "");
  if(mini){
    d.className = "mini-card " + cls;
    d.innerHTML = '<div class="v">' + card.rank + '</div><div class="s">' + card.suit + '</div>';
  } else {
    d.className = "card " + (card.red ? "red" : "black") + (hl ? " highlight" : "") + (isNew ? " card-new" : "");
    d.innerHTML = '<div class="v">' + card.rank + '</div><div class="s">' + card.suit + '</div>';
  }
  return d;
}
function renderCardBackMini(){ const d = document.createElement("div"); d.className = "mini-card"; return d; }
function posCls(k){
  if(!k) return "";
  if(k === "posBTNSB" || k === "posBTN") return "btn";
  if(k === "posSB") return "sb";
  if(k === "posBB") return "bb";
  return "";
}

function render(){
  const container = $("seatsLayer");
  if(!container) return;
  if(G.online.active && G.stage === 'waiting'){
    renderWaitingTable(container);
    const bc = document.getElementById('boardCards'); if(bc) bc.innerHTML = '';
    const pm = document.getElementById('potMain'); if(pm) pm.textContent = '0';
    const pc = document.getElementById('potChips'); if(pc) pc.innerHTML = '';
    const ps = document.getElementById('potSideWrap'); if(ps) ps.classList.add('hidden');
    const handArea = document.getElementById('handCardsLarge'); if(handArea) handArea.innerHTML = '';
    const sl = document.getElementById('stageLabel');
    if(sl) sl.textContent = isEn() ? 'Waiting' : '等待中';
    return;
  }
  if(!G.players.length) return;
  for(let i = 0; i < G.players.length; i++){
    const p = G.players[i];
    const style = p.isHuman ? null : PokerAI.STYLES[p.styleKey];
    let seat = container.querySelector('.seat[data-pid="' + p.id + '"]');
    const pos = G.seatPositions[i] || { x:50, y:50 };
    if(!seat){
      seat = document.createElement("div");
      seat.className = "seat";
      seat.setAttribute("data-pid", p.id);
      container.appendChild(seat);
    }
    seat.style.left = pos.x + "%";
    seat.style.top = pos.y + "%";
    seat.classList.toggle("folded", (!!p.folded || p.seated === false) && !p.revealCards);
    seat.classList.toggle("reveal", !!p.revealCards);
    seat.classList.toggle("empty", p.seated === false);
    seat.classList.toggle("intent-reveal", !!p._intentReveal);

    const isCurrentTurn = (G.currentPlayerIndex === i)
      && !G.gameOver
      && !p.folded
      && G.stage !== "showdown"
      && G.stage !== "waiting"
      && p.seated !== false;
    const isMe = (i === myIndex());
    seat.classList.toggle("active", isCurrentTurn);
    seat.classList.toggle("me", isMe && !isCurrentTurn);

    let betInfo = "";
    if(p.seated === false){
      betInfo = isEn() ? "Left" : "已离桌";
    } else {
      if(p.currentBet > 0) betInfo = t("actionBet") + " " + fmtNum(p.currentBet);
      if(p.lastAction) betInfo += (betInfo ? " · " : "") + p.lastAction;
    }
    const posHtml = p.position ? '<span class="pos-badge ' + posCls(p.positionKey) + '">' + p.position + '</span>' : '';
    let styleHtml = '';
    if(G.online.active) styleHtml = '<span class="seat-style">P2P</span>';
    else if(style) styleHtml = '<span class="seat-style">' + t(style.name) + '</span>';
    else styleHtml = '<span class="seat-style">' + t("handShort") + '</span>';

    let avatarHtml;
    if(G.online.active){
      const initial = (p.name || 'P').charAt(0).toUpperCase();
      avatarHtml = '<div class="avatar-wrap" style="background:' + p.bg + '">' + initial + '</div>';
    } else {
      avatarHtml = '<div class="avatar-wrap" style="background:' + p.bg + '">' + p.emoji + '</div>';
    }

    const stackHtml = renderChipStackHtml(p.chips, {
      maxPerColumn: 6,
      maxColumns: 3,
      wrapClass: 'chip-stack-wrap seat-stack'
    });

    const metaSig = [p.name, p.chips, betInfo, p.position, styleHtml, avatarHtml, p.seated === false ? 1 : 0].join('|');
    if(seat.getAttribute('data-meta') !== metaSig){
      const oldBubble = seat.querySelector('.chat-bubble');
      const bubbleText = oldBubble ? oldBubble.textContent : null;
      const bubbleFade = oldBubble ? oldBubble.classList.contains('fade') : false;

      seat.setAttribute('data-meta', metaSig);
      seat.innerHTML =
        '<div class="seat-head">' + avatarHtml +
          '<div class="seat-meta">' +
            '<div class="seat-name">' + p.name + '</div>' +
            '<div>' + posHtml + styleHtml + '</div>' +
          '</div>' +
        '</div>' +
        stackHtml +
        '<div class="seat-chips">' + fmtNum(p.chips) + ' ' + t("chips") + '</div>' +
        '<div class="seat-bet">' + betInfo + '</div>' +
        '<div class="seat-cards"></div>';
      seat.removeAttribute('data-card-sig');

      if(bubbleText != null){
        const nb = document.createElement('div');
        nb.className = 'chat-bubble' + (bubbleFade ? ' fade' : '');
        nb.textContent = bubbleText;
        seat.appendChild(nb);
      }
    }

    const cards = seat.querySelector(".seat-cards");
    let nextCards = [];
    let showFace = false;
    if(p.seated === false || p.holeCards.length < 2){
      nextCards = [null, null];
    } else if(p.revealCards || i === myIndex()){
      nextCards = p.holeCards;
      showFace = true;
    } else {
      nextCards = [null, null];
    }
    const cardSig = (showFace ? 'F:' : 'B:') + cardsSig(nextCards);
    if(cards && seat.getAttribute('data-card-sig') !== cardSig){
      seat.setAttribute('data-card-sig', cardSig);
      cards.innerHTML = "";
      if(!showFace){
        const a = renderCardBackMini();
        const b = renderCardBackMini();
        if(p.seated === false || p.folded || p.holeCards.length < 2){
          a.style.opacity = ".2"; b.style.opacity = ".2";
        }
        cards.appendChild(a); cards.appendChild(b);
      } else {
        p.holeCards.forEach(function(c){
          cards.appendChild(renderCardEl(c, true, p._highlight && p._highlight.has(c)));
        });
      }
    }
  }
  Array.prototype.slice.call(container.querySelectorAll('.seat')).forEach(function(el){
    const pid = el.getAttribute('data-pid');
    const exists = G.players.some(function(p){ return String(p.id) === String(pid); });
    if(!exists) el.remove();
  });

  const bc = $("boardCards");
  if(bc){
    const hlSet = new Set();
    G.players.forEach(function(p){ if(p._highlight) p._highlight.forEach(function(c){ hlSet.add(c); }); });
    const boardSig = cardsSig(G.community) + '|' + G.community.map(function(c){ return hlSet.has(c) ? 1 : 0; }).join('');
    if(G._lastBoardSig !== boardSig){
      G._lastBoardSig = boardSig;
      bc.innerHTML = "";
      G.community.forEach(function(c){ bc.appendChild(renderCardEl(c, false, hlSet.has(c))); });
    }
  }

  renderHumanHand();

  const pots = calculateSidePots();
  const pm = $("potMain");
  if(pm) pm.textContent = fmtNum(G.pot);

  const psw = $("potSideWrap"), ps = $("potSide");
  if(psw && ps){
    if(pots.length > 1){
      const sideTotal = pots.slice(1).reduce(function(a, p){ return a + p.amount; }, 0);
      ps.textContent = fmtNum(sideTotal);
      psw.classList.remove("hidden");
    } else {
      psw.classList.add("hidden");
    }
  }

  const potChips = $("potChips");
  if(potChips){
    potChips.innerHTML = renderChipStackHtml(G.pot, {
      maxPerColumn: 8,
      maxColumns: 5,
      wrapClass: 'pot-chips-inner'
    });
  }

  const sl = $("stageLabel");
  if(sl) sl.textContent = t(STAGE_KEYS[G.stage] || "stagePreflop");
  updateHandInfo();

  const meIdx = myIndex();
  const meNow = G.players[meIdx];
  const myTurn = (G.currentPlayerIndex === meIdx)
    && meNow && meNow.seated !== false && !meNow.folded && !meNow.allIn
    && G.stage !== 'showdown' && G.stage !== 'waiting' && !G.gameOver;
  if(!myTurn){
    hideHumanActions();
  } else {
    const box = $("humanActions");
    if(box && box.childNodes.length === 0) showHumanControls();
  }
}

function renderWaitingTable(container){
  Array.prototype.slice.call(container.querySelectorAll('.seat')).forEach(function(el){ el.remove(); });
  Array.prototype.slice.call(container.querySelectorAll('.seat-empty-slot')).forEach(function(el){ el.remove(); });
  const myId = window.PokerOnline ? PokerOnline.getMyId() : null;
  const players = window.PokerOnline ? PokerOnline.getRoomPlayers() : {};
  const seatPositions = computeSeatPositions(ONLINE_MAX_SEATS);
  for(let seatIdx = 0; seatIdx < ONLINE_MAX_SEATS; seatIdx++){
    let p = null;
    for(const pid in players){
      if(players[pid].seat === seatIdx){ p = { peerId: pid, info: players[pid] }; break; }
    }
    const pos = seatPositions[seatIdx] || { x:50, y:50 };
    if(!p){
      const empty = document.createElement("div");
      empty.className = "seat empty seat-empty-slot";
      empty.setAttribute("data-seat", seatIdx);
      empty.style.left = pos.x + "%";
      empty.style.top = pos.y + "%";
      empty.innerHTML = '<div class="empty-label">' + (isEn() ? 'Empty' : '空位') + '</div>';
      container.appendChild(empty);
      continue;
    }
    const isSelf = p.peerId === myId;
    const seat = document.createElement("div");
    seat.className = "seat";
    seat.setAttribute("data-seat", seatIdx);
    seat.style.left = pos.x + "%";
    seat.style.top = pos.y + "%";
    if(isSelf) seat.classList.add("active");
    const initial = (p.info.name || 'P').charAt(0).toUpperCase();
    const bg = isSelf ? PokerAvatars.HUMAN.bg : 'linear-gradient(135deg,#a855f7,#6d28d9)';
    const readyBadge = p.info.ready
      ? '<div class="ready-badge">✓ ' + (isEn() ? 'Ready' : '已准备') + '</div>'
      : '<div class="not-ready-badge">' + (isEn() ? 'Waiting' : '未准备') + '</div>';
    seat.innerHTML =
      readyBadge +
      '<div class="seat-head">' +
        '<div class="avatar-wrap" style="background:' + bg + '">' + initial + '</div>' +
        '<div class="seat-meta">' +
          '<div class="seat-name">' + p.info.name + (isSelf ? (isEn() ? ' (you)' : ' (你)') : '') + '</div>' +
          '<div><span class="seat-style">P2P</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="seat-chips">10,000 ' + t("chips") + '</div>' +
      '<div class="seat-bet">' + (isEn() ? 'Seat ' : '座位 ') + (seatIdx + 1) + '</div>';
    container.appendChild(seat);
  }
}

function renderHumanHand(){
  const me = G.players[myIndex()];
  if(!me){ const c = $("handCardsLarge"); if(c) c.innerHTML = ""; return; }
  const c = $("handCardsLarge");
  if(!c) return;
  const bem = $("handBem");
  if(bem) bem.textContent = G.gameMode === 'real' ? "≈ " + toBem(me.chips) + " BEM" : fmtNum(me.chips) + (isEn() ? " chips" : " 筹码");
  let sig;
  if(!me || me.folded || me.holeCards.length < 2 || G.stage === 'waiting') sig = 'empty';
  else sig = cardsSig(me.holeCards) + '|' + (me._highlight ? cardsSig(Array.from(me._highlight)) : '');
  if(G._lastHandSig === sig) return;
  G._lastHandSig = sig;
  c.innerHTML = "";
  if(sig === 'empty'){
    const a = document.createElement("div"); a.className = "card"; a.style.opacity = ".2";
    const b = document.createElement("div"); b.className = "card"; b.style.opacity = ".2";
    c.appendChild(a); c.appendChild(b);
    return;
  }
  me.holeCards.forEach(function(card){
    const d = document.createElement("div");
    d.className = "card " + (card.red ? "red" : "black") + (me._highlight && me._highlight.has(card) ? " highlight" : "");
    d.innerHTML = '<div class="v">' + card.rank + '</div><div class="s">' + card.suit + '</div>';
    c.appendChild(d);
  });
}

function updateHandInfo(){
  const el = $("handInfo");
  if(!el) return;
  if(!G.players.length){ el.innerHTML = ""; return; }
  const me = G.players[myIndex()];
  if(!me) return;
  const toCall = Math.max(0, G.currentBet - (me.currentBet || 0));
  el.innerHTML =
    '<div class="row"><span>' + t("infoHand") + '</span><strong>#' + G.handNumber + '</strong></div>' +
    '<div class="row"><span>' + t("infoStage") + '</span><strong>' + t(STAGE_KEYS[G.stage] || "stagePreflop") + '</strong></div>' +
    '<div class="row"><span>' + t("infoPot") + '</span><strong>' + fmtNum(G.pot) + '</strong></div>' +
    '<div class="row"><span>' + t("infoYourBet") + '</span><strong>' + fmtNum(me.currentBet || 0) + '</strong></div>' +
    '<div class="row"><span>' + t("infoToCall") + '</span><strong>' + fmtNum(toCall) + '</strong></div>';
}

function showHumanControls(){
  const me = G.players[myIndex()];
  if(!me) return;
  const box = $("humanActions");
  const panel = $("raisePanel");
  if(!box || !panel) return;
  if(G.stage === 'waiting' || me.seated === false || me.folded || me.allIn || me.chips <= 0 || G.currentPlayerIndex !== myIndex()){
    hideHumanActions();
    return;
  }
  const sig = buildActionSig();
  const raiseOpen = !panel.classList.contains("hidden");
  if(raiseOpen) return;
  if(G._lastActionSig === sig && box.childNodes.length) return;
  G._lastActionSig = sig;
  box.innerHTML = "";
  const toCall = Math.max(0, G.currentBet - me.currentBet);
  const canCheck = toCall === 0;
  const foldBtn = document.createElement("button");
  foldBtn.className = "danger";
  foldBtn.textContent = t("actionFold");
  foldBtn.onclick = function(){ doHumanAction({ type:"fold" }); };
  box.appendChild(foldBtn);
  const callBtn = document.createElement("button");
  callBtn.textContent = canCheck ? t("actionCheck") : (t("actionCall") + " " + fmtNum(Math.min(me.chips, toCall)));
  callBtn.onclick = function(){ doHumanAction({ type:"call" }); };
  box.appendChild(callBtn);
  if(me.chips > toCall){
    const raiseBtn = document.createElement("button");
    raiseBtn.textContent = canCheck ? t("actionBetMenu") : t("actionRaise");
    raiseBtn.onclick = openRaisePanel;
    box.appendChild(raiseBtn);
  }

  setTimeout(function(){
    const sr = document.querySelector('.side-right');
    if(sr && sr.scrollHeight > sr.clientHeight){
      try { sr.scrollTo({ top: sr.scrollHeight, behavior: 'smooth' }); }
      catch(e){ sr.scrollTop = sr.scrollHeight; }
    }
  }, 120);
}

function openRaisePanel(){
  const me = G.players[myIndex()];
  const panel = $("raisePanel");
  const oldBet = G.currentBet;
  const max = me.chips + me.currentBet;
  let minT;
  if(oldBet === 0){ minT = G.bigBlind; }
  else { minT = oldBet * 2; }
  if(minT > max) minT = max;
  if(max <= oldBet) return;
  G.raiseMin = minT; G.raiseMax = max;
  const sl = $("raiseSlider"); if(sl) sl.value = 0;
  const inp = $("raiseInput");
  if(inp){ inp.min = minT; inp.max = max; inp.value = minT; }
  const a = $("raiseMinLabel"), b = $("raiseMaxLabel");
  if(a) a.textContent = fmtNum(minT);
  if(b) b.textContent = fmtNum(max);
  updateRaiseAmount();
  panel.classList.remove("hidden");
  if(window.PokerAudio) PokerAudio.play('click');

  setTimeout(function(){
    const panel2 = document.getElementById('raisePanel');
    if(panel2){
      try { panel2.scrollIntoView({ block: 'end', behavior: 'smooth' }); }
      catch(e){ panel2.scrollIntoView(false); }
    }
  }, 80);
}

function updateRaiseAmount(){
  const sl = $("raiseSlider"), d = $("raiseAmountValue"), inp = $("raiseInput");
  if(!sl || !d) return;
  const pct = parseInt(sl.value, 10) / 1000;
  const val = Math.round(G.raiseMin + (G.raiseMax - G.raiseMin) * pct);
  d.textContent = fmtNum(val);
  if(inp && document.activeElement !== inp) inp.value = val;
}

function bindRaiseInputEvents(){
  const inp = $("raiseInput"), sl = $("raiseSlider"), d = $("raiseAmountValue");
  if(inp){
    inp.addEventListener("input", function(){
      let v = parseInt(inp.value, 10);
      if(isNaN(v)) v = G.raiseMin;
      v = Math.max(G.raiseMin, Math.min(G.raiseMax, v));
      const range = G.raiseMax - G.raiseMin;
      const pct = range <= 0 ? 1000 : Math.round((v - G.raiseMin) / range * 1000);
      if(sl) sl.value = pct;
      if(d) d.textContent = fmtNum(v);
    });
    inp.addEventListener("blur", function(){
      let v = parseInt(inp.value, 10);
      if(isNaN(v)) v = G.raiseMin;
      v = Math.max(G.raiseMin, Math.min(G.raiseMax, v));
      inp.value = v;
    });
  }
  const minus = $("raiseMinusBtn"), plus = $("raisePlusBtn");
  if(minus) minus.onclick = function(){
    const cur = parseInt(inp.value, 10) || G.raiseMin;
    const step = Math.max(1, Math.round((G.raiseMax - G.raiseMin) / 20));
    const v = Math.max(G.raiseMin, cur - step);
    inp.value = v;
    inp.dispatchEvent(new Event('input'));
  };
  if(plus) plus.onclick = function(){
    const cur = parseInt(inp.value, 10) || G.raiseMin;
    const step = Math.max(1, Math.round((G.raiseMax - G.raiseMin) / 20));
    const v = Math.min(G.raiseMax, cur + step);
    inp.value = v;
    inp.dispatchEvent(new Event('input'));
  };
}

function applyRaisePreset(preset){
  const me = G.players[myIndex()];
  if(!me) return;
  const panel = $("raisePanel");
  if(panel && panel.classList.contains("hidden")){
    openRaisePanel();
    if(panel.classList.contains("hidden")) return;
  }
  const oldBet = G.currentBet;
  const toCall = Math.max(0, oldBet - (me.currentBet || 0));
  const potAfter = G.pot + toCall;
  const max = G.raiseMax;
  const minT = G.raiseMin;
  const unit = oldBet === 0 ? G.bigBlind : oldBet;
  let target;

  if(preset === 'allin'){
    target = max;
  } else if(preset === 'twoX' || preset === 'threeX' || preset === 'fourX'){
    const mult = preset === 'twoX' ? 2 : (preset === 'threeX' ? 3 : 4);
    if(oldBet === 0){
      target = G.bigBlind * mult;
    } else {
      target = oldBet * mult;
    }
    if(target < minT) target = minT;
    if(target > max) target = max;
  } else {
    let ratio;
    switch(preset){
      case 'quarter': ratio = 0.25; break;
      case 'third': ratio = 1/3; break;
      case 'half': ratio = 0.5; break;
      case 'twoThird': ratio = 2/3; break;
      case 'threeQuarter': ratio = 0.75; break;
      case 'pot': ratio = 1.0; break;
      default: ratio = 0.5;
    }
    const extra = Math.max(unit, Math.floor(potAfter * ratio));
    target = oldBet === 0 ? extra : (oldBet + extra);
    if(target < minT) target = minT;
    if(target > max) target = max;
  }
  const range = max - minT;
  const pct = range <= 0 ? 1 : (target - minT) / range;
  const sl = $("raiseSlider");
  if(sl){ sl.value = Math.round(pct * 1000); updateRaiseAmount(); }
  const d = $("raiseAmountValue");
  if(d) d.textContent = fmtNum(target);
  const inp = $("raiseInput");
  if(inp) inp.value = target;
  if(window.PokerAudio) PokerAudio.play('click');
}

function doHumanAction(action){
  const me = G.players[myIndex()];
  if(!me || me.folded || me.allIn || me.seated === false) return;
  if(G.stage === 'waiting') return;
  if(G.currentPlayerIndex !== myIndex()) return;
  stopTurnTimer();
  clearAllGameTimers();
  hideHumanActions();
  playActionSound(action);
  if(G.online.active && !G.online.isHost){
    PokerOnline.sendPlayerAction({ playerId: PokerOnline.getMyId(), action: action });
    return;
  }
  executeAction(me, action);
  render();
  if(G.online.active && G.online.isHost){
    broadcastFullState();
    runHostTurn();
  } else {
    runTurnAi();
  }
}

function startTurnTimer(player){
  if(!player || !player.isHuman) return;
  if(G.turnTimer) return;
  G.turnTimeLeft = 30;
  updateTimerUI();
  const tt = $("turnTimer"); if(tt) tt.classList.remove("hidden");
  G.turnTimer = setInterval(function(){
    G.turnTimeLeft -= 0.1;
    if(G.turnTimeLeft <= 0){
      stopTurnTimer();
      const me = G.players[myIndex()];
      if(me && !me.folded && !me.allIn && me.seated !== false){
        log(t("timeoutFold", { name:me.name }), "action");
        doHumanAction({ type:"fold" });
      }
      return;
    }
    const secLeft = Math.ceil(G.turnTimeLeft);
    if(secLeft <= 5 && secLeft > 0 && secLeft !== G._lastTickSecond){
      G._lastTickSecond = secLeft;
      if(window.PokerAudio) PokerAudio.play('tick');
    }
    updateTimerUI();
  }, 100);
}
function stopTurnTimer(){
  if(G.turnTimer){ clearInterval(G.turnTimer); G.turnTimer = null; }
  if(G._turnTickTimer){ clearInterval(G._turnTickTimer); G._turnTickTimer = null; }
  G._timerKey = null; G._lastTickSecond = 0;
  const tt = $("turnTimer"); if(tt) tt.classList.add('hidden');
}
function updateTimerUI(){
  const f = $("timerFill"), t2 = $("timerText");
  if(!f || !t2) return;
  const pct = Math.max(0, G.turnTimeLeft / 30) * 100;
  f.style.width = pct + "%";
  t2.textContent = Math.ceil(Math.max(0, G.turnTimeLeft)) + "s";
  if(G.turnTimeLeft <= 5){ f.classList.add("warn"); t2.classList.add("warn"); }
  else { f.classList.remove("warn"); t2.classList.remove("warn"); }
}

/* ================= 聊天 & 表情 ================= */
function appendChat(name, text, self){
  const el = document.getElementById('chatMessages');
  if(!el) return;
  const div = document.createElement('div');
  div.className = 'chat-msg' + (self ? ' self' : '');
  div.innerHTML = '<span class="chat-name">' + escapeHtml(name) + '</span><span class="chat-text">' + escapeHtml(text) + '</span>';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  while(el.childNodes.length > 50) el.removeChild(el.firstChild);
}

function showSeatBubble(peerIdOrSeatId, text, usePeerId){
  if(!text) return;
  const found = usePeerId
    ? G.players.findIndex(function(p){ return p.peerId === peerIdOrSeatId; })
    : G.players.findIndex(function(p){ return String(p.id) === String(peerIdOrSeatId); });
  if(found < 0) return;
  const p = G.players[found];
  const seat = document.querySelector('.seat[data-pid="' + p.id + '"]');
  if(!seat) return;

  const old = seat.querySelector('.chat-bubble');
  if(old) old.remove();

  let display = String(text);
  if(display.length > 24) display = display.slice(0, 24) + '…';

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = display;
  seat.appendChild(bubble);

  const fadeTimer = setTimeout(function(){ bubble.classList.add('fade'); }, 1600);
  const removeTimer = setTimeout(function(){
    if(bubble.parentNode) bubble.remove();
  }, 2000);

  bubble._fadeTimer = fadeTimer;
  bubble._removeTimer = removeTimer;
}

function clearAllBubbles(){
  document.querySelectorAll('.chat-bubble').forEach(function(b){
    if(b._fadeTimer) clearTimeout(b._fadeTimer);
    if(b._removeTimer) clearTimeout(b._removeTimer);
    b.remove();
  });
}

function initChat(){
  const fab = document.getElementById('chatFab');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatCloseBtn');
  const sendBtn = document.getElementById('chatSendBtn');
  const input = document.getElementById('chatInput');
  const quick = document.getElementById('chatQuick');

  if(fab) fab.onclick = function(){
    panel.classList.toggle('hidden');
    if(window.PokerAudio) PokerAudio.play('click');
  };
  if(closeBtn) closeBtn.onclick = function(){ panel.classList.add('hidden'); };

  function doSend(text){
    text = (text || '').trim();
    if(!text) return;
    if(text.length > 80) text = text.slice(0, 80);
    const me = G.players[myIndex()];
    const myName = (me && me.name) || 'Me';
    appendChat(myName, text, true);
    if(G.online.active && window.PokerOnline){
      showSeatBubble(PokerOnline.getMyId(), text, true);
      PokerOnline.sendChat({ peerId: PokerOnline.getMyId(), name: myName, text: text });
    } else if(me){
      showSeatBubble(me.id, text, false);
    }
    if(input) input.value = '';
  }

  if(sendBtn) sendBtn.onclick = function(){ doSend(input.value); };
  if(input) input.addEventListener('keydown', function(e){
    if(e.key === 'Enter'){ e.preventDefault(); doSend(input.value); }
  });
  if(quick) quick.addEventListener('click', function(e){
    const b = e.target.closest('button[data-quick]');
    if(!b) return;
    const raw = b.getAttribute('data-quick');
    const text = raw && raw.indexOf('quick') === 0 ? t(raw) : raw;
    doSend(text);
  });

  const langSel = document.getElementById('langSelect');
  if(langSel && !langSel.__chatBound){
    langSel.__chatBound = true;
    langSel.addEventListener('change', function(){
      if(input) input.placeholder = t('chatPlaceholder');
    });
  }
  if(input) input.placeholder = t('chatPlaceholder');

  document.addEventListener('pointerdown', function(e){
    const tgt = e.target;
    if(tgt && tgt.classList && tgt.classList.contains('chat-close')){
      const p = document.getElementById('chatPanel');
      if(p) p.classList.add('hidden');
      e.preventDefault();
      e.stopPropagation();
      if(window.PokerAudio) PokerAudio.play('click');
    }
  }, true);

  document.addEventListener('pointerdown', function(e){
    const p = document.getElementById('chatPanel');
    if(!p || p.classList.contains('hidden')) return;
    const f = document.getElementById('chatFab');
    if(f && f.contains(e.target)) return;
    if(p.contains(e.target)) return;
    p.classList.add('hidden');
  }, true);

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      const p = document.getElementById('chatPanel');
      if(p) p.classList.add('hidden');
    }
  });
}

/* ================= 局内历史 ================= */
function renderHistoryList(list){
  if(!list.length){
    return '<div class="ingame-history-empty">' + (isEn() ? 'No hands yet' : '还没有记录') + '</div>';
  }
  return list.map(function(rec){
    const myCardsHtml = (rec.myCards || []).map(function(s){
      const red = s.indexOf('♥') >= 0 || s.indexOf('♦') >= 0;
      return '<span class="mini-card-inline ' + (red ? 'red' : 'black') + '">' + s + '</span>';
    }).join('');
    const commHtml = (rec.community || []).map(function(s){
      const red = s.indexOf('♥') >= 0 || s.indexOf('♦') >= 0;
      return '<span class="mini-card-inline ' + (red ? 'red' : 'black') + '">' + s + '</span>';
    }).join('');
    const deltaCls = rec.delta >= 0 ? 'pos' : 'neg';
    const deltaText = (rec.delta >= 0 ? '+' : '') + fmtNum(rec.delta);
    return '<div class="ingame-history-item">' +
      '<div class="ihi-row"><b>#' + rec.handNumber + '</b><span class="ihi-result ' + deltaCls + '">' + deltaText + '</span></div>' +
      '<div class="ihi-row"><span class="ihi-label">' + (isEn()?'You':'你') + '</span>' + myCardsHtml + '</div>' +
      (commHtml ? '<div class="ihi-row"><span class="ihi-label">' + (isEn()?'Board':'公共') + '</span>' + commHtml + '</div>' : '') +
      (rec.result ? '<div class="ihi-row"><span class="ihi-label">' + (isEn()?'Hand':'成牌') + '</span><span>' + rec.result + '</span></div>' : '') +
      '</div>';
  }).join('');
}

function refreshHistoryPanelsIfOpen(){
  const list = PokerStorage.getHandHistory ? PokerStorage.getHandHistory() : [];
  const html = renderHistoryList(list);
  const el1 = document.getElementById('inGameHistory');
  const body1 = document.getElementById('inGameHistoryBody');
  if(el1 && body1 && !el1.classList.contains('hidden')){
    body1.innerHTML = html;
  }
  const el2 = document.getElementById('mobileLogPanel');
  const mBody = document.getElementById('mobileLogHistoryBody');
  if(el2 && mBody && !el2.classList.contains('hidden')){
    mBody.innerHTML = html;
  }
}

function openInGameHistory(){
  const el = document.getElementById('inGameHistory');
  const body = document.getElementById('inGameHistoryBody');
  const mobileBody = document.getElementById('mobileLogHistoryBody');
  const list = PokerStorage.getHandHistory ? PokerStorage.getHandHistory() : [];
  const html = renderHistoryList(list);
  if(el && body){
    body.innerHTML = html;
    el.classList.remove('hidden');
  }
  if(mobileBody){
    mobileBody.innerHTML = html;
  }
  if(window.PokerAudio) PokerAudio.play('click');
}
function closeInGameHistory(){
  const el = document.getElementById('inGameHistory');
  if(el) el.classList.add('hidden');
}

/* ================= 初始化 ================= */
document.addEventListener("DOMContentLoaded", function(){
  applyDeviceClass();
  let resizeTimer = null;
  function onResizeOrOrientation(){
    if(resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
      applyDeviceClass();
      if(!$("gameScreen").classList.contains("hidden") && G.players.length){
        G.seatPositions = computeSeatPositions(G.players.length);
        render();
      }
    }, 180);
  }
  window.addEventListener("resize", onResizeOrOrientation);
  window.addEventListener("orientationchange", onResizeOrOrientation);
  if(window.matchMedia){
    try { window.matchMedia("(orientation: portrait)").addEventListener("change", onResizeOrOrientation); } catch(e){}
  }

  if(PokerStorage.ensureInitialPoints) PokerStorage.ensureInitialPoints();

  const saved = (function(){
    try { return localStorage.getItem('neon_holdem_lang') || 'zh'; } catch(e){ return 'zh'; }
  })();
  PokerI18n.setLang(saved);
  const ls = $("langSelect"); if(ls) ls.value = saved;
  if(ls) ls.addEventListener("change", function(){
    PokerI18n.setLang(this.value);
    try { localStorage.setItem('neon_holdem_lang', this.value); } catch(e){}
    PokerI18n.apply(document);
    document.querySelectorAll('[data-i18n-ph]').forEach(function(el){
      el.placeholder = PokerI18n.t(el.getAttribute('data-i18n-ph'));
    });
    renderLobby();
    renderNumbers();
    if(G.players.length && !$("gameScreen").classList.contains("hidden")){
      G._lastBoardSig = ''; G._lastHandSig = '';
      render();
      updateHandInfo();
    }
  });

  document.querySelectorAll(".nav-link").forEach(function(a){
    a.addEventListener("click", function(){
      if(window.PokerAudio) PokerAudio.play('click');
      showScreen(a.getAttribute("data-nav"));
    });
  });
  document.querySelectorAll(".mode-tab").forEach(function(tab){
    tab.addEventListener("click", function(){
      if(window.PokerAudio) PokerAudio.play('click');
      document.querySelectorAll(".mode-tab").forEach(function(x){ x.classList.remove("active"); });
      tab.classList.add("active");
      const mode = tab.getAttribute("data-mode");
      ["aiSection","pointsSection","realSection"].forEach(function(id){
        const el = $(id); if(el) el.classList.add("hidden");
      });
      if(mode === "ai") $("aiSection").classList.remove("hidden");
      else if(mode === "points") $("pointsSection").classList.remove("hidden");
      else { $("realSection").classList.remove("hidden"); if(window.PokerWallet) PokerWallet.updateUI(); }
      renderRoomLists();
    });
  });
  document.querySelectorAll(".seats-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      if(window.PokerAudio) PokerAudio.play('click');
      document.querySelectorAll(".seats-btn").forEach(function(x){ x.classList.remove("active"); });
      btn.classList.add("active");
      G.aiSeats = parseInt(btn.getAttribute("data-seats"), 10);
      renderTableGrid("aiTableGrid", "ai");
    });
  });

  if(window.PokerOnline){
    PokerOnline.init().then(function(){
      PokerOnline.setMessageCallback(handleOnlineMessage);
      PokerOnline.setPlayersCallback(function(){
        updateWaitingBar();
        if(G.online.active && (G.stage === 'waiting' || !G.online.started)){
          syncWaitingSeatsFromRoom();
        }
      });
      PokerOnline.setRoomsCallback(function(){ renderRoomLists(); });
      renderLobby();
    }).catch(function(err){
      console.warn('Supabase init failed', err);
      renderLobby();
    });
  } else { renderLobby(); }

  const qs = $("quickAiBtn");
  if(qs) qs.onclick = function(){ if(window.PokerAudio) PokerAudio.play('click'); openAiLevel(LEVELS[0]); };
  const aiRb = $("aiRebuyBtn");
  if(aiRb) aiRb.onclick = function(){
    if(window.PokerAudio) PokerAudio.play('chip');
    const amt = parseInt($("aiRebuyAmount").value, 10);
    PokerStorage.addAiChips(amt);
    refreshBalanceUI();
  };
  const prb = $("pointsRebuyBtn");
  if(prb) prb.onclick = function(){
    if(window.PokerAudio) PokerAudio.play('chip');
    const amt = parseInt($("pointsRebuyAmount").value, 10);
    PokerStorage.addPoints(amt);
    refreshBalanceUI();
  };
  const qp = $("quickPointsBtn");
  if(qp) qp.onclick = function(){
    if(window.PokerAudio) PokerAudio.play('click');
    document.querySelector('.mode-tab[data-mode="points"]').click();
  };
  const sn = $("saveNicknameBtn");
  if(sn) sn.onclick = function(){
    if(window.PokerAudio) PokerAudio.play('click');
    const v = $("nicknameInput").value.trim();
    if(!v){ appToast(isEn() ? "Enter a nickname" : "请输入昵称", "error"); return; }
    PokerStorage.setNickname(v);
    appToast(isEn() ? ("Saved: " + v) : ("已保存：" + v), "success");
  };
  const cw = $("connectWalletBtn");
  const rc = $("realConnectBtn");
  const doConnect = async function(){
    if(window.PokerAudio) PokerAudio.play('click');
    try {
      const res = await PokerWallet.connect();
      if(res){ $("walletOverlay").classList.add("hidden"); refreshBalanceUI(); }
      else { appToast(isEn() ? "Connect failed" : "连接失败", "error"); }
    } catch(e){ console.error(e); appToast(isEn() ? "Connect failed" : "连接失败", "error"); }
  };
  if(cw) cw.onclick = doConnect;
  if(rc) rc.onclick = doConnect;

  const db = $("depositBtn");
  if(db) db.onclick = async function(){
    if(!PokerWallet.isConnected()){ appToast(isEn() ? "Connect wallet first" : "请先连接钱包", "error"); return; }
    const amt = parseFloat($("depositAmount").value);
    if(!amt || amt <= 0){ appToast(isEn() ? "Enter an amount" : "请输入充值数量", "error"); return; }
    if(amt < MIN_DEPOSIT_BEM){
      appToast(isEn() ? ("Minimum " + MIN_DEPOSIT_BEM + " BEM") : ("最低充值 " + MIN_DEPOSIT_BEM + " BEM"), "error");
      return;
    }
    try {
      const res = await PokerWallet.depositBem(amt);
      if(res && res.netChips > 0){
        PokerStorage.setRealChips(PokerStorage.getRealChips() + res.netChips);
        refreshBalanceUI();
        $("depositAmount").value = "";
        appToast(isEn() ? ("Deposited +" + res.netChips.toLocaleString()) : ("充值成功 +" + res.netChips.toLocaleString()), "success");
      }
    } catch(err){
      console.error('[deposit]', err);
      const msg = err && (err.reason || err.shortMessage || err.message) ? (err.reason || err.shortMessage || err.message) : String(err);
      appToast((isEn() ? "Deposit failed: " : "充值失败：") + msg, "error");
    }
  };

  const wd = $("withdrawBtn");
  if(wd) wd.onclick = async function(){
    if(!PokerWallet.isConnected()){ appToast(isEn() ? "Connect wallet first" : "请先连接钱包", "error"); return; }
    const bem = parseFloat($("withdrawAmount").value);
    if(!bem || bem <= 0){ appToast(isEn() ? "Enter an amount" : "请输入提现数量", "error"); return; }
    if(bem < MIN_WITHDRAW_BEM){
      appToast(isEn() ? ("Minimum " + MIN_WITHDRAW_BEM + " BEM") : ("最低提现 " + MIN_WITHDRAW_BEM + " BEM"), "error");
      return;
    }
    const chipsNeeded = Math.ceil(bem / CHIP_TO_BEM);
    const have = PokerStorage.getRealChips();
    if(have < chipsNeeded){
      appToast(isEn() ? ("Not enough chips. Need " + chipsNeeded.toLocaleString() + ", have " + have.toLocaleString())
                      : ("筹码不足。需要 " + chipsNeeded.toLocaleString() + " 筹码，当前 " + have.toLocaleString()), "error");
      return;
    }
    if(!confirm(isEn()
      ? ("Withdraw " + bem + " BEM? Will deduct " + chipsNeeded.toLocaleString() + " chips.")
      : ("确认提现 " + bem + " BEM？将扣减 " + chipsNeeded.toLocaleString() + " 筹码。"))) {
      return;
    }
    try {
      if(window.PokerAudio) PokerAudio.play('chip');
      const res = await PokerWallet.withdrawBem(bem);
      if(res && res.txHash){
        PokerStorage.setRealChips(have - chipsNeeded);
        refreshBalanceUI();
        $("withdrawAmount").value = "";
        appToast(isEn() ? ("Withdraw success: +" + bem + " BEM") : ("提现成功：+" + bem + " BEM"), "success");
      }
    } catch(err){
      console.error('[withdraw]', err);
      const msg = err && (err.reason || err.shortMessage || err.message) ? (err.reason || err.shortMessage || err.message) : String(err);
      appToast((isEn() ? "Withdraw failed: " : "提现失败：") + msg, "error");
    }
  };

  const wdInput = $("withdrawAmount");
  if(wdInput){
    wdInput.addEventListener("input", function(){
      const bem = parseFloat(this.value) || 0;
      const chips = Math.ceil(bem / CHIP_TO_BEM);
      const preview = $("withdrawPreview");
      if(preview){
        preview.textContent = bem > 0
          ? (isEn() ? ("Costs " + chips.toLocaleString() + " chips") : ("将扣 " + chips.toLocaleString() + " 筹码"))
          : (isEn() ? "Min 0.0001 BEM (= 1 chip)" : "最低 0.0001 BEM（= 1 筹码）");
      }
    });
  }
  const chb = $("clearHistoryBtn");
  if(chb) chb.onclick = function(){
    if(confirm(isEn() ? "Clear hand history?" : "清空复盘记录？")){
      PokerStorage.clearHandHistory();
      renderHandHistory();
    }
  };
  const wcb = $("walletConnectBtn");
  if(wcb) wcb.onclick = doConnect;
  const wcl = $("walletCloseBtn");
  if(wcl) wcl.onclick = function(){ $("walletOverlay").classList.add("hidden"); };
  const rnb = $("resetNumbersBtn");
  if(rnb) rnb.onclick = function(){
    if(confirm(isEn() ? "Reset all numbers?" : "确定清空所有战绩记录吗？")){
      PokerStorage.resetStats();
      renderNumbers();
    }
  };
  const fsBtn = $("fullscreenBtn");
  const updateFullscreenState = function(){
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    document.body.classList.toggle('is-fullscreen', isFs);
  };
  if(fsBtn){
    fsBtn.onclick = function(){
      if(window.PokerAudio) PokerAudio.play('click');
      const el = document.documentElement;
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
      if(!isFs){
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if(req){
          try {
            const p = req.call(el);
            if(p && p.catch) p.catch(function(e){ console.warn('fullscreen failed', e); });
          } catch(e){ console.warn('fullscreen failed', e); }
        }
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if(exit){
          try {
            const p = exit.call(document);
            if(p && p.catch) p.catch(function(e){ console.warn('exit fullscreen failed', e); });
          } catch(e){ console.warn(e); }
        }
      }
    };
  }
  document.addEventListener('fullscreenchange', updateFullscreenState);
  document.addEventListener('webkitfullscreenchange', updateFullscreenState);
  document.addEventListener('msfullscreenchange', updateFullscreenState);

  window.addEventListener('walletConnected', function(){
    try { refreshBalanceUI(); } catch(e){ console.warn(e); }
    if(window.PokerWallet) PokerWallet.updateUI();
  });

  const back = $("backToLobbyBtn");
  if(back) back.onclick = function(){
    if(confirm(isEn() ? "Leave the table?" : "确定离桌吗？")) backToLobby();
  };
  const ngb = $("newGameBtn");
  if(ngb) ngb.onclick = function(){ $("gameOverOverlay").classList.add("hidden"); backToLobby(); };
  const rs = $("raiseSlider"); if(rs) rs.addEventListener("input", updateRaiseAmount);
  const crb = $("cancelRaiseBtn");
  if(crb) crb.onclick = function(){
    if(window.PokerAudio) PokerAudio.play('click');
    $("raisePanel").classList.add("hidden");
  };
  const cfr = $("confirmRaiseBtn");
  if(cfr) cfr.onclick = function(){
    const inp = $("raiseInput");
    let amt = parseInt(inp.value, 10);
    if(isNaN(amt)) amt = G.raiseMin;
    amt = Math.max(G.raiseMin, Math.min(G.raiseMax, amt));
    doHumanAction({ type:"raise", target:amt });
  };
  const rp = $("raisePresets");
  if(rp) rp.addEventListener("click", function(e){
    const b = e.target.closest('button[data-preset]');
    if(b) applyRaisePreset(b.getAttribute('data-preset'));
  });

  const mlogFab = document.getElementById('mobileLogFab');
  const mlogPanel = document.getElementById('mobileLogPanel');
  const mlogClose = document.getElementById('mobileLogClose');
  if(mlogFab && mlogPanel){
    mlogFab.onclick = function(){
      mlogPanel.classList.toggle('hidden');
      if(!mlogPanel.classList.contains('hidden')){
        const list = PokerStorage.getHandHistory ? PokerStorage.getHandHistory() : [];
        const mBody = document.getElementById('mobileLogHistoryBody');
        if(mBody) mBody.innerHTML = renderHistoryList(list);
        const tabA = document.querySelector('.mobile-log-tab[data-tab="action"]');
        if(tabA && !tabA.classList.contains('active')) tabA.click();
      }
      if(window.PokerAudio) PokerAudio.play('click');
    };
  }
  if(mlogClose) mlogClose.onclick = function(){
    mlogPanel.classList.add('hidden');
  };
  document.querySelectorAll('.mobile-log-tab').forEach(function(tab){
    tab.onclick = function(){
      document.querySelectorAll('.mobile-log-tab').forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      const which = tab.getAttribute('data-tab');
      const bodyA = document.getElementById('mobileLogBodyAction');
      const bodyH = document.getElementById('mobileLogBodyHistory');
      if(which === 'action'){
        if(bodyA) bodyA.classList.remove('hidden');
        if(bodyH) bodyH.classList.add('hidden');
      } else {
        if(bodyA) bodyA.classList.add('hidden');
        if(bodyH) bodyH.classList.remove('hidden');
        const list = PokerStorage.getHandHistory ? PokerStorage.getHandHistory() : [];
        const mBody = document.getElementById('mobileLogHistoryBody');
        if(mBody) mBody.innerHTML = renderHistoryList(list);
      }
      if(window.PokerAudio) PokerAudio.play('click');
    };
  });

  let _zoomLevel = parseInt(localStorage.getItem('neon_holdem_zoom') || '100', 10);
  if(isNaN(_zoomLevel)) _zoomLevel = 100;
  if(_zoomLevel < 50) _zoomLevel = 50;
  if(_zoomLevel > 110) _zoomLevel = 110;

  function applyZoom(){
    const scale = _zoomLevel / 100;
    const gs = document.getElementById('gameScreen');
    if(!gs) return;
    gs.style.zoom = String(scale);
    if(scale === 1){
      gs.style.width = '';
      gs.style.height = '';
      document.body.classList.remove('zoom-active');
    } else {
      gs.style.width = (100 / scale) + 'vw';
      gs.style.height = (100 / scale) + 'dvh';
      document.body.classList.add('zoom-active');
    }
    try { localStorage.setItem('neon_holdem_zoom', String(_zoomLevel)); } catch(e){}
  }
  applyZoom();

  const zOut = $("zoomOutBtn");
  const zIn = $("zoomInBtn");
  if(zOut) zOut.onclick = function(){
    _zoomLevel = Math.max(50, _zoomLevel - 10);
    applyZoom();
    if(window.PokerAudio) PokerAudio.play('click');
  };
  if(zIn) zIn.onclick = function(){
    _zoomLevel = Math.min(110, _zoomLevel + 10);
    applyZoom();
    if(window.PokerAudio) PokerAudio.play('click');
  };

  bindRaiseInputEvents();
  initChat();
  const hob = $("historyOpenBtn"); if(hob) hob.onclick = openInGameHistory;
  const ihc = $("inGameHistoryClose"); if(ihc) ihc.onclick = closeInGameHistory;
});

})();
