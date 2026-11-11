/* ===========================================================================
 * 江湖残局（《抉招：江湖录》跑团战斗试玩）· UI 层（js/ui.js）· v1.2
 * ---------------------------------------------------------------------------
 * 屏幕：menu → challenges → (briefing) → battle → result
 * 战斗：敌人网格 / 战斗演示区（events 逐招播放）/ 已出牌序列 / 秘笈卡片化
 * 只依赖 SPEC §三 + §10.3 引擎 API；不读引擎内部。
 * 零外部请求；图标（含倾向标记）全部内联 SVG。
 * =========================================================================== */
(function () {
  'use strict';

  var UI_VERSION = '1.2.0';
  var SYSTEM_DEFAULT = {
    name: '江湖残局',
    subtitle: '《抉招：江湖录》跑团战斗环节试玩 · 高难挑战',
    tagline: '一局残局，一场没退路的过招。',
    footer: '单机 · 无需登录 · 无内购 · 更多剧本筹备中'
  };
  var K = window.JZ_SHARK_KEYS || {};
  var SAVE_KEY = K.save || (typeof window.JZ_SHARK_SAVE_KEY === 'string' && window.JZ_SHARK_SAVE_KEY) || 'jz_shark_save_v1';
  var META_KEY = K.meta || 'jz_shark_save_meta_v1';
  var RECORDS_KEY = K.records || 'jz_shark_records_v1';
  var UNLOCK_KEY = K.unlock || 'jz_shark_unlock_v1';
  var MODE_KEY = K.mode || 'jz_shark_mode_v1';
  var TUTORIAL_KEY = K.tutorial || (typeof window.JZ_SHARK_TUTORIAL_KEY === 'string' && window.JZ_SHARK_TUTORIAL_KEY) || 'jz_shark_tutorial_v1';
  var DEFENSE_KEY = K.defense || 'jz_shark_defense_tip_v1';

  /* ------------------------------------------------------------------ 素材 */
  var IMG = {
    boss1: 'boss_p1.webp',
    boss2: 'boss_p2.webp',
    shrimp: 'minion_shrimp.webp',
    crab: 'minion_crab.webp',
    player: 'player_yijinquan.webp',
    bg: 'bg_battle.webp',
    cardBack: 'card_back.webp',
    ink: 'skills/fx_ink_burst.webp',
    blood: 'skills/fx_blood.webp'
  };
  var SKILL_DIR = 'skills/';
  /* 官方倾向标记（作者原图，朱砂剪影）；缺图时回退到内联 SVG 标记 */
  var MARK_IMG = {
    jq: 'marks/mark_jq.png',
    bs: 'marks/mark_bs.png',
    lh: 'marks/mark_lh.png',
    hidden: 'marks/mark_hidden.png'
  };
  var AUDIO_MUTE_KEY = K.audioMute || 'jz_shark_mute_v1';

  /* ------------------------------------------------------- 倾向标记（统一） */
  var MARK_MAP = {
    jq: { label: '进取', cls: 'm-jq' },
    bs: { label: '保守', cls: 'm-bs' },
    lh: { label: '灵活', cls: 'm-lh' },
    hidden: { label: '隐藏', cls: 'm-hidden' }
  };
  var ROUTE_MARK = { '上': 'jq', '中': 'bs', '下': 'lh', '特': 'hidden' };
  var ROUTE_LIST = ['上', '中', '下', '特'];
  var INTENT_KEYS = ['jq', 'bs', 'lh'];
  var STAT_LABEL = { block: '格挡', dodge: '闪避', hua: '化劲' };

  /* --------------------------------------------------- 内联 SVG：线条图标 */
  var ICONS = {
    close: ['M6 6 L18 18', 'M18 6 L6 18'],
    help: ['M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z', 'M9.4 9.2 C9.6 7.8 10.7 6.9 12 6.9 C13.4 6.9 14.5 7.8 14.5 9.1 C14.5 10.9 12 11 12 13', 'M12 16.4 V16.5'],
    menu: ['M4 7 H20', 'M4 12 H20', 'M4 17 H20'],
    log: ['M5 4.5 H19 V19.5 H5 Z', 'M8 9 H16', 'M8 12.5 H16', 'M8 16 H13'],
    book: ['M4.5 5 H11 V19.5 H4.5 Z', 'M13 5 H19.5 V19.5 H13 Z', 'M11 5 V19.5'],
    chevron: ['M9 6 L15 12 L9 18'],
    back: ['M15 6 L9 12 L15 18'],
    block: ['M12 3.5 L19.5 6.2 V11.6 C19.5 16.2 16.2 19.3 12 20.7 C7.8 19.3 4.5 16.2 4.5 11.6 V6.2 Z', 'M8.5 11.8 H15.5'],
    dodge: ['M4 12.5 C6.5 8.5 9 8.5 11.5 12.5 C14 16.5 16.5 16.5 20 12.5', 'M4 17.5 C6.5 14 9 14 11.5 17.5 C14 21 16.5 21 20 17.5'],
    hua: ['M12 3.5 C15.5 7 18.5 9 18.5 13 C18.5 17 15.5 19.5 12 21 C8.5 19.5 5.5 17 5.5 13 C5.5 9 8.5 7 12 3.5 Z', 'M12 8.5 C13.8 10.5 14.8 11.8 14.8 13.6 C14.8 15.4 13.7 16.8 12 17.8 C10.3 16.8 9.2 15.4 9.2 13.6 C9.2 11.8 10.2 10.5 12 8.5 Z'],
    eye: ['M2.5 12 C5.5 7.5 8.5 6 12 6 C15.5 6 18.5 7.5 21.5 12 C18.5 16.5 15.5 18 12 18 C8.5 18 5.5 16.5 2.5 12 Z', 'M12 9.5 A2.5 2.5 0 1 1 12 14.5 A2.5 2.5 0 1 1 12 9.5 Z'],
    buff: ['M12 20.5 V4.5', 'M7 9.5 L12 4.5 L17 9.5'],
    lock: ['M7.5 11 V8.2 C7.5 5.7 9.5 4 12 4 C14.5 4 16.5 5.7 16.5 8.2 V11', 'M5.5 11 H18.5 V20 H5.5 Z'],
    draw: ['M6 4.5 H17.5 V15.5 H6 Z', 'M9 19.5 H21 V8.5'],
    sword: ['M6 18 L18 6', 'M14.5 6 H18 V9.5', 'M8.4 15.6 L4.5 19.5'],
    drop: ['M12 3.5 C15.5 8 17.5 11 17.5 13.8 C17.5 17.2 15 19.5 12 19.5 C9 19.5 6.5 17.2 6.5 13.8 C6.5 11 8.5 8 12 3.5 Z'],
    restart: ['M4.5 12 A7.5 7.5 0 1 0 7.1 6.2', 'M4 3.5 V8 H8.5'],
    spark: ['M12 3.5 L13.6 9.4 L19.5 11 L13.6 12.6 L12 18.5 L10.4 12.6 L4.5 11 L10.4 9.4 Z'],
    target: ['M12 3 A9 9 0 1 1 11.99 3 Z', 'M12 7.5 A4.5 4.5 0 1 1 11.99 7.5 Z', 'M12 1.5 V5', 'M12 19 V22.5', 'M1.5 12 H5', 'M19 12 H22.5'],
    play: ['M8 5 L19 12 L8 19 Z'],
    shieldDot: ['M12 3.5 L19.5 6.2 V11.6 C19.5 16.2 16.2 19.3 12 20.7 C7.8 19.3 4.5 16.2 4.5 11.6 V6.2 Z', 'M12 10.5 A1.6 1.6 0 1 1 12 13.7 A1.6 1.6 0 1 1 12 10.5 Z'],
    info: ['M12 3 A9 9 0 1 1 11.99 3 Z', 'M12 10.5 V17', 'M12 7.5 V7.6'],
    sound: ['M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z', 'M16.5 9 C18 10.5 18 13.5 16.5 15', 'M19 6.5 C22 9.5 22 14.5 19 17.5'],
    mute: ['M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z', 'M17 9.5 L22 14.5', 'M22 9.5 L17 14.5']
  };

  /* ------------------------------------------------- 内联 SVG：倾向标记（填色）
   * 三标记按作者制作的「进取/保守/灵活」风格重绘（实心剪影）+「隐藏」月牙。 */
  var MARK_PATHS = {
    jq: [
      { d: 'M16 2.2 L23 9.6 L23 13.8 L16 6.3 L9 13.8 L9 9.6 Z' },
      { d: 'M3.2 27.6 L5.9 24.9 L23.4 7.4 L26.9 10.9 L9.4 28.4 Z' },
      { d: 'M28.8 27.6 L26.1 24.9 L8.6 7.4 L5.1 10.9 L22.6 28.4 Z' },
      { d: 'M5.6 26.4 A2.5 2.5 0 1 1 5.61 26.4 Z', circle: true },
      { d: 'M26.4 26.4 A2.5 2.5 0 1 1 26.41 26.4 Z', circle: true }
    ],
    bs: [
      { d: 'M16 2 L29 5.6 V15.4 C29 23.2 23.4 28.4 16 30.4 C8.6 28.4 3 23.2 3 15.4 V5.6 Z M16 9.2 L21.6 16 L16 22.8 L10.4 16 Z', fillRule: 'evenodd' }
    ],
    lh: [
      { d: 'M5.2 29.8 C13.2 22 9.2 14 16.8 5 C13.8 14.6 19.4 20.6 12.4 27.4 C10.4 29.6 7.2 30.4 5.2 29.8 Z' },
      { d: 'M26.8 29.8 C18.8 22 22.8 14 15.2 5 C18.2 14.6 12.6 20.6 19.6 27.4 C21.6 29.6 24.8 30.4 26.8 29.8 Z' },
      { d: 'M3.4 28.6 L5.4 26.2 L25.8 5.8 L29.6 2.4 L28.8 6.8 L8.4 27.2 Z' }
    ],
    hidden: [
      { d: 'M20.8 3.2 A13 13 0 1 0 20.8 28.8 A10.2 10.2 0 0 1 20.8 3.2 Z' },
      { d: 'M8 25.4 L24 9.4 L25.4 10.8 L9.4 26.8 Z' }
    ]
  };

  var SELECT_LABEL = {
    'enemy': '选择 1 个敌人', 'enemies3': '选择最多 3 个敌人', 'minion': '选择 1 个杂兵',
    'route': '宣言倾向', 'convert': '转换意图', 'bet': '投入 HP 上限',
    'jqIntentsDynamic': '选择进取意图', 'jqIntents8': '选择最多 8 个进取意图',
    'jqIntents6': '选择最多 6 个进取意图'
  };
  var LOG_KIND_LABEL = {
    turn: '回合', card: '出牌', manual: '秘笈', damage: '伤害', defense: '防御',
    heal: '治疗', intent: '意图', summon: '召唤', phase: '阶段', system: '系统',
    win: '胜利', lose: '失败', error: '异常'
  };

  /* ------------------------------------------------------------------ 状态 */
  var ui = {
    screen: 'menu',
    battle: null,
    viewState: null,
    playback: null,
    busy: false,
    data: null,
    cards: [],
    cardMap: {},
    manuals: [],
    manualMap: {},
    bossData: null,
    challengeData: { list: [], upcoming: [], decks: {}, bosses: {} },
    system: null,
    currentChallenge: null,
    challengeId: '',
    nodes: {},
    anchors: {},
    playableCards: null,
    playableManuals: null,
    handBuilt: false,
    prevLogLen: null,
    logSeen: 0,
    logRenderedLen: -1,
    logOpen: false,
    modal: null,
    overlay: null,
    selectedIndex: null,
    handHint: '',
    manualHint: '',
    lastDemo: null,
    blogExpanded: false,
    tutorialDone: false,
    tutorialIndex: 0,
    pendingMode: 'standard',
    pendingUnlockToast: false,
    resultShown: false,
    resultRecorded: false,
    ghostTurns: {},
    reduced: false,
    imgOK: {},
    imgChecked: {},
    artBoxes: [],
    artTimer: null,
    toastTimer: null,
    suppressClickUntil: 0,
    renderError: ''
  };

  /* ------------------------------------------------------------- DOM 小工具 */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function svgEl(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }
  function icon(name, extraClass) {
    var paths = ICONS[name], svg = svgEl('svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icon' + (extraClass ? ' ' + extraClass : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (paths) for (var i = 0; i < paths.length; i++) {
      var p = svgEl('path'); p.setAttribute('d', paths[i]); svg.appendChild(p);
    }
    return svg;
  }
  function markSvg(kind, extraClass) {
    var paths = MARK_PATHS[kind] || MARK_PATHS.hidden;
    var svg = svgEl('svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('class', 'mark ' + (MARK_MAP[kind] ? MARK_MAP[kind].cls : '') + (extraClass ? ' ' + extraClass : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (var i = 0; i < paths.length; i++) {
      var p = svgEl('path');
      p.setAttribute('d', paths[i].d);
      if (paths[i].fillRule) p.setAttribute('fill-rule', paths[i].fillRule);
      svg.appendChild(p);
    }
    return svg;
  }

  /* 倾向标记：优先官方 PNG（浅色底用 multiply 消白底），缺图/加载失败回退内联 SVG */
  function markIcon(kind, extraClass) {
    var key = 'mark:' + kind;
    var url = assetBase() + (MARK_IMG[kind] || MARK_IMG.hidden);
    if (ui.imgChecked[key] !== true) attemptImage(key, url);
    if (ui.imgOK[key] !== true && ui.imgChecked[key] === true) return markSvg(kind, extraClass);
    var img = el('img', 'mark mark--img ' + (MARK_MAP[kind] ? MARK_MAP[kind].cls : '') + (extraClass ? ' ' + extraClass : ''));
    img.alt = '';
    img.setAttribute('draggable', 'false');
    img.setAttribute('aria-hidden', 'true');
    on(img, 'error', function () {
      ui.imgOK[key] = false; ui.imgChecked[key] = true;
      var fb = markSvg(kind, extraClass);
      if (img.parentNode) img.parentNode.replaceChild(fb, img);
    });
    try { img.src = url; } catch (e) { return markSvg(kind, extraClass); }
    return img;
  }
  function markRow(kind, count, extraClass) {
    var box = el('span', 'marks' + (extraClass ? ' ' + extraClass : ''));
    var n = Math.max(0, Math.min(12, Number(count) || 0));
    for (var i = 0; i < n; i++) {
      var m = markIcon(kind);
      m.setAttribute('title', (MARK_MAP[kind] ? MARK_MAP[kind].label : kind));
      box.appendChild(m);
    }
    return box;
  }
  function clear(node) { if (node) while (node.firstChild) node.removeChild(node.firstChild); }
  function add(parent, child) { if (parent && child) parent.appendChild(child); return child; }
  function on(node, type, fn) { if (node && node.addEventListener) node.addEventListener(type, fn); }
  function addClass(node, cls) {
    if (!node || !node.classList) return;
    var a = String(cls).split(' ');
    for (var i = 0; i < a.length; i++) if (a[i]) node.classList.add(a[i]);
  }
  function removeClass(node, cls) {
    if (!node || !node.classList) return;
    var a = String(cls).split(' ');
    for (var i = 0; i < a.length; i++) if (a[i]) node.classList.remove(a[i]);
  }
  function hasClass(node, cls) { return !!(node && node.classList && node.classList.contains(cls)); }
  function setHidden(node, hidden) {
    if (!node) return;
    node.hidden = !!hidden;
    try { node.style.display = hidden ? 'none' : ''; } catch (e) { }
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function num(v, fb) { var n = Number(v); return isFinite(n) ? n : (fb || 0); }
  function assetBase() {
    return (typeof window.JZ_UI_ASSET_BASE === 'string' && window.JZ_UI_ASSET_BASE) ? window.JZ_UI_ASSET_BASE : 'assets/img/';
  }

  /* -------------------------------------------------------------- 本地存储 */
  function storeGet(storeName, key) { try { var st = window[storeName]; if (!st) return null; var v = st.getItem(key); return (typeof v === 'string') ? v : null; } catch (e) { return null; } }
  function storeSet(storeName, key, val) { try { var st = window[storeName]; if (st) st.setItem(key, String(val)); } catch (e) { } }
  function storeDel(storeName, key) { try { var st = window[storeName]; if (st) st.removeItem(key); } catch (e) { } }
  function readJSON(storeName, key) {
    var raw = storeGet(storeName, key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function writeJSON(storeName, key, obj) { try { storeSet(storeName, key, JSON.stringify(obj)); } catch (e) { } }

  /* ========================================================================= 
   * BGM 框架：读 GAME_DATA.audio = {calm, battle, rage, win, lose}（本地相对路径） 
   * 零外链；缺文件静默；首次交互后起播；换曲 1.2s 交叉淡入淡出。 
   * ======================================================================= */ 
  var audio = {
    muted: storeGet('localStorage', AUDIO_MUTE_KEY) === '1',
    unlocked: false,
    current: '',
    token: 0,
    a: null,
    b: null,
    active: null,
    volume: 0.5
  };
  ui.audioBtns = [];

  function audioConfig() {
    var d = (window.JZ && window.JZ.DATA) || null;
    var g = window.GAME_DATA || null;
    var a = (d && d.audio && typeof d.audio === 'object') ? d.audio : ((g && g.audio && typeof g.audio === 'object') ? g.audio : null);
    return a;
  }
  function audioSrc(key) {
    var cfg = audioConfig();
    if (!cfg || !key) return null;
    var v = cfg[key];
    if (typeof v !== 'string' || !v) return null;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^\/\//.test(v)) return null; /* 只接受本地相对路径 */
    /* 预览页（tests/ 下）可重定基：assets/ → ../assets/ */
    if (typeof window.JZ_UI_AUDIO_BASE === 'string' && window.JZ_UI_AUDIO_BASE && v.indexOf('assets/') === 0) {
      return window.JZ_UI_AUDIO_BASE + v.slice('assets/'.length);
    }
    return v;
  }
  function audioEl() {
    var el2;
    try { el2 = (typeof window.Audio === 'function') ? new window.Audio() : document.createElement('audio'); }
    catch (e) { el2 = document.createElement('audio'); }
    try { el2.loop = true; } catch (e) { }
    try { el2.preload = 'auto'; } catch (e) { }
    if (typeof el2.play !== 'function') el2.play = function () { return { then: function () { }, catch: function () { } }; };
    if (typeof el2.pause !== 'function') el2.pause = function () { };
    if (el2.volume === undefined) el2.volume = 0;
    on(el2, 'error', function () { });
    return el2;
  }
  function audioFade(el2, to, ms, done) {
    if (!el2) { if (done) done(); return; }
    var from = num(el2.volume, 0), steps = Math.max(1, Math.round(ms / 80)), k = 0;
    var timer = setInterval(function () {
      k += 1;
      var v = from + (to - from) * (k / steps);
      try { el2.volume = clamp(v, 0, 1); } catch (e) { }
      if (k >= steps) { clearInterval(timer); try { el2.volume = clamp(to, 0, 1); } catch (e) { } if (done) done(); }
    }, 80);
  }
  function audioStop(ms) {
    audio.token += 1;
    var cur = audio.active;
    audio.active = null;
    if (cur) audioFade(cur, 0, ms || 400, function () { try { cur.pause(); } catch (e) { } });
  }
  function audioPlayTrack(key) {
    var src = audioSrc(key);
    var token = ++audio.token;
    if (!src) { audioStop(500); return; }
    if (!audio.a) audio.a = audioEl();
    if (!audio.b) audio.b = audioEl();
    var cur = audio.active;
    var next = (cur === audio.a) ? audio.b : audio.a;
    try { if (String(next.src || '').indexOf(src) < 0) next.src = src; } catch (e) { }
    try { next.currentTime = 0; } catch (e) { }
    try { next.volume = 0; } catch (e) { }
    try { var p = next.play(); if (p && typeof p.catch === 'function') p.catch(function () { }); } catch (e) { }
    audio.active = next;
    if (token !== audio.token) return;
    audioFade(next, audio.volume, 1200, null);
    if (cur && cur !== next) audioFade(cur, 0, 1200, function () { try { cur.pause(); } catch (e) { } });
  }
  function audioUnlock() {
    if (audio.unlocked) return;
    audio.unlocked = true;
    if (audio.muted) return;
    if (audio.current) audioPlayTrack(audio.current);
  }
  function setAudioTrack(key) {
    if (audio.current === key) { if (audio.unlocked && !audio.muted && audio.current && !audio.active) audioPlayTrack(audio.current); return; }
    audio.current = key || '';
    if (audio.muted || !audio.unlocked) { if (audio.muted) audioStop(300); return; }
    audioPlayTrack(audio.current);
  }
  function currentAudioKey() {
    if (ui.overlay && ui.overlay.opts && ui.overlay.opts.kind === 'result') return ui.lastResultWin ? 'win' : 'lose';
    if (ui.screen === 'battle' && ui.battle) {
      /* 演出中按演出进度（viewState）切曲：转阶段那一步才切 rage */
      var st = ui.viewState || ui.battle.state;
      var boss = null;
      for (var i = 0; i < (st.enemies || []).length; i++) if (st.enemies[i].kind === 'boss') boss = st.enemies[i];
      return (boss && num(boss.phase, 1) === 2) ? 'rage' : 'battle';
    }
    return 'calm';
  }
  function updateAudioForState() { setAudioTrack(currentAudioKey()); }
  function applyAudioIcon(btn) {
    if (!btn) return;
    clear(btn);
    btn.appendChild(icon(audio.muted ? 'mute' : 'sound'));
    btn.setAttribute('aria-label', audio.muted ? '开启配乐' : '静音配乐');
    btn.setAttribute('title', audio.muted ? '开启配乐' : '静音配乐');
  }
  function updateAudioButtons() {
    var alive = [];
    for (var i = 0; i < ui.audioBtns.length; i++) {
      var b = ui.audioBtns[i];
      if (b && b.parentNode) { alive.push(b); applyAudioIcon(b); }
    }
    ui.audioBtns = alive;
  }
  function audioButton(extraClass) {
    var b = el('button', 'btn btn--icon audio-btn' + (extraClass ? ' ' + extraClass : ''));
    b.type = 'button';
    applyAudioIcon(b);
    on(b, 'click', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); toggleMute(); });
    ui.audioBtns.push(b);
    return b;
  }
  function toggleMute() {
    audio.muted = !audio.muted;
    storeSet('localStorage', AUDIO_MUTE_KEY, audio.muted ? '1' : '0');
    updateAudioButtons();
    if (audio.muted) audioStop(300);
    else { audioUnlock(); if (audio.current) audioPlayTrack(audio.current); }
    toast(audio.muted ? '已静音' : (audioConfig() ? '配乐已开启' : '配乐未就绪（暂无音频资源）'));
  }

  /* ------------------------------------------------------------------ 数据 */
  function resolveData() {
    var raw = (window.JZ && window.JZ.DATA) || window.GAME_DATA || null;
    if (!raw) return false;
    var cards = null, boss = null;
    if (raw.cards && raw.cards.cards && raw.cards.manuals) { cards = raw.cards; boss = raw.boss || null; }
    else if (raw.cards && raw.cards.length) cards = raw;
    else if (raw.manuals) cards = raw;
    if (!boss && raw.boss) boss = raw.boss;
    if (!boss && raw.phases && raw.skills) boss = raw;
    if (!cards || !cards.cards) return false;
    var chal = raw.challenges || null;
    ui.data = { cards: cards, boss: boss, challenges: chal, decks: raw.decks || (chal && chal.decks) || {}, bosses: raw.bosses || (chal && chal.bosses) || {} };
    var sysRaw = (chal && chal.system) || raw.system || null;
    ui.system = {
      name: (sysRaw && sysRaw.name) || SYSTEM_DEFAULT.name,
      subtitle: (sysRaw && sysRaw.subtitle) || SYSTEM_DEFAULT.subtitle,
      tagline: (sysRaw && sysRaw.tagline) || SYSTEM_DEFAULT.tagline,
      footer: (sysRaw && sysRaw.footer) || SYSTEM_DEFAULT.footer
    };
    ui.cards = cards.cards || [];
    ui.manuals = cards.manuals || [];
    ui.bossData = boss;
    ui.cardMap = {};
    for (var i = 0; i < ui.cards.length; i++) ui.cardMap[ui.cards[i].id] = ui.cards[i];
    ui.manualMap = {};
    for (var j = 0; j < ui.manuals.length; j++) ui.manualMap[ui.manuals[j].id] = ui.manuals[j];
    return true;
  }

  function systemInfo() { return ui.system || SYSTEM_DEFAULT; }
  function challengeTitle(ch) {
    if (!ch) return '残局';
    return (ch.scriptNo ? ch.scriptNo + ' · ' : '') + (ch.name || '残局');
  }
  function challengeRecordLabel() { return '入局'; }

  /* ---- 敌方 AI 自我学习（可选模块，缺失/异常时静默降级） ---- */
  function aiModule() {
    try {
      var J = window.JZ;
      return (J && J.AILearning && typeof J.AILearning.getState === 'function') ? J.AILearning : null;
    } catch (e) { return null; }
  }
  function aiFirstNum(list, dflt) {
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.round(v));
    }
    return dflt;
  }
  function aiTargetChallengeId() {
    var sc = ui.battle && ui.battle.state && ui.battle.state.challenge;
    if (sc && sc.id) return sc.id;
    var open = firstOpenChallenge();
    return (open && open.id) || 'shark';
  }
  function aiStateFor(id) {
    var mod = aiModule();
    if (!mod) return null;
    var st = null;
    try { st = mod.getState(id); } catch (e) { return { id: id, error: true }; }
    if (!st || typeof st !== 'object') return null;
    var battles = aiFirstNum([st.battles, st.games, st.totalBattles, st.total, st.count], 0);
    var playerWins = aiFirstNum([st.playerWins, st.playerWin, st.wins], null);
    var bossWins = aiFirstNum([st.bossWins, st.enemyWins, st.aiWins], null);
    if (playerWins === null && bossWins !== null) playerWins = Math.max(0, battles - bossWins);
    if (bossWins === null && playerWins !== null) bossWins = Math.max(0, battles - playerWins);
    return {
      id: id,
      battles: battles,
      playerWins: playerWins === null ? 0 : playerWins,
      bossWins: bossWins === null ? 0 : bossWins,
      raw: st
    };
  }
  function aiLine(st) {
    if (!st) return '';
    if (!st.battles) return '本机敌方 AI：尚未从对局中学习（完成一局后开始积累）';
    return '本机敌方 AI：已从 ' + st.battles + ' 局对战中学习（敌方胜 ' + st.bossWins + ' · 玩家胜 ' + st.playerWins + '）';
  }
  function aiReset(id) {
    var mod = aiModule();
    if (!mod || typeof mod.reset !== 'function') return false;
    try { mod.reset(id); return true; } catch (e) { return false; }
  }


  function getChallengesRaw() {
    var api = null;
    try { if (window.JZ && typeof window.JZ.getChallenges === 'function') api = window.JZ.getChallenges(); } catch (e) { api = null; }
    if (api && api.challenges && api.challenges.length) return api;
    var c = (ui.data && ui.data.challenges) || {};
    if (c.challenges && c.challenges.length) return { challenges: c.challenges, upcoming: c.upcoming || [] };
    /* 老数据兼容：没有 challenges.json 时按 Boss 数据合成一条 */
    var bd = ui.bossData || {};
    var synthesized = [{
      id: 'shark', order: 1, name: bd.name || '罐中鲨', code: bd.code || 'XS-01',
      subtitle: '罐中噬潮 · 首领战', difficulty: '高难', difficultyStars: 4, status: 'open',
      deckId: 'YJQ', bossId: 'shark', duration: '约 5–10 分钟',
      tags: ['首领战', '水面', '罐中'], desc: '', goal: '', quote: ''
    }];
    return { challenges: synthesized, upcoming: [] };
  }

  function getChallengeById(id) {
    var all = getChallengesRaw().challenges || [];
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function firstOpenChallenge() {
    var all = getChallengesRaw().challenges || [];
    for (var i = 0; i < all.length; i++) if (all[i].status === 'open') return all[i];
    return all[0] || null;
  }
  function challengeView(ch, stateChallenge) {
    var base = (stateChallenge && stateChallenge.id) ? stateChallenge : null;
    var raw = ch || (base && base.id ? getChallengeById(base.id) : null);
    if (!raw && !base) return null;
    var b = base || {};
    var deck = (ui.data && ui.data.decks && raw && ui.data.decks[raw.deckId]) || {};
    var bs = (ui.data && ui.data.bosses && raw && ui.data.bosses[raw.bossId]) || {};
    return {
      id: (raw && raw.id) || b.id,
      name: (raw && raw.name) || b.name,
      code: (raw && raw.code) || b.code || '',
      scriptNo: (raw && raw.scriptNo) || b.scriptNo || '',
      subtitle: (raw && raw.subtitle) || b.subtitle || '',
      difficulty: (raw && raw.difficulty) || b.difficulty || '',
      difficultyStars: (raw && raw.difficultyStars) || b.difficultyStars || 0,
      tags: (raw && raw.tags) || b.tags || [],
      story: (raw && raw.story) || b.story || '',
      cast: (raw && raw.cast) || b.cast || [],
      quote: (raw && raw.quote) || b.quote || '',
      goal: (raw && raw.goal) || b.goal || '',
      extreme: (raw && raw.extreme) || b.extreme || null,
      deckName: b.deckName || deck.name || '',
      bossName: b.bossName || bs.name || ''
    };
  }
  function currentChallengeView() {
    var sc = ui.battle && ui.battle.state && ui.battle.state.challenge;
    if (sc) return challengeView(getChallengeById(sc.id), sc);
    return ui.currentChallenge;
  }

  /* ------------------------------------------------ 极限模式：解锁 / 选择 */
  function readUnlockMap() { var o = readJSON('localStorage', UNLOCK_KEY); return (o && typeof o === 'object') ? o : {}; }
  function isExtremeUnlocked(id) {
    if (!id) return false;
    try { var u = readUnlockMap(); return !!(u[id] && u[id].extreme); } catch (e) { return false; }
  }
  function unlockExtreme(id) {
    if (!id) return false;
    try {
      var u = readUnlockMap();
      if (u[id] && u[id].extreme) return false;
      if (!u[id] || typeof u[id] !== 'object') u[id] = {};
      u[id].extreme = true;
      writeJSON('localStorage', UNLOCK_KEY, u);
      return true;
    } catch (e) { return false; }
  }
  function readModeMap() { var o = readJSON('localStorage', MODE_KEY); return (o && typeof o === 'object') ? o : {}; }
  function selectedMode(id) {
    try {
      var m = readModeMap();
      if (m[id] === 'extreme' && isExtremeUnlocked(id)) return 'extreme';
    } catch (e) { }
    return 'standard';
  }
  function setSelectedMode(id, mode) {
    if (!id) return;
    try {
      var m = readModeMap();
      m[id] = (mode === 'extreme' && isExtremeUnlocked(id)) ? 'extreme' : 'standard';
      writeJSON('localStorage', MODE_KEY, m);
    } catch (e) { }
  }
  function battleMode(st) {
    return (st && st.mode === 'extreme') ? 'extreme' : 'standard';
  }
  function currentBattleMode() {
    if (ui.battle && ui.battle.state) return battleMode(ui.battle.state);
    return ui.pendingMode === 'extreme' ? 'extreme' : 'standard';
  }
  function extremeInfo(ch) {
    var ex = ch && ch.extreme;
    return (ex && typeof ex === 'object') ? ex : null;
  }
  function extremeUnlockHint(ch) {
    var ex = extremeInfo(ch);
    return (ex && ex.unlockHint) ? ex.unlockHint : '用「千手归一」通关一次后解锁';
  }
  function extremeDesc(ch) {
    var ex = extremeInfo(ch);
    return (ex && ex.desc) ? ex.desc : '禁用千手归一；千手归一替换为「万法皆通」：对所有敌人造成 20 点真实必中伤害。';
  }
  function modeLabel(mode) { return mode === 'extreme' ? '极限' : '标准'; }

  /* ------------------------------------------------------ 存档 / 本地记录 */
  function emptyModeRec() { return { attempts: 0, wins: 0, bestTurns: 0 }; }
  function normalizeRecords(raw) {
    var out = {}, changed = false, any = false;
    if (!raw || typeof raw !== 'object') return { records: out, changed: false };
    for (var id in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, id)) continue;
      var rec = raw[id];
      if (!rec || typeof rec !== 'object') continue;
      any = true;
      var hasModes = !!(rec.standard || rec.extreme);
      var flat = (typeof rec.attempts === 'number' || typeof rec.wins === 'number' || typeof rec.bestTurns === 'number');
      if (hasModes) {
        out[id] = {
          standard: rec.standard || emptyModeRec(),
          extreme: rec.extreme || emptyModeRec()
        };
        if (!rec.standard || !rec.extreme) changed = true;
      } else if (flat) {
        out[id] = { standard: { attempts: num(rec.attempts, 0), wins: num(rec.wins, 0), bestTurns: num(rec.bestTurns, 0) }, extreme: emptyModeRec() };
        changed = true;
      } else {
        out[id] = rec;
      }
    }
    return { records: out, changed: changed && any };
  }
  function readRecords() {
    var raw = readJSON('localStorage', RECORDS_KEY);
    var n = normalizeRecords(raw);
    if (n.changed) writeJSON('localStorage', RECORDS_KEY, n.records);
    return n.records;
  }
  function writeRecords(r) { writeJSON('localStorage', RECORDS_KEY, r); }
  function recordOf(id, mode) {
    var r = readRecords();
    var rec = r[id];
    if (!rec) return null;
    var m = mode === 'extreme' ? 'extreme' : 'standard';
    return (rec[m] && typeof rec[m] === 'object') ? rec[m] : null;
  }
  function ensureRecord(r, id, mode) {
    if (!r[id]) r[id] = { standard: emptyModeRec(), extreme: emptyModeRec() };
    var m = mode === 'extreme' ? 'extreme' : 'standard';
    if (!r[id][m]) r[id][m] = emptyModeRec();
    return r[id][m];
  }
  function recordAttempt(id, mode) {
    var r = readRecords();
    var rec = ensureRecord(r, id, mode);
    rec.attempts += 1;
    writeRecords(r);
  }
  function recordResult(id, win, turns, mode) {
    var r = readRecords();
    var rec = ensureRecord(r, id, mode);
    if (win) {
      rec.wins += 1;
      if (!rec.bestTurns || turns < rec.bestTurns) rec.bestTurns = turns;
    }
    writeRecords(r);
  }
  function recordLine(id, mode) {
    var m = mode === 'extreme' ? 'extreme' : 'standard';
    var rec = recordOf(id, m);
    if (!rec || !rec.attempts) return m === 'extreme' ? '极限 · 尚无记录' : '尚无记录';
    var s = challengeRecordLabel() + ' ' + rec.attempts + ' 次 · 胜 ' + rec.wins + ' 次';
    if (rec.bestTurns) s += ' · 最佳 ' + rec.bestTurns + ' 回合';
    return (m === 'extreme' ? '极限 · ' : '') + s;
  }

  function saveNow() {
    if (!ui.battle || !ui.battle.state) return;
    if (ui.battle.state.stage === 'over') return;
    var json = null;
    try { json = ui.battle.serialize(); } catch (e) { json = null; }
    if (typeof json !== 'string' || !json) return;
    storeSet('localStorage', SAVE_KEY, json);
    var cv = currentChallengeView() || {};
    writeJSON('localStorage', META_KEY, {
      challengeId: cv.id || ui.challengeId || '',
      challengeName: cv.name || '',
      code: cv.code || '',
      mode: battleMode(ui.battle.state),
      turn: num(ui.battle.state.turn, 1),
      savedAt: Date.now && Date.now()
    });
  }
  function clearSave() { storeDel('localStorage', SAVE_KEY); storeDel('localStorage', META_KEY); }
  function saveInfo() {
    var raw = storeGet('localStorage', SAVE_KEY);
    if (!raw) return null;
    var meta = readJSON('localStorage', META_KEY) || {};
    var S = null;
    try {
      var parsed = JSON.parse(raw);
      S = parsed && parsed.S ? parsed.S : (parsed && parsed.state ? parsed.state : parsed);
    } catch (e) { S = null; }
    if (!S || S.stage === 'over') { clearSave(); return null; }
    var ch = (S && S.challenge) || null;
    return {
      turn: num(S && S.turn, meta.turn || 1),
      challengeName: (ch && ch.name) || meta.challengeName || '',
      challengeCode: (ch && ch.code) || meta.code || '',
      challengeId: (ch && ch.id) || meta.challengeId || '',
      mode: (S && S.mode === 'extreme') ? 'extreme' : ((meta.mode === 'extreme') ? 'extreme' : 'standard')
    };
  }

  /* =========================================================================
   * 图片：预加载主素材 + 缺图兜底 + 技能剪影懒加载
   * ======================================================================= */
  function preloadImages() {
    /* 只预加载核心素材；fx / 招式剪影 / 标记按需懒加载，避免美术未齐时刷 404 */
    var MAIN = ['boss1', 'boss2', 'shrimp', 'crab', 'player', 'bg', 'cardBack'];
    for (var i = 0; i < MAIN.length; i++) attemptImage('main:' + MAIN[i], assetBase() + IMG[MAIN[i]]);
    var mk = Object.keys(MARK_IMG);
    for (var j = 0; j < mk.length; j++) attemptImage('mark:' + mk[j], assetBase() + MARK_IMG[mk[j]]);
  }
  function ensureMain(name) {
    var key = 'main:' + name;
    if (!ui.imgChecked[key]) attemptImage(key, assetBase() + IMG[name]);
  }
  function attemptImage(key, url) {
    if (ui.imgChecked[key]) return;
    if (typeof window.Image !== 'function') { ui.imgOK[key] = false; ui.imgChecked[key] = true; return; }
    var im;
    try { im = new window.Image(); } catch (e) { ui.imgOK[key] = false; ui.imgChecked[key] = true; return; }
    var settled = false;
    im.onload = function () {
      if (settled) return; settled = true;
      ui.imgOK[key] = true; ui.imgChecked[key] = true;
      if (key.indexOf('main:bg') === 0) applyBgArt();
      scheduleArtRefresh();
    };
    im.onerror = function () { if (settled) return; settled = true; ui.imgOK[key] = false; ui.imgChecked[key] = true; };
    try { im.src = url; } catch (e) { }
  }
  function mainOK(name) { return ui.imgOK['main:' + name] === true; }
  function applyBgArt() {
    var bg = ui.nodes.bgArt;
    if (!bg) return;
    if (mainOK('bg')) { try { bg.style.backgroundImage = "url('" + assetBase() + IMG.bg + "')"; } catch (e) { } addClass(bg, 'has-art'); }
    else { try { bg.style.backgroundImage = ''; } catch (e) { } removeClass(bg, 'has-art'); }
  }
  function scheduleArtRefresh() {
    if (ui.artTimer) return;
    ui.artTimer = setTimeout(function () { ui.artTimer = null; refreshArtBoxes(); if (ui.battle) renderBattle(); }, 80);
  }
  function artBox(imgKey, label, extraClass, url) {
    var box = el('div', 'art' + (extraClass ? ' ' + extraClass : ''));
    ui.artBoxes.push({ box: box, key: imgKey, label: label, url: url });
    paintArtBox(box, imgKey, label, url);
    return box;
  }
  function paintArtBox(box, imgKey, label, url) {
    if (!box) return;
    clear(box); removeClass(box, 'art--missing');
    if (ui.imgOK[imgKey]) {
      var im = el('img', 'art__img');
      im.alt = label || '';
      im.setAttribute('decoding', 'async');
      on(im, 'error', function () { ui.imgOK[imgKey] = false; paintArtBox(box, imgKey, label, url); });
      try { im.src = url; } catch (e) { }
      box.appendChild(im);
    } else decorateMissing(box, label);
  }
  function decorateMissing(box, label) {
    clear(box); addClass(box, 'art--missing');
    var ph = el('div', 'art__ph');
    ph.appendChild(el('span', 'art__seal', String(label || '？').charAt(0)));
    ph.appendChild(el('span', 'art__ph-sub', '水墨未至'));
    box.appendChild(ph);
  }
  function pruneArtBoxes() {
    var alive = [];
    for (var i = 0; i < ui.artBoxes.length; i++) if (ui.artBoxes[i] && ui.artBoxes[i].box && ui.artBoxes[i].box.parentNode) alive.push(ui.artBoxes[i]);
    ui.artBoxes = alive;
  }
  function refreshArtBoxes() {
    var alive = [];
    for (var i = 0; i < ui.artBoxes.length; i++) {
      var e = ui.artBoxes[i];
      if (!e || !e.box || !e.box.parentNode) continue;
      alive.push(e); paintArtBox(e.box, e.key, e.label, e.url);
    }
    ui.artBoxes = alive;
  }
  function charArtBox(label, extraClass) {
    var box = el('div', 'art art--char' + (extraClass ? ' ' + extraClass : ''));
    box.appendChild(el('span', 'art__char', String(label || '？').charAt(0)));
    return box;
  }

  /* =========================================================================
   * 外壳：三个屏幕 + 全局层
   * ======================================================================= */
  function buildShell() {
    var mount = document.getElementById('app-root') || document.body;
    clear(mount);

    var bg = el('div', 'bg-art'); bg.setAttribute('aria-hidden', 'true'); document.body.appendChild(bg);

    var app = el('div', 'app');

    /* ---------- menu 屏 ---------- */
    var menuScreen = el('section', 'screen screen--menu');
    menuScreen.setAttribute('aria-label', '标题菜单');
    app.appendChild(menuScreen);

    /* ---------- challenges 屏 ---------- */
    var chalScreen = el('section', 'screen screen--challenges');
    chalScreen.setAttribute('aria-label', '战斗剧本列表');
    app.appendChild(chalScreen);

    /* ---------- battle 屏 ---------- */
    var battleScreen = el('section', 'screen screen--battle');
    battleScreen.setAttribute('aria-label', '战斗');

    var btop = el('header', 'btop');
    var bleft = el('div', 'btop__left');
    var menuBtn = el('button', 'btn btn--icon btop__menu');
    menuBtn.type = 'button'; menuBtn.setAttribute('aria-label', '返回菜单'); menuBtn.appendChild(icon('menu'));
    bleft.appendChild(menuBtn);
    var btitleWrap = el('div', 'btop__titles');
    var btopTitle = el('h1', 'btop__title', '江湖残局');
    btitleWrap.appendChild(btopTitle);
    var chalChip = el('p', 'btop__chal', '');
    btitleWrap.appendChild(chalChip);
    var modeBadge = el('span', 'mode-badge', '极限');
    setHidden(modeBadge, true);
    bleft.appendChild(btitleWrap);
    btop.appendChild(bleft);
    var bright = el('div', 'btop__right');
    bright.appendChild(modeBadge);
    var turnPill = el('span', 'pill pill--turn');
    turnPill.appendChild(el('span', 'pill__k', '回合'));
    var turnNum = el('b', 'pill__v', '1');
    turnPill.appendChild(turnNum);
    bright.appendChild(turnPill);
    bright.appendChild(audioButton());
    var helpBtn = el('button', 'btn btn--icon');
    helpBtn.type = 'button'; helpBtn.setAttribute('aria-label', '帮助与规则'); helpBtn.setAttribute('title', '帮助与规则');
    helpBtn.appendChild(icon('help'));
    bright.appendChild(helpBtn);
    btop.appendChild(bright);
    battleScreen.appendChild(btop);

    var stage = el('main', 'stage');
    var enemiesZone = el('section', 'ezone');
    var midZone = el('section', 'mid');
    var demoZone = el('section', 'demo');
    var blogZone = el('section', 'blog');
    var blogHead = el('div', 'blog__head');
    blogHead.appendChild(el('span', 'blog__title', '战斗记录'));
    var blogSub = el('span', 'blog__sub', '最近 10 条 · 实时滚动');
    blogHead.appendChild(blogSub);
    var blogToggle = el('button', 'blog__toggle');
    blogToggle.type = 'button';
    blogToggle.textContent = '展开';
    on(blogToggle, 'click', function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      ui.blogExpanded = !ui.blogExpanded;
      renderBlog(ui.battle ? ui.battle.state : null);
    });
    blogHead.appendChild(blogToggle);
    var blogList = el('ol', 'blog__list');
    blogZone.appendChild(blogHead); blogZone.appendChild(blogList);
    midZone.appendChild(demoZone); midZone.appendChild(blogZone);
    var playerZone = el('section', 'pzone');
    var manualZone = el('section', 'mzone');
    var handZone = el('section', 'hzone');
    stage.appendChild(enemiesZone); stage.appendChild(midZone);
    stage.appendChild(playerZone); stage.appendChild(manualZone); stage.appendChild(handZone);
    battleScreen.appendChild(stage);

    var bar = el('footer', 'actionbar');
    var logBtn = el('button', 'btn btn--ghost actionbar__log');
    logBtn.type = 'button'; logBtn.setAttribute('aria-label', '战斗日志');
    logBtn.appendChild(icon('log')); logBtn.appendChild(el('span', 'btn__label', '日志'));
    var dot = el('span', 'dot'); setHidden(dot, true); logBtn.appendChild(dot);
    var hint = el('p', 'actionbar__hint', '');
    var endBtn = el('button', 'btn btn--primary actionbar__end');
    endBtn.type = 'button'; endBtn.appendChild(el('span', 'btn__label', '结束回合'));
    bar.appendChild(logBtn); bar.appendChild(hint); bar.appendChild(endBtn);
    battleScreen.appendChild(bar);

    app.appendChild(battleScreen);
    mount.appendChild(app);

    /* ---------- 日志抽屉 ---------- */
    var drawer = el('div', 'drawer'); setHidden(drawer, true);
    var dScrim = el('div', 'drawer__scrim');
    var panel = el('section', 'drawer__panel');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '战斗日志');
    var dHead = el('header', 'drawer__head');
    dHead.appendChild(el('h2', 'drawer__title', '战斗日志'));
    dHead.appendChild(el('p', 'drawer__sub', '完整记录 · 伤害/防御/治疗/阶段按颜色区分'));
    var logClose = el('button', 'btn btn--icon');
    logClose.type = 'button'; logClose.setAttribute('aria-label', '收起日志'); logClose.appendChild(icon('close'));
    dHead.appendChild(logClose);
    var logList = el('ol', 'loglist');
    panel.appendChild(dHead); panel.appendChild(logList);
    drawer.appendChild(dScrim); drawer.appendChild(panel);
    document.body.appendChild(drawer);

    /* ---------- 模态 / 覆盖层 / toast ---------- */
    var modalRoot = el('div', 'modal-root'); setHidden(modalRoot, true); document.body.appendChild(modalRoot);
    var overlayRoot = el('div', 'overlay-root'); setHidden(overlayRoot, true); document.body.appendChild(overlayRoot);
    var toastEl = el('div', 'toast'); setHidden(toastEl, true);
    toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);

    var fx = document.getElementById('fx-layer');
    if (!fx) { fx = el('div', 'fx-layer'); fx.setAttribute('aria-hidden', 'true'); document.body.appendChild(fx); }

    ui.root = app;
    ui.nodes = {
      app: app, bgArt: bg,
      menu: menuScreen, challenges: chalScreen, battle: battleScreen,
      btop: btop, btopTitle: btopTitle, turnNum: turnNum, chalChip: chalChip, modeBadge: modeBadge, menuBtn: menuBtn, helpBtn: helpBtn,
      stage: stage, enemies: enemiesZone, mid: midZone, demo: demoZone,
      blog: blogZone, blogList: blogList, blogToggle: blogToggle,
      player: playerZone, manuals: manualZone, hand: handZone,
      actionbar: bar, logBtn: logBtn, logDot: dot, actionHint: hint, endTurnBtn: endBtn,
      drawer: drawer, drawerScrim: dScrim, logList: logList, logCloseBtn: logClose,
      modalRoot: modalRoot, overlayRoot: overlayRoot, toast: toastEl, fxLayer: fx
    };

    on(menuBtn, 'click', leaveBattleFlow);
    on(helpBtn, 'click', showHelp);
    on(logBtn, 'click', function () { if (ui.logOpen) closeLogDrawer(); else openLogDrawer(); });
    on(logClose, 'click', closeLogDrawer);
    on(dScrim, 'click', closeLogDrawer);
    on(endBtn, 'click', endTurnFlow);
    on(document, 'keydown', function (ev) { audioUnlock(); onKeydown(ev); });
    on(document, 'pointerdown', function () { audioUnlock(); });
    on(document, 'click', function () { audioUnlock(); });
    on(window, 'resize', function () { positionToast(); updateHandNav(); });
    on(window, 'pagehide', function () { if (ui.battle) saveNow(); });
  }

  function onKeydown(ev) {
    var key = ev && (ev.key || ev.keyCode);
    if (key === 'Escape' || key === 'Esc' || key === 27) {
      if (ui.modal) { closeModal(); return; }
      if (ui.logOpen) { closeLogDrawer(); return; }
    }
    if (key === ' ' || key === 'Spacebar' || key === 32) {
      if (ui.playback) { ev.preventDefault && ev.preventDefault(); acceleratePlayback(); }
    }
  }

  /* ------------------------------------------------------------ 屏幕切换 */
  function showScreen(name) {
    ui.screen = name;
    setHidden(ui.nodes.menu, name !== 'menu');
    setHidden(ui.nodes.challenges, name !== 'challenges');
    setHidden(ui.nodes.battle, name !== 'battle');
    if (name === 'menu') renderMenu();
    else if (name === 'challenges') renderChallenges();
    else if (name === 'battle') renderBattle();
    updateAudioForState();
  }

  /* -------------------------------------------------------------- 菜单屏 */
  function renderMenu() {
    var screen = ui.nodes.menu;
    clear(screen);
    var box = el('div', 'menu');
    var sys = systemInfo();
    box.appendChild(el('p', 'menu__kicker', '《抉招：江湖录》跑团战斗试玩'));
    var titleWrap = el('div', 'menu__title-wrap');
    var seal = el('span', 'menu__seal', '局');
    seal.setAttribute('aria-hidden', 'true');
    titleWrap.appendChild(seal);
    var t = el('h1', 'menu__title', sys.name);
    titleWrap.appendChild(t);
    box.appendChild(titleWrap);
    box.appendChild(el('p', 'menu__sub', sys.subtitle));
    box.appendChild(el('p', 'menu__tagline', sys.tagline));
    var open = firstOpenChallenge();
    var recLine = open ? recordLine(open.id) : '尚无记录';
    box.appendChild(el('p', 'menu__record', (open ? challengeTitle(open) + ' · ' : '') + recLine));
    var menuAudio = el('div', 'menu__audio');
    menuAudio.appendChild(audioButton());
    box.appendChild(menuAudio);

    var nav = el('nav', 'menu__nav');
    var info = saveInfo();
    if (info) {
      var cont = el('button', 'btn btn--primary btn--menu');
      cont.type = 'button';
      var contMain = el('span', 'btn--menu__main', '继续上局');
      var infoRaw = info.challengeId ? getChallengeById(info.challengeId) : null;
      var contSub = el('span', 'btn--menu__sub', (infoRaw && infoRaw.scriptNo ? infoRaw.scriptNo + ' · ' : '') + (info.challengeName || '残局') + (info.mode === 'extreme' ? ' · 极限' : '') + ' · 第 ' + info.turn + ' 回合');
      cont.appendChild(contMain); cont.appendChild(contSub);
      on(cont, 'click', continueSavedBattle);
      nav.appendChild(cont);
    }
    var start = el('button', 'btn btn--menu' + (info ? '' : ' btn--primary'));
    start.type = 'button';
    start.appendChild(el('span', 'btn--menu__main', '开始残局'));
    start.appendChild(el('span', 'btn--menu__sub', open ? (challengeTitle(open) + ' · ' + (open.subtitle || '')) : sys.name));
    on(start, 'click', function () {
      var ch = firstOpenChallenge();
      if (ch) startChallengeWithBriefing(ch);
      else toast('暂无可用剧本');
    });
    nav.appendChild(start);

    var listBtn = el('button', 'btn btn--menu');
    listBtn.type = 'button';
    listBtn.appendChild(el('span', 'btn--menu__main', '剧本列表'));
    listBtn.appendChild(el('span', 'btn--menu__sub', '查看全部战斗剧本与筹备中的残局'));
    on(listBtn, 'click', function () { showScreen('challenges'); });
    nav.appendChild(listBtn);

    var howBtn = el('button', 'btn btn--ghost btn--menu btn--menu--sm', '玩法说明');
    howBtn.type = 'button'; on(howBtn, 'click', showHelp);
    var aboutBtn = el('button', 'btn btn--ghost btn--menu btn--menu--sm', '制作信息');
    aboutBtn.type = 'button'; on(aboutBtn, 'click', showAbout);
    nav.appendChild(howBtn); nav.appendChild(aboutBtn);
    box.appendChild(nav);

    box.appendChild(el('p', 'menu__foot', sys.footer));
    screen.appendChild(box);
  }

  /* -------------------------------------------------------- 战斗剧本列表屏 */
  function renderChallenges() {
    var screen = ui.nodes.challenges;
    clear(screen);
    var head = el('header', 'screen__head');
    var back = el('button', 'btn btn--icon screen__back');
    back.type = 'button'; back.setAttribute('aria-label', '返回菜单'); back.appendChild(icon('back'));
    on(back, 'click', function () { showScreen('menu'); });
    head.appendChild(back);
    var titles = el('div', 'screen__titles');
    titles.appendChild(el('h2', 'screen__title', '战斗剧本列表'));
    var raw = getChallengesRaw();
    var openCount = raw.challenges.filter(function (c) { return c.status === 'open'; }).length;
    titles.appendChild(el('p', 'screen__sub', '当前开放 ' + openCount + ' 个残局 · 筹备中 ' + (raw.upcoming || []).length + ' 个'));
    head.appendChild(titles);
    head.appendChild(audioButton());
    screen.appendChild(head);
    screen.appendChild(el('p', 'screen__hint', '每个剧本有独立的卡组与敌人配置；更多残局陆续开放。'));

    var list = el('div', 'ch-list');
    var chs = raw.challenges.filter(function (c) { return c.status !== 'hidden'; });
    for (var i = 0; i < chs.length; i++) list.appendChild(challengeCard(chs[i], i + 1));
    var ups = raw.upcoming || [];
    for (var j = 0; j < ups.length; j++) list.appendChild(upcomingCard(ups[j], chs.length + j + 1));
    screen.appendChild(list);
    screen.appendChild(el('p', 'screen__foot', '记录保存在本机（localStorage）；清除浏览器数据会一并清除。'));
  }

  function stars(n) {
    var box = el('span', 'stars');
    var k = clamp(num(n, 0), 0, 5);
    for (var i = 0; i < 5; i++) {
      var dot = el('i', 'stars__d' + (i < k ? ' is-on' : ''));
      box.appendChild(dot);
    }
    return box;
  }

  function challengeCard(ch, order) {
    var open = ch.status === 'open';
    var card = el('button', 'ch-card' + (open ? ' is-open' : ' is-locked'));
    card.type = 'button';
    if (!open) card.disabled = true;
    var top = el('div', 'ch-card__top');
    top.appendChild(el('span', 'ch-card__order', ch.scriptNo || ('剧本 ' + String(order).padStart(2, '0'))));
    if (ch.code) top.appendChild(el('span', 'ch-card__code', ch.code));
    if (!open) top.appendChild(el('span', 'ch-card__lock', '筹备中'));
    card.appendChild(top);
    var nameRow = el('div', 'ch-card__name-row');
    nameRow.appendChild(el('h3', 'ch-card__name', challengeTitle(ch)));
    nameRow.appendChild(stars(ch.difficultyStars));
    card.appendChild(nameRow);
    if (ch.subtitle) card.appendChild(el('p', 'ch-card__sub', ch.subtitle));
    if (ch.tags && ch.tags.length) {
      var tags = el('div', 'ch-card__tags');
      for (var i = 0; i < ch.tags.length; i++) tags.appendChild(el('span', 'tag', ch.tags[i]));
      card.appendChild(tags);
    }
    var meta = el('div', 'ch-card__meta');
    meta.appendChild(el('span', 'ch-card__meta-i', '难度 ' + (ch.difficulty || '—')));
    if (ch.duration) meta.appendChild(el('span', 'ch-card__meta-i', ch.duration));
    meta.appendChild(el('span', 'ch-card__record', open ? recordLine(ch.id) : '尚未开放'));
    card.appendChild(meta);
    var chAi2 = aiStateFor(ch.id);
    if (chAi2 && chAi2.battles) card.appendChild(el('p', 'ch-card__ai', 'AI 已学习 ' + chAi2.battles + ' 局'));
    if (extremeInfo(ch)) {
      var unlockedNow = isExtremeUnlocked(ch.id);
      var exTag = el('span', 'tag tag--mode' + (unlockedNow ? ' is-on' : ' is-off'), unlockedNow ? '极限已解锁' : '极限 · 未解锁');
      exTag.setAttribute('title', unlockedNow ? '可在剧本简介里切换极限模式' : extremeUnlockHint(ch));
      card.appendChild(exTag);
    }
    if (open) {
      on(card, 'click', function () { startChallengeWithBriefing(ch); });
    }
    return card;
  }

  function upcomingCard(up, order) {
    var card = el('div', 'ch-card is-locked is-upcoming');
    var top = el('div', 'ch-card__top');
    top.appendChild(el('span', 'ch-card__order', '筹备中'));
    top.appendChild(el('span', 'ch-card__lock', '即将开放'));
    card.appendChild(top);
    var nameRow = el('div', 'ch-card__name-row');
    nameRow.appendChild(el('h3', 'ch-card__name', up.name || '下一场残局'));
    card.appendChild(nameRow);
    card.appendChild(el('p', 'ch-card__desc', up.note || '新的敌人配置与卡组将陆续开放'));
    return card;
  }

  /* ----------------------------------------------------- 开局 / 继续 / 返回 */
  function startChallengeWithBriefing(ch) {
    showBriefing(ch);
  }

  function startBattleWithChallenge(challengeId, mode) {
    closeModal(true); closeOverlay(); closeLogDrawer(true);
    ui.handBuilt = false; ui.battle = null; ui.viewState = null;
    ui.playback = null; ui.busy = false; ui.resultShown = false; ui.resultRecorded = false;
    ui.ghostTurns = {}; ui.prevLogLen = null; ui.logSeen = 0; ui.logRenderedLen = -1; ui.logOpen = false; ui.lastDemo = null;
    ui.handHint = ''; ui.manualHint = ''; ui.selectedIndex = null;
    ui.blogExpanded = false;
    ui.challengeId = challengeId || '';
    ui.currentChallenge = challengeView(getChallengeById(challengeId));
    var cvNow = ui.currentChallenge || {};
    var wantMode = (mode === 'extreme') ? 'extreme' : (mode === 'standard' ? 'standard' : selectedMode(ui.challengeId));
    if (wantMode === 'extreme' && !isExtremeUnlocked(ui.challengeId)) wantMode = 'standard';
    if (wantMode === 'extreme' && !extremeInfo(cvNow)) wantMode = 'standard';
    ui.pendingMode = wantMode;

    if (!engineReady()) { showFatal('战斗引擎未加载', '请确认 js/engine.js / js/cards.js / js/enemy.js 已就位后刷新。'); return; }
    var b = null;
    try { b = window.JZ.startBattle({ challengeId: ui.challengeId || undefined, mode: wantMode }); } catch (e) { b = null; }
    if (!b || !b.state || !b.state.player) { showFatal('战斗引擎启动失败', 'startBattle() 没有返回有效对局。'); return; }
    ui.battle = b;
    ui.currentChallenge = currentChallengeView() || ui.currentChallenge;
    clearSave();
    ui.prevLogLen = (b.state.log || []).length;
    var actualMode = battleMode(b.state);
    ui.pendingMode = actualMode;
    if (wantMode === 'extreme' && actualMode !== 'extreme') toast('极限模式暂未生效（引擎未就绪），本局按标准进行');
    recordAttempt(ui.challengeId || (ui.currentChallenge && ui.currentChallenge.id) || 'shark', actualMode);
    showScreen('battle');
    renderBattle();
    saveNow();
    if (!ui.tutorialDone) showTutorial();
    else showDefenseHintOnce();
  }

  function continueSavedBattle() {
    var info = saveInfo();
    if (!info) { toast('没有可继续的存档'); renderMenu(); return; }
    var raw = storeGet('localStorage', SAVE_KEY);
    var b = null;
    try { b = window.JZ.restoreBattle(raw); } catch (e) { b = null; }
    if (!b || !b.state || !b.state.player || b.state.stage === 'over') {
      clearSave(); toast('存档已失效，请重新开始'); renderMenu(); return;
    }
    ui.battle = b;
    ui.handBuilt = false; ui.viewState = null; ui.playback = null; ui.busy = false;
    ui.resultShown = false; ui.resultRecorded = false; ui.ghostTurns = {}; ui.logSeen = (b.state.log || []).length;
    ui.logRenderedLen = -1;
    ui.prevLogLen = ui.logSeen; ui.lastDemo = null;
    ui.handHint = ''; ui.manualHint = ''; ui.selectedIndex = null;
    ui.blogExpanded = false;
    ui.challengeId = info.challengeId || (b.state.challenge && b.state.challenge.id) || '';
    ui.pendingMode = battleMode(b.state);
    ui.currentChallenge = currentChallengeView() || challengeView(getChallengeById(ui.challengeId)) || { name: info.challengeName };
    showScreen('battle');
    renderBattle();
    toast('继续上局 · 第 ' + num(b.state.turn, 1) + ' 回合');
  }

  function leaveBattleFlow() {
    if (ui.busy) { toast('演出中，请稍候'); return; }
    showConfirm('返回菜单？', '当前进度已自动存档，可以从菜单「继续上局」回来。', function () {
      if (ui.battle) saveNow();
      closeLogDrawer(true);
      showScreen('menu');
    });
  }

  function engineReady() { return !!(window.JZ && typeof window.JZ.startBattle === 'function'); }

  /* =========================================================================
   * PART B · 战斗渲染
   * ======================================================================= */
  function cloneState(s) { try { return JSON.parse(JSON.stringify(s)); } catch (e) { return s; } }

  function readPlayable(real) {
    ui.playableCards = null; ui.playableManuals = null;
    if (!ui.battle) return;
    try {
      var pc = ui.battle.playableCards();
      if (pc && typeof pc.length === 'number') ui.playableCards = pc;
    } catch (e) { }
    try {
      var pm = ui.battle.playableManuals();
      if (pm && typeof pm.length === 'number') ui.playableManuals = pm;
    } catch (e) { }
    void real;
  }
  function playableCardAt(index) {
    var list = ui.playableCards;
    if (list) for (var i = 0; i < list.length; i++) if (list[i] && list[i].index === index) return list[i];
    return { index: index, playable: true, reason: '' };
  }
  function playableManualById(id) {
    var list = ui.playableManuals;
    if (list) for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return { id: id, playable: true, reason: '' };
  }

  function captureScroll() {
    var out = { hand: 0, log: 0 };
    try { if (ui.nodes.handScroll) out.hand = ui.nodes.handScroll.scrollLeft || 0; } catch (e) { }
    try { if (ui.nodes.logList) out.log = ui.nodes.logList.scrollTop || 0; } catch (e) { }
    return out;
  }
  function restoreScroll(v) {
    if (!v) return;
    try { if (ui.nodes.handScroll) ui.nodes.handScroll.scrollLeft = v.hand; } catch (e) { }
    try { if (ui.nodes.logList) ui.nodes.logList.scrollTop = v.log; } catch (e) { }
  }

  function renderBattle() {
    try {
      renderBattleCore();
    } catch (err) {
      ui.renderError = String((err && err.message) || err);
      try { toast('界面渲染异常：' + ui.renderError); } catch (e) { }
    }
  }

  function renderBattleCore() {
    if (!ui.battle || !ui.nodes.battle) return;
    var real = ui.battle.state;
    if (!real || !real.player) return;
    var s = ui.viewState || real;
    if (!ui.playback) readPlayable(real);
    pruneArtBoxes();
    var scroll = captureScroll();
    renderBtop(s, real);
    renderEnemies(s, real);
    renderDemo(s);
    renderBlog(real);
    renderPlayer(s, real);
    renderManuals(s, real);
    renderHand(s, real);
    renderActionbar(s, real);
    renderLogDrawer(real);
    restoreScroll(scroll);
    updateHandNav();
  }

  function renderBtop(s) {
    var cv = currentChallengeView() || {};
    var sys = systemInfo();
    if (ui.nodes.btopTitle) ui.nodes.btopTitle.textContent = sys.name;
    if (ui.nodes.turnNum) ui.nodes.turnNum.textContent = String(num(s.turn, 1));
    if (ui.nodes.chalChip) ui.nodes.chalChip.textContent = challengeTitle(cv) + (cv.subtitle ? '　' + cv.subtitle : '');
    if (ui.nodes.modeBadge) {
      var exMode = battleMode(s) === 'extreme';
      setHidden(ui.nodes.modeBadge, !exMode);
      ui.nodes.modeBadge.textContent = '极限';
    }
  }

  /* ------------------------------------------------------------ 倾向标记区 */
  function intentMarks(e, opts) {
    opts = opts || {};
    var box = el('div', 'imarks' + (opts.sm ? ' imarks--sm' : ''));
    if (e.hidden) {
      var h = markIcon('hidden', 'mark--dim');
      h.setAttribute('title', '隐藏意图：不可消除/转换，也不计入按意图计算的效果');
      box.appendChild(h);
      box.appendChild(el('span', 'imarks__unknown', '意图未知'));
      return box;
    }
    var it = e.intents || {};
    var any = false;
    for (var i = 0; i < INTENT_KEYS.length; i++) {
      var k = INTENT_KEYS[i];
      var n = num(it[k], 0);
      for (var c = 0; c < n; c++) {
        var m = markIcon(k);
        m.setAttribute('title', MARK_MAP[k].label);
        box.appendChild(m);
        any = true;
      }
    }
    if (!any) box.appendChild(el('span', 'imarks__none', '无意图'));
    return box;
  }

  function intentBlock(e, labelText, opts) {
    var row = el('div', 'irow' + (opts && opts.sm ? ' irow--sm' : ''));
    var lab = el('span', 'irow__label');
    lab.appendChild(icon('eye'));
    lab.appendChild(el('span', null, labelText || '意图'));
    row.appendChild(lab);
    row.appendChild(intentMarks(e, opts || {}));
    return row;
  }

  function defenseBadges(e, opts) {
    opts = opts || {};
    var box = el('div', 'dbadges' + (opts.sm ? ' dbadges--sm' : ''));
    var any = false;
    var keys = [['block', '格挡'], ['dodge', '闪避'], ['hua', '化劲']];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i][0], label = keys[i][1];
      var v = num(e[k], 0);
      if (!opts.always && v <= 0) continue;
      var b = opts.clickable ? el('button', 'dbadge dbadge--' + k) : el('span', 'dbadge dbadge--' + k);
      if (opts.clickable) { b.type = 'button'; b.setAttribute('aria-label', label + ' 说明'); }
      b.appendChild(icon(k));
      b.appendChild(el('b', 'dbadge__v', v));
      b.setAttribute('title', label + ' ' + v);
      if (opts.clickable) on(b, 'click', showDefenseInfo);
      box.appendChild(b);
      if (v > 0) any = true;
    }
    if (num(e.dmgBonus) > 0) {
      var atk = el('span', 'dbadge dbadge--atk');
      atk.appendChild(icon('buff'));
      atk.appendChild(el('b', 'dbadge__v', num(e.dmgBonus)));
      atk.setAttribute('title', '本回合每次伤害 +' + num(e.dmgBonus));
      box.appendChild(atk);
      any = true;
    }
    if (!any && !opts.always) { if (opts.sm) return null; box.appendChild(el('span', 'dbadges__none', '无护体')); }
    return box;
  }

  /* ----------------------------------------------------------- Boss 血条 */
  /* 伪映射：把 HP 三等分，分别占 1/4 / 1/2 / 1/4 的条长（R12） */
  function pseudoRatio(cur, max) {
    if (max <= 0) return 0;
    var c = clamp(cur, 0, max);
    var seg = max / 3;
    if (c >= max - seg) return 0.75 + (c - (max - seg)) / seg * 0.25;
    if (c >= max - seg * 2) return 0.25 + (c - (max - seg * 2)) / seg * 0.5;
    return (c / seg) * 0.25;
  }
  function bossBarValue(boss) {
    var fake = num(boss.phase, 1) === 2 ? num(boss.fakeHp, 0) : 0;
    var fakeMax = num(boss.phase, 1) === 2 ? num(boss.fakeMax, 20) : 0;
    return { cur: num(boss.hp, 0) + fake, max: num(boss.maxHp, 60) + fakeMax };
  }
  function bossMeter(boss) {
    var v = bossBarValue(boss);
    var wrap = el('div', 'meter meter--boss');
    var fill = el('div', 'meter__fill');
    try { fill.style.width = Math.round(pseudoRatio(v.cur, v.max) * 1000) / 10 + '%'; } catch (e) { }
    wrap.appendChild(fill);
    var nodes = (ui.bossData && ui.bossData.phaseNodes) || [];
    var triggered = (ui.battle && ui.battle.state.nodesTriggered) || {};
    if (num(boss.phase, 1) === 1) {
      var ticks = el('div', 'meter__ticks');
      for (var i = 0; i < nodes.length; i++) {
        var n = num(nodes[i], 0);
        var tk = el('i', 'meter__tick' + (triggered[String(n)] ? ' is-done' : ''));
        try { tk.style.left = Math.round(pseudoRatio(n, v.max) * 1000) / 10 + '%'; } catch (e) { }
        ticks.appendChild(tk);
      }
      wrap.appendChild(ticks);
    }
    /* 只保留主血条 + 阶段刻度：不再附加任何分隔线/装饰条，避免伪血条看起来变成两条 */
    return wrap;
  }
  /* ------------------------------------------------------------ 敌人区域 */
  function renderEnemies(s) {
    var zone = ui.nodes.enemies;
    if (!zone) return;
    clear(zone);
    var enemies = s.enemies || [];
    var boss = null, minions = [];
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e) continue;
      if (e.kind === 'boss' || e.unitType === 'boss' || e.id === 'boss') boss = e;
      else minions.push(e);
    }
    if (boss) zone.appendChild(bossCard(boss));
    else zone.appendChild(el('p', 'empty-note', '敌方首领未出现'));

    var visible = [];
    for (var j = 0; j < minions.length; j++) {
      var m = minions[j];
      if (m.alive !== false) { delete ui.ghostTurns[m.id]; visible.push({ e: m, ghost: false }); continue; }
      if (!ui.ghostTurns[m.id]) ui.ghostTurns[m.id] = num(s.turn, 1);
      if (ui.ghostTurns[m.id] === num(s.turn, 1)) visible.push({ e: m, ghost: true });
    }
    if (visible.length) {
      var grid = el('div', 'mgrid');
      for (var k = 0; k < visible.length; k++) grid.appendChild(minionCard(visible[k].e, visible[k].ghost));
      zone.appendChild(grid);
    } else {
      zone.appendChild(el('p', 'empty-note empty-note--mini', '场上暂无杂兵'));
    }
  }

  function enemyTags(e, opts) {
    var row = el('div', 'etags');
    if (e.kind === 'boss') row.appendChild(el('span', 'tag tag--code', (ui.bossData && ui.bossData.code) || ''));
    else {
      var nat = '';
      if (ui.bossData && ui.bossData.minions && ui.bossData.minions[e.unitType]) nat = ui.bossData.minions[e.unitType].nature || '';
      if (nat) row.appendChild(el('span', 'tag tag--mini', nat));
    }
    if (e.kind === 'boss') row.appendChild(el('span', 'tag tag--phase', num(e.phase, 1) === 2 ? '罐碎' : '罐中'));
    if (e.hidden) row.appendChild(el('span', 'tag tag--hidden', '隐藏意图'));
    if (num(e.mcTurns) > 0) row.appendChild(el('span', 'tag tag--mc', '被操控 ×' + num(e.mcTurns)));
    if (opts && opts.ghost) row.appendChild(el('span', 'tag tag--dead', '已倒下'));
    return row;
  }

  function bossCard(e) {
    var cv = currentChallengeView() || {};
    var card = el('article', 'bcard' + (num(e.phase, 1) === 2 ? ' is-phase2' : '') + (e.alive === false ? ' is-dead' : ''));
    card.setAttribute('data-enemy-id', e.id || 'boss');
    var artWrap = el('div', 'bcard__art');
    var name = displayBossName(e.name);
    artWrap.appendChild(artBox('main:' + (num(e.phase, 1) === 2 ? 'boss2' : 'boss1'), name, 'art--boss', assetBase() + IMG[num(e.phase, 1) === 2 ? 'boss2' : 'boss1']));
    card.appendChild(artWrap);
    var body = el('div', 'bcard__body');
    var head = el('div', 'bcard__head');
    head.appendChild(el('h2', 'bcard__name', name));
    head.appendChild(enemyTags(e));
    body.appendChild(head);
    if (cv.subtitle) body.appendChild(el('p', 'bcard__sub', cv.subtitle));
    body.appendChild(bossMeter(e));
    body.appendChild(intentBlock(e, '意图', {}));
    var db = defenseBadges(e, {});
    if (db) body.appendChild(db);
    card.appendChild(body);
    ui.anchors[e.id || 'boss'] = card;
    ui.anchors.boss = card;
    return card;
  }

  function minionCard(e, ghost) {
    var card = el('article', 'mcard' + (ghost ? ' is-ghost' : ''));
    card.setAttribute('data-enemy-id', e.id);
    var artWrap = el('div', 'mcard__art');
    var key = e.unitType === 'crab' ? 'crab' : 'shrimp';
    artWrap.appendChild(artBox('main:' + key, e.name, 'art--minion', assetBase() + IMG[key]));
    card.appendChild(artWrap);
    var body = el('div', 'mcard__body');
    var top = el('div', 'mcard__top');
    top.appendChild(el('span', 'mcard__name', e.name || '杂兵'));
    top.appendChild(enemyTags(e, { ghost: ghost }));
    body.appendChild(top);
    var maxHp = Math.max(1, num(e.maxHp, 1));
    var meter = el('div', 'meter meter--mini');
    var fill = el('div', 'meter__fill');
    try { fill.style.width = Math.round(clamp(num(e.hp, 0) / maxHp, 0, 1) * 100) + '%'; } catch (err2) { }
    meter.appendChild(fill);
    body.appendChild(meter);
    if (!ghost) body.appendChild(intentMarks(e, { sm: true }));
    var db = defenseBadges(e, { sm: true });
    if (db) body.appendChild(db);
    card.appendChild(body);
    ui.anchors[e.id] = card;
    return card;
  }

  function displayBossName(name) {
    var n = String(name || '罐中鲨');
    var bd = ui.bossData;
    if (bd && bd.collabSuffix) n = n + bd.collabSuffix;
    return n;
  }

  /* ------------------------------------------------------------ 演示区 */
  function renderDemo(s) {
    var zone = ui.nodes.demo;
    if (!zone) return;
    clear(zone);
    var pb = ui.playback;
    var step = pb && pb.steps && pb.steps[pb.idx] ? pb.steps[pb.idx] : null;
    if (!step) {
      var idle = el('div', 'demo__idle');
      var k = el('p', 'demo__k');
      k.appendChild(icon('play'));
      k.appendChild(el('span', null, '战斗演示'));
      idle.appendChild(k);
      idle.appendChild(el('p', 'demo__hint', '出牌 / 结束回合后，这里逐招播放：招式 · 目标 · 伤害 · 消耗意图'));
      if (ui.lastDemo && ui.lastDemo.summary) idle.appendChild(el('p', 'demo__last', '上一招：' + ui.lastDemo.summary));
      idle.appendChild(el('p', 'demo__tiny', '点击演示区或空格键可加速 · 「跳过」立即结算'));
      zone.appendChild(idle);
      return;
    }
    var act = el('div', 'demo__act demo__act--' + (step.kind || 'misc'));
    var art;
    if (step.cardId) art = skillArtBox(step.cardId, step.artLabel || '招');
    else if (step.kind === 'enemy-skill') { ensureMain('ink'); if (mainOK('ink')) art = artBox('main:ink', step.name, 'art--demo', assetBase() + IMG.ink); else art = charArtBox('影', 'art--demo art--demo-ink'); }
    else if (step.kind === 'manual') art = charArtBox('秘', 'art--demo');
    else if (step.kind === 'phase') art = charArtBox('碎', 'art--demo art--demo-phase');
    else if (step.kind === 'result') art = charArtBox(step.win ? '胜' : '败', 'art--demo');
    else art = charArtBox(step.char || '战', 'art--demo');
    act.appendChild(art);
    var body = el('div', 'demo__body');
    /* 标题独占一行（kicker + 招式名同行，不换行；超长省略，完整名放 title） */
    var head = el('div', 'demo__head');
    if (step.kicker) head.appendChild(el('span', 'demo__kicker', step.kicker));
    var nameEl = el('h3', 'demo__name', step.name || '');
    nameEl.setAttribute('title', step.name || '');
    head.appendChild(nameEl);
    if (step.marks && step.marks.length) {
      var mk = el('div', 'demo__marks');
      for (var i = 0; i < step.marks.length; i++) {
        var mi = markIcon(step.marks[i].kind, step.marks[i].spent ? 'mark--spent' : '');
        mi.setAttribute('title', MARK_MAP[step.marks[i].kind] ? MARK_MAP[step.marks[i].kind].label : '');
        mk.appendChild(mi);
      }
      head.appendChild(mk);
    }
    body.appendChild(head);
    /* 伤害/防御行：纵向固定行高列表，最新一条自动滚到底；不再绝对定位/不等高 */
    if (step.lines && step.lines.length) {
      var list = el('div', 'demo__lines');
      for (var j = 0; j < step.lines.length; j++) {
        var line = el('div', 'demo__line ' + (step.lines[j].cls || ''), step.lines[j].text);
        line.setAttribute('title', step.lines[j].text);
        list.appendChild(line);
      }
      body.appendChild(list);
      setTimeout(function () { try { list.scrollTop = list.scrollHeight || 0; } catch (e) { } }, 0);
    }
    act.appendChild(body);
    var ctrl = el('div', 'demo__ctrl');
    var acc = el('button', 'btn btn--ghost demo__acc', (pb.speed > 1 ? '加速 ×' + pb.speed : '加速 ×3'));
    acc.type = 'button'; on(acc, 'click', function (ev) { ev.stopPropagation && ev.stopPropagation(); acceleratePlayback(); });
    var skip = el('button', 'btn btn--primary demo__skip', '跳过');
    skip.type = 'button'; on(skip, 'click', function (ev) { ev.stopPropagation && ev.stopPropagation(); finishPlayback(true); });
    ctrl.appendChild(acc); ctrl.appendChild(skip);
    act.appendChild(ctrl);
    on(act, 'click', function () { acceleratePlayback(); });
    zone.appendChild(act);
  }

  function skillArtBox(cardId, label) {
    var key = 'skill:' + cardId;
    var url = assetBase() + SKILL_DIR + cardId + '.webp';
    if (!ui.imgChecked[key]) attemptImage(key, url);
    /* 剪影缺图：回退「水墨冲击 + 大字」（大字由旁边的 demo__name 承担） */
    if (ui.imgChecked[key] === false) return charArtBox('招', 'art--demo art--demo-ink');
    var box = el('div', 'art art--demo');
    ui.artBoxes.push({ box: box, key: key, label: label || '招', url: url });
    paintArtBox(box, key, label || '招', url);
    return box;
  }

  /* ---------------------------------------------------- 常驻战斗记录面板 */
  function blogLineLimit() {
    if (ui.blogExpanded) return 60;
    try {
      if (window.innerHeight && window.innerHeight <= 720) return 2;
      if (window.innerHeight && window.innerHeight <= 900) return 3;
    } catch (e) { }
    return 10;
  }
  function renderBlog(real) {
    var list = ui.nodes.blogList;
    if (!list) return;
    var src = (ui.playback && ui.playback.blogLines) ? ui.playback.blogLines : ((real && real.log) || []);
    var recent = src.slice(-blogLineLimit());
    var blog = ui.nodes.blog;
    if (blog) {
      if (ui.blogExpanded) addClass(blog, 'is-expanded'); else removeClass(blog, 'is-expanded');
    }
    if (ui.nodes.blogToggle) ui.nodes.blogToggle.textContent = ui.blogExpanded ? '收起' : '展开';
    clear(list);
    if (!recent.length) {
      list.appendChild(el('li', 'blog__line blog__line--guide', '战斗开始后，这里会实时滚动显示最近的战斗记录'));
      return;
    }
    for (var i = 0; i < recent.length; i++) {
      var e = recent[i] || {};
      var li = el('li', 'blog__line blog__line--' + (LOG_KIND_LABEL[e.kind] ? e.kind : 'system'), e.text || '');
      li.setAttribute('title', e.text || '');
      list.appendChild(li);
    }
    try { list.scrollTop = list.scrollHeight || 0; } catch (err) { }
  }

  function stepLogKind(step) {
    switch (step && step.kind) {
      case 'player-card': return 'card';
      case 'manual': return 'manual';
      case 'enemy-skill': return 'intent';
      case 'turn': return 'turn';
      case 'summon': return 'summon';
      case 'phase': return 'phase';
      case 'draw': return 'system';
      case 'defeat': return 'damage';
      case 'result': return step.win ? 'win' : 'lose';
      default: return step && step.logKind ? step.logKind : 'system';
    }
  }
  function appendBlogStep(step) {
    var lines = ui.playback && ui.playback.blogLines;
    if (!lines || !step) return;
    var headText = (step.kicker ? step.kicker + ' · ' : '') + (step.name || step.summary || '');
    if (headText) lines.push({ kind: stepLogKind(step), text: headText });
    for (var i = 0; i < (step.lines || []).length; i++) {
      var ln = step.lines[i];
      lines.push({ kind: ln.cls === 'is-damage' ? 'damage' : (ln.cls === 'is-heal' ? 'heal' : (ln.cls === 'is-gain' ? 'defense' : stepLogKind(step))), text: ln.text || '' });
    }
    while (lines.length > 40) lines.shift();
  }

  /* ------------------------------------------------------------ 玩家区域 */
  function renderPlayer(s) {
    var zone = ui.nodes.player;
    if (!zone) return;
    clear(zone);
    var p = s.player || {};
    var dataPlayer = (ui.data && ui.data.cards && ui.data.cards.player) || {};

    /* R10：本回合已出牌序列 */
    var played = el('div', 'played');
    var pl = el('div', 'played__head');
    pl.appendChild(el('span', 'played__title', '本回合已出'));
    var seq = el('div', 'played__seq');
    var list = p.playedThisTurn || [];
    if (!list.length) addClass(played, 'is-empty');
    if (!list.length) seq.appendChild(el('span', 'played__empty', '尚未出牌'));
    for (var i = 0; i < list.length; i++) {
      var item = list[i] || {};
      var card = ui.cardMap[item.id] || {};
      var chip = el('span', 'played__chip');
      chip.appendChild(markIcon(ROUTE_MARK[item.route] || 'hidden'));
      chip.appendChild(el('span', 'played__name', card.name || item.id || ''));
      chip.setAttribute('title', (card.name || item.id) + ' · ' + (MARK_MAP[ROUTE_MARK[item.route]] ? MARK_MAP[ROUTE_MARK[item.route]].label : ''));
      seq.appendChild(chip);
    }
    pl.appendChild(seq);
    played.appendChild(pl);
    zone.appendChild(played);

    var card = el('div', 'pcard');
    var artWrap = el('div', 'pcard__art');
    artWrap.appendChild(artBox('main:player', p.name || dataPlayer.name || '易金权', 'art--avatar', assetBase() + IMG.player));
    card.appendChild(artWrap);

    var main = el('div', 'pcard__main');
    var head = el('div', 'pcard__head');
    head.appendChild(el('span', 'pcard__name', p.name || dataPlayer.name || '易金权'));
    if (dataPlayer.title) head.appendChild(el('span', 'pcard__title', dataPlayer.title));
    var plays = el('span', 'pill pill--plays', '出牌 ' + num(p.playsUsed, 0) + '/' + num(p.playLimit, 5));
    head.appendChild(plays);
    main.appendChild(head);

    var maxHp = Math.max(1, num(p.maxHp, num(dataPlayer.maxHp, 40)));
    var meter = el('div', 'meter meter--player');
    var fill = el('div', 'meter__fill');
    try { fill.style.width = Math.round(clamp(num(p.hp, 0) / maxHp, 0, 1) * 100) + '%'; } catch (e) { }
    meter.appendChild(fill);
    meter.appendChild(el('span', 'meter__label', num(p.hp, 0) + ' / ' + maxHp));
    main.appendChild(meter);

    var stats = el('div', 'pcard__stats');
    var db = defenseBadges(p, { clickable: true, always: true });
    if (db) stats.appendChild(db);

    var buff = p.dmgBuff || {};
    if (num(buff.cardsLeft) > 0 || num(buff.turnBonus) > 0) {
      var b1 = el('span', 'chip chip--buff');
      b1.appendChild(icon('buff'));
      b1.appendChild(el('span', null, '增伤 +' + num(buff.perCard, 0) + ' ×' + (num(buff.cardsLeft, 0) + num(buff.turnBonus, 0))));
      stats.appendChild(b1);
    }
    if (num(p.dmgMinus) > 0) {
      var b2 = el('span', 'chip chip--warn');
      b2.appendChild(icon('sword')); b2.appendChild(el('span', null, '伤害 -' + num(p.dmgMinus)));
      stats.appendChild(b2);
    }
    var lock = p.routeLock || {};
    if (num(lock.count) > 0) {
      var b3 = el('span', 'chip chip--warn');
      b3.appendChild(icon('lock')); b3.appendChild(el('span', null, '前 ' + num(lock.count) + ' 张视为隐藏'));
      stats.appendChild(b3);
    }
    if (p.icePearl) { var b4 = el('span', 'chip chip--buff'); b4.appendChild(icon('spark')); b4.appendChild(el('span', null, '玄寒珠')); stats.appendChild(b4); }
    if (p.multiSplash) { var b5 = el('span', 'chip chip--buff'); b5.appendChild(icon('target')); b5.appendChild(el('span', null, '黑白错 · 可加 2 目标')); stats.appendChild(b5); }
    var reflect = p.reflect || {};
    if (num(reflect.count) > 0) { var b6 = el('span', 'chip chip--buff'); b6.appendChild(icon('shieldDot')); b6.appendChild(el('span', null, '天罗地网 ×' + num(reflect.count))); stats.appendChild(b6); }
    if (num(p.bonusDraw) > 0) { var b7 = el('span', 'chip chip--info'); b7.appendChild(icon('draw')); b7.appendChild(el('span', null, '下回合多抽 ' + num(p.bonusDraw))); stats.appendChild(b7); }
    if (num(p.hitOnBossThisTurn) > 0) { var b8 = el('span', 'chip chip--info'); b8.appendChild(icon('target')); b8.appendChild(el('span', null, '命中首领 ×' + num(p.hitOnBossThisTurn))); stats.appendChild(b8); }
    main.appendChild(stats);
    card.appendChild(main);
    zone.appendChild(card);
    ui.anchors.player = card;
  }

  /* ------------------------------------------------------------ 秘笈区 */
  function shortManualName(name) {
    var n = String(name || '秘笈');
    var idx = n.indexOf('·');
    return (idx >= 0 && idx < n.length - 1) ? n.slice(idx + 1) : n;
  }
  function routeProgress(seq, routes) {
    if (!seq || !routes || !routes.length) return 0;
    var hist = routes.join(''), best = 0;
    for (var start = 0; start < hist.length; start++) {
      var k = 0;
      while (k < seq.length && start + k < hist.length && hist.charAt(start + k) === seq.charAt(k)) k++;
      if (k > best) best = k;
      if (best >= seq.length) break;
    }
    return best;
  }
  function defaultManualHint(s) {
    var p = s.player || {};
    var list = p.manuals || [], used = 0;
    for (var i = 0; i < list.length; i++) if (list[i].used) used++;
    if (list.length && used >= list.length) return '秘笈已全部翻面';
    if (num(p.manualsUsedThisTurn, 0) >= 1) return '本回合已结算 1 张秘笈';
    if (!ui.playableManuals) return '按倾向顺序连出可触发（每回合限 1 张）';
    for (var j = 0; j < ui.playableManuals.length; j++) if (ui.playableManuals[j] && ui.playableManuals[j].playable) return '路数已满足 · 点秘笈触发（每回合限 1 张）';
    return '暂无秘笈满足倾向要求（点按看原因）';
  }
  function renderManuals(s) {
    var zone = ui.nodes.manuals;
    if (!zone) return;
    clear(zone);
    var head = el('div', 'zone__head');
    var title = el('h2', 'zone__title');
    title.appendChild(icon('book')); title.appendChild(el('span', null, '秘笈'));
    head.appendChild(title);
    head.appendChild(el('span', 'zone__hint' + (ui.manualHint ? ' is-warn' : ''), ui.manualHint || defaultManualHint(s)));
    zone.appendChild(head);
    var p = s.player || {};
    var routes = (p.playedThisTurn || []).map(function (x) { return x.route; });
    var list = p.manuals || [];
    var scroller = el('div', 'mcards');
    for (var i = 0; i < list.length; i++) {
      var entry = list[i] || {};
      var data = ui.manualMap[entry.id] || { name: entry.id, routeSeq: '', desc: '' };
      var pm = playableManualById(entry.id);
      var stateCls = entry.used ? 'is-used' : (pm.playable ? 'is-playable' : 'is-blocked');
      var stateText = entry.used ? '已翻面' : (pm.playable ? '可触发' : '未满足');
      var btn = el('button', 'mcard2 ' + stateCls);
      btn.type = 'button';
      btn.setAttribute('data-manual-id', entry.id);
      btn.setAttribute('title', (data.name || '') + '　需倾向：' + (data.routeSeq || '—') + (data.desc ? '　' + data.desc : ''));
      var headRow = el('div', 'mcard2__head');
      headRow.appendChild(el('span', 'mcard2__name', shortManualName(data.name || entry.id)));
      headRow.appendChild(el('span', 'mcard2__state', stateText));
      btn.appendChild(headRow);
      var seq = String(data.routeSeq || '');
      var seqBox = el('span', 'mcard2__seq');
      var prog = entry.used ? 0 : routeProgress(seq, routes);
      for (var k = 0; k < seq.length; k++) {
        var ch = seq.charAt(k);
        var mkind = ROUTE_MARK[ch] || 'hidden';
        var mk = markIcon(mkind, 'mark--sm' + (!entry.used && k < prog ? ' is-done' : ''));
        mk.setAttribute('title', MARK_MAP[mkind].label);
        seqBox.appendChild(mk);
      }
      btn.appendChild(seqBox);
      btn.appendChild(el('span', 'mcard2__desc', data.desc || ''));
      on(btn, 'click', (function (id) { return function () { manualClick(id); }; })(entry.id));
      scroller.appendChild(btn);
    }
    zone.appendChild(scroller);
  }
  function ROUTE_MAP_LABEL(ch) { return ROUTE_MARK[ch] || 'hidden'; }

  /* ------------------------------------------------------------ 手牌区 */
  function updateHandNav() {
    var sc = ui.nodes.handScroll;
    var left = ui.nodes.handLeft, right = ui.nodes.handRight;
    if (!sc || !left || !right) return;
    var max = (sc.scrollWidth || 0) - (sc.clientWidth || 0);
    var overflow = max > 4;
    setHidden(left, !overflow);
    setHidden(right, !overflow);
    if (!overflow) return;
    var pos = sc.scrollLeft || 0;
    left.disabled = pos <= 2;
    right.disabled = pos >= max - 2;
  }
  function scrollHandBy(dir) {
    var sc = ui.nodes.handScroll;
    if (!sc) return;
    var step = Math.max(80, Math.round((sc.clientWidth || 240) * 0.8));
    var max = Math.max(0, (sc.scrollWidth || 0) - (sc.clientWidth || 0));
    sc.scrollLeft = clamp((sc.scrollLeft || 0) + dir * step, 0, max);
    updateHandNav();
  }
  function onHandWheel(ev) {
    var sc = ui.nodes.handScroll;
    if (!sc) return;
    var d = ev.deltaY || ev.deltaX || 0;
    var max = (sc.scrollWidth || 0) - (sc.clientWidth || 0);
    if (!d || max <= 0) return;
    var before = sc.scrollLeft || 0;
    sc.scrollLeft = clamp(before + d, 0, max);
    if (sc.scrollLeft !== before && ev.preventDefault) ev.preventDefault();
  }

  function renderHand(s) {
    var zone = ui.nodes.hand;
    if (!zone) return;
    var p = s.player || {};
    var hand = p.hand || [];
    if (!ui.handBuilt) {
      clear(zone);
      var head = el('div', 'hand__head');
      var title = el('h2', 'hand__title', '手牌');
      var count = el('b', 'hand__count', '0');
      title.appendChild(count);
      head.appendChild(title);
      var meta = el('span', 'hand__meta');
      var pile = el('span', 'hand__pile');
      pile.appendChild(artBox('main:cardBack', '卡背', 'art--pile', assetBase() + IMG.cardBack));
      meta.appendChild(pile);
      var deckInfo = el('span', 'hand__deckinfo', '');
      meta.appendChild(deckInfo);
      head.appendChild(meta);
      var hint = el('span', 'hand__hint', '');
      head.appendChild(hint);
      var handRow = el('div', 'hand__row');
      var leftBtn = el('button', 'hand__nav hand__nav--left');
      leftBtn.type = 'button'; leftBtn.setAttribute('aria-label', '向左翻手牌'); leftBtn.appendChild(icon('back'));
      setHidden(leftBtn, true);
      var scroll = el('div', 'hand__scroll');
      scroll.setAttribute('tabindex', '0');
      scroll.setAttribute('aria-label', '手牌，可横向滑动');
      var track = el('div', 'hand__track');
      scroll.appendChild(track);
      var rightBtn = el('button', 'hand__nav hand__nav--right');
      rightBtn.type = 'button'; rightBtn.setAttribute('aria-label', '向右翻手牌'); rightBtn.appendChild(icon('chevron'));
      setHidden(rightBtn, true);
      handRow.appendChild(leftBtn); handRow.appendChild(scroll); handRow.appendChild(rightBtn);
      zone.appendChild(head); zone.appendChild(handRow);
      ui.nodes.handCount = count; ui.nodes.handDeckInfo = deckInfo;
      ui.nodes.handHintEl = hint; ui.nodes.handScroll = scroll; ui.nodes.handTrack = track;
      ui.nodes.handLeft = leftBtn; ui.nodes.handRight = rightBtn;
      on(leftBtn, 'click', function () { scrollHandBy(-1); });
      on(rightBtn, 'click', function () { scrollHandBy(1); });
      on(scroll, 'scroll', updateHandNav);
      on(scroll, 'wheel', onHandWheel);
      var drag = { on: false, x: 0, left: 0, moved: false };
      on(scroll, 'pointerdown', function (ev) { drag.on = true; drag.x = ev.clientX || 0; drag.left = scroll.scrollLeft || 0; drag.moved = false; });
      on(scroll, 'pointermove', function (ev) {
        if (!drag.on) return;
        var dx = (ev.clientX || 0) - drag.x;
        if (Math.abs(dx) > 5) drag.moved = true;
        if (!drag.moved) return;
        var max = (scroll.scrollWidth || 0) - (scroll.clientWidth || 0);
        scroll.scrollLeft = clamp(drag.left - dx, 0, Math.max(0, max));
        if (ev.preventDefault) ev.preventDefault();
      });
      function endDrag() {
        if (drag.moved) ui.suppressClickUntil = Date.now() + 300;
        drag.on = false; drag.moved = false; updateHandNav();
      }
      on(scroll, 'pointerup', endDrag);
      on(scroll, 'pointercancel', endDrag);
      on(scroll, 'pointerleave', endDrag);
      ui.handBuilt = true;
    }
    ui.nodes.handCount.textContent = String(hand.length);
    ui.nodes.handDeckInfo.textContent = '牌库 ' + (p.deck || []).length + ' · 弃牌 ' + (p.discard || []).length;
    ui.nodes.handHintEl.textContent = ui.handHint || '点卡出牌 · 长按看完整描述';
    if (ui.handHint) addClass(ui.nodes.handHintEl, 'is-warn'); else removeClass(ui.nodes.handHintEl, 'is-warn');
    var track = ui.nodes.handTrack;
    if (!track) return;
    clear(track);
    if (!hand.length) { track.appendChild(el('p', 'empty-note', '手牌已空，结束回合看敌方行动')); return; }
    for (var i = 0; i < hand.length; i++) {
      var card = ui.cardMap[hand[i]] || { id: hand[i], name: hand[i], type: '', route: '', desc: '', select: 'none' };
      track.appendChild(handCardNode(card, i, playableCardAt(i)));
    }
    updateHandNav();
  }

  function handCardNode(card, index, pc) {
    var blocked = pc && pc.playable === false;
    var markKind = ROUTE_MARK[card.route] || 'hidden';
    var node = el('div', 'card ' + (blocked ? 'is-blocked' : 'is-playable') + (ui.selectedIndex === index ? ' is-selected' : ''));
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('data-index', String(index));
    node.setAttribute('aria-label', (card.name || '') + '，倾向 ' + (MARK_MAP[markKind] ? MARK_MAP[markKind].label : '') + '，' + (card.type || '') + (blocked ? '，不可打出' : '，可打出'));
    if (blocked && pc.reason) node.setAttribute('title', '不可打出：' + pc.reason);
    var top = el('div', 'card__top');
    var mk = markIcon(markKind);
    mk.setAttribute('title', MARK_MAP[markKind] ? MARK_MAP[markKind].label : '');
    top.appendChild(mk);
    var more = el('span', 'card__more');
    more.setAttribute('role', 'button'); more.setAttribute('tabindex', '0'); more.setAttribute('aria-label', '查看完整描述');
    more.appendChild(icon('info'));
    top.appendChild(more);
    node.appendChild(top);
    /* 卡名独占一行，窄屏允许两行，保证「常式·破气弹」这类完整可读 */
    node.appendChild(el('span', 'card__name', card.name || ''));
    node.appendChild(el('span', 'card__desc', card.desc || ''));
    var foot = el('div', 'card__foot');
    foot.appendChild(el('span', 'card__type2', card.type || '卡'));
    foot.appendChild(el('span', 'card__sel', selectHint(card.select)));
    foot.appendChild(el('span', 'card__state', blocked ? '不可' : '可出'));
    node.appendChild(foot);
    void node;

    var pressTimer = null;
    function cancelPress() { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } }
    on(node, 'pointerdown', function () {
      cancelPress();
      pressTimer = setTimeout(function () {
        pressTimer = null; ui.suppressClickUntil = Date.now() + 700;
        openCardDetail(card, index, pc);
      }, 520);
    });
    on(node, 'pointerup', cancelPress);
    on(node, 'pointercancel', cancelPress);
    on(node, 'pointerleave', cancelPress);
    on(node, 'click', function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      if (Date.now() < ui.suppressClickUntil) return;
      handCardClick(index, card, pc);
    });
    on(node, 'keydown', function (ev) {
      var key = ev && (ev.key || ev.keyCode);
      if (key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 13 || key === 32) {
        if (ev.preventDefault) ev.preventDefault();
        handCardClick(index, card, pc);
      }
    });
    on(more, 'click', function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      if (ev && ev.preventDefault) ev.preventDefault();
      openCardDetail(card, index, pc);
    });
    return node;
  }

  function selectHint(select) {
    switch (select) {
      case 'enemy': return '选敌';
      case 'enemies3': return '多目标';
      case 'minion': return '选杂兵';
      case 'route': return '宣言倾向';
      case 'convert': return '转意图';
      case 'bet': return '投上限';
      case 'jqIntentsDynamic': case 'jqIntents8': case 'jqIntents6': return '消意图';
      default: return '直接出';
    }
  }

  /* ------------------------------------------------------------ 操作条 */
  function renderActionbar(s, real) {
    var n = ui.nodes;
    if (!n) return;
    var stage = s.stage || 'player';
    var p = s.player || {};
    var playsLeft = Math.max(0, num(p.playLimit, 5) - num(p.playsUsed, 0));
    var canEnd = stage === 'player' && !ui.busy && !ui.playback;
    if (n.endTurnBtn) {
      n.endTurnBtn.disabled = !canEnd;
      if (canEnd) { addClass(n.endTurnBtn, 'is-ready'); removeClass(n.endTurnBtn, 'is-disabled'); }
      else { addClass(n.endTurnBtn, 'is-disabled'); removeClass(n.endTurnBtn, 'is-ready'); }
      clear(n.endTurnBtn);
      n.endTurnBtn.appendChild(icon('chevron'));
      n.endTurnBtn.appendChild(el('span', 'btn__label',
        ui.busy ? '演出中…' : (stage === 'player' ? '结束回合' : (stage === 'enemy' ? '敌方行动中' : '对局结束'))));
    }
    if (n.actionHint) {
      var hint = '';
      if (ui.busy) {
        var pb = ui.playback;
        hint = '演出中 · 点击演示区加速 / 跳过';
        if (pb && pb.steps && pb.steps[pb.idx]) hint = (pb.steps[pb.idx].kicker ? pb.steps[pb.idx].kicker + ' · ' : '') + (pb.steps[pb.idx].name || '') + '（点击加速）';
      } else if (stage === 'player') {
        hint = playsLeft <= 0 ? '本回合出牌已用尽 · 结束回合看敌方结算' : '第 ' + num(s.turn, 1) + ' 回合 · 还可出 ' + playsLeft + ' 张 · 点卡出牌';
      } else if (stage === 'enemy') hint = '敌方行动中…';
      else hint = '对局已结束';
      n.actionHint.textContent = hint;
    }
    if (n.logDot && real) {
      var unseen = (real.log || []).length > ui.logSeen;
      setHidden(n.logDot, !(unseen && !ui.logOpen));
    }
  }

  function renderLogDrawer(real, force) {
    var list = ui.nodes.logList;
    if (!list || !real) return;
    var log = real.log || [];
    /* 抽屉收起时只在日志长度变化时重建，避免演出逐步重渲染时重复铺长列表 */
    if (!force && !ui.logOpen && ui.logRenderedLen === log.length) return;
    ui.logRenderedLen = log.length;
    clear(list);
    if (!log.length) { list.appendChild(el('li', 'log log--system', '尚无战斗记录')); return; }
    for (var i = 0; i < log.length; i++) {
      var entry = log[i] || {};
      var kind = LOG_KIND_LABEL[entry.kind] ? entry.kind : 'system';
      var li = el('li', 'log log--' + kind);
      li.appendChild(el('span', 'log__k', LOG_KIND_LABEL[kind] || '系统'));
      li.appendChild(el('span', 'log__t', entry.text || ''));
      list.appendChild(li);
    }
    if (ui.logOpen) { try { list.scrollTop = list.scrollHeight || 0; } catch (e) { } }
  }


  /* =========================================================================
   * PART C · 交互 / 弹窗 / 逐招演出
   * ======================================================================= */
  function callEngine(fn) {
    var res;
    try { res = fn(); } catch (err) { return { ok: false, reason: '引擎异常：' + String((err && err.message) || err) }; }
    if (res && res.ok === false) return res;
    return res || { ok: true };
  }

  function actionBlocked() {
    if (ui.busy || ui.playback) { toast('演出中，请稍候（可点演出去加速/跳过）'); return true; }
    if (!ui.battle) return true;
    return false;
  }

  /* ------------------------------------------------------------ 出牌 / 秘笈 */
  function handCardClick(index, card, pc) {
    if (actionBlocked()) return;
    var s = ui.battle.state;
    if (s.stage !== 'player') { toast('敌方行动中，请稍候'); return; }
    if (pc && pc.playable === false) {
      ui.handHint = '「' + card.name + '」不可打出：' + (pc.reason || '条件不足');
      toast(ui.handHint); renderBattle(); return;
    }
    ui.selectedIndex = index;
    markCardSelected(index);
    var select = card.select || 'none';
    if (select === 'none') { playCardNow(index, {}); return; }
    var extraAllowed = !!(s.player && s.player.multiSplash) && card.type === '招式' &&
      (select === 'enemy' || (select === 'route' && card.id === 'YJQ-AQ-14'));
    ui.lastExtraAllowed = extraAllowed;
    openChoice(select, {
      title: card.name,
      subtitle: '出牌 · ' + (card.type || '卡') + ' · 倾向「' + (MARK_MAP[ROUTE_MARK[card.route]] ? MARK_MAP[ROUTE_MARK[card.route]].label : '隐藏') + '」',
      desc: card.desc || '',
      card: card,
      extraAllowed: extraAllowed,
      onClose: function () { ui.selectedIndex = null; if (ui.battle) renderBattle(); }
    }, function (choice) { playCardNow(index, choice); });
  }

  function markCardSelected(index) {
    var track = ui.nodes.handTrack;
    if (!track) return;
    for (var i = 0; i < track.childNodes.length; i++) {
      var n = track.childNodes[i];
      if (!n || !n.getAttribute) continue;
      var raw = n.getAttribute('data-index');
      if (raw === null || raw === undefined) continue;
      if (Number(raw) === index) addClass(n, 'is-selected'); else removeClass(n, 'is-selected');
    }
  }

  function playCardNow(index, choice) {
    if (!ui.battle) return;
    ui.selectedIndex = null;
    var before = cloneState(ui.battle.state);
    var res = callEngine(function () { return ui.battle.playCard(index, choice || {}); });
    if (!res.ok) { toast('无法打出：' + (res.reason || '条件不足')); renderBattle(); return; }
    ui.handHint = '';
    saveNow();
    startPlayback(before, res.events);
  }

  function manualClick(id) {
    if (actionBlocked()) return;
    var s = ui.battle.state;
    if (s.stage !== 'player') { toast('敌方行动中，请稍候'); return; }
    openManualDetail(id);
  }

  /* 秘笈详情：常驻完整效果 + 触发按钮（点秘笈先看全文，再触发） */
  function openManualDetail(id) {
    var pm = playableManualById(id);
    var data = ui.manualMap[id] || { name: id, routeSeq: '', desc: '', select: 'none' };
    var entry = null;
    var list = (ui.battle.state.player.manuals || []);
    for (var mi = 0; mi < list.length; mi++) if (list[mi].id === id) entry = list[mi];
    var blocked = !!(pm && pm.playable === false);
    var body = el('div', 'mdetail');
    var seqBox = el('div', 'mdetail__seq');
    var seq = String(data.routeSeq || '');
    for (var k = 0; k < seq.length; k++) {
      var mk2 = markIcon(ROUTE_MARK[seq.charAt(k)] || 'hidden', 'mark--lg');
      mk2.setAttribute('title', MARK_MAP[ROUTE_MARK[seq.charAt(k)] || 'hidden'].label);
      seqBox.appendChild(mk2);
    }
    body.appendChild(el('p', 'mdetail__req', '触发要求：本回合已出牌倾向顺序中，连续出现以上序列'));
    body.appendChild(seqBox);
    body.appendChild(el('p', 'mdetail__desc', data.desc || '（暂无描述）'));
    if (entry && entry.used) body.appendChild(el('p', 'mdetail__state is-blocked', '本场已翻面，不可再用'));
    else if (blocked) body.appendChild(el('p', 'mdetail__state is-blocked', '当前不可触发：' + (pm.reason || '条件不足')));
    else body.appendChild(el('p', 'mdetail__state', '当前可触发（每回合限 1 张，触发后翻面）'));
    var btns = [modalButton('关闭', 'ghost', function () { closeModal(); })];
    if (!blocked) btns.push(modalButton('触发', 'primary', function () { closeModal(true); manualTrigger(id); }));
    showModal({ title: data.name || id, subtitle: '秘笈 · 每回合限 1 张', body: body, buttons: btns });
  }

  function manualTrigger(id) {
    var pm = playableManualById(id);
    var data = ui.manualMap[id] || { name: id, routeSeq: '', desc: '', select: 'none' };
    if (pm && pm.playable === false) {
      ui.manualHint = '「' + shortManualName(data.name || id) + '」不可触发：' + (pm.reason || '条件不足');
      toast(ui.manualHint); renderBattle(); return;
    }
    if (!data.select || data.select === 'none') { playManualNow(id, {}); return; }
    openChoice(data.select, {
      title: data.name || id,
      subtitle: '秘笈 · 倾向「' + (data.routeSeq || '—') + '」· 每回合限 1 张',
      desc: data.desc || '',
      onClose: function () { if (ui.battle) renderBattle(); }
    }, function (choice) { playManualNow(id, choice); });
  }

  function playManualNow(id, choice) {
    if (!ui.battle) return;
    var before = cloneState(ui.battle.state);
    var res = callEngine(function () { return ui.battle.playManual(id, choice || {}); });
    if (!res.ok) { toast('无法触发：' + (res.reason || '条件不足')); renderBattle(); return; }
    ui.manualHint = '';
    saveNow();
    startPlayback(before, res.events);
  }

  function endTurnFlow() {
    if (actionBlocked()) return;
    var s = ui.battle.state;
    if (s.stage !== 'player') { toast('敌方行动中，请稍候'); return; }
    if (ui.modal) { toast('请先完成当前选择'); return; }
    closeLogDrawer(true);
    var before = cloneState(s);
    var res = callEngine(function () { return ui.battle.endTurn(); });
    if (!res.ok) { toast('无法结束回合：' + (res.reason || '条件不足')); return; }
    ui.handHint = ''; ui.manualHint = '';
    saveNow();
    startPlayback(before, res.events);
  }

  /* =========================================================================
   * 逐招演出（events → 时间线 → 演出区）
   * ======================================================================= */
  var HEADER_TYPES = {
    'card-play': 1, 'manual-play': 1, 'skill-start': 1, 'turn-start': 1, 'turn-end': 1,
    'summon': 1, 'phase': 1, 'draw': 1, 'battle-end': 1, 'defeat': 1, 'buff': 1
  };

  function buildTimeline(events, before, after) {
    if (!Array.isArray(events) || !events.length) return fallbackTimeline(before, after);
    var steps = [], cur = null;
    for (var i = 0; i < events.length; i++) {
      var ev = events[i] || {};
      if (HEADER_TYPES[ev.t]) { cur = { header: ev, events: [ev], details: [] }; steps.push(cur); continue; }
      if (!cur) { cur = { header: null, events: [], details: [] }; steps.push(cur); }
      cur.events.push(ev);
      if (ev.t === 'damage' || ev.t === 'heal' || ev.t === 'gain') cur.details.push(ev);
    }
    var out = [];
    for (var k = 0; k < steps.length; k++) {
      var d = decorateStep(steps[k]);
      if (d) out.push(d);
    }
    return out;
  }

  function lineOfDamage(ev) {
    var text = (ev.fromName || '') + ' → ' + (ev.toName || '') + '：' + num(ev.dealt, ev.amount || 0) + ' 点';
    var bits = [];
    if (ev.dodged) bits.push('闪避');
    if (num(ev.blocked) > 0) bits.push('格挡 ' + num(ev.blocked));
    if (num(ev.hua) > 0) bits.push('化劲 ' + num(ev.hua));
    if (bits.length) text += '（' + bits.join(' / ') + '）';
    else if (num(ev.dealt, 0) <= 0) text += '（未破防）';
    return { text: text, cls: 'is-damage' };
  }
  function decorateStep(step) {
    var h = step.header || {};
    var d = { kind: 'misc', kicker: '', name: '', marks: [], lines: [], events: step.events, summary: '' };
    switch (h.t) {
      case 'card-play':
        d.kind = 'player-card'; d.kicker = '我方出招'; d.name = h.name || '';
        d.cardId = h.cardId; d.artLabel = '招';
        d.marks = [{ kind: ROUTE_MARK[h.route] || 'hidden' }];
        if (h.targets && h.targets.length) d.lines.push({ text: '目标：' + targetNames(h.targets) });
        break;
      case 'manual-play':
        d.kind = 'manual'; d.kicker = '秘笈触发'; d.name = h.name || ''; break;
      case 'skill-start':
        d.kind = 'enemy-skill'; d.kicker = (h.enemyName || '敌人') + ' 施展'; d.name = h.skillName || '';
        var cost = h.cost || {};
        for (var i = 0; i < INTENT_KEYS.length; i++) for (var c = 0; c < num(cost[INTENT_KEYS[i]], 0); c++) d.marks.push({ kind: INTENT_KEYS[i], spent: true });
        break;
      case 'turn-start':
        d.kind = 'turn'; d.kicker = '回合开始'; d.name = '第 ' + num(h.turn, 1) + ' 回合'; break;
      case 'turn-end':
        d.kind = 'turn'; d.kicker = '回合结束'; d.name = '敌方行动'; break;
      case 'summon':
        d.kind = 'summon'; d.kicker = '召唤'; d.name = (h.name || '小怪') + ' 出现'; d.char = '妖'; break;
      case 'phase':
        d.kind = 'phase'; d.kicker = '阶段变化'; d.name = '罐碎 · 进入二阶段'; d.char = '碎';
        if (h.summons && h.summons.length) d.lines.push({ text: '召唤：' + h.summons.join('、') });
        break;
      case 'draw':
        d.kind = 'draw'; d.kicker = '摸牌'; d.name = '摸 ' + num(h.count, 0) + ' 张';
        break;
      case 'battle-end':
        d.kind = 'result'; d.kicker = h.winner === 'player' ? '胜利' : '战败';
        d.name = h.winner === 'player' ? '罐中鲨伏诛' : '千手散尽'; d.win = h.winner === 'player';
        if (h.reason) d.lines.push({ text: h.reason });
        break;
      case 'defeat':
        d.kind = 'defeat'; d.kicker = '击破'; d.name = (h.name || '') + ' 倒下'; break;
      case 'buff':
        d.kind = 'buff'; d.kicker = '效果'; d.name = h.text || ''; break;
      default:
        d.kind = 'misc'; d.kicker = '结算'; d.name = ''; break;
    }
    for (var j = 0; j < step.details.length; j++) {
      var ev = step.details[j];
      if (ev.t === 'damage') d.lines.push(lineOfDamage(ev));
      else if (ev.t === 'heal') d.lines.push({ text: (ev.toName || '') + ' 恢复 ' + num(ev.amount, 0) + ' 点', cls: 'is-heal' });
      else if (ev.t === 'gain') d.lines.push({ text: (ev.toName || '') + ' ' + (STAT_LABEL[ev.stat] || ev.stat) + ' +' + num(ev.v, 0), cls: 'is-gain' });
    }
    d.summary = d.kicker + (d.name ? ' · ' + d.name : '');
    return d;
  }

  function fallbackTimeline(before, after) {
    var prev = (before && before.log) || [];
    var cur = (after && after.log) || [];
    var added = cur.slice(prev.length);
    if (!added.length) added = [{ kind: 'system', text: after && after.stage === 'over' ? '对局结束' : '完成结算' }];
    var steps = [];
    for (var i = 0; i < added.length; i++) {
      var l = added[i] || {};
      steps.push({
        kind: 'log', logKind: l.kind, kicker: LOG_KIND_LABEL[l.kind] || '记录', name: '',
        marks: [], events: [],
        lines: [{ text: l.text || '', cls: 'is-log' }],
        summary: l.text || ''
      });
    }
    return steps;
  }

  function targetNames(ids) {
    var s = ui.battle ? ui.battle.state : null;
    var names = [];
    for (var i = 0; i < (ids || []).length; i++) {
      var id = ids[i];
      if (id === 'player') names.push('易金权');
      else {
        var found = '';
        if (s && s.enemies) for (var j = 0; j < s.enemies.length; j++) if (s.enemies[j].id === id) found = s.enemies[j].name;
        names.push(found || id);
      }
    }
    return names.join('、');
  }

  function findViewEntity(vs, id) {
    if (!vs) return null;
    if (id === 'player') return vs.player;
    for (var i = 0; i < (vs.enemies || []).length; i++) if (vs.enemies[i].id === id) return vs.enemies[i];
    return null;
  }

  function applyEventToView(vs, ev) {
    if (!vs || !ev) return;
    var target;
    switch (ev.t) {
      case 'damage':
        target = findViewEntity(vs, ev.toId);
        if (target) {
          if (ev.hpAfter !== undefined) target.hp = ev.hpAfter;
          if (ev.blockAfter !== undefined) target.block = ev.blockAfter;
          if (ev.dodgeAfter !== undefined) target.dodge = ev.dodgeAfter;
          if (ev.huaAfter !== undefined) target.hua = ev.huaAfter;
          if (ev.fakeHpAfter !== undefined) target.fakeHp = ev.fakeHpAfter;
          if (ev.aliveAfter === false) target.alive = false;
        }
        break;
      case 'heal':
        target = findViewEntity(vs, ev.toId);
        if (target && ev.hpAfter !== undefined) target.hp = ev.hpAfter;
        break;
      case 'gain':
        target = findViewEntity(vs, ev.toId);
        if (target) target[ev.stat] = ev.totalAfter;
        break;
      case 'skill-start':
        target = findViewEntity(vs, ev.enemyId);
        if (target) { target.hidden = false; if (ev.remain) target.intents = { jq: num(ev.remain.jq, 0), bs: num(ev.remain.bs, 0), lh: num(ev.remain.lh, 0) }; }
        break;
      case 'summon':
        if (!findViewEntity(vs, ev.enemyId)) {
          vs.enemies.push({
            id: ev.enemyId, name: ev.name, kind: 'minion', unitType: ev.unitType || 'shrimp',
            hp: num(ev.hp, 1), maxHp: num(ev.hp, 1), fakeHp: 0, fakeMax: 0, phase: 1,
            block: 0, dodge: 0, hua: 0, intents: { jq: 0, bs: 0, lh: 0 }, hidden: false,
            intentSetId: '', intentLabel: '', intentPool: 0, dmgBonus: 0, alive: true, mcTurns: 0
          });
        }
        break;
      case 'phase':
        target = null;
        for (var i = 0; i < (vs.enemies || []).length; i++) if (vs.enemies[i].kind === 'boss') target = vs.enemies[i];
        if (target) { target.phase = num(ev.to, 2); if (ev.fakeHp !== undefined) target.fakeHp = ev.fakeHp; }
        if (ev.node) vs.nodesTriggered[String(ev.node)] = true;
        break;
      case 'defeat':
        target = findViewEntity(vs, ev.id);
        if (target) target.alive = false;
        break;
      case 'turn-start':
        vs.turn = num(ev.turn, vs.turn);
        break;
      case 'card-play':
        try {
          var hi = (vs.player.hand || []).indexOf(ev.cardId);
          if (hi >= 0) { vs.player.hand.splice(hi, 1); vs.player.discard.push(ev.cardId); }
          vs.player.playsUsed = num(vs.player.playsUsed, 0) + 1;
          vs.player.playedThisTurn = (vs.player.playedThisTurn || []).concat([{ id: ev.cardId, route: ev.route || '特', type: ev.type || '' }]);
        } catch (e) { }
        break;
      case 'manual-play':
        try {
          for (var mi = 0; mi < (vs.player.manuals || []).length; mi++) if (vs.player.manuals[mi].id === ev.cardId) vs.player.manuals[mi].used = true;
          vs.player.manualsUsedThisTurn = 1;
        } catch (e) { }
        break;
      case 'battle-end':
        vs.stage = 'over'; vs.winner = ev.winner || null; vs.endReason = ev.reason || '';
        break;
      default: break;
    }
  }

  function applyStep(step) {
    var vs = ui.viewState;
    if (!vs || !step) return;
    for (var i = 0; i < step.events.length; i++) applyEventToView(vs, step.events[i]);
  }

  function stepFx(step) {
    if (!step) return;
    for (var i = 0; i < step.events.length; i++) {
      var ev = step.events[i];
      if (ev.t === 'damage') {
        var amount = num(ev.dealt, 0);
        if (amount > 0) { spawnFloater('-' + amount, 'damage', anchorFor(ev.toId)); spawnBlood(anchorFor(ev.toId)); }
        if (num(ev.blocked) > 0 || ev.dodged) spawnFloater(ev.dodged ? '闪避' : '格挡', 'block', anchorFor(ev.toId));
      } else if (ev.t === 'heal') {
        var heal = num(ev.amount, 0);
        if (heal > 0) spawnFloater('+' + heal, 'heal', anchorFor(ev.toId));
      } else if (ev.t === 'phase') {
        spawnRipple();
      } else if (ev.t === 'skill-start') {
        var node = anchorFor(ev.enemyId);
        if (node) { addClass(node, 'is-acting'); setTimeout(function () { if (node) removeClass(node, 'is-acting'); }, 650); }
      }
    }
  }

  function startPlayback(before, events) {
    if (!ui.battle) return;
    var after = ui.battle.state;
    var steps = buildTimeline(events, before, after);
    ui.selectedIndex = null;
    if (!steps.length) { finishAction(); return; }
    ui.busy = true;
    hideToast();
    ui.playback = { steps: steps, idx: -1, speed: 1, timer: null, before: before, after: after };
    ui.playback.blogLines = ((before && before.log) || []).slice(-12).map(function (l) { return { kind: l.kind, text: l.text }; });
    ui.viewState = cloneState(before);
    ui.lastDemo = null;
    renderBattle();
    ui.playback.timer = setTimeout(advancePlayback, 140);
  }

  function advancePlayback() {
    var pb = ui.playback;
    if (!pb) return;
    pb.idx += 1;
    if (pb.idx >= pb.steps.length) { finishPlayback(false); return; }
    var step = pb.steps[pb.idx];
    applyStep(step);
    ui.lastDemo = step;
    appendBlogStep(step);
    renderBattle();
    updateAudioForState();
    stepFx(step);
    scheduleStep();
  }

  function scheduleStep() {
    var pb = ui.playback;
    if (!pb) return;
    if (pb.timer) clearTimeout(pb.timer);
    var delay = Math.max(170, Math.round(760 / (pb.speed || 1)));
    pb.timer = setTimeout(function () { if (ui.playback === pb) advancePlayback(); }, delay);
  }

  function acceleratePlayback() {
    var pb = ui.playback;
    if (!pb) return;
    pb.speed = pb.speed >= 6 ? 8 : (pb.speed >= 3 ? 6 : 3);
    renderBattle();
    scheduleStep();
  }

  function finishPlayback(skipped) {
    var pb = ui.playback;
    if (!pb) return;
    if (pb.timer) clearTimeout(pb.timer);
    ui.playback = null;
    ui.viewState = null;
    ui.busy = false;
    if (skipped) { /* 立即结算，演出区显示上一招 */ }
    if (ui.battle) ui.prevLogLen = (ui.battle.state.log || []).length;
    renderBattle();
    updateAudioForState();
    saveNow();
    if (ui.battle) handleResult(ui.battle.state);
  }

  function finishAction() {
    ui.busy = false;
    ui.playback = null;
    ui.viewState = null;
    if (ui.battle) ui.prevLogLen = (ui.battle.state.log || []).length;
    renderBattle();
    updateAudioForState();
    saveNow();
    if (ui.battle) handleResult(ui.battle.state);
  }

  /* --------------------------------------------------------------- 弹窗基础 */
  function modalButton(label, kind, handler, disabled) {
    var btn = el('button', 'btn btn--' + (kind || 'ghost'), label);
    btn.type = 'button';
    if (disabled) btn.disabled = true;
    on(btn, 'click', function () { if (!btn.disabled) handler(); });
    return btn;
  }
  function showModal(cfg) {
    var root = ui.nodes.modalRoot;
    if (!root) return;
    if (ui.modal) { setHidden(root, true); clear(root); ui.modal = null; }
    setHidden(root, false); clear(root);
    var scrim = el('div', 'modal__scrim');
    var sheet = el('div', 'modal');
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
    var head = el('div', 'modal__head');
    var titles = el('div', 'modal__titles');
    titles.appendChild(el('h2', 'modal__title', cfg.title || '选择'));
    if (cfg.subtitle) titles.appendChild(el('p', 'modal__sub', cfg.subtitle));
    head.appendChild(titles);
    if (cfg.dismissible !== false) {
      var x = el('button', 'btn btn--icon modal__close');
      x.type = 'button'; x.setAttribute('aria-label', '关闭'); x.appendChild(icon('close'));
      on(x, 'click', function () { closeModal(); });
      head.appendChild(x);
    }
    sheet.appendChild(head);
    var body = el('div', 'modal__body');
    if (cfg.desc) body.appendChild(el('p', 'modal__desc', cfg.desc));
    if (cfg.body) body.appendChild(cfg.body);
    sheet.appendChild(body);
    if (cfg.buttons && cfg.buttons.length) {
      var foot = el('div', 'modal__foot');
      for (var i = 0; i < cfg.buttons.length; i++) foot.appendChild(cfg.buttons[i]);
      sheet.appendChild(foot);
    }
    scrim.appendChild(sheet); root.appendChild(scrim);
    if (cfg.dismissible !== false) on(scrim, 'click', function (ev) { if (ev && ev.target === scrim) closeModal(); });
    ui.modal = { root: root, sheet: sheet, cfg: cfg };
    if (cfg.focusEl && typeof cfg.focusEl.focus === 'function') { try { cfg.focusEl.focus(); } catch (e) { } }
  }
  function closeModal(silent) {
    var prev = ui.modal;
    if (ui.nodes.modalRoot) { setHidden(ui.nodes.modalRoot, true); clear(ui.nodes.modalRoot); }
    ui.modal = null;
    if (!silent && prev && prev.cfg && typeof prev.cfg.onClose === 'function') { try { prev.cfg.onClose(); } catch (e) { } }
  }
  function showConfirm(title, text, onYes) {
    var body = el('div', 'confirm');
    body.appendChild(el('p', 'confirm__text', text));
    showModal({
      title: title, body: body,
      buttons: [modalButton('取消', 'ghost', function () { closeModal(); }), modalButton('确定', 'danger', function () { closeModal(true); onYes(); })]
    });
  }

  /* ------------------------------------------------------------- 选择器 */
  function aliveEnemies(s) {
    var out = [], list = (s && s.enemies) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].alive !== false) out.push(list[i]);
    return out;
  }
  function unitArtKey(e) {
    if (e.kind === 'boss') return 'main:' + (num(e.phase, 1) === 2 ? 'boss2' : 'boss1');
    return 'main:' + (e.unitType === 'crab' ? 'crab' : 'shrimp');
  }
  function unitArtUrl(e) {
    if (e.kind === 'boss') return assetBase() + IMG[num(e.phase, 1) === 2 ? 'boss2' : 'boss1'];
    return assetBase() + IMG[e.unitType === 'crab' ? 'crab' : 'shrimp'];
  }
  function collectJqMarks(s) {
    var out = [], list = (s && s.enemies) || [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || e.alive === false || e.hidden) continue;
      var n = num(e.intents && e.intents.jq, 0);
      for (var k = 0; k < n; k++) out.push({ enemyId: e.id, enemyName: e.name || e.id, index: k + 1 });
    }
    return out;
  }
  function enemyRow(e, opts) {
    opts = opts || {};
    var blocked = opts.blockedReason || '';
    var row = el('button', 'tgt' + (blocked ? ' is-disabled' : ''));
    row.type = 'button'; row.setAttribute('data-enemy-id', e.id);
    if (blocked) row.setAttribute('title', blocked);
    var artWrap = el('div', 'tgt__art');
    artWrap.appendChild(artBox(opts.artKey || unitArtKey(e), e.name, 'art--tgt', unitArtUrl(e)));
    row.appendChild(artWrap);
    var info = el('div', 'tgt__info');
    var top = el('div', 'tgt__top');
    top.appendChild(el('strong', 'tgt__name', e.name || e.id));
    if (e.kind === 'boss') top.appendChild(el('span', 'tag tag--mini', num(e.phase, 1) === 2 ? '罐碎' : '罐中'));
    else if (ui.bossData && ui.bossData.minions && ui.bossData.minions[e.unitType]) top.appendChild(el('span', 'tag tag--mini', ui.bossData.minions[e.unitType].nature || '杂兵'));
    if (e.hidden) top.appendChild(el('span', 'tag tag--hidden', '隐藏意图'));
    info.appendChild(top);
    var maxHp = Math.max(1, num(e.maxHp, 1));
    var meter = el('div', 'meter meter--tgt');
    var fill = el('div', 'meter__fill');
    try { fill.style.width = Math.round(clamp(num(e.hp, 0) / maxHp, 0, 1) * 100) + '%'; } catch (err) { }
    meter.appendChild(fill);
    info.appendChild(meter);
    var row2 = el('div', 'tgt__row');
    row2.appendChild(intentMarks(e, { sm: true }));
    var db = defenseBadges(e, { sm: true });
    if (db) row2.appendChild(db);
    info.appendChild(row2);
    if (blocked) info.appendChild(el('p', 'tgt__reason', blocked));
    row.appendChild(info);
    return row;
  }
  function markSelectedRows(rows, id) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === id) addClass(rows[i].node, 'is-selected'); else removeClass(rows[i].node, 'is-selected');
    }
  }
  function enemySection(s, opts) {
    var wrap = el('div', 'tgt-list'), rows = [], list = aliveEnemies(s);
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var blocked = opts.blockedReason ? (opts.blockedReason(e) || '') : '';
      var row = enemyRow(e, { blockedReason: blocked });
      if (!blocked) on(row, 'click', (function (enemy) { return function () { opts.onPick(enemy); }; })(e));
      wrap.appendChild(row); rows.push({ id: e.id, node: row });
    }
    if (!list.length) wrap.appendChild(el('p', 'empty-note', '场上没有存活的敌人'));
    return { wrap: wrap, rows: rows };
  }

  function openChoice(select, opts, onConfirm) {
    if (!ui.battle) return;
    opts = opts || {};
    var s = ui.battle.state;
    var body = el('div', 'choice');
    var confirmBtn = null, complete = false;
    function setComplete(v) { complete = !!v; if (confirmBtn) confirmBtn.disabled = !complete; }
    function note(t) { return el('p', 'choice__note', t); }
    function section(t) { var sec = el('div', 'choice__sec'); sec.appendChild(el('h3', 'choice__title', t)); return sec; }
    var value = {}, i;
    var extraAllowed = !!opts.extraAllowed;

    switch (select) {
      case 'enemy': {
        var mainRows = [], mainId = null, extraIds = [];
        var extraArea = el('div', 'choice__sec');
        var refreshExtra = function () {
          if (!extraAllowed) return;
          clear(extraArea);
          extraArea.appendChild(el('h3', 'choice__title', '黑白错 · 额外目标（最多 2 个，可不选）'));
          var list = aliveEnemies(s).filter(function (e) { return e.id !== mainId; });
          if (!list.length) { extraArea.appendChild(note('没有其他存活敌人')); return; }
          var grid = el('div', 'tgt-list');
          for (var k = 0; k < list.length; k++) {
            var e = list[k];
            var row = enemyRow(e, {});
            if (extraIds.indexOf(e.id) >= 0) addClass(row, 'is-selected');
            on(row, 'click', (function (enemy, node) {
              return function () {
                var idx = extraIds.indexOf(enemy.id);
                if (idx >= 0) { extraIds.splice(idx, 1); removeClass(node, 'is-selected'); }
                else {
                  if (extraIds.length >= 2) { toast('最多再选 2 个额外目标'); return; }
                  extraIds.push(enemy.id); addClass(node, 'is-selected');
                }
                value.extraTargetIds = extraIds.slice();
                refreshExtra();
              };
            })(e, row));
            grid.appendChild(row);
          }
          extraArea.appendChild(grid);
          extraArea.appendChild(note('已选 ' + extraIds.length + ' / 2（主目标：' + targetNames([mainId]) + '）'));
        };
        var main = enemySection(s, {
          onPick: function (e) {
            mainId = e.id; value.targetId = e.id;
            markSelectedRows(mainRows, e.id);
            extraIds = extraIds.filter(function (x) { return x !== mainId; });
            value.extraTargetIds = extraIds.slice();
            refreshExtra();
            setComplete(true);
          }
        });
        mainRows = main.rows;
        var secMain = section('选择 1 个敌人');
        secMain.appendChild(main.wrap);
        body.appendChild(secMain);
        if (extraAllowed) {
          refreshExtra();
          body.appendChild(extraArea);
        }
        setComplete(false);
        break;
      }
      case 'enemies3': {
        var picked = {}, countNote = note('已选 0 个 · 再点一次取消'), mRows = [];
        var multi = enemySection(s, {
          onPick: function (e) {
            if (picked[e.id]) delete picked[e.id];
            else { if (Object.keys(picked).length >= 3) { toast('最多选择 3 个敌人'); return; } picked[e.id] = true; }
            value.targetIds = Object.keys(picked);
            for (var r = 0; r < mRows.length; r++) { if (picked[mRows[r].id]) addClass(mRows[r].node, 'is-selected'); else removeClass(mRows[r].node, 'is-selected'); }
            countNote.textContent = '已选 ' + Object.keys(picked).length + ' 个 · 再点一次取消';
          }
        });
        mRows = multi.rows;
        var secMulti = section('选择最多 3 个敌人（可不选）');
        secMulti.appendChild(multi.wrap); secMulti.appendChild(countNote);
        body.appendChild(secMulti); value.targetIds = []; setComplete(true);
        break;
      }
      case 'minion': {
        var minions = aliveEnemies(s).filter(function (e) { return e.kind === 'minion'; });
        var secMinion = section('选择 1 个杂兵');
        if (!minions.length) { secMinion.appendChild(note('场上没有存活的杂兵')); setComplete(false); }
        else {
          var mWrap = el('div', 'tgt-list'), minRows = [];
          for (var mi = 0; mi < minions.length; mi++) {
            var me = minions[mi];
            var mrow = enemyRow(me, {});
            on(mrow, 'click', (function (enemy) { return function () { value.targetId = enemy.id; markSelectedRows(minRows, enemy.id); setComplete(true); }; })(me));
            mWrap.appendChild(mrow); minRows.push({ id: me.id, node: mrow });
          }
          secMinion.appendChild(mWrap); setComplete(false);
        }
        body.appendChild(secMinion);
        break;
      }
      case 'route': {
        var routeRows = [], targetArea = el('div', 'choice__sec');
        var routeButtons = [], routeExtraIds = [];
        /* 黑白错额外目标区：只在 上/中/下 + 已选主目标 后出现，「特」不出现 */
        var routeExtraArea = el('div', 'choice__sec');
        function refreshRouteExtra() {
          var needsTarget = !!value.route && value.route !== '特';
          if (!extraAllowed || !needsTarget || !value.targetId) {
            if (routeExtraArea.parentNode) routeExtraArea.parentNode.removeChild(routeExtraArea);
            return;
          }
          clear(routeExtraArea);
          routeExtraArea.appendChild(el('h3', 'choice__title', '黑白错 · 额外目标（最多 2 个，可不选）'));
          var pool = aliveEnemies(s).filter(function (e) { return e.id !== value.targetId; });
          if (!pool.length) { routeExtraArea.appendChild(note('没有其他存活敌人')); }
          else {
            var gridX = el('div', 'tgt-list');
            for (var k = 0; k < pool.length; k++) {
              var e = pool[k];
              var row = enemyRow(e, {});
              if (routeExtraIds.indexOf(e.id) >= 0) addClass(row, 'is-selected');
              on(row, 'click', (function (enemy, node) {
                return function () {
                  var idx = routeExtraIds.indexOf(enemy.id);
                  if (idx >= 0) { routeExtraIds.splice(idx, 1); removeClass(node, 'is-selected'); }
                  else {
                    if (routeExtraIds.length >= 2) { toast('最多再选 2 个额外目标'); return; }
                    routeExtraIds.push(enemy.id); addClass(node, 'is-selected');
                  }
                  value.extraTargetIds = routeExtraIds.slice();
                  refreshRouteExtra();
                };
              })(e, row));
              gridX.appendChild(row);
            }
            routeExtraArea.appendChild(gridX);
            routeExtraArea.appendChild(note('已选 ' + routeExtraIds.length + ' / 2（主目标：' + targetNames([value.targetId]) + '）'));
          }
          if (!routeExtraArea.parentNode) body.appendChild(routeExtraArea);
        }
        function refreshRouteTarget() {
          clear(targetArea);
          /* 路由切换/主目标变化时，额外目标里不能还留着主目标 */
          routeExtraIds = routeExtraIds.filter(function (x) { return x !== value.targetId; });
          value.extraTargetIds = routeExtraIds.slice();
          if (!value.route) {
            targetArea.appendChild(note('先选择倾向；进取/保守/灵活 还需要选 1 个目标'));
            refreshRouteExtra();
            setComplete(false);
            return;
          }
          if (value.route === '特') {
            delete value.targetId;
            value.extraTargetIds = [];
            routeExtraIds = [];
            targetArea.appendChild(note('「隐藏」无需目标'));
            refreshRouteExtra();
            setComplete(true);
            return;
          }
          targetArea.appendChild(el('h3', 'choice__title', '选择目标（该倾向需要 1 个敌人）'));
          var built = enemySection(s, {
            onPick: function (e) {
              value.targetId = e.id;
              routeExtraIds = routeExtraIds.filter(function (x) { return x !== e.id; });
              value.extraTargetIds = routeExtraIds.slice();
              markSelectedRows(routeRows, e.id);
              refreshRouteExtra();
              setComplete(true);
            }
          });
          routeRows = built.rows;
          targetArea.appendChild(built.wrap);
          if (value.targetId) markSelectedRows(routeRows, value.targetId);
          refreshRouteExtra();
          setComplete(!!value.targetId);
        }
        var secRoute = section('宣言倾向');
        var grid = el('div', 'route-grid');
        for (var ri = 0; ri < ROUTE_LIST.length; ri++) {
          var r = ROUTE_LIST[ri], mkk = ROUTE_MARK[r];
          var rb = el('button', 'route-btn ' + MARK_MAP[mkk].cls);
          rb.type = 'button';
          rb.appendChild(markIcon(mkk, 'mark--lg'));
          rb.appendChild(el('span', 'route-btn__t', MARK_MAP[mkk].label));
          on(rb, 'click', (function (route) {
            return function () {
              value.route = route; value.targetId = null; routeRows = []; routeExtraIds = [];
              value.extraTargetIds = [];
              for (var k = 0; k < routeButtons.length; k++) {
                if (routeButtons[k].route === route) addClass(routeButtons[k].node, 'is-selected'); else removeClass(routeButtons[k].node, 'is-selected');
              }
              refreshRouteTarget();
            };
          })(r));
          grid.appendChild(rb); routeButtons.push({ route: r, node: rb });
        }
        secRoute.appendChild(grid); body.appendChild(secRoute); body.appendChild(targetArea); refreshRouteTarget();
        break;
      }
      case 'convert': {
        var convRows = [], convArea = el('div', 'choice__sec'), target = null, fromKey = null, toKey = null;
        function refreshConvert() {
          clear(convArea);
          convArea.appendChild(el('h3', 'choice__title', '从哪类意图 → 改成哪类意图'));
          if (!target) { convArea.appendChild(note('先选择 1 个敌人')); setComplete(false); return; }
          var counts = target.intents || {};
          var fromRow = el('div', 'intent-grid');
          fromRow.appendChild(el('span', 'intent-grid__k', '原类型'));
          for (var k = 0; k < INTENT_KEYS.length; k++) {
            var key = INTENT_KEYS[k], cnt = num(counts[key], 0);
            var fb = el('button', 'intent-btn ' + MARK_MAP[key].cls + (cnt <= 0 ? ' is-disabled' : ''));
            fb.type = 'button';
            fb.appendChild(markIcon(key)); fb.appendChild(el('span', 'intent-btn__t', MARK_MAP[key].label));
            fb.appendChild(el('b', 'intent-btn__v', '×' + cnt));
            if (fromKey === key) addClass(fb, 'is-selected');
            if (cnt <= 0) fb.setAttribute('title', '该敌人没有' + MARK_MAP[key].label + '意图');
            on(fb, 'click', (function (kk, cc) {
              return function () {
                if (cc <= 0) { toast('该敌人没有这类意图'); return; }
                fromKey = kk; if (toKey === kk) toKey = null;
                value.from = kk; delete value.to;
                refreshConvert();
              };
            })(key, cnt));
            fromRow.appendChild(fb);
          }
          convArea.appendChild(fromRow);
          var toRow = el('div', 'intent-grid');
          toRow.appendChild(el('span', 'intent-grid__k', '改为'));
          for (var m2 = 0; m2 < INTENT_KEYS.length; m2++) {
            var key2 = INTENT_KEYS[m2];
            var disabled = !fromKey || key2 === fromKey;
            var tb = el('button', 'intent-btn ' + MARK_MAP[key2].cls + (disabled ? ' is-disabled' : ''));
            tb.type = 'button';
            tb.appendChild(markIcon(key2)); tb.appendChild(el('span', 'intent-btn__t', MARK_MAP[key2].label));
            if (toKey === key2) addClass(tb, 'is-selected');
            if (!fromKey) tb.setAttribute('title', '先选择原类型');
            else if (key2 === fromKey) tb.setAttribute('title', '原类型与目标类型不能相同');
            on(tb, 'click', (function (kk) {
              return function () {
                if (!fromKey) { toast('先选择要转换的意图类型'); return; }
                if (kk === fromKey) { toast('原类型与目标类型不能相同'); return; }
                toKey = kk; value.to = kk; refreshConvert();
              };
            })(key2));
            toRow.appendChild(tb);
          }
          convArea.appendChild(toRow);
          setComplete(!!(value.targetId && fromKey && toKey));
        }
        var secTarget = section('选择 1 个敌人');
        var single = enemySection(s, {
          blockedReason: function (e) { return e.hidden ? '意图未知，无法转换' : ''; },
          onPick: function (e) {
            target = e; value.targetId = e.id; fromKey = null; toKey = null;
            delete value.from; delete value.to;
            markSelectedRows(convRows, e.id); refreshConvert();
          }
        });
        convRows = single.rows;
        secTarget.appendChild(single.wrap); body.appendChild(secTarget); body.appendChild(convArea); refreshConvert();
        break;
      }
      case 'bet': {
        var maxBet = Math.min(15, Math.max(0, num(s.player && s.player.maxHp, 40)));
        var secBet = section('投入 HP 上限');
        if (maxBet < 5) { secBet.appendChild(note('当前 HP 上限不足 5 点，无法使用')); setComplete(false); }
        else {
          var def = clamp(10, 5, maxBet);
          value.amount = def;
          var wrap = el('div', 'bet');
          var val = el('strong', 'bet__val', '投入 ' + def + ' 点');
          var range = el('input', 'bet__range');
          range.type = 'range';
          range.setAttribute('min', '5'); range.setAttribute('max', String(maxBet));
          range.setAttribute('step', '1'); range.setAttribute('value', String(def));
          range.setAttribute('aria-label', '投入点数');
          range.value = String(def);
          on(range, 'input', function () {
            var v = clamp(num(range.value, def), 5, maxBet);
            value.amount = v; val.textContent = '投入 ' + v + ' 点';
          });
          wrap.appendChild(val); wrap.appendChild(range);
          var ticks = el('div', 'bet__ticks');
          ticks.appendChild(el('span', null, '5')); ticks.appendChild(el('span', null, String(maxBet)));
          wrap.appendChild(ticks); wrap.appendChild(el('p', 'bet__hint', '扣除等量 HP 上限'));
          secBet.appendChild(wrap); setComplete(true);
        }
        body.appendChild(secBet);
        break;
      }
      case 'jqIntentsDynamic':
      case 'jqIntents8':
      case 'jqIntents6': {
        var limit = select === 'jqIntentsDynamic' ? aliveEnemies(s).length : (select === 'jqIntents8' ? 8 : 6);
        var pool = collectJqMarks(s);
        var picks = [];
        var secJq = section('选择最多 ' + limit + ' 个进取意图（可不选）');
        if (!pool.length) secJq.appendChild(note('场上没有可见的进取意图（隐藏意图无法消除）'));
        else {
          var jqGrid = el('div', 'jq-grid');
          var cntEl = note('已选 0 / ' + limit);
          for (var qi = 0; qi < pool.length; qi++) {
            var mark = pool[qi];
            var jb = el('button', 'jq-btn');
            jb.type = 'button';
            jb.appendChild(markIcon('jq'));
            jb.appendChild(el('span', 'jq-btn__name', mark.enemyName));
            on(jb, 'click', (function (m, node) {
              return function () {
                var key = m.enemyId + '#' + m.index;
                var idx = -1;
                for (var q = 0; q < picks.length; q++) if (picks[q]._k === key) { idx = q; break; }
                if (idx >= 0) { picks.splice(idx, 1); removeClass(node, 'is-selected'); }
                else {
                  if (picks.length >= limit) { toast('最多选择 ' + limit + ' 个进取意图'); return; }
                  picks.push({ _k: key, enemyId: m.enemyId, type: 'jq' }); addClass(node, 'is-selected');
                }
                value.picks = picks.map(function (p) { return { enemyId: p.enemyId, type: 'jq' }; });
                cntEl.textContent = '已选 ' + picks.length + ' / ' + limit;
              };
            })(mark, jb));
            jqGrid.appendChild(jb);
          }
          secJq.appendChild(jqGrid); secJq.appendChild(cntEl);
        }
        body.appendChild(secJq); value.picks = []; setComplete(true);
        break;
      }
      default: {
        body.appendChild(note('未知的选择类型：' + select + '（直接确认视为无选择）'));
        setComplete(true);
      }
    }

    var cancelBtn = modalButton('取消', 'ghost', function () { closeModal(true); if (opts.onClose) opts.onClose(); });
    confirmBtn = modalButton('确认', 'primary', function () {
      if (confirmBtn.disabled) return;
      var payload = cleanChoice(select, value);
      closeModal(true);
      onConfirm(payload);
    }, true);
    confirmBtn.disabled = !complete;
    showModal({
      title: opts.title || SELECT_LABEL[select] || '选择',
      subtitle: opts.subtitle || '', desc: opts.desc || '',
      body: body, buttons: [cancelBtn, confirmBtn], focusEl: confirmBtn,
      onClose: opts.onClose || function () { }
    });
  }

  function cleanChoice(select, value) {
    var out = {};
    if (select === 'enemy' || select === 'minion') {
      out.targetId = value.targetId || '';
      if (select === 'enemy' && value.extraTargetIds && value.extraTargetIds.length) out.extraTargetIds = value.extraTargetIds.slice();
      return out;
    }
    if (select === 'enemies3') { out.targetIds = (value.targetIds || []).slice(); return out; }
    if (select === 'route') {
      out.route = value.route || '上';
      if (out.route !== '特') {
        if (value.targetId) out.targetId = value.targetId;
        if (value.extraTargetIds && value.extraTargetIds.length) out.extraTargetIds = value.extraTargetIds.slice();
      }
      return out;
    }
    if (select === 'convert') { out.targetId = value.targetId || ''; out.from = value.from || 'jq'; out.to = value.to || 'bs'; return out; }
    if (select === 'bet') { out.amount = num(value.amount, 5); return out; }
    if (select === 'jqIntentsDynamic' || select === 'jqIntents8' || select === 'jqIntents6') { out.picks = (value.picks || []).slice(); return out; }
    return out;
  }

  /* ------------------------------------------------------- 详情 / 日志 / toast */
  function openCardDetail(card, index, pc) {
    if (ui.busy) { toast('演出中，请稍候'); return; }
    var body = el('div', 'detail');
    var meta = el('div', 'detail__meta');
    var mkind = ROUTE_MARK[card.route] || 'hidden';
    meta.appendChild(markIcon(mkind, 'mark--lg'));
    meta.appendChild(el('span', 'detail__label', MARK_MAP[mkind].label));
    meta.appendChild(el('span', 'card__type', card.type || '卡'));
    meta.appendChild(el('span', 'detail__sel', '目标：' + (SELECT_LABEL[card.select] || '直接打出')));
    body.appendChild(meta);
    body.appendChild(el('p', 'detail__desc', card.desc || ''));
    var blocked = pc && pc.playable === false;
    body.appendChild(el('p', 'detail__state' + (blocked ? ' is-blocked' : ''), blocked ? ('当前不可打出：' + (pc.reason || '条件不足')) : '当前可打出'));
    var btns = [modalButton('关闭', 'ghost', function () { closeModal(); })];
    if (!blocked) btns.push(modalButton('打出', 'primary', function () { closeModal(true); handCardClick(index, card, pc); }));
    showModal({ title: card.name, subtitle: '完整描述', body: body, buttons: btns });
  }

  function openLogDrawer() {
    if (!ui.nodes.drawer) return;
    ui.logOpen = true;
    ui.logSeen = ui.battle ? (ui.battle.state.log || []).length : 0;
    setHidden(ui.nodes.drawer, false);
    addClass(document.body, 'has-drawer');
    setHidden(ui.nodes.logDot, true);
    if (ui.battle) renderLogDrawer(ui.battle.state, true);
  }
  function closeLogDrawer(silent) {
    ui.logOpen = false;
    setHidden(ui.nodes.drawer, true);
    removeClass(document.body, 'has-drawer');
    if (!silent && ui.battle) setHidden(ui.nodes.logDot, (ui.battle.state.log || []).length <= ui.logSeen);
  }

  function positionToast() {
    var t = ui.nodes.toast;
    if (!t) return;
    var inBattle = ui.screen === 'battle' && ui.nodes.battle && !ui.nodes.battle.hidden && ui.nodes.demo;
    if (inBattle) {
      var r = null;
      try { r = ui.nodes.demo.getBoundingClientRect(); } catch (e) { r = null; }
      if (r && (r.top || r.height)) {
        t.style.top = Math.max(4, Math.round(r.top) + 3) + 'px';
        t.style.bottom = 'auto';
        return;
      }
      t.style.top = '46px';
      t.style.bottom = 'auto';
      return;
    }
    /* 菜单/挑战/结算：贴底部，不挡标题与卡片 */
    t.style.top = 'auto';
    t.style.bottom = 'calc(22px + env(safe-area-inset-bottom, 0px))';
  }
  function hideToast() {
    var t = ui.nodes.toast;
    if (!t) return;
    removeClass(t, 'is-show');
    setTimeout(function () { if (!hasClass(t, 'is-show')) setHidden(t, true); }, 200);
  }
  function toast(msg) {
    var t = ui.nodes.toast;
    if (!t) return;
    t.textContent = String(msg || '');
    setHidden(t, false);
    positionToast();
    addClass(t, 'is-show');
    if (ui.toastTimer) clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(function () {
      removeClass(t, 'is-show');
      setTimeout(function () { if (!hasClass(t, 'is-show')) setHidden(t, true); }, 220);
    }, 2400);
  }

  /* ------------------------------------------------------------------ 特效 */
  function anchorFor(id) {
    if (!id || id === 'player') return ui.anchors.player;
    return ui.anchors[id] || ui.anchors.boss || ui.anchors.player;
  }
  function spawnFloater(text, kind, node) {
    if (ui.reduced) return;
    var layer = ui.nodes.fxLayer;
    if (!layer) return;
    var x = null, y = null;
    try {
      if (node && typeof node.getBoundingClientRect === 'function') {
        var r = node.getBoundingClientRect();
        if (r && (r.width || r.height)) { x = r.left + r.width / 2; y = r.top + Math.min(r.height, 160) * 0.45; }
      }
    } catch (e) { }
    var f = el('span', 'fx-float fx-float--' + kind, text);
    try { if (x !== null) f.style.left = x + 'px'; if (y !== null) f.style.top = y + 'px'; } catch (e) { }
    layer.appendChild(f);
    if (node) addClass(node, 'is-hit');
    setTimeout(function () {
      if (f.parentNode) f.parentNode.removeChild(f);
      if (node) removeClass(node, 'is-hit');
    }, 1000);
  }
  function spawnRipple() {
    if (ui.reduced) return;
    var layer = ui.nodes.fxLayer;
    if (!layer) return;
    var ring = el('div', 'fx-ripple');
    layer.appendChild(ring);
    setTimeout(function () { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 1200);
  }
  /* 出血 / 墨爆：优先用 fx_blood.webp，缺图回退 CSS 水墨溅射 */
  function spawnBlood(node) {
    if (ui.reduced) return;
    var layer = ui.nodes.fxLayer;
    if (!layer) return;
    ensureMain('blood');
    var x = null, y = null;
    try {
      if (node && typeof node.getBoundingClientRect === 'function') {
        var r = node.getBoundingClientRect();
        if (r && (r.width || r.height)) { x = r.left + r.width / 2; y = r.top + Math.min(r.height, 160) * 0.4; }
      }
    } catch (e) { }
    var d = el('div', 'fx-blood');
    if (mainOK('blood')) { try { d.style.backgroundImage = "url('" + assetBase() + IMG.blood + "')"; } catch (e) { } addClass(d, 'has-img'); }
    try { if (x !== null) d.style.left = x + 'px'; if (y !== null) d.style.top = y + 'px'; } catch (e) { }
    layer.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 760);
  }


  /* =========================================================================
   * PART D · 覆盖层 / 记录 / QA 钩子 / 启动
   * ======================================================================= */
  function showOverlay(node, opts) {
    var root = ui.nodes.overlayRoot;
    if (!root) return;
    setHidden(root, false);
    clear(root);
    root.appendChild(node);
    ui.overlay = { node: node, opts: opts || {} };
    addClass(document.body, 'has-overlay');
  }
  function closeOverlay() {
    var root = ui.nodes.overlayRoot;
    if (root) { setHidden(root, true); clear(root); }
    ui.overlay = null;
    removeClass(document.body, 'has-overlay');
  }
  function overlayCard(cls) { return el('div', 'overlay-card ' + (cls || '')); }

  /* ---------------------------------------------------------------- 教学 */
  var TUTORIAL_STEPS = [
    {
      icon: 'eye',
      title: '先看意图标记',
      text: '敌人头上的标记就是它下回合要做的事。四种倾向标记对应四种意图：进取＝攻击、保守＝防御、灵活＝闪避/召唤；「隐藏」表示这一套意图未知，无法消除，也不计入按意图计算的效果。'
    },
    {
      icon: 'book',
      title: '出牌 · 演示区 · 秘笈',
      text: '点手牌出牌，每回合最多 5 张。中间是战斗演示区：每张牌、敌人每一招都会逐招播放，点击演示区或按空格可加速，「跳过」立即结算。秘笈按倾向顺序连出即可触发（每回合 1 张，卡面常驻显示效果）。'
    },
    {
      icon: 'chevron',
      title: '防御与结束回合',
      text: '点击玩家区的闪避 / 格挡 / 化劲徽标可查看说明与结算顺序（闪避→格挡→化劲→扣血）。确认后点「结束回合」，敌人会按意图逐招行动。你的 HP 归零就输了。'
    }
  ];

  function showTutorial() {
    ui.tutorialIndex = 0;
    renderTutorial();
  }
  function renderTutorial() {
    var step = TUTORIAL_STEPS[ui.tutorialIndex] || TUTORIAL_STEPS[0];
    var card = overlayCard('overlay-card--tutorial');
    var dots = el('div', 'tutorial-dots');
    for (var i = 0; i < TUTORIAL_STEPS.length; i++) dots.appendChild(el('span', 'tutorial-dot' + (i === ui.tutorialIndex ? ' is-on' : '')));
    card.appendChild(dots);
    var mark = el('div', 'tutorial-mark');
    mark.appendChild(icon(step.icon));
    card.appendChild(mark);
    card.appendChild(el('p', 'overlay-kicker', '第 ' + (ui.tutorialIndex + 1) + ' / ' + TUTORIAL_STEPS.length + ' 步'));
    card.appendChild(el('h2', 'overlay-title', step.title));
    card.appendChild(el('p', 'overlay-text', step.text));
    var btns = el('div', 'overlay-btns');
    var skip = el('button', 'btn btn--ghost btn--lg', '跳过教学');
    skip.type = 'button'; on(skip, 'click', function () { finishTutorial(true); });
    var next = el('button', 'btn btn--primary btn--lg', ui.tutorialIndex >= TUTORIAL_STEPS.length - 1 ? '开始这场残局' : '下一步');
    next.type = 'button';
    on(next, 'click', function () {
      if (ui.tutorialIndex >= TUTORIAL_STEPS.length - 1) { finishTutorial(false); return; }
      ui.tutorialIndex += 1; renderTutorial();
    });
    btns.appendChild(skip); btns.appendChild(next);
    card.appendChild(btns);
    showOverlay(card, { kind: 'tutorial' });
  }
  function finishTutorial(skipped) {
    ui.tutorialDone = true;
    storeSet('localStorage', TUTORIAL_KEY, '1');
    closeOverlay();
    showDefenseHintOnce();
    toast(skipped ? '已跳过教学 · 祝你好运' : '教学完毕 · 入局');
  }
  function showDefenseHintOnce() {
    if (storeGet('localStorage', DEFENSE_KEY) === '1') return;
    storeSet('localStorage', DEFENSE_KEY, '1');
    setTimeout(function () { if (ui.screen === 'battle') toast('提示：点玩家区的 闪避 / 格挡 / 化劲 徽标可看防御说明'); }, 1200);
  }

  /* ------------------------------------------------------- 玩法说明 / 制作 */
  function helpSection(parent, title, text) {
    parent.appendChild(el('h3', 'help__title', title));
    parent.appendChild(el('p', 'help__text', text));
  }
  function showHelp() {
    var body = el('div', 'help');
    helpSection(body, '· 屏幕流程', '标题菜单 → 战斗剧本列表（可入局 + 筹备中）→ 剧本简介 → 战斗 → 结算（再战 / 回列表 / 回菜单）。菜单里有存档时可「继续上局」。');
    helpSection(body, '· 倾向标记', '全站只有一套标记：上＝进取、中＝保守、下＝灵活、特＝隐藏。卡牌、秘笈、敌人意图、已出牌序列都用标记个数表示，不再写数字。隐藏意图不可消除/转换，也不计入按意图计算的效果。');
    helpSection(body, '· 一个回合', '看意图 → 出牌（每回合最多 5 张）→ 结束回合 → 敌人按意图逐招行动 → 下一回合摸牌。');
    helpSection(body, '· 战斗演示', '中间演示区逐招播放：招式名 + 剪影 + 目标 + 伤害/消耗意图。自动约 0.7 秒一步，点击演示区或空格加速，点「跳过」立即结算。完整记录仍在右下「日志」抽屉。');
    helpSection(body, '· 防御结算', '闪避（整段抵消，必中无视）→ 格挡（按点吸收，真实伤害无视）→ 化劲（一次性，扣减后清零）→ 扣血。点玩家区徽标可随时查看。');
    helpSection(body, '· 秘笈', '秘笈卡常驻显示完整效果；本回合已出牌的倾向顺序「包含」秘笈要求的连续序列即可触发（例：秘笈要「灵活→进取→灵活」，本回合打过「灵活 进取 灵活」即可）。每回合限 1 张，触发后翻面。');
    var exChHelp = firstOpenChallenge();
    if (extremeInfo(exChHelp)) {
      helpSection(body, '· 极限模式', '用「千手归一」通关一次后解锁（只记在本机浏览器）。' + extremeDesc(exChHelp) + ' 解锁后可在剧本简介里切换标准 / 极限，记录与 AI 学习按模式分开。');
    }
    helpSection(body, '· 二阶段与血量', 'Boss 与杂兵不显示具体血量数字；罐中鲨一阶段血量跨过节点会罐碎进入二阶段，假血并入主血条显示，清空后回到一阶段。');
    helpSection(body, '· 敌方 AI', '敌方 AI 会从本机对战记录中学习你的打法（防御/攻击/千手归一使用习惯），在后续对局里调整意图套组的权重；学习只发生在这台浏览器里，不联网、不汇总其他玩家。可在「制作信息」查看学习状态或重置。');
    helpSection(body, '· 存档与记录', '每次操作后自动存档（localStorage）；结算后清除存档，入局次数/胜场/最佳回合记在「战斗剧本列表」。');
    var btns = [
      modalButton('重看教学', 'ghost', function () { closeModal(true); ui.tutorialIndex = 0; renderTutorial(); }),
      modalButton('关闭', 'primary', function () { closeModal(); })
    ];
    showModal({ title: '玩法说明', subtitle: systemInfo().name + ' · v' + UI_VERSION, body: body, buttons: btns });
  }

  function showAbout() {
    var sys = systemInfo();
    var body = el('div', 'about');
    body.appendChild(el('p', 'about__line about__line--big', sys.name));
    body.appendChild(el('p', 'about__line', sys.subtitle));
    body.appendChild(el('p', 'about__line', sys.tagline));
    body.appendChild(el('p', 'about__line', '规则体系：《抉招：江湖录》· 卡牌战斗／倾向标记'));
    body.appendChild(el('p', 'about__line', '作者与卡牌设计：寒溟'));
    body.appendChild(el('p', 'about__line', '版本 v' + UI_VERSION + '（2026-11-11）'));
    body.appendChild(el('p', 'about__line', sys.footer));
    var exChAbout = firstOpenChallenge();
    if (extremeInfo(exChAbout)) {
      var exUnlocked = isExtremeUnlocked(exChAbout.id);
      body.appendChild(el('p', 'about__line about__line--extreme', '极限模式：' + (exUnlocked ? '已解锁' : '未解锁') +
        (exUnlocked ? '（可在剧本简介切换）' : ' —— ' + extremeUnlockHint(exChAbout))));
      if (exUnlocked) body.appendChild(el('p', 'about__line about__line--dim', extremeDesc(exChAbout)));
    }
    var aiId = aiTargetChallengeId();
    var ai = aiStateFor(aiId);
    if (aiModule() && ai && !ai.error) {
      var aiBox = el('div', 'about__ai');
      aiBox.appendChild(el('p', 'about__ai-line', aiLine(ai)));
      aiBox.appendChild(el('p', 'about__ai-note', '学习数据只保存在本机浏览器，不联网、不汇总其他玩家。'));
      var resetBtn = el('button', 'btn btn--ghost about__ai-reset', '重置 AI 学习');
      resetBtn.type = 'button';
      on(resetBtn, 'click', function () { showAiResetConfirm(aiId); });
      aiBox.appendChild(resetBtn);
      body.appendChild(aiBox);
    } else if (aiModule() && !ai) {
      /* 模块在但没有可读状态：仍给出入口，避免「看起来没这个功能」 */
      var aiBox2 = el('div', 'about__ai');
      aiBox2.appendChild(el('p', 'about__ai-line', '本机敌方 AI：尚未从对局中学习（完成一局后开始积累）'));
      aiBox2.appendChild(el('p', 'about__ai-note', '学习数据只保存在本机浏览器，不联网、不汇总其他玩家。'));
      var resetBtn2 = el('button', 'btn btn--ghost about__ai-reset', '重置 AI 学习');
      resetBtn2.type = 'button';
      on(resetBtn2, 'click', function () { showAiResetConfirm(aiId); });
      aiBox2.appendChild(resetBtn2);
      body.appendChild(aiBox2);
    }
    body.appendChild(el('p', 'about__line about__line--dim', '游戏内美术为项目原创素材；卡面美术不在此公开。'));
    showModal({ title: '制作信息', body: body, buttons: [modalButton('关闭', 'primary', function () { closeModal(); })] });
  }

  function showAiResetConfirm(id) {
    closeModal(true);
    var body = el('div', 'about');
    body.appendChild(el('p', 'about__line', '重置后，本机敌方 AI 会回到初始状态；已累计的对局数、胜负与学习权重都会被清除。'));
    body.appendChild(el('p', 'about__line about__line--dim', '此操作只影响本机浏览器，不影响其他玩家。'));
    showModal({
      title: '重置 AI 学习？',
      subtitle: '在本机清除学习数据',
      body: body,
      buttons: [
        modalButton('取消', 'ghost', function () { closeModal(true); showAbout(); }),
        modalButton('确认重置', 'primary', function () {
          closeModal(true);
          var okReset = aiReset(id);
          toast(okReset ? '已重置本机敌方 AI 学习' : 'AI 学习模块当前不可用');
          showAbout();
        })
      ]
    });
  }

  function showBriefing(ch) {
    var body = el('div', 'brief');
    var top = el('div', 'brief__top');
    if (ch.code) top.appendChild(el('span', 'brief__code', ch.code));
    top.appendChild(stars(ch.difficultyStars));
    top.appendChild(el('span', 'brief__diff', ch.difficulty || '—'));
    body.appendChild(top);
    if (ch.tags && ch.tags.length) {
      var tags = el('div', 'brief__tags');
      for (var i = 0; i < ch.tags.length; i++) tags.appendChild(el('span', 'tag', ch.tags[i]));
      body.appendChild(tags);
    }
    if (ch.story) body.appendChild(el('p', 'brief__story', ch.story));
    var cast = ch.cast || [];
    if (cast.length) {
      var castBox = el('div', 'brief__cast');
      for (var c = 0; c < cast.length; c++) {
        var row = el('div', 'brief__cast-row');
        row.appendChild(el('span', 'brief__cast-name', cast[c].name || ''));
        row.appendChild(el('span', 'brief__cast-line', cast[c].line || ''));
        castBox.appendChild(row);
      }
      body.appendChild(castBox);
    }
    /* 极限模式：标准 / 极限 切换（数据驱动：challenge.extreme） */
    var ex = extremeInfo(ch);
    var modeSel = selectedMode(ch.id);
    if (modeSel === 'extreme' && (!ex || !isExtremeUnlocked(ch.id))) modeSel = 'standard';
    var modePick = modeSel;
    var modeRow = null;
    var modeBox = null;
    var modeHintEl = null, modeDescEl = null;
    if (ex) {
      modeBox = el('div', 'brief__modes');
      var modeHead = el('div', 'brief__modes-head');
      modeHead.appendChild(el('h3', 'brief__modes-title', '模式'));
      var modeState = el('span', 'brief__modes-state', '');
      modeHead.appendChild(modeState);
      modeBox.appendChild(modeHead);
      var seg = el('div', 'mode-switch');
      var stdBtn = el('button', 'mode-opt', '标准');
      var exBtn = el('button', 'mode-opt', '极限');
      stdBtn.type = 'button'; exBtn.type = 'button';
      seg.appendChild(stdBtn); seg.appendChild(exBtn);
      modeBox.appendChild(seg);
      modeHintEl = el('p', 'brief__mode-hint', '');
      modeDescEl = el('p', 'brief__mode-desc', '');
      modeBox.appendChild(modeHintEl);
      modeBox.appendChild(modeDescEl);
      body.appendChild(modeBox);
      modeRow = modeBox;
      var paintMode = function () {
        var unlocked = isExtremeUnlocked(ch.id);
        if (modePick === 'extreme' && !unlocked) modePick = 'standard';
        if (modePick === 'extreme') addClass(exBtn, 'is-selected'); else removeClass(exBtn, 'is-selected');
        if (modePick === 'standard') addClass(stdBtn, 'is-selected'); else removeClass(stdBtn, 'is-selected');
        exBtn.disabled = !unlocked;
        addClass(exBtn, unlocked ? 'is-unlocked' : 'is-locked');
        removeClass(exBtn, unlocked ? 'is-locked' : 'is-unlocked');
        modeState.textContent = unlocked ? '极限已解锁' : '极限未解锁';
        modeHintEl.textContent = unlocked ? '' : extremeUnlockHint(ch);
        modeHintEl.hidden = unlocked;
        modeDescEl.textContent = modePick === 'extreme' ? extremeDesc(ch) : '';
        modeDescEl.hidden = modePick !== 'extreme';
        if (recVal) recVal.textContent = recordLine(ch.id, modePick);
      };
      on(stdBtn, 'click', function () { modePick = 'standard'; setSelectedMode(ch.id, 'standard'); paintMode(); });
      on(exBtn, 'click', function () {
        if (!isExtremeUnlocked(ch.id)) { toast(extremeUnlockHint(ch)); return; }
        modePick = 'extreme'; setSelectedMode(ch.id, 'extreme'); paintMode();
      });
    }
    var rows = el('div', 'brief__rows brief__rows--inline');
    if (ch.duration) rows.appendChild(briefRow('时长', ch.duration));
    var recRow = el('div', 'brief__row');
    recRow.appendChild(el('span', 'brief__row-k', '记录'));
    var recVal = el('span', 'brief__row-v', recordLine(ch.id, modePick));
    recRow.appendChild(recVal);
    rows.appendChild(recRow);
    var briefAi = aiStateFor(ch.id);
    if (briefAi && briefAi.battles) rows.appendChild(el('span', 'brief__ai', 'AI 已学习 ' + briefAi.battles + ' 局'));
    body.appendChild(rows);
    if (ch.quote) body.appendChild(el('p', 'brief__quote', '「' + ch.quote + '」'));
    if (modeBox) paintMode();

    var btns = [
      modalButton('返回', 'ghost', function () { closeModal(true); showScreen('challenges'); }),
      modalButton('开始这场残局', 'primary', function () { closeModal(true); startBattleWithChallenge(ch.id, modePick); })
    ];
    showModal({ title: challengeTitle(ch), subtitle: ch.subtitle || '剧本简介', body: body, buttons: btns });
  }
  function briefRow(k, v) {
    var row = el('div', 'brief__row');
    row.appendChild(el('span', 'brief__row-k', k));
    row.appendChild(el('span', 'brief__row-v', v));
    return row;
  }

  /* ---------------------------------------------------------------- 防御说明 */
  function showDefenseInfo() {
    var body = el('div', 'defhelp');
    body.appendChild(el('p', 'defhelp__order', '结算顺序：闪避 → 格挡 → 化劲 → 扣血（每「一段」伤害独立结算）'));
    var items = [
      { k: 'dodge', name: '闪避', text: '每 1 层完全抵消 1 段伤害，无论这段有多少点；被抵消即消耗。必中伤害无视闪避（不消耗层数）。' },
      { k: 'block', name: '格挡', text: '按点数吸收伤害的「池」，每段伤害先扣格挡再扣血；格挡用完即止。真实伤害无视格挡。' },
      { k: 'hua', name: '化劲', text: '最后一道防线，一次性：本段剩余伤害按化劲值扣减（最低到 0），扣减后化劲清零。' }
    ];
    for (var i = 0; i < items.length; i++) {
      var row = el('div', 'defhelp__row');
      var ic = el('span', 'defhelp__icon');
      ic.appendChild(icon(items[i].k));
      row.appendChild(ic);
      var info = el('div', 'defhelp__info');
      info.appendChild(el('h3', 'defhelp__name', items[i].name));
      info.appendChild(el('p', 'defhelp__text', items[i].text));
      row.appendChild(info);
      body.appendChild(row);
    }
    showModal({ title: '防御三属性', subtitle: '闪避 / 格挡 / 化劲', body: body, buttons: [modalButton('知道了', 'primary', function () { closeModal(); })] });
  }

  /* ---------------------------------------------------------------- 致命错误 */
  function showFatal(title, detail) {
    var card = overlayCard('overlay-card--fatal');
    card.setAttribute('data-fatal', '1');
    card.appendChild(el('div', 'overlay-seal overlay-seal--ink', '！'));
    card.appendChild(el('h2', 'overlay-title', title || '出了点问题'));
    card.appendChild(el('p', 'overlay-text', detail || ''));
    var btns = el('div', 'overlay-btns');
    var retry = el('button', 'btn btn--primary btn--lg', '重新加载');
    retry.type = 'button';
    on(retry, 'click', function () { try { window.location.reload(); } catch (e) { } });
    btns.appendChild(retry);
    card.appendChild(btns);
    showOverlay(card, { kind: 'fatal' });
  }

  /* ---------------------------------------------------------------- 结算 */
  function handleResult(s) {
    if (!s || s.stage !== 'over') return;
    if (ui.resultShown) return;
    if (ui.busy || ui.playback) return;
    ui.resultShown = true;
    closeModal(true); closeLogDrawer(true);
    clearSave();
    var cv = currentChallengeView() || {};
    var cid = cv.id || ui.challengeId || 'shark';
    var resultMode = battleMode(s);
    var justUnlocked = false;
    if (!ui.resultRecorded) {
      ui.resultRecorded = true;
      recordResult(cid, s.winner === 'player', num(s.turn, 1), resultMode);
      if (s.winner === 'player' && resultMode === 'standard' && s.qianshouUsed === true) {
        justUnlocked = unlockExtreme(cid);
        if (justUnlocked) ui.pendingUnlockToast = true;
      }
    }
    showResult(s, { unlocked: justUnlocked });
  }

  function showResult(s, info) {
    var win = s.winner === 'player';
    var p = s.player || {};
    var cv = currentChallengeView() || {};
    var exMode = battleMode(s) === 'extreme';
    var card = overlayCard('result ' + (win ? 'result--win' : 'result--lose'));
    card.appendChild(el('div', 'result__seal', win ? '胜' : '败'));
    if (exMode) card.appendChild(el('span', 'result__mode', '极限模式'));
    card.appendChild(el('p', 'overlay-kicker', win ? (exMode ? '极限 · 一阶段血尽' : '一阶段血尽') : (exMode ? '极限 · 潮声吞人' : '潮声吞人')));
    card.appendChild(el('h2', 'overlay-title', win ? '罐中鲨伏诛' : '千手散尽'));
    card.appendChild(el('p', 'overlay-text', win
      ? (cv.quote || '罐碎潮平，鲨首伏诛。')
      : '潮水漫过罐沿，千手散尽。再整衣冠，重来一局。'));
    if (s.endReason) card.appendChild(el('p', 'result__reason', '结算：' + s.endReason));
    var stats = el('div', 'result__stats');
    stats.appendChild(resultStat('回合数', String(num(s.turn, 1))));
    stats.appendChild(resultStat('易金权 HP', num(p.hp, 0) + ' / ' + num(p.maxHp, 40)));
    stats.appendChild(resultStat(cv.scriptNo || '剧本', cv.name || challengeTitle(cv)));
    stats.appendChild(resultStat('模式', exMode ? '极限' : '标准'));
    card.appendChild(stats);
    if (info && info.unlocked) card.appendChild(el('p', 'result__unlock', '解锁 · 极限模式'));
    var btns = el('div', 'overlay-btns');
    var again = el('button', 'btn btn--primary btn--lg', '再战一局');
    again.type = 'button';
    on(again, 'click', function () { var id = (currentChallengeView() || {}).id || ui.challengeId || 'shark'; startBattleWithChallenge(id); });
    var backList = el('button', 'btn btn--ghost btn--lg', '返回剧本列表');
    backList.type = 'button';
    on(backList, 'click', function () { leaveResult('challenges'); });
    var backMenu = el('button', 'btn btn--ghost btn--lg', '返回菜单');
    backMenu.type = 'button';
    on(backMenu, 'click', function () { leaveResult('menu'); });
    btns.appendChild(again); btns.appendChild(backList); btns.appendChild(backMenu);
    card.appendChild(btns);
    showOverlay(card, { kind: 'result' });
    ui.lastResultWin = win;
    updateAudioForState();
  }
  function resultStat(k, v) {
    var box = el('div', 'result__stat');
    box.appendChild(el('span', 'result__stat-k', k));
    box.appendChild(el('strong', 'result__stat-v', v));
    return box;
  }
  function leaveResult(screen) {
    closeOverlay();
    if (ui.pendingUnlockToast) { ui.pendingUnlockToast = false; toast('解锁 · 极限模式'); }
    ui.battle = null; ui.viewState = null; ui.playback = null; ui.busy = false;
    ui.resultShown = false; ui.resultRecorded = false;
    ui.handBuilt = false; ui.logRenderedLen = -1;
    showScreen(screen);
  }

  /* ------------------------------------------------------------ QA 钩子 */
  function installHooks() {
    try {
      Object.defineProperty(window, '__jzBattle', { configurable: true, get: function () { return ui.battle || null; } });
    } catch (e) { }
    window.__jzRender = function () { if (ui.battle) renderBattle(); return true; };
    window.__jzState = function () { return ui.battle ? ui.battle.state : null; };
    window.__jzScreen = function () {
      if (ui.overlay && ui.overlay.opts && ui.overlay.opts.kind === 'result') return 'result';
      return ui.screen;
    };
    window.__jzUI = ui;
    window.JZ_UI = {
      version: UI_VERSION,
      refresh: function () { if (ui.battle) renderBattle(); return true; },
      __test: {
        startBattle: function (id, mode) { startBattleWithChallenge(id || (firstOpenChallenge() || {}).id || 'shark', mode); },
        selectedMode: selectedMode,
        isExtremeUnlocked: isExtremeUnlocked,
        setSelectedMode: setSelectedMode,
        showScreen: showScreen,
        showBriefing: function (id) { var ch = getChallengeById(id) || firstOpenChallenge(); if (ch) showBriefing(ch); },
        openChoice: function (select, cb) {
          openChoice(select, { title: '选择器调试 · ' + select, subtitle: '预览页用 · 不消耗出牌', desc: 'SPEC §三 select 类型：' + select }, function (choice) {
            if (typeof cb === 'function') cb(choice); else toast('选择结果：' + JSON.stringify(choice));
          });
        },
        showTutorial: showTutorial,
        showHelp: showHelp,
        showAbout: showAbout,
        showDefenseInfo: showDefenseInfo,
        openLog: openLogDrawer,
        skipPlayback: function () { if (ui.playback) finishPlayback(true); else return false; return true; },
        accelerate: acceleratePlayback,
        finishNow: function () { if (ui.battle) handleResult(ui.battle.state); },
        getState: function () { return ui.battle ? ui.battle.state : null; },
        audio: function () { return { muted: audio.muted, unlocked: audio.unlocked, current: audio.current, src: audioSrc(audio.current), hasConfig: !!audioConfig(), active: !!audio.active }; },
        syncAudio: function () { updateAudioForState(); },
        toast: toast,
        toggleMute: toggleMute,
        resetStorage: function () {
          clearSave();
          storeDel('localStorage', TUTORIAL_KEY);
          storeDel('localStorage', DEFENSE_KEY);
          storeDel('localStorage', RECORDS_KEY);
          ui.tutorialDone = false;
          toast('本地存档/教学/记录已清除');
          renderMenu();
        }
      }
    };
    window.__jzAudit = function () {
      var out = { viewport: null, doc: null, screen: null, images: {}, flags: {}, overflow: [] };
      try {
        var de = document.documentElement;
        out.viewport = { w: window.innerWidth, h: window.innerHeight };
        out.doc = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, scrollHeight: de.scrollHeight, clientHeight: de.clientHeight };
      } catch (e) { out.error = String(e); }
      out.screen = window.__jzScreen();
      try {
        var keys = Object.keys(IMG);
        for (var i = 0; i < keys.length; i++) out.images[IMG[keys[i]]] = mainOK(keys[i]) ? 'ok' : (ui.imgChecked['main:' + keys[i]] ? 'missing' : 'pending');
        var mk = Object.keys(MARK_IMG);
        for (var mi = 0; mi < mk.length; mi++) {
          out.images[MARK_IMG[mk[mi]]] = ui.imgOK['mark:' + mk[mi]] === true ? 'ok' : (ui.imgChecked['mark:' + mk[mi]] ? 'missing' : 'pending');
        }
      } catch (e) { }
      try {
        out.flags = {
          reduceMotion: ui.reduced, tutorialDone: ui.tutorialDone,
          modalOpen: !!ui.modal,
          overlay: ui.overlay ? ((ui.overlay.opts && ui.overlay.opts.kind) || 'open') : null,
          logOpen: ui.logOpen, busy: ui.busy, playing: !!ui.playback,
          stage: ui.battle ? ui.battle.state.stage : null,
          turn: ui.battle ? ui.battle.state.turn : null,
          challengeId: ui.challengeId || '',
          mode: currentBattleMode(),
          extremeUnlocked: isExtremeUnlocked(ui.challengeId || ((firstOpenChallenge() || {}).id || 'shark')),
          qianshouUsed: !!(ui.battle && ui.battle.state && ui.battle.state.qianshouUsed),
          audioMuted: audio.muted,
          audioUnlocked: audio.unlocked,
          audioTrack: audio.current,
          audioHasSrc: !!audioSrc(audio.current),
          audioHasConfig: !!audioConfig(),
          blogLines: (ui.nodes.blogList && ui.nodes.blogList.childNodes) ? ui.nodes.blogList.childNodes.length : 0,
          blogExpanded: !!ui.blogExpanded,
          renderError: ui.renderError || ''
        };
      } catch (e) { }
      try {
        if (document.querySelectorAll && window.getComputedStyle) {
          var nodes = document.querySelectorAll('body *');
          for (var n = 0; n < nodes.length && out.overflow.length < 20; n++) {
            var e2 = nodes[n];
            if (!e2 || e2.nodeType !== 1) continue;
            var rect = e2.getBoundingClientRect();
            var cs = window.getComputedStyle(e2);
            var overX = e2.scrollWidth > e2.clientWidth + 1 && cs.overflowX === 'visible';
            var outRight = rect.right > (window.innerWidth + 1);
            if (overX || outRight) out.overflow.push({ tag: e2.tagName, cls: String(e2.className || '').slice(0, 90), rectRight: Math.round(rect.right), scrollW: e2.scrollWidth, clientW: e2.clientWidth });
          }
        }
      } catch (e) { out.overflowError = String(e); }
      return out;
    };
  }

  /* ---------------------------------------------------------------- 启动 */
  function detectMotion() {
    try { ui.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { ui.reduced = false; }
    if (ui.reduced) addClass(document.body, 'reduce-motion');
  }

  function boot() {
    buildShell();
    detectMotion();
    installHooks();
    if (!resolveData()) {
      showScreen('menu');
      showFatal('数据未加载', '找不到 data/bundle.js 里的 GAME_DATA。请确认脚本顺序：data/bundle.js → js/engine.js → js/cards.js → js/enemy.js → js/ui.js。');
      return;
    }
    ui.tutorialDone = storeGet('localStorage', TUTORIAL_KEY) === '1';
    preloadImages();
    showScreen('menu');
    if (!engineReady()) {
      showFatal('战斗引擎未加载', '找不到 JZ.startBattle()。请确认 js/engine.js、js/cards.js、js/enemy.js 已就位后再刷新。');
    }
  }

  if (document.readyState === 'loading') on(document, 'DOMContentLoaded', boot);
  else boot();
})();
