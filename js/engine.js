/* ============================================================
 * 《抉招：江湖录》· 鲨鱼头挑战 —— 战斗引擎（纯逻辑）
 * ------------------------------------------------------------
 * 形态：经典脚本（非 ESM），加载顺序 engine.js → cards.js → enemy.js
 *       挂载命名空间 window.JZ / globalThis.JZ
 * 约束：无 DOM / 无 localStorage / 所有动作同步返回 / 不向 UI 抛异常
 * 数据真源：JZ.DATA = { cards, boss }（由 data/bundle.js 注入；
 *           node 测试直接读 JSON 注入 globalThis.GAME_DATA）
 * 规则口径：SPEC.md §四 / §五（R1~R28）
 * ============================================================ */
(function (root) {
  'use strict';

  var JZ = (root.JZ = root.JZ || {});
  JZ.VERSION = '1.1.0';
  JZ.CARD_EFFECTS = JZ.CARD_EFFECTS || {};

  // data/bundle.js 先把 GAME_DATA 挂在 window/globalThis 上
  if (!JZ.DATA && root.GAME_DATA) JZ.DATA = root.GAME_DATA;

  // ------------------------------------------------------------
  // 常量
  // ------------------------------------------------------------
  var MARK_KEYS = ['jq', 'bs', 'lh'];
  var MARK_NAMES = { jq: '进取', bs: '保守', lh: '灵活' };
  var ROUTES = ['上', '中', '下', '特'];
  var LOG_LIMIT = 1200;
  var STATE_VERSION = 1;

  // ------------------------------------------------------------
  // 小工具
  // ------------------------------------------------------------
  function clamp(n, lo, hi) {
    n = Number(n) || 0;
    return n < lo ? lo : n > hi ? hi : n;
  }
  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }
  function isAlive(e) {
    return !!(e && e.alive && e.hp > 0);
  }
  function zeroMarks() {
    return { jq: 0, bs: 0, lh: 0 };
  }
  function sumMarks(m) {
    if (!m) return 0;
    return (m.jq || 0) + (m.bs || 0) + (m.lh || 0);
  }
  function costSum(cost) {
    if (!cost) return 0;
    return (cost.jq || 0) + (cost.bs || 0) + (cost.lh || 0);
  }
  function afford(cost, marks) {
    cost = cost || {};
    marks = marks || {};
    return (cost.jq || 0) <= (marks.jq || 0) &&
      (cost.bs || 0) <= (marks.bs || 0) &&
      (cost.lh || 0) <= (marks.lh || 0);
  }
  function payCost(marks, cost) {
    cost = cost || {};
    marks.jq = (marks.jq || 0) - (cost.jq || 0);
    marks.bs = (marks.bs || 0) - (cost.bs || 0);
    marks.lh = (marks.lh || 0) - (cost.lh || 0);
    return marks;
  }
  /** 在 routeArr 里找 seqArr 的「连续子串」（SPEC R7：子串匹配，不是只看末尾） */
  function containsSeq(routeArr, seqArr) {
    if (!routeArr || !seqArr || !seqArr.length) return false;
    if (seqArr.length > routeArr.length) return false;
    for (var i = 0; i <= routeArr.length - seqArr.length; i++) {
      var ok = true;
      for (var j = 0; j < seqArr.length; j++) {
        if (routeArr[i + j] !== seqArr[j]) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }
  function routeSeqChars(seq) {
    if (!seq) return [];
    if (Array.isArray(seq)) return seq.slice();
    return String(seq).split('');
  }

  // ------------------------------------------------------------
  // 玩家卡牌角色分类（用于内置 AI 学习的「玩家画像」）
  //   attack  = 造成伤害 / 攻击增益
  //   defense = 格挡 / 闪避 / 化劲 / 回血 / HP 上限
  //   utility = 意图操控等其它
  // ------------------------------------------------------------
  var CARD_ROLES = {
    'YJQ-AQ-01': 'attack', 'YJQ-AQ-02': 'attack', 'YJQ-AQ-03': 'attack',
    'YJQ-AQ-04': 'attack', 'YJQ-AQ-05': 'attack', 'YJQ-AQ-06': 'attack',
    'YJQ-AQ-07': 'attack', 'YJQ-AQ-08': 'attack', 'YJQ-AQ-09': 'attack',
    'YJQ-AQ-10': 'defense', 'YJQ-AQ-11': 'defense',
    'YJQ-AQ-12': 'attack', 'YJQ-AQ-13': 'attack', 'YJQ-AQ-14': 'attack',
    'YJQ-LL-01': 'defense', 'YJQ-LL-02': 'attack', 'YJQ-LL-03': 'defense',
    'YJQ-LL-04': 'attack', 'YJQ-LL-05': 'utility',
    'YJQ-SF-01': 'defense', 'YJQ-SF-02': 'utility', 'YJQ-SF-03': 'defense',
    'YJQ-SF-04': 'attack', 'YJQ-SF-05': 'defense'
  };
  function cardRoleOf(cardId) {
    return CARD_ROLES[cardId] || 'utility';
  }

  // ------------------------------------------------------------
  // 敌方意图套组原型（与 enemy.js 同口径；enemy.js 未加载时用本地兜底）
  // ------------------------------------------------------------
  var ARCHETYPE_KEYS = ['offense', 'defense', 'utility', 'burst'];
  function archetypeOfIntentSet(set) {
    if (JZ.ENEMY_AI && typeof JZ.ENEMY_AI.archetypeOfSet === 'function') {
      return JZ.ENEMY_AI.archetypeOfSet(set);
    }
    if (!set) return 'offense';
    if (set.hidden) return 'burst';
    var m = set.marks || {};
    var jq = Number(m.jq) || 0;
    var bs = Number(m.bs) || 0;
    var lh = Number(m.lh) || 0;
    if (jq >= 3) return 'offense';
    if (bs >= 3) return 'defense';
    if (lh >= 3) return 'utility';
    if (jq >= bs && jq >= lh) return 'offense';
    if (bs >= lh) return 'defense';
    return 'utility';
  }
  function round3(n) {
    return Math.round(n * 1000) / 1000;
  }

  // ------------------------------------------------------------
  // 可注入种子的 PRNG（xorshift32）。状态存 state._rng，可序列化 → 可复现
  // ------------------------------------------------------------
  function hashSeed(seed) {
    var x;
    if (seed === undefined || seed === null) {
      x = (Date.now() & 0x7fffffff) >>> 0;
    } else if (typeof seed === 'number') {
      x = (seed >>> 0);
    } else {
      var s = String(seed);
      x = 2166136261;
      for (var i = 0; i < s.length; i++) {
        x ^= s.charCodeAt(i);
        x = Math.imul(x, 16777619) >>> 0;
      }
    }
    if (x === 0) x = 0x9e3779b9;
    return x >>> 0;
  }
  function nextRandom(S) {
    var x = S._rng >>> 0;
    x ^= (x << 13) >>> 0; x = x >>> 0;
    x ^= x >>> 17; x = x >>> 0;
    x ^= (x << 5) >>> 0; x = x >>> 0;
    S._rng = x >>> 0;
    return (x >>> 0) / 4294967296;
  }
  function shuffle(S, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(nextRandom(S) * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ------------------------------------------------------------
  // 伤害结算核心（SPEC R1~R6）
  //   每「一段伤害」独立结算：闪避 → 格挡 → 化劲 → 扣血（先扣假血）
  //   type: 'normal' | 'true'(穿格挡) | 'aim'(穿闪避) | 'trueAim'(双穿)
  //   纯函数（只改 target 自身字段），可直接单测
  // ------------------------------------------------------------
  function resolveDamage(target, amount, opts) {
    opts = opts || {};
    var type = opts.type || 'normal';
    var dodgePierce = (type === 'aim' || type === 'trueAim');
    var blockPierce = (type === 'true' || type === 'trueAim');
    var remain = Math.max(0, Number(amount) || 0);
    var res = { dealt: 0, hit: false, dodged: false, blocked: 0, hua: 0, type: type };

    if (!target || remain <= 0) return res;

    // ① 闪避：1 层完全抵消 1 段（必中/真实必中无视且不消耗层数）
    if (!dodgePierce && (target.dodge || 0) > 0) {
      target.dodge -= 1;
      res.dodged = true;
      return res;
    }
    // ② 格挡：按点数吸收，池逐点扣减（真实/真实必中无视）
    if (!blockPierce && (target.block || 0) > 0 && remain > 0) {
      var b = Math.min(target.block, remain);
      target.block -= b;
      remain -= b;
      res.blocked = b;
    }
    // ③ 化劲：最后一道，一次性（本段剩余伤害 >0 时扣减，扣减后清零）
    if ((target.hua || 0) > 0 && remain > 0) {
      var h = Math.min(target.hua, remain);
      target.hua = 0;
      remain -= h;
      res.hua = h;
    }
    // ④ 扣血（二阶段先扣假血；假血是独立血条，溢出伤害不打一阶段）
    if (remain > 0) {
      var fakeShield = (target.phase === 2 && target.fakeHp > 0);
      if (fakeShield) {
        var fk = Math.min(target.fakeHp, remain);
        target.fakeHp -= fk;
        res.dealt += fk;
        remain = 0; // 一阶段 HP 在二阶段期间锁定，假血溢出作废
      }
      if (remain > 0) {
        var before = target.hp || 0;
        target.hp = Math.max(0, before - remain);
        res.dealt += before - target.hp; // 溢出伤害不计入「实际造成」
      }
    }
    res.hit = res.dealt > 0;
    return res;
  }

  /** 阶段节点判定（纯函数）：返回本次回合末应触发的节点（跨档只触发最靠当前 HP 的那个） */
  function crossedNodes(nodes, hp, triggered) {
    var crossed = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!triggered[String(n)] && hp <= n) crossed.push(n);
    }
    return crossed;
  }

  // ------------------------------------------------------------
  // 数据解析（v1.1：支持挑战 → deck/boss 映射）
  //   GAME_DATA = { cards, boss, challenges, decks, bosses }
  //   decks[deckId] / bosses[bossId] 是解析好的卡组/Boss 数据
  // ------------------------------------------------------------
  function resolveData() {
    var d = JZ.DATA || root.GAME_DATA;
    if (d) JZ.DATA = d;
    return d;
  }
  /** deck 数据 = { player, cards[], manuals[] }（旧版 D.cards 同形） */
  function buildIndex(deck) {
    var byId = {};
    var cards = (deck && deck.cards) || [];
    for (var i = 0; i < cards.length; i++) byId[cards[i].id] = cards[i];
    var manuals = (deck && deck.manuals) || [];
    var manualById = {};
    for (var j = 0; j < manuals.length; j++) manualById[manuals[j].id] = manuals[j];
    return { cardById: byId, manualById: manualById };
  }
  function manualIds(deck) {
    return ((deck && deck.manuals) || []).map(function (m) { return m.id; });
  }
  function deckManualById(deck, id) {
    var list = (deck && deck.manuals) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /**
   * SPEC §10.14 R32：按模式取本局秘笈 id 列表
   *   standard：排除 mode==='extreme' 的秘笈（标准 5 张）
   *   extreme ：在标准列表基础上，把 replaceManual 原位替换成 manualId（保持顺序，仍 5 张）
   */
  function manualIdsForMode(deck, mode, extremeCfg) {
    var all = (deck && deck.manuals) || [];
    var ids = [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i].mode === 'extreme') continue;
      ids.push(all[i].id);
    }
    if (mode === 'extreme' && extremeCfg) {
      var rep = extremeCfg.replaceManual;
      var mid = extremeCfg.manualId;
      if (rep && mid && deckManualById(deck, mid)) {
        var idx = ids.indexOf(rep);
        if (idx >= 0) ids[idx] = mid;
        else ids.push(mid);
      }
    }
    return ids;
  }
  function appendNote(a, b) {
    if (!a) return b;
    return a + '；' + b;
  }

  /** 挑战清单（无数据时返回空） */
  function challengeLists(D) {
    var c = D && D.challenges;
    if (!c || !Array.isArray(c.challenges)) return { challenges: [], upcoming: [] };
    return { challenges: c.challenges, upcoming: Array.isArray(c.upcoming) ? c.upcoming : [] };
  }

  /** state.challenge 快照（SPEC §10.3 字段，严格按表） */
  function buildChallengeSnapshot(D, ch) {
    var deckMeta = (D.challenges && D.challenges.decks) || {};
    var bossMeta = (D.challenges && D.challenges.bosses) || {};
    var deck = (D.decks && D.decks[ch.deckId]) || null;
    var boss = (D.bosses && D.bosses[ch.bossId]) || null;
    var deckName = (deckMeta[ch.deckId] && deckMeta[ch.deckId].name) ||
      (deck && deck.player && (deck.player.title || deck.player.name)) || ch.deckId || '';
    var bossName = (bossMeta[ch.bossId] && bossMeta[ch.bossId].name) ||
      (boss && boss.name) || ch.bossId || '';
    var snap = {
      id: ch.id,
      name: ch.name || ch.id,
      code: ch.code || '',
      subtitle: ch.subtitle || '',
      difficulty: ch.difficulty || '',
      difficultyStars: typeof ch.difficultyStars === 'number' ? ch.difficultyStars : 0,
      tags: Array.isArray(ch.tags) ? ch.tags.slice() : [],
      goal: ch.goal || '',
      quote: ch.quote || '',
      deckName: deckName,
      bossName: bossName
    };
    // v1.1 数据扩展字段（challenges.json 新增的展示字段，有则透传，UI 可直接用）
    var EXTRA_KEYS = ['scriptNo', 'story', 'cast', 'duration', 'desc', 'order', 'status'];
    for (var k = 0; k < EXTRA_KEYS.length; k++) {
      var key = EXTRA_KEYS[k];
      if (ch[key] !== undefined) snap[key] = clone(ch[key]);
    }
    return snap;
  }

  /**
   * 解析开局配置（SPEC §10.3 + §10.14 R32 模式）：
   *   challengeId 指定 → 找对应挑战；否则取第一条 status==='open'；
   *   找不到 / 数据缺失 → 回退默认 cards/boss，并在 state.log 记 system。
   *   mode：缺省/非法 → standard；extreme 仅在 challenge.extreme 存在且替换秘笈可用时生效。
   */
  function resolveBattleSetup(D, opts) {
    opts = opts || {};
    var out = {
      deck: null, boss: null, challenge: null, deckId: null, bossId: null,
      note: '', mode: 'standard', extreme: null
    };
    var reqMode = (opts.mode === 'extreme') ? 'extreme' : 'standard'; // 缺省/非法 → standard
    var lists = challengeLists(D);
    var ch = null;
    var i;
    if (opts.challengeId) {
      for (i = 0; i < lists.challenges.length; i++) {
        if (lists.challenges[i].id === opts.challengeId) { ch = lists.challenges[i]; break; }
      }
      // 明确指定但找不到 → 直接回退默认，不再自动挑 open 挑战
      if (!ch) out.note = '未找到挑战「' + opts.challengeId + '」，回退默认卡组/Boss';
    } else {
      // 未指定 → 取第一条 status==='open'
      for (i = 0; i < lists.challenges.length; i++) {
        if ((lists.challenges[i].status || 'open') === 'open') { ch = lists.challenges[i]; break; }
      }
      if (!ch && lists.challenges.length) out.note = out.note || '当前没有可挑战（open）的关卡，回退默认卡组/Boss';
    }
    if (ch) {
      var deck = (D.decks && D.decks[ch.deckId]) || null;
      var boss = (D.bosses && D.bosses[ch.bossId]) || null;
      if (deck && boss) {
        out.deck = deck;
        out.boss = boss;
        out.challenge = buildChallengeSnapshot(D, ch);
        out.deckId = ch.deckId;
        out.bossId = ch.bossId;
        // R32：极限模式校验
        if (reqMode === 'extreme') {
          var ex = ch.extreme;
          var okExtreme = !!(ex && typeof ex === 'object' && ex.replaceManual && ex.manualId &&
            deckManualById(deck, ex.manualId));
          if (okExtreme) {
            out.mode = 'extreme';
            out.extreme = clone(ex);
          } else {
            out.note = appendNote(out.note, '该挑战不支持极限模式（缺少 extreme 配置），已回退标准模式');
          }
        }
        return out;
      }
      out.note = '挑战「' + ch.id + '」的卡组/Boss 数据缺失，回退默认卡组/Boss';
    }
    if (reqMode === 'extreme') {
      out.note = appendNote(out.note, '无法启用极限模式，已回退标准模式');
    }
    out.deck = (D && D.cards) || null;
    out.boss = (D && D.boss) || null;
    out.challenge = null;
    out.deckId = null;
    out.bossId = null;
    out.mode = 'standard';
    out.extreme = null;
    return out;
  }

  /** 战斗所用的卡组数据（restore 时按存档里的 _deckId 复原） */
  function deckDataOf(S, D) {
    if (S && S._deckId && D && D.decks && D.decks[S._deckId]) return D.decks[S._deckId];
    return (D && D.cards) || { player: {}, cards: [], manuals: [] };
  }

  // ------------------------------------------------------------
  // 结构化事件流（SPEC §10.4，演出用；不写入 state.log / state）
  // ------------------------------------------------------------
  function emit(S, t, data) {
    var ev = { t: t };
    if (data) {
      for (var k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k) && data[k] !== undefined) ev[k] = data[k];
      }
    }
    S._events.push(ev);
    return ev;
  }
  function beginAction(S) { S._events = []; }
  function finishAction(S) { return S._events.slice(); }

  /** 伤害事件（字段见 SPEC §10.4 damage 行） */
  function emitDamage(S, fromId, fromName, isPlayerTarget, target, res, amount, type) {
    var data = {
      fromId: fromId,
      fromName: fromName,
      toId: isPlayerTarget ? 'player' : target.id,
      toName: isPlayerTarget ? S.player.name : target.name,
      amount: amount,
      dealt: res.dealt || 0,
      blocked: res.blocked || 0,
      dodged: !!res.dodged,
      hua: res.hua || 0,
      type: type || res.type || 'normal',
      hpAfter: target.hp,
      blockAfter: target.block || 0,
      dodgeAfter: target.dodge || 0,
      huaAfter: target.hua || 0
    };
    if (!isPlayerTarget && target.kind === 'boss') data.fakeHpAfter = target.fakeHp || 0;
    return emit(S, 'damage', data);
  }
  function emitHeal(S, toId, toName, amount, hpAfter) {
    if (amount > 0) emit(S, 'heal', { toId: toId, toName: toName, amount: amount, hpAfter: hpAfter });
  }
  function emitGain(S, toId, toName, stat, v, totalAfter) {
    if (v > 0) emit(S, 'gain', { toId: toId, toName: toName, stat: stat, v: v, totalAfter: totalAfter });
  }
  function emitBuff(S, text) {
    emit(S, 'buff', { text: String(text) });
  }

  // ------------------------------------------------------------
  // 实体查找
  // ------------------------------------------------------------
  function findEnemy(S, id) {
    if (!id) return null;
    for (var i = 0; i < S.enemies.length; i++) {
      if (S.enemies[i].id === id && isAlive(S.enemies[i])) return S.enemies[i];
    }
    return null;
  }
  function bossOf(S) {
    for (var i = 0; i < S.enemies.length; i++) {
      if (S.enemies[i].kind === 'boss') return S.enemies[i];
    }
    return null;
  }

  /** SPEC §10.12 R30：把 boss.strategy 归一化成只含 p1/p2/shrimp/crab 的映射 */
  function normalizeStrategy(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    var keys = ['p1', 'p2', 'shrimp', 'crab'];
    for (var i = 0; i < keys.length; i++) {
      if (typeof raw[keys[i]] === 'string' && raw[keys[i]]) out[keys[i]] = raw[keys[i]];
    }
    return out;
  }

  function aliveEnemies(S) {
    return S.enemies.filter(isAlive);
  }
  function aliveMinions(S) {
    return S.enemies.filter(function (e) { return isAlive(e) && e.kind === 'minion'; });
  }

  // ------------------------------------------------------------
  // 日志
  // ------------------------------------------------------------
  function addLog(S, kind, text) {
    S.log.push({ kind: kind || 'system', text: String(text), turn: S.turn });
    if (S.log.length > LOG_LIMIT) S.log.splice(0, S.log.length - LOG_LIMIT);
  }

  // ------------------------------------------------------------
  // 战斗状态工厂
  // ------------------------------------------------------------
  function emptyBrokenState(err) {
    var S = {
      version: STATE_VERSION,
      seed: null,
      _rng: hashSeed(null),
      turn: 0,
      stage: 'over',
      winner: null,
      endReason: '引擎初始化失败',
      player: {
        name: '易金权', hp: 0, maxHp: 1, block: 0, dodge: 0, hua: 0,
        deck: [], hand: [], discard: [],
        manuals: [], routeHistory: [], playedThisTurn: [],
        playLimit: 5, playsUsed: 0, bonusDraw: 0,
        dmgBuff: { cardsLeft: 0, perCard: 0, turnBonus: 0 },
        dmgMinus: 0, multiSplash: false, icePearl: false,
        reflect: { count: 0, dmg: 1, hits: 3 },
        routeLock: { count: 0 }, hitOnBossThisTurn: 0,
        _dmgMinusLeft: 0
      },
      enemies: [],
      nodesTriggered: { '45': false, '30': false, '15': false },
      log: [],
      _events: [],
      _challenge: null,
      _deckId: null,
      _bossId: null,
      _stats: null,
      _aiId: null,
      _learningRecorded: false,
      _strategy: null,
      _mode: 'standard',
      _icePoints: 0,
      _pending: { playLimit: 0, routeLock: 0, dmgMinus: 0, dmgMinusTurns: 1 },
      _manualsUsedThisTurn: 0,
      _manualLimit: 1,
      _minionSeq: 0,
      _unitSeq: { shrimp: 0, crab: 0 }
    };
    addLog(S, 'error', '引擎初始化失败：' + (err && err.message ? err.message : err));
    return S;
  }

  function createState(D, opts) {
    opts = opts || {};
    var setup = resolveBattleSetup(D, opts);
    var cardsData = setup.deck;
    var bossData = setup.boss;
    var pdata = (cardsData && cardsData.player) || {};
    var maxHp = Number(pdata.maxHp) || 40;
    var seedVal = (opts.seed === undefined ? null : opts.seed);

    var S = {
      version: STATE_VERSION,
      seed: seedVal,
      _rng: hashSeed(seedVal),
      turn: 1,
      stage: 'player',
      winner: null,
      endReason: '',
      player: {
        name: pdata.name || '易金权',
        hp: maxHp,
        maxHp: maxHp,
        block: 0, dodge: 0, hua: 0,
        deck: [], hand: [], discard: [],
        manuals: manualIdsForMode(cardsData, setup.mode, setup.extreme).map(function (id) { return { id: id, used: false }; }),
        routeHistory: [],
        playedThisTurn: [],
        playLimit: Number(pdata.playLimit) || 5,
        playsUsed: 0,
        bonusDraw: 0,
        dmgBuff: { cardsLeft: 0, perCard: 0, turnBonus: 0 },
        dmgMinus: 0,
        multiSplash: false,
        icePearl: false,
        reflect: { count: 0, dmg: 1, hits: 3 },
        routeLock: { count: 0 },
        hitOnBossThisTurn: 0,
        _dmgMinusLeft: 0
      },
      enemies: [],
      nodesTriggered: { '45': false, '30': false, '15': false },
      log: [],
      _events: [],
      // v1.1 挑战解析（SPEC §10.2/10.3）
      _challenge: setup.challenge,
      _deckId: setup.deckId,
      _bossId: setup.bossId,
      // v1.1 内置敌方 AI 学习（SPEC §10.9 R25）
      _aiId: null,
      _stats: null,
      _learningRecorded: false,
      // R30：敌方分单位/分阶段策略（SPEC §10.12）
      _strategy: normalizeStrategy(bossData && bossData.strategy),
      // R32：模式（'standard' | 'extreme'，SPEC §10.14）
      _mode: setup.mode || 'standard',
      _icePoints: 0,
      _pending: { playLimit: 0, routeLock: 0, dmgMinus: 0, dmgMinusTurns: 1 },
      _manualsUsedThisTurn: 0,
      _manualLimit: Number(pdata.manualLimitPerTurn) || 1,
      _minionSeq: 0,
      _unitSeq: { shrimp: 0, crab: 0 }
    };
    // 玩家血量（测试用 opts.playerHp 覆盖，maxHp 仍取数据）
    if (typeof opts.playerHp === 'number' && opts.playerHp > 0) S.player.hp = opts.playerHp;

    // v1.1 R25：本局统计（玩家画像）+ 载入内置敌方 AI 学习状态
    S._aiId = (setup.challenge && setup.challenge.id) || '_default';
    S._stats = {
      cardsPlayed: 0,
      playsByRole: { attack: 0, defense: 0, utility: 0 },
      manualsUsed: 0,
      qianshouUsed: false,
      archetypeUses: { offense: 0, defense: 0, utility: 0, burst: 0 }
    };
    if (JZ.AILearning && typeof JZ.AILearning.load === 'function') {
      try { JZ.AILearning.load(S._aiId); } catch (e) { /* 无 AI / 存储异常 → 静默降级 */ }
    }

    if (!cardsData || !bossData) {
      addLog(S, 'error', '缺少卡组/Boss 数据，无法开始战斗');
      S.stage = 'over';
      return S;
    }

    // 主卡组：50 张（按 copies 展开）
    var deck = [];
    var allCards = cardsData.cards || [];
    for (var i = 0; i < allCards.length; i++) {
      for (var c = 0; c < (allCards[i].copies || 0); c++) deck.push(allCards[i].id);
    }
    S.player.deck = shuffle(S, deck);
    drawCards(S, S.player, Number(pdata.drawPerTurn) || 6);
    beginAction(S); // 开局的摸牌/召唤不归属任何玩家动作（startBattle 不返回 events）

    // Boss
    var ph1 = (bossData.phases && bossData.phases.p1) || {};
    var ph2 = (bossData.phases && bossData.phases.p2) || {};
    var bossHp = Number(ph1.hp) || 60;
    var startHp = (typeof opts.bossHp === 'number' && opts.bossHp > 0) ? opts.bossHp : bossHp;
    var suffix = '';
    if (typeof bossData.collabSuffix === 'string') suffix = bossData.collabSuffix;
    var bossName = (bossData.name || '罐中鲨') + suffix;
    var boss = {
      id: 'boss',
      name: bossName,
      kind: 'boss',
      unitType: 'boss',
      hp: Math.min(startHp, bossHp),
      maxHp: bossHp,
      fakeHp: 0,
      fakeMax: Number(ph2.fakeHp) || 20,
      phase: 1,
      block: 0, dodge: 0, hua: 0,
      intents: zeroMarks(),
      hidden: false,
      intentSetId: '',
      intentLabel: '',
      intentPool: Number((bossData.phases && bossData.phases.p1 && bossData.phases.p1.pool)) || 7,
      dmgBonus: 0,
      nextDmgBonus: 0,
      _buffTurn: 0,
      alive: true,
      mcTurns: 0,
      _skills: [],
      _plan: [],
      _label: ''
    };
    S.enemies.push(boss);

    // 测试用 bossHp 覆盖时：已低于的节点视为已跨过（避免开局立刻触发）
    var nodes = bossData.phaseNodes || [45, 30, 15];
    for (var n = 0; n < nodes.length; n++) {
      if (startHp <= nodes[n]) S.nodesTriggered[String(nodes[n])] = true;
    }

    if (setup.note) addLog(S, 'system', setup.note);
    if (setup.challenge) {
      addLog(S, 'system', '挑战：' + setup.challenge.name + '（' + setup.challenge.code + '）');
    }
    if (S._mode === 'extreme') {
      addLog(S, 'system', '模式：极限模式（千手归一已替换为万法皆通）');
    }
    addLog(S, 'phase', '战斗开始：' + bossName + ' vs ' + S.player.name);
    addLog(S, 'system', bossName + ' HP ' + boss.hp + '/' + boss.maxHp +
      '　' + S.player.name + ' HP ' + S.player.hp + '/' + S.player.maxHp +
      '（牌库 ' + S.player.deck.length + ' 张）');

    // 潮唤·开场
    var opening = bossData.opening || {};
    if (opening.summon) summonUnits(S, bossData, opening.summon, Number(opening.count) || 1);

    // 所有存活敌人各滚一次意图（含开场召唤的小怪）
    for (var e = 0; e < S.enemies.length; e++) {
      if (isAlive(S.enemies[e])) rollIntents(S, bossData, S.enemies[e]);
    }
    addLog(S, 'turn', '—— 第 1 回合 · 玩家行动 ——');
    beginAction(S); // 清掉开局阶段的 events（startBattle 不返回 events）
    return S;
  }

  // ------------------------------------------------------------
  // 战斗上下文：按存档/开局解析出本次战斗用的 deck/boss 数据
  // ------------------------------------------------------------
  function battleData(S, D) {
    var deck = deckDataOf(S, D);
    var boss = (S && S._bossId && D && D.bosses && D.bosses[S._bossId]) ||
      (D && D.boss) || {};
    return { deck: deck, boss: boss, data: D };
  }

  // ------------------------------------------------------------
  // 抽牌 / 弃牌堆洗回
  // ------------------------------------------------------------
  function drawCards(S, p, n) {
    var drawn = 0;
    for (var i = 0; i < n; i++) {
      if (!p.deck.length) {
        if (!p.discard.length) {
          addLog(S, 'system', '牌库与弃牌堆皆空，无法再摸牌');
          break;
        }
        p.deck = shuffle(S, p.discard.slice());
        p.discard = [];
        addLog(S, 'system', '弃牌堆洗回牌库（' + p.deck.length + ' 张）');
      }
      p.hand.push(p.deck.pop());
      drawn++;
    }
    if (drawn > 0) emit(S, 'draw', { count: drawn });
    return drawn;
  }

  // ------------------------------------------------------------
  // 召唤
  // ------------------------------------------------------------
  /** R31：场上小怪上限（boss.maxMinions；缺失/非法时默认 6） */
  function maxMinionsOf(bossData) {
    var v = bossData ? bossData.maxMinions : undefined;
    var n = Number(v);
    if (!isFinite(n) || Math.floor(n) !== n || n < 0) return 6;
    return n;
  }

  function summonUnits(S, bossData, unitType, count) {
    var defs = (bossData && bossData.minions) || {};
    var def = defs[unitType];
    if (!def) {
      addLog(S, 'error', '未知召唤单位：' + unitType);
      return [];
    }
    var cap = maxMinionsOf(bossData);
    var made = [];
    var wanted = Math.max(0, Math.floor(Number(count) || 0));
    for (var i = 0; i < wanted; i++) {
      // R31：场上存活小怪达到上限 → 不再召唤（记 system 日志，不报错）
      var aliveNow = aliveMinions(S).length;
      if (aliveNow >= cap) {
        addLog(S, 'system', '场上小怪已达上限（' + cap + '），不再召唤');
        break;
      }
      S._unitSeq[unitType] = (S._unitSeq[unitType] || 0) + 1;
      var seq = S._unitSeq[unitType];
      S._minionSeq += 1;
      var unit = {
        id: 'm' + S._minionSeq,
        name: seq > 1 ? (def.name + ' ' + seq) : def.name,
        kind: 'minion',
        unitType: unitType,
        hp: Number(def.hp) || 1,
        maxHp: Number(def.hp) || 1,
        fakeHp: 0,
        fakeMax: 0,
        phase: 1,
        block: 0, dodge: 0, hua: 0,
        intents: zeroMarks(),
        hidden: false,
        intentSetId: '',
        intentLabel: '',
        intentPool: 0,
        dmgBonus: 0,
        nextDmgBonus: 0,
        _buffTurn: 0,
        alive: true,
        mcTurns: 0,
        _skills: [],
        _plan: [],
        _label: ''
      };
      S.enemies.push(unit);
      made.push(unit);
      addLog(S, 'summon', '召唤了 ' + unit.name + '（HP ' + unit.hp + '）');
      emit(S, 'summon', { enemyId: unit.id, unitType: unitType, name: unit.name, hp: unit.hp });
    }
    return made;
  }

  // ------------------------------------------------------------
  // 意图滚动（含隐藏 / 被操控）
  // ------------------------------------------------------------
  function chooseIntentSet(sets, rand) {
    var total = 0;
    for (var i = 0; i < sets.length; i++) total += Math.max(0, Number(sets[i].weight) || 0) || 1;
    if (total <= 0) return sets[0];
    var r = rand() * total;
    var acc = 0;
    for (var j = 0; j < sets.length; j++) {
      acc += Math.max(0, Number(sets[j].weight) || 0) || 1;
      if (r < acc) return sets[j];
    }
    return sets[sets.length - 1];
  }

  function rollIntents(S, bossData, entity) {
    if (!isAlive(entity)) return;
    if (entity.kind === 'minion' && entity.mcTurns > 0) {
      entity.intents = zeroMarks();
      entity.hidden = false;
      entity.intentSetId = '';
      entity.intentLabel = '被操控';
      entity.intentPool = 0;
      entity._plan = [];
      entity._skills = [];
      entity._label = '被操控';
      addLog(S, 'intent', entity.name + ' 被操控，跳过行动');
      return;
    }
    var sets, skillList, pool;
    if (entity.kind === 'boss') {
      var phaseKey = entity.phase === 2 ? 'p2' : 'p1';
      sets = bossData.intents[phaseKey] || [];
      skillList = bossData.skills[phaseKey] || [];
      pool = (bossData.phases && bossData.phases[phaseKey] && bossData.phases[phaseKey].pool) || 7;
    } else {
      var mdef = bossData.minions[entity.unitType] || {};
      sets = mdef.intents || [];
      skillList = mdef.skills || [];
      pool = sumMarks({ jq: 0, bs: 0, lh: 0 });
      for (var s = 0; s < sets.length; s++) {
        var sm = sumMarks(sets[s].marks);
        if (sm > pool) pool = sm;
      }
    }
    if (!sets.length) {
      addLog(S, 'error', entity.name + ' 没有意图库数据');
      return;
    }
    var chooser = (JZ.ENEMY_AI && typeof JZ.ENEMY_AI.chooseIntentSet === 'function')
      ? JZ.ENEMY_AI.chooseIntentSet
      : chooseIntentSet;
    var set = chooser(sets, function () { return nextRandom(S); });
    if (!set) {
      addLog(S, 'error', entity.name + ' 意图套组选择失败');
      return;
    }
    // R25：记录 Boss 本局用到的意图原型（用于「敌方胜 → 主用原型 +0.05」）
    if (entity.kind === 'boss' && S._stats) {
      var arch = archetypeOfIntentSet(set);
      entity._archetype = arch;
      if (S._stats.archetypeUses[arch] !== undefined) S._stats.archetypeUses[arch] += 1;
      else S._stats.archetypeUses[arch] = 1;
    }
    entity.intents = {
      jq: Number(set.marks && set.marks.jq) || 0,
      bs: Number(set.marks && set.marks.bs) || 0,
      lh: Number(set.marks && set.marks.lh) || 0
    };
    entity.hidden = !!set.hidden;
    entity.intentSetId = set.id || '';
    entity._label = set.label || '';
    entity.intentLabel = set.hidden ? '意图未知' : (set.label || '');
    entity.intentPool = pool;
    entity._plan = (set.plan || []).slice();
    entity._skills = skillList;
    if (entity.kind === 'boss') {
      addLog(S, 'intent', entity.name + (set.hidden
        ? ' 意图未知（隐藏）'
        : ' 意图：' + (set.label || '')));
    }
  }

  // ------------------------------------------------------------
  // 玄寒珠结算：下回合意图滚完后，按「灵活→进取→保守」逐点扣（R13）
  //   R18（v1.1 补充）：hidden 敌人的意图视为不存在 → 不扣
  // ------------------------------------------------------------
  function applyIcePearl(S) {
    var n = S._icePoints || 0;
    if (!n) return;
    var order = ['lh', 'jq', 'bs'];
    var applied = 0;
    for (var i = 0; i < n; i++) {
      var done = false;
      for (var ei = 0; ei < S.enemies.length && !done; ei++) {
        var e = S.enemies[ei];
        if (!isAlive(e)) continue;
        if (e.hidden) continue; // R18：隐藏意图不可被消解类效果影响
        for (var oi = 0; oi < order.length; oi++) {
          var k = order[oi];
          if ((e.intents[k] || 0) > 0) {
            e.intents[k] -= 1;
            applied++;
            addLog(S, 'intent', '玄寒珠：' + e.name + ' ' + MARK_NAMES[k] + '意图 -1');
            done = true;
            break;
          }
        }
      }
      if (!done) break;
    }
    if (applied < n) addLog(S, 'system', '玄寒珠：无可扣除的敌方意图（剩余 ' + (n - applied) + ' 点作废）');
    if (applied > 0) emitBuff(S, '玄寒珠：扣除敌方意图 ' + applied + ' 点');
    S._icePoints = 0;
  }

  // ------------------------------------------------------------
  // v1.1 R25：内置敌方 AI 学习 —— 本局统计 & 战斗结束结算
  // ------------------------------------------------------------
  function trackCardPlay(S, cardId) {
    var st = S._stats;
    if (!st) return;
    st.cardsPlayed += 1;
    var role = cardRoleOf(cardId);
    st.playsByRole[role] = (st.playsByRole[role] || 0) + 1;
  }
  function trackManualUse(S, manualId) {
    var st = S._stats;
    if (!st) return;
    st.manualsUsed += 1;
    if (manualId === 'YJQ-MJ-05') st.qianshouUsed = true; // 千手归一
  }
  /** 战斗结束时组装玩家画像交给 JZ.AILearning.recordBattle（无 ai.js 时静默跳过） */
  function finalizeLearning(S, winner) {
    if (!S || S._learningRecorded) return;
    S._learningRecorded = true;
    var A = JZ.AILearning;
    if (!A || typeof A.recordBattle !== 'function') return;
    try {
      var st = S._stats || {};
      var by = st.playsByRole || {};
      var played = st.cardsPlayed || 0;
      var attacks = by.attack || 0;
      var defenses = by.defense || 0;
      var utility = by.utility || 0;
      var uses = st.archetypeUses || {};
      var mainArch = '';
      var maxN = -1;
      for (var i = 0; i < ARCHETYPE_KEYS.length; i++) {
        var a = ARCHETYPE_KEYS[i];
        var n = uses[a] || 0;
        if (n > maxN) { maxN = n; mainArch = a; }
      }
      if (maxN <= 0) mainArch = '';
      var profile = {
        cardsPlayed: played,
        attackRatio: played ? round3(attacks / played) : 0,
        defenseRatio: played ? round3(defenses / played) : 0,
        utilityRatio: played ? round3(utility / played) : 0,
        manualUses: st.manualsUsed || 0,
        manualRate: round3((st.manualsUsed || 0) / 5),
        qianshouUsed: !!st.qianshouUsed,
        qianshouWin: winner === 'player' && !!st.qianshouUsed
      };
      var summary = {
        challengeId: S._aiId || '_default',
        winner: winner,
        turns: S.turn,
        playerHp: S.player.hp,
        mainArchetype: mainArch,
        archetypeUses: {
          offense: uses.offense || 0,
          defense: uses.defense || 0,
          utility: uses.utility || 0,
          burst: uses.burst || 0
        },
        profile: profile
      };
      A.recordBattle(S._aiId || '_default', summary);
    } catch (e) { /* 学习失败不影响战斗 */ }
  }

  // ------------------------------------------------------------
  // 战斗结束
  // ------------------------------------------------------------
  function endBattle(S, winner, reason) {
    if (S.stage === 'over') return;
    S.stage = 'over';
    S.winner = winner;
    S.endReason = reason || '';
    if (winner === 'player') addLog(S, 'win', '胜利：' + (reason || '敌人被击败'));
    else addLog(S, 'lose', '战败：' + (reason || '易金权被击败'));
    emit(S, 'battle-end', {
      winner: winner,
      reason: S.endReason,
      mode: S._mode || 'standard',
      qianshouUsed: !!(S._stats && S._stats.qianshouUsed)
    });
    finalizeLearning(S, winner); // R25：记录本局（只记录一次）
  }
  function checkEnd(S) {
    if (S.stage === 'over') return;
    var b = bossOf(S);
    if (b && b.hp <= 0) {
      b.hp = 0;
      b.alive = false;
      emit(S, 'defeat', { id: b.id, name: b.name, kind: 'boss' });
      endBattle(S, 'player', '罐中鲨一阶段 HP 归零');
      return;
    }
    if (S.player.hp <= 0) {
      S.player.hp = 0;
      emit(S, 'defeat', { id: 'player', name: S.player.name, kind: 'player' });
      endBattle(S, 'boss', '易金权 HP 归零');
    }
  }

  // ------------------------------------------------------------
  // 玩家 → 敌人 伤害（含增伤 / 减伤 / 玄寒珠 / 击杀判定）
  //   opts.manual : 秘笈伤害（不吃增伤/减伤、不计玄寒珠）
  //   opts.noSplash: 强制不溅射（多目标/变轨弹/秘笈）
  //   黑白错（v1.1 §10.5）：不再自动溅射；额外目标由 choice.extraTargetIds 指定，
  //   由 playCard 收集 pending 段落后按「主目标→额外目标」逐目标结算（flushSplash）
  // ------------------------------------------------------------
  function playerDamageBonus(S) {
    var p = S.player;
    var buff = (p.dmgBuff.cardsLeft > 0 ? p.dmgBuff.perCard : 0) + (p.dmgBuff.turnBonus || 0);
    return buff;
  }
  function afterEnemyDamage(S, t) {
    if (!t || !t.alive) return;
    if (t.hp > 0) return;
    t.hp = 0;
    t.alive = false;
    if (t.kind === 'boss') {
      emit(S, 'defeat', { id: t.id, name: t.name, kind: 'boss' });
      endBattle(S, 'player', '罐中鲨一阶段 HP 归零');
    } else {
      addLog(S, 'damage', t.name + ' 被击败');
      emit(S, 'defeat', { id: t.id, name: t.name, kind: 'minion' });
    }
  }
  function registerPlayerHit(S, t, countIce) {
    if (t.kind === 'boss') S.player.hitOnBossThisTurn += 1;
    // SPEC §10.10：秘笈伤害不计入「招式命中」类（玄寒珠）计数
    if (countIce !== false && S.player.icePearl) S._icePoints += 1;
  }
  function playerHit(S, targetId, amount, type, opts) {
    if (S.stage === 'over') return 0;
    opts = opts || {};
    var t = findEnemy(S, targetId);
    if (!t) {
      if (!opts.quiet) addLog(S, 'system', '目标不存在或已阵亡');
      return 0;
    }
    var raw = Number(amount) || 0;
    // SPEC §10.10：秘笈吃「本回合持续增伤/减伤」（turnBonus、dmgMinus），
    //   不吃「接下来 N 张牌」类（万事当先 perCard/cardsLeft）
    if (opts.manual) {
      raw = Math.max(0, raw + (S.player.dmgBuff.turnBonus || 0) - (S.player.dmgMinus || 0));
    } else {
      raw = Math.max(0, raw + playerDamageBonus(S) - (S.player.dmgMinus || 0));
    }
    // 黑白错多目标：记录主目标的伤害段（额外目标在主目标结算完后统一结算）
    if (opts.splash && opts.splash.primaryId === t.id && raw > 0) {
      opts.splash.pending.push({ amount: raw, type: type || 'normal' });
    }
    var res = resolveDamage(t, raw, { type: type || 'normal' });
    if (res.dodged) {
      addLog(S, 'defense', t.name + ' 闪避了攻击');
    } else if (res.dealt > 0) {
      addLog(S, 'damage', (opts.sourceName || S.player.name) + ' → ' + t.name + '：' + res.dealt + ' 点伤害' +
        (res.blocked > 0 ? '（格挡 ' + res.blocked + '）' : ''));
    } else if (res.blocked > 0 || res.hua > 0) {
      addLog(S, 'defense', t.name + ' 挡下了全部伤害' +
        (res.blocked ? '（格挡 ' + res.blocked + '）' : '') + (res.hua ? '（化劲 ' + res.hua + '）' : ''));
    }
    emitDamage(S, 'player', S.player.name, false, t, res, raw, type || 'normal');
    if (res.dealt > 0) registerPlayerHit(S, t, !opts.manual);
    afterEnemyDamage(S, t);
    return res.dealt;
  }

  /**
   * 黑白错额外目标结算（SPEC §10.5 + R24）：
   *   按「主目标→额外目标」逐目标、每目标按段序结算同样伤害段；
   *   结算完某目标的伤害段后，再对该目标执行卡牌的「附加效果」（splash.effects，
   *   如连飞蝗的消除意图 / 绽血枫的吸血），使黑白错真正=「增加命中对象」。
   */
  function flushSplash(S, splash) {
    if (!splash || !splash.pending.length || !splash.extras.length) return;
    for (var i = 0; i < splash.extras.length; i++) {
      if (S.stage === 'over') return;
      var t = findEnemy(S, splash.extras[i]);
      if (!t) continue;
      var dealtTotal = 0;
      for (var j = 0; j < splash.pending.length; j++) {
        if (S.stage === 'over' || !isAlive(t)) break;
        var seg = splash.pending[j];
        var res = resolveDamage(t, seg.amount, { type: seg.type });
        if (res.dealt > 0) addLog(S, 'damage', '黑白错 → ' + t.name + '：' + res.dealt + ' 点伤害');
        else if (res.dodged) addLog(S, 'defense', t.name + ' 闪避了黑白错的溅射');
        else addLog(S, 'defense', t.name + ' 挡下了黑白错的溅射');
        emitDamage(S, 'player', S.player.name, false, t, res, seg.amount, seg.type);
        if (res.dealt > 0) registerPlayerHit(S, t);
        dealtTotal += res.dealt;
        afterEnemyDamage(S, t);
      }
      // R24：卡牌的附加效果对每个被黑白错命中的额外目标分别结算
      var effects = splash.effects || [];
      for (var k = 0; k < effects.length; k++) {
        if (S.stage === 'over') break;
        try {
          effects[k](t.id, dealtTotal);
        } catch (e) {
          addLog(S, 'error', '黑白错附加效果执行失败：' + (e && e.message ? e.message : e));
        }
      }
    }
  }

  function playerHitAll(S, amount, times, type, opts) {
    // 多目标招式不吃黑白错溅射（R14 只对「单体招式」生效）
    opts = Object.assign({ noSplash: true }, opts || {});
    var total = 0;
    for (var t = 0; t < (times || 1); t++) {
      if (S.stage === 'over') break;
      var ens = aliveEnemies(S);
      for (var i = 0; i < ens.length; i++) {
        if (S.stage === 'over') break;
        total += playerHit(S, ens[i].id, amount, type, opts);
      }
    }
    return total;
  }

  // ------------------------------------------------------------
  // 敌方 → 玩家 伤害（含敌方增伤 / 天罗地网反击 / 胜负判定）
  // ------------------------------------------------------------
  function enemyAttack(S, entity, raw) {
    if (S.stage === 'over') return 0;
    var p = S.player;
    var amount = Math.max(0, (Number(raw) || 0) + (entity.dmgBonus || 0));
    // 蓄力类（selfDamageBuff）：「自身下回合首次攻击额外 +v（一次性）」
    if ((entity.nextDmgBonus || 0) > 0 && S.turn > (entity._buffTurn || 0)) {
      var burst = entity.nextDmgBonus;
      entity.nextDmgBonus = 0;
      amount += burst;
      addLog(S, 'intent', entity.name + ' 蓄力爆发：本次攻击 +' + burst + ' 点');
    }
    var res = resolveDamage(p, amount, { type: 'normal' });
    if (res.dodged) {
      addLog(S, 'defense', p.name + ' 闪避了 ' + entity.name + ' 的攻击');
    } else if (res.dealt > 0) {
      addLog(S, 'damage', entity.name + ' → ' + p.name + '：' + res.dealt + ' 点伤害' +
        (res.blocked > 0 ? '（格挡 ' + res.blocked + '）' : '') +
        (res.hua > 0 ? '（化劲 ' + res.hua + '）' : ''));
    } else {
      addLog(S, 'defense', p.name + ' 挡下了 ' + entity.name + ' 的攻击（' +
        (res.dodged ? '闪避' : '格挡 ' + res.blocked + (res.hua ? '／化劲 ' + res.hua : '')) + '）');
    }
    emitDamage(S, entity.id, entity.name, true, p, res, amount, 'normal');
    // 天罗地网：每段「玩家受到攻击」触发一次（无论是否被挡下）
    if (p.reflect.count > 0) {
      p.reflect.count -= 1;
      addLog(S, 'defense', '天罗地网 反击 ' + entity.name + '（剩余 ' + p.reflect.count + ' 次）');
      for (var i = 0; i < p.reflect.hits; i++) {
        if (S.stage === 'over' || !isAlive(entity)) break;
        var r = resolveDamage(entity, p.reflect.dmg, { type: 'normal' });
        if (r.dealt > 0) addLog(S, 'damage', '天罗地网 → ' + entity.name + '：' + r.dealt + ' 点伤害');
        else if (r.dodged) addLog(S, 'defense', entity.name + ' 闪避了天罗地网');
        emitDamage(S, 'player', S.player.name, false, entity, r, p.reflect.dmg, 'normal');
        afterEnemyDamage(S, entity);
      }
    }
    if (S.player.hp <= 0) {
      S.player.hp = 0;
      emit(S, 'defeat', { id: 'player', name: S.player.name, kind: 'player' });
      endBattle(S, 'boss', '易金权 HP 归零');
    }
    return res.dealt;
  }

  // ------------------------------------------------------------
  // 清理 / 下一回合
  // ------------------------------------------------------------
  function cleanupTurn(S, deckData) {
    var p = S.player;
    // R26 玩家防御回合末清
    p.block = 0; p.dodge = 0; p.hua = 0;
    // 本回合攻击加成清
    p.dmgBuff = { cardsLeft: 0, perCard: 0, turnBonus: 0 };
    p.multiSplash = false;
    p.icePearl = false;
    p.routeLock.count = 0;
    p.hitOnBossThisTurn = 0;
    // 敌方「本回合」增伤清；「下回合首次攻击」加伤若本回合（即加伤生效的那一回合）
    // 结束仍未被消耗，则过期作废（一次性，不跨回合囤积）
    for (var i = 0; i < S.enemies.length; i++) {
      var en = S.enemies[i];
      en.dmgBonus = 0;
      if ((en.nextDmgBonus || 0) > 0 && (en._buffTurn || 0) < S.turn) {
        addLog(S, 'system', en.name + ' 的蓄力加成未用出，已失效');
        en.nextDmgBonus = 0;
      }
    }
    // 上回合玩家承受的伤害减益到期
    if (p._dmgMinusLeft > 0) {
      p._dmgMinusLeft -= 1;
      if (p._dmgMinusLeft <= 0) p.dmgMinus = 0;
    }
    // 结算敌方留下的「下回合」减益
    var baseLimit = (deckData && deckData.player && Number(deckData.player.playLimit)) || 5;
    var limitDown = Math.min(2, S._pending.playLimit || 0);
    p.playLimit = Math.max(1, baseLimit - limitDown);
    if (S._pending.routeLock > 0) p.routeLock.count = S._pending.routeLock;
    if (S._pending.dmgMinus > 0) {
      p.dmgMinus = S._pending.dmgMinus;
      p._dmgMinusLeft = Math.max(1, S._pending.dmgMinusTurns || 1);
    }
    S._pending = { playLimit: 0, routeLock: 0, dmgMinus: 0, dmgMinusTurns: 1 };
  }

  function nextTurn(S, bossData, deckData) {
    var p = S.player;
    var playedLast = p.playsUsed;
    var bonus = p.bonusDraw || 0;
    var drawBase = Number(deckData && deckData.player && deckData.player.drawPerTurn) || 6;
    var limitBase = Number(deckData && deckData.player && deckData.player.playLimit) || 5;
    var comp = Math.max(0, limitBase - playedLast);
    var drawN = drawBase + comp + bonus;
    p.playsUsed = 0;
    p.bonusDraw = 0;
    p.playedThisTurn = [];
    S._manualsUsedThisTurn = 0;
    S.turn += 1;
    addLog(S, 'turn', '—— 第 ' + S.turn + ' 回合 · 玩家行动 ——');
    emit(S, 'turn-start', { turn: S.turn });
    addLog(S, 'system', '摸牌 ' + drawN + ' 张（基础 ' + drawBase + ' + 少出补偿 ' + comp + ' + 额外 ' + bonus + '）');
    drawCards(S, p, drawN);
    for (var i = 0; i < S.enemies.length; i++) {
      if (isAlive(S.enemies[i])) rollIntents(S, bossData, S.enemies[i]);
    }
    applyIcePearl(S);
    S.stage = 'player';
  }

  // ------------------------------------------------------------
  // 阶段检查（回合末统一处理，R23/R24）
  // ------------------------------------------------------------
  function phaseCheck(S, bossData) {
    var b = bossOf(S);
    if (!b || !b.alive) return;
    var nodes = bossData.phaseNodes || [45, 30, 15];
    if (b.phase === 1) {
      var crossed = crossedNodes(nodes, b.hp, S.nodesTriggered);
      if (crossed.length) {
        // 跨档：只触发「最靠近当前 HP」的那个节点（46→29 只触发 30），其余记为已跨过（跳过）
        var trigger = Math.min.apply(null, crossed);
        for (var i = 0; i < crossed.length; i++) S.nodesTriggered[String(crossed[i])] = true;
        var summons = (bossData.summons && bossData.summons[String(trigger)]) || {};
        addLog(S, 'phase', '罐碎·转阶段！触发 HP 节点 ' + trigger +
          '（跳过：' + crossed.filter(function (n) { return n !== trigger; }).join('、') + '）');
        var names = [];
        if (summons.shrimp) names = names.concat(summonUnits(S, bossData, 'shrimp', summons.shrimp).map(function (m) { return m.name; }));
        if (summons.crab) names = names.concat(summonUnits(S, bossData, 'crab', summons.crab).map(function (m) { return m.name; }));
        b.phase = 2;
        b.fakeHp = b.fakeMax;
        addLog(S, 'phase', b.name + ' 进入二阶段：假血 ' + b.fakeHp + '（一阶段 HP 锁定 ' + b.hp + '）');
        emit(S, 'phase', { from: 'p1', to: 'p2', node: trigger, fakeHp: b.fakeHp, summons: names });
      }
    }
    if (b.phase === 2 && b.fakeHp <= 0) {
      b.phase = 1;
      b.fakeHp = 0;
      addLog(S, 'phase', '潮退·归元：假血耗尽，' + b.name + ' 退回一阶段（HP ' + b.hp + '、不消耗节点）');
      emit(S, 'phase', { from: 'p2', to: 'p1', node: null, fakeHp: 0, summons: [] });
    }
  }

  // ------------------------------------------------------------
  // 敌方行动（引擎负责流程与顺序，具体 AI/op 在 enemy.js）
  //   SPEC §10.11.3 R29：优先用 AI.planTurn(S) 的全局调度顺序执行；
  //   无 AI / 异常时回退旧的「按敌人顺序 runAction」。
  // ------------------------------------------------------------
  function findSkillById(skills, id) {
    for (var i = 0; i < (skills || []).length; i++) {
      if (skills[i].id === id) return skills[i];
    }
    return null;
  }

  /** 敌方单个单位的行动开始：揭示隐藏意图 / 清上回合防御 / 跳过受控与无意图 */
  function enemyActionStart(S, entity) {
    if (!isAlive(entity) || S.stage === 'over') return false;
    if (entity.hidden) {
      addLog(S, 'intent', entity.name + ' 揭示意图：' + (entity._label || entity.intentLabel || '？'));
      emitBuff(S, entity.name + ' 揭示意图：' + (entity._label || entity.intentLabel || '？'));
      entity.hidden = false;
      entity.intentLabel = entity._label || entity.intentLabel || '';
    }
    // R25 敌方防御保留到其下次行动开始才清
    entity.block = 0; entity.dodge = 0; entity.hua = 0;
    // R18（杯酒停戎）被操控：跳过本次行动
    if (entity.kind === 'minion' && entity.mcTurns > 0) {
      entity.mcTurns -= 1;
      addLog(S, 'system', entity.name + ' 被操控，跳过行动');
      entity.intents = zeroMarks();
      return false;
    }
    if (sumMarks(entity.intents) <= 0) {
      addLog(S, 'system', entity.name + ' 无意图，跳过行动');
      return false;
    }
    // 调度推演会静默跳过未知技能；这里补记 error（与旧 runAction 日志一致）
    var planIds = entity._plan || [];
    for (var i = 0; i < planIds.length; i++) {
      if (!findSkillById(entity._skills || [], planIds[i])) {
        addLog(S, 'error', '意图套组 plan 引用了未知技能：' + planIds[i] + '（' + entity.name + '）');
      }
    }
    return true;
  }

  /** 敌方整个回合：行动开始预处理 → planTurn 调度执行（或回退） */
  function executeEnemyTurn(S, BD) {
    var snapshot = S.enemies.filter(isAlive);
    var actors = [];
    var i;
    for (i = 0; i < snapshot.length && S.stage !== 'over'; i++) {
      if (enemyActionStart(S, snapshot[i])) actors.push(snapshot[i]);
    }
    if (S.stage === 'over') return;
    var ai = JZ.ENEMY_AI;
    if (!ai || typeof ai.castSkill !== 'function') {
      addLog(S, 'error', '敌方 AI 未加载（js/enemy.js）');
      return;
    }
    // ① 全局调度（R29）
    var plan = null;
    if (typeof ai.planTurn === 'function') {
      try {
        plan = ai.planTurn(S);
      } catch (e) {
        addLog(S, 'error', '敌方调度失败，回退默认顺序：' + (e && e.message ? e.message : e));
        plan = null;
      }
    }
    if (Array.isArray(plan)) {
      var guard = 0;
      for (i = 0; i < plan.length && S.stage !== 'over' && guard < 300; i++, guard++) {
        var step = plan[i];
        var ent = findEnemy(S, step.enemyId);
        if (!ent) continue;
        var skill = findSkillById(ent._skills || [], step.skillId);
        if (!skill) {
          addLog(S, 'error', '调度计划中的技能不存在：' + step.skillId + '（' + ent.name + '）');
          continue;
        }
        ai.castSkill(makeCtx(S, BD, ent), ent, skill);
      }
    } else {
      // ② 回退：按敌人顺序，各自执行原来的 plan+贪心整套行动
      for (i = 0; i < actors.length && S.stage !== 'over'; i++) {
        ai.runAction(makeCtx(S, BD, actors[i]), actors[i]);
      }
    }
    // R12：未用完的意图标记作废
    for (i = 0; i < S.enemies.length; i++) {
      if (isAlive(S.enemies[i])) S.enemies[i].intents = zeroMarks();
    }
  }

  // ------------------------------------------------------------
  // ctx：给 cards.js 的卡牌效果 / enemy.js 的 op 执行提供的上下文
  //   BD = { deck, boss, data }；opts.splash 为黑白错多目标收集器（仅 playCard 用）
  // ------------------------------------------------------------
  function makeCtx(S, BD, actor, opts) {
    opts = opts || {};
    var idx = buildIndex(BD.deck);
    var splash = opts.splash || null;
    var ctx = {
      state: S,
      data: BD.data,
      deck: BD.deck,
      bossData: BD.boss,
      actor: actor || null,
      player: S.player,
      emit: function (t, data) { return emit(S, t, data); },
      rng: function () { return nextRandom(S); },
      log: function (kind, text) { addLog(S, kind, text); },
      over: function () { return S.stage === 'over'; },

      // R30：按单位+阶段取策略（boss 用 p1/p2，小怪用 unitType；缺省 aggressive）
      strategyOf: function (e) {
        var st = S._strategy || {};
        if (!e) return 'aggressive';
        if (e.kind === 'boss') return (e.phase === 2 ? st.p2 : st.p1) || 'aggressive';
        return st[e.unitType] || 'aggressive';
      },

      // ---- 实体 ----
      enemies: function () { return aliveEnemies(S); },
      enemy: function (id) { return findEnemy(S, id); },
      boss: function () { return bossOf(S); },
      card: function (id) { return idx.cardById[id] || null; },
      manual: function (id) { return idx.manualById[id] || null; },

      // ---- 玩家 → 敌人 ----
      hitEnemy: function (targetId, amount, type, opts2) {
        opts2 = opts2 || {};
        if (splash && splash.primaryId === targetId) opts2 = Object.assign({}, opts2, { splash: splash });
        return playerHit(S, targetId, amount, type, opts2);
      },
      hitAll: function (amount, times, type, opts2) {
        return playerHitAll(S, amount, times, type, opts2 || {});
      },
      // ---- 黑白错附加目标（R24）：卡牌对「每个被命中目标」的附加效果 ----
      splashTargets: function () { return splash ? splash.extras.slice() : []; },
      onBystanderHit: function (fn) {
        if (typeof fn !== 'function' || !splash) return false;
        splash.effects.push(fn);
        return true;
      },
      // ---- 秘笈专用伤害：不吃增伤/减伤、不触发黑白错 ----
      manualHit: function (targetId, amount, type) {
        return playerHit(S, targetId, amount, type, { manual: true, quiet: true });
      },
      manualHitAll: function (amount, times, type) {
        return playerHitAll(S, amount, times, type, { manual: true, quiet: true });
      },

      // ---- 玩家自身 ----
      healPlayer: function (n) {
        var p = S.player;
        var before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + (Number(n) || 0));
        if (p.hp > before) {
          addLog(S, 'heal', p.name + ' 恢复 ' + (p.hp - before) + ' HP（' + p.hp + '/' + p.maxHp + '）');
          emitHeal(S, 'player', p.name, p.hp - before, p.hp);
        }
        return p.hp - before;
      },
      setPlayerHp: function (v) {
        var p2 = S.player;
        var before = p2.hp;
        p2.hp = clamp(v, 0, p2.maxHp);
        addLog(S, p2.hp < before ? 'damage' : 'heal', p2.name + ' HP → ' + p2.hp + '（原 ' + before + '）');
        if (p2.hp > before) emitHeal(S, 'player', p2.name, p2.hp - before, p2.hp);
        else if (p2.hp < before) emitDamage(S, 'player', '自身代价', true, p2,
          { dealt: before - p2.hp, blocked: 0, dodged: false, hua: 0 }, before - p2.hp, 'true');
      },
      selfDamage: function (n) {
        var p = S.player;
        n = Math.max(0, Number(n) || 0);
        var before = p.hp;
        p.hp = Math.max(0, p.hp - n);
        addLog(S, 'damage', p.name + ' 自损 ' + (before - p.hp) + ' HP（' + p.hp + '/' + p.maxHp + '）');
        emitDamage(S, 'player', '自损', true, p,
          { dealt: before - p.hp, blocked: 0, dodged: false, hua: 0 }, before - p.hp, 'true');
        checkEnd(S);
      },
      maxHpUp: function (n) {
        var p = S.player;
        n = Math.max(0, Number(n) || 0);
        if (!n) return 0;
        var before = p.hp;
        p.maxHp += n;
        p.hp = Math.min(p.maxHp, p.hp + n);
        addLog(S, 'heal', p.name + ' HP 上限 +' + n + '（' + p.hp + '/' + p.maxHp + '）');
        if (p.hp > before) emitHeal(S, 'player', p.name, p.hp - before, p.hp);
        emitBuff(S, p.name + ' HP 上限 +' + n);
        return n;
      },
      maxHpDown: function (n) {
        var p = S.player;
        n = Math.max(0, Number(n) || 0);
        if (!n) return 0;
        var real = Math.min(n, Math.max(0, p.maxHp - 1));
        p.maxHp -= real;
        p.hp = Math.min(p.hp, p.maxHp);
        addLog(S, 'damage', p.name + ' HP 上限 -' + real + '（' + p.hp + '/' + p.maxHp + '）');
        emitBuff(S, p.name + ' HP 上限 -' + real);
        return real;
      },
      addBlock: function (n) {
        n = Math.max(0, Number(n) || 0);
        if (!n) return 0;
        S.player.block += n;
        addLog(S, 'defense', S.player.name + ' 获得 ' + n + ' 点格挡（共 ' + S.player.block + '）');
        emitGain(S, 'player', S.player.name, 'block', n, S.player.block);
        return n;
      },
      addDodge: function (n) {
        n = Math.max(0, Number(n) || 0);
        if (!n) return 0;
        S.player.dodge += n;
        addLog(S, 'defense', S.player.name + ' 获得 ' + n + ' 层闪避（共 ' + S.player.dodge + '）');
        emitGain(S, 'player', S.player.name, 'dodge', n, S.player.dodge);
        return n;
      },
      addHua: function (n) {
        n = Math.max(0, Number(n) || 0);
        if (!n) return 0;
        S.player.hua += n;
        addLog(S, 'defense', S.player.name + ' 获得 ' + n + ' 点化劲（共 ' + S.player.hua + '，一次性）');
        emitGain(S, 'player', S.player.name, 'hua', n, S.player.hua);
        return n;
      },
      gainDraw: function (n) {
        n = Math.max(0, Number(n) || 0);
        if (!n) return 0;
        S.player.bonusDraw += n;
        addLog(S, 'system', '下回合额外摸 ' + n + ' 张（累计 ' + S.player.bonusDraw + '）');
        emitBuff(S, '下回合额外摸 ' + n + ' 张（累计 ' + S.player.bonusDraw + '）');
        return n;
      },

      // ---- 意图操作 ----
      removeIntent: function (enemyId, type, n) {
        var e = findEnemy(S, enemyId);
        if (!e) return 0;
        if (e.hidden) {
          addLog(S, 'system', e.name + ' 意图未知，无法消除');
          return 0;
        }
        var want = Math.max(1, Number(n) || 1);
        var have = e.intents[type] || 0;
        var rm = Math.min(want, have);
        if (rm <= 0) {
          addLog(S, 'system', e.name + ' 没有可消除的' + (MARK_NAMES[type] || type) + '意图');
          return 0;
        }
        e.intents[type] = have - rm;
        addLog(S, 'intent', '消除 ' + e.name + ' ' + rm + ' 个' + (MARK_NAMES[type] || type) + '意图（剩余 ' + sumMarks(e.intents) + '）');
        emitBuff(S, '消除 ' + e.name + ' ' + rm + ' 个' + (MARK_NAMES[type] || type) + '意图');
        return rm;
      },
      convertIntent: function (enemyId, from, to) {
        var e = findEnemy(S, enemyId);
        if (!e) return 0;
        if (e.hidden) {
          addLog(S, 'system', e.name + ' 意图未知，无法转换');
          return 0;
        }
        if (MARK_KEYS.indexOf(from) < 0 || MARK_KEYS.indexOf(to) < 0 || from === to) {
          addLog(S, 'error', '非法的意图转换：' + from + '→' + to);
          return 0;
        }
        var have = e.intents[from] || 0;
        if (have <= 0) {
          addLog(S, 'system', e.name + ' 没有' + MARK_NAMES[from] + '意图可转换');
          return 0;
        }
        e.intents[from] = 0;
        e.intents[to] = (e.intents[to] || 0) + have;
        addLog(S, 'intent', e.name + '：' + MARK_NAMES[from] + ' ×' + have + ' → ' + MARK_NAMES[to]);
        emitBuff(S, e.name + '：' + MARK_NAMES[from] + ' ×' + have + ' → ' + MARK_NAMES[to]);
        return have;
      },
      // R18（v1.1）：hidden 敌人的意图视为不存在 → 计数时跳过
      countIntent: function (type) {
        var n = 0;
        var ens = aliveEnemies(S);
        for (var i = 0; i < ens.length; i++) {
          if (ens[i].hidden) continue;
          n += (ens[i].intents[type] || 0);
        }
        return n;
      },
      countNonJq: function () {
        var n = 0;
        var ens = aliveEnemies(S);
        for (var i = 0; i < ens.length; i++) {
          if (ens[i].hidden) continue;
          n += (ens[i].intents.bs || 0) + (ens[i].intents.lh || 0);
        }
        return n;
      },
      aliveCount: function () { return aliveEnemies(S).length; },
      minions: function () { return aliveMinions(S); },
      addEnemyMc: function (enemyId, n) {
        var e = findEnemy(S, enemyId);
        if (!e || e.kind !== 'minion') return 0;
        n = Math.max(0, Number(n) || 0);
        if (!n) return 0;
        e.mcTurns = (e.mcTurns || 0) + n;
        addLog(S, 'system', e.name + ' 被操控 ' + n + ' 次行动');
        emitBuff(S, e.name + ' 被操控 ' + n + ' 次行动');
        return n;
      },

      // ---- 本回合增益开关 ----
      setDmgBuffCards: function (n) {
        S.player.dmgBuff.cardsLeft = Math.max(0, Number(n) || 0);
        S.player.dmgBuff.perCard = 1;
        addLog(S, 'system', '接下来 ' + S.player.dmgBuff.cardsLeft + ' 张牌每段伤害 +1');
        emitBuff(S, '接下来 ' + S.player.dmgBuff.cardsLeft + ' 张牌每段伤害 +1');
      },
      addTurnBonus: function (n) {
        n = Math.max(0, Number(n) || 0);
        S.player.dmgBuff.turnBonus += n;
        addLog(S, 'system', '本回合我方每段攻击 +' + n + ' 伤害');
        emitBuff(S, '本回合我方每段攻击 +' + n + ' 伤害');
      },
      setMultiSplash: function () {
        S.player.multiSplash = true;
        addLog(S, 'system', '黑白错：本回合后续单体招式可额外选择最多 2 个攻击对象');
        emitBuff(S, '黑白错：本回合后续单体招式可额外选择最多 2 个攻击对象');
      },
      setIcePearl: function () {
        S.player.icePearl = true;
        addLog(S, 'system', '玄寒珠：本回合每命中一次，下回合敌方意图 -1');
        emitBuff(S, '玄寒珠：本回合每命中一次，下回合敌方意图 -1');
      },
      setReflect: function (count, dmg, hits) {
        S.player.reflect = { count: Number(count) || 5, dmg: Number(dmg) || 1, hits: Number(hits) || 3 };
        addLog(S, 'system', '天罗地网：接下来 ' + S.player.reflect.count + ' 次受攻击会反击');
        emitBuff(S, '天罗地网：接下来 ' + S.player.reflect.count + ' 次受攻击会反击');
      },

      // ---- 敌方（enemy.js 用） ----
      marksOf: function (e) { return e.intents; },
      afford: function (e, cost) { return afford(cost, e.intents); },
      spend: function (e, cost) { payCost(e.intents, cost); },
      enemyHit: function (e, v) { return enemyAttack(S, e, v); },
      enemyMultiHit: function (e, v, times) {
        for (var i = 0; i < (times || 1); i++) {
          if (S.stage === 'over') break;
          enemyAttack(S, e, v);
        }
      },
      addEnemyBlock: function (e, n) {
        n = Math.max(0, Number(n) || 0); if (!n) return;
        e.block = (e.block || 0) + n;
        addLog(S, 'defense', e.name + ' 获得 ' + n + ' 点格挡');
        emitGain(S, e.id, e.name, 'block', n, e.block);
      },
      addEnemyDodge: function (e, n) {
        n = Math.max(0, Number(n) || 0); if (!n) return;
        e.dodge = (e.dodge || 0) + n;
        addLog(S, 'defense', e.name + ' 获得 ' + n + ' 层闪避');
        emitGain(S, e.id, e.name, 'dodge', n, e.dodge);
      },
      addEnemyHua: function (e, n) {
        n = Math.max(0, Number(n) || 0); if (!n) return;
        e.hua = (e.hua || 0) + n;
        addLog(S, 'defense', e.name + ' 获得 ' + n + ' 点化劲');
        emitGain(S, e.id, e.name, 'hua', n, e.hua);
      },
      healEntity: function (e, n) {
        n = Math.max(0, Number(n) || 0);
        var before = e.hp;
        e.hp = Math.min(e.maxHp, e.hp + n);
        if (e.hp > before) {
          addLog(S, 'heal', e.name + ' 恢复 ' + (e.hp - before) + ' HP（' + e.hp + '/' + e.maxHp + '）');
          emitHeal(S, e.id, e.name, e.hp - before, e.hp);
        }
      },
      healFake: function (e, n) {
        if (!e || e.kind !== 'boss' || e.phase !== 2) {
          addLog(S, 'system', '潮噬回生：一阶段无假血，效果无效');
          return 0;
        }
        n = Math.max(0, Number(n) || 0);
        var before = e.fakeHp;
        e.fakeHp = Math.min(e.fakeMax, e.fakeHp + n);
        if (e.fakeHp > before) {
          addLog(S, 'heal', e.name + ' 假血 +' + (e.fakeHp - before) + '（' + e.fakeHp + '/' + e.fakeMax + '）');
          emitBuff(S, e.name + ' 假血 +' + (e.fakeHp - before));
        }
        return e.fakeHp - before;
      },
      allyDamageBuff: function (e, v, unit) {
        v = Number(v) || 0;
        if (!v) return;
        var ens = aliveEnemies(S);
        var hits = [];
        for (var i = 0; i < ens.length; i++) {
          var x = ens[i];
          if (unit && x.unitType !== unit) continue;
          x.dmgBonus = (x.dmgBonus || 0) + v;
          hits.push(x.name);
        }
        addLog(S, 'intent', '狂潮号令：' + (hits.length ? hits.join('、') : '无目标') + ' 本回合每次伤害 +' + v);
        emitBuff(S, '狂潮号令：' + (hits.length ? hits.join('、') : '无目标') + ' 本回合每次伤害 +' + v);
      },
      allyBlock: function (e, v, includeSelf) {
        v = Number(v) || 0; if (!v) return;
        var ens = aliveEnemies(S);
        for (var i = 0; i < ens.length; i++) {
          if (!includeSelf && ens[i] === e) continue;
          ens[i].block = (ens[i].block || 0) + v;
          emitGain(S, ens[i].id, ens[i].name, 'block', v, ens[i].block);
        }
        addLog(S, 'defense', '友方获得 ' + v + ' 点格挡（' + (includeSelf ? '含自身' : '不含自身') + '）');
      },
      allyDodge: function (e, v, includeSelf) {
        v = Number(v) || 0; if (!v) return;
        var ens = aliveEnemies(S);
        for (var i = 0; i < ens.length; i++) {
          if (!includeSelf && ens[i] === e) continue;
          ens[i].dodge = (ens[i].dodge || 0) + v;
          emitGain(S, ens[i].id, ens[i].name, 'dodge', v, ens[i].dodge);
        }
        addLog(S, 'defense', '友方获得 ' + v + ' 层闪避（' + (includeSelf ? '含自身' : '不含自身') + '）');
      },
      allyHeal: function (e, v, includeSelf) {
        v = Number(v) || 0; if (!v) return;
        var ens = aliveEnemies(S);
        for (var i = 0; i < ens.length; i++) {
          if (!includeSelf && ens[i] === e) continue;
          var x = ens[i];
          var before = x.hp;
          x.hp = Math.min(x.maxHp, x.hp + v);
          if (x.hp > before) {
            addLog(S, 'heal', x.name + ' 恢复 ' + (x.hp - before) + ' HP');
            emitHeal(S, x.id, x.name, x.hp - before, x.hp);
          }
        }
      },
      summon: function (unit, count) { return summonUnits(S, BD.boss, unit, count || 1); },
      playerPlayLimit: function (v) {
        v = Math.max(1, Number(v) || 1);
        S._pending.playLimit += v;
        addLog(S, 'system', S.player.name + ' 下回合出牌上限 -' + v + '（累计 -' + S._pending.playLimit + '，最多 -2）');
        emitBuff(S, S.player.name + ' 下回合出牌上限 -' + v);
      },
      playerRouteLock: function (count) {
        count = Math.max(1, Number(count) || 3);
        S._pending.routeLock = Math.max(S._pending.routeLock, count);
        addLog(S, 'system', S.player.name + ' 下回合前 ' + count + ' 张牌的路数视为「特」（只影响秘笈）');
        emitBuff(S, S.player.name + ' 下回合前 ' + count + ' 张牌的路数视为「特」');
      },
      playerDamageDebuff: function (v, turns) {
        v = Math.max(1, Number(v) || 1);
        S._pending.dmgMinus = Math.max(S._pending.dmgMinus, v);
        S._pending.dmgMinusTurns = Math.max(1, Number(turns) || 1);
        addLog(S, 'system', S.player.name + ' 下回合每段伤害 -' + v);
        emitBuff(S, S.player.name + ' 下回合每段伤害 -' + v);
      },
      retaliate: function (e, perHit) {
        var hits = S.player.hitOnBossThisTurn || 0;
        var dmg = hits * (Number(perHit) || 0);
        if (dmg > 0) {
          addLog(S, 'intent', e.name + ' 逆鳞反噬：本回合被命中 ' + hits + ' 次 → 追加 ' + dmg + ' 点伤害');
          enemyAttack(S, e, dmg);
        } else {
          addLog(S, 'intent', e.name + ' 逆鳞反噬：本回合未被命中，无追加伤害');
        }
      },
      selfDamageBuff: function (e, v) {
        // SPEC §2.2：自身「下回合」首次攻击额外 +v（一次性；本回合不生效）
        v = Number(v) || 0; if (!v) return;
        e.nextDmgBonus = (e.nextDmgBonus || 0) + v;
        e._buffTurn = S.turn;
        addLog(S, 'intent', e.name + ' 蓄力：下回合首次攻击 +' + v);
        emitBuff(S, e.name + ' 蓄力：下回合首次攻击 +' + v);
      },

      // ---- 终局 ----
      checkEnd: function () { checkEnd(S); },
      lose: function (reason) { endBattle(S, 'boss', reason || '特殊败北'); },
      win: function (reason) { endBattle(S, 'player', reason || '特殊胜利'); }
    };
    return ctx;
  }

  // ------------------------------------------------------------
  // choice 校验（SPEC §3.2）
  // 返回 { ok:true, value:<规范化后的 choice> } 或 { ok:false, reason }
  // ------------------------------------------------------------
  function failChoice(reason) { return { ok: false, reason: reason }; }
  function validateChoice(S, card, choice) {
    choice = choice || {};
    var sel = card.select || 'none';
    var i, list, out, e, id;

    function alive(id2) { return findEnemy(S, id2); }

    switch (sel) {
      case 'none':
        return { ok: true, value: {} };

      case 'enemy': {
        e = alive(choice.targetId);
        if (!e) return failChoice('请选择 1 个存活敌人');
        var outEnemy = { targetId: e.id };
        // 黑白错多目标（SPEC §10.5）：额外目标最多 2 个（共 3 个），跟随玩家所选顺序
        if (Array.isArray(choice.extraTargetIds) && choice.extraTargetIds.length) {
          var extras = [];
          for (i = 0; i < choice.extraTargetIds.length; i++) {
            var et = alive(choice.extraTargetIds[i]);
            if (!et) return failChoice('额外目标已阵亡或不存在');
            if (et.id === e.id) return failChoice('额外目标不能与主目标相同');
            if (extras.indexOf(et.id) >= 0) continue;
            extras.push(et.id);
          }
          if (extras.length > 2) return failChoice('额外目标最多 2 个（共 3 个目标）');
          outEnemy.extraTargetIds = extras;
        }
        return { ok: true, value: outEnemy };
      }

      case 'enemies3':
        list = Array.isArray(choice.targetIds) ? choice.targetIds : [];
        if (list.length > 3) return failChoice('最多选择 3 个敌人');
        out = [];
        for (i = 0; i < list.length; i++) {
          e = alive(list[i]);
          if (!e) return failChoice('目标已阵亡或不存在');
          if (out.indexOf(e.id) < 0) out.push(e.id);
        }
        return { ok: true, value: { targetIds: out } };

      case 'minion':
        e = alive(choice.targetId);
        if (!e || e.kind !== 'minion') return failChoice('请选择 1 个存活小怪');
        return { ok: true, value: { targetId: e.id } };

      case 'route': {
        if (ROUTES.indexOf(choice.route) < 0) return failChoice('请选择路数：上/中/下/特');
        // 变轨弹等「先选路数、再选目标」的卡：透传 targetId（校验存活）；
        // 缺省时由 cards.js 回退到第一个存活敌人
        var routeTargetId = null;
        if (choice.targetId) {
          var rt = alive(choice.targetId);
          if (!rt) return failChoice('目标已阵亡或不存在');
          routeTargetId = rt.id;
        }
        // SPEC §10.11.1：路数=上/中/下 视为单体攻击招式 → 吃黑白错多目标
        var routeExtras = [];
        if (choice.route !== '特' && Array.isArray(choice.extraTargetIds) && choice.extraTargetIds.length) {
          var routePrimary = routeTargetId || (aliveEnemies(S)[0] && aliveEnemies(S)[0].id) || null;
          for (i = 0; i < choice.extraTargetIds.length; i++) {
            var ret = alive(choice.extraTargetIds[i]);
            if (!ret) return failChoice('额外目标已阵亡或不存在');
            if (routePrimary && ret.id === routePrimary) return failChoice('额外目标不能与主目标相同');
            if (routeExtras.indexOf(ret.id) >= 0) continue;
            routeExtras.push(ret.id);
          }
          if (routeExtras.length > 2) return failChoice('额外目标最多 2 个（共 3 个目标）');
        }
        var routeValue = { route: choice.route, targetId: routeTargetId };
        if (routeExtras.length) routeValue.extraTargetIds = routeExtras;
        return { ok: true, value: routeValue };
      }

      case 'convert': {
        e = alive(choice.targetId);
        if (!e) return failChoice('请选择 1 个存活敌人');
        var from = choice.from, to = choice.to;
        if (MARK_KEYS.indexOf(from) < 0 || MARK_KEYS.indexOf(to) < 0 || from === to) {
          return failChoice('请选择「从哪类意图 → 哪类意图」（两类不能相同）');
        }
        return { ok: true, value: { targetId: e.id, from: from, to: to } };
      }

      case 'bet': {
        var amount = Number(choice.amount);
        if (!isFinite(amount) || Math.floor(amount) !== amount) return failChoice('投入值必须是整数');
        if (amount < 5 || amount > 15) return failChoice('投入值需在 5~15 之间');
        if (amount > S.player.maxHp) return failChoice('投入值不能超过当前 HP 上限（' + S.player.maxHp + '）');
        return { ok: true, value: { amount: amount } };
      }

      case 'jqIntentsDynamic':
      case 'jqIntents8':
      case 'jqIntents6': {
        var aliveN = aliveEnemies(S).length;
        var limit = sel === 'jqIntents8' ? 8 : sel === 'jqIntents6' ? 6 : aliveN;
        list = Array.isArray(choice.picks) ? choice.picks : [];
        if (list.length > limit) return failChoice('最多选择 ' + limit + ' 个进取意图');
        out = [];
        for (i = 0; i < list.length; i++) {
          var pick = list[i] || {};
          e = alive(pick.enemyId);
          if (!e) return failChoice('目标已阵亡或不存在');
          out.push({ enemyId: e.id, type: 'jq' });
        }
        return { ok: true, value: { picks: out } };
      }

      case 'enemy+jqIntent1': {
        e = alive(choice.targetId);
        if (!e) return failChoice('请选择 1 个存活敌人');
        var pick2 = null;
        if (choice.jqPick && choice.jqPick.enemyId) {
          var e2 = alive(choice.jqPick.enemyId);
          if (!e2) return failChoice('意图目标已阵亡或不存在');
          pick2 = { enemyId: e2.id };
        }
        return { ok: true, value: { targetId: e.id, jqPick: pick2 } };
      }

      default:
        return failChoice('未知的选择器类型：' + sel);
    }
  }

  // ------------------------------------------------------------
  // 对外快照
  // ------------------------------------------------------------
  function publicState(S) {
    var p = S.player;
    return clone({
      version: STATE_VERSION,
      turn: S.turn,
      stage: S.stage,
      winner: S.winner,
      endReason: S.endReason,
      // R32：模式与「本局是否用过千手归一」（UI 解锁/展示用）
      mode: S._mode || 'standard',
      qianshouUsed: !!(S._stats && S._stats.qianshouUsed),
      // v1.1：当前挑战（旧数据/回退时可能为 null）
      challenge: S._challenge ? S._challenge : null,
      player: {
        name: p.name,
        hp: p.hp,
        maxHp: p.maxHp,
        block: p.block,
        dodge: p.dodge,
        hua: p.hua,
        deck: p.deck.slice(),
        hand: p.hand.slice(),
        discard: p.discard.slice(),
        manuals: p.manuals.map(function (m) { return { id: m.id, used: !!m.used }; }),
        routeHistory: p.routeHistory.slice(),
        playedThisTurn: p.playedThisTurn.map(function (x) { return { id: x.id, route: x.route, type: x.type }; }),
        playLimit: p.playLimit,
        playsUsed: p.playsUsed,
        bonusDraw: p.bonusDraw,
        dmgBuff: { cardsLeft: p.dmgBuff.cardsLeft, perCard: p.dmgBuff.perCard, turnBonus: p.dmgBuff.turnBonus },
        dmgMinus: p.dmgMinus,
        multiSplash: p.multiSplash,
        icePearl: p.icePearl,
        reflect: { count: p.reflect.count, dmg: p.reflect.dmg, hits: p.reflect.hits },
        routeLock: { count: p.routeLock.count },
        hitOnBossThisTurn: p.hitOnBossThisTurn,
        manualsUsedThisTurn: S._manualsUsedThisTurn
      },
      enemies: S.enemies.map(function (e) {
        return {
          id: e.id,
          name: e.name,
          kind: e.kind,
          unitType: e.unitType,
          hp: e.hp,
          maxHp: e.maxHp,
          fakeHp: e.fakeHp,
          fakeMax: e.fakeMax,
          phase: e.phase,
          block: e.block,
          dodge: e.dodge,
          hua: e.hua,
          intents: { jq: e.intents.jq, bs: e.intents.bs, lh: e.intents.lh },
          hidden: e.hidden,
          intentSetId: e.intentSetId,
          intentLabel: e.intentLabel,
          intentPool: e.intentPool,
          dmgBonus: e.dmgBonus,
          alive: e.alive,
          mcTurns: e.mcTurns || 0
        };
      }),
      nodesTriggered: {
        '45': !!S.nodesTriggered['45'],
        '30': !!S.nodesTriggered['30'],
        '15': !!S.nodesTriggered['15']
      },
      log: S.log.map(function (l) { return { kind: l.kind, text: l.text, turn: l.turn }; })
    });
  }

  // ------------------------------------------------------------
  // Battle 实例（API 合同，SPEC §三）
  // ------------------------------------------------------------
  function makeBattle(S, D) {
    var BD = battleData(S, D);
    var idx = buildIndex(BD.deck);

    /** card-play 事件的 targets：主目标在前，黑白错额外目标按玩家所选顺序在后 */
    function cardTargets(card, value) {
      var sel = card.select || 'none';
      var ids = [];
      var i;
      if (sel === 'enemy' || sel === 'minion' || sel === 'convert') {
        if (value.targetId) ids.push(value.targetId);
      } else if (sel === 'enemies3') {
        ids = (value.targetIds || []).slice();
      } else if (sel === 'route') {
        if (value.route !== '特') {
          var fallback = aliveEnemies(S)[0];
          var tid = value.targetId || (fallback && fallback.id);
          if (tid) ids.push(tid);
        }
      }
      if (S.player.multiSplash && Array.isArray(value.extraTargetIds)) {
        for (i = 0; i < value.extraTargetIds.length; i++) {
          if (ids.indexOf(value.extraTargetIds[i]) < 0) ids.push(value.extraTargetIds[i]);
        }
      }
      return ids;
    }

    /**
     * 黑白错多目标收集器（SPEC §10.5 / §10.11.1）：
     *   - 单体招式（select==='enemy'）
     *   - 变轨弹（YJQ-AQ-14）且宣言路数 ≠ 特（上/中/下 视为单体攻击）
     *   只在 multiSplash + 玩家选择了额外目标时启用
     */
    function makeSplash(card, value) {
      if (!S.player.multiSplash) return null;
      var isSingleTarget = card.select === 'enemy';
      var isVariantRoute = card.id === 'YJQ-AQ-14' && value.route && value.route !== '特';
      if (!isSingleTarget && !isVariantRoute) return null;
      if (!Array.isArray(value.extraTargetIds) || !value.extraTargetIds.length) return null;
      var primaryId = value.targetId || (aliveEnemies(S)[0] && aliveEnemies(S)[0].id);
      if (!primaryId) return null;
      return { primaryId: primaryId, extras: value.extraTargetIds.slice(), pending: [], effects: [] };
    }

    function playableCards() {
      var out = [];
      var p = S.player;
      for (var i = 0; i < p.hand.length; i++) {
        var id = p.hand[i];
        var card = idx.cardById[id];
        var playable = true;
        var reason = '';
        if (S.stage !== 'player') {
          playable = false; reason = '不是玩家回合';
        } else if (!card) {
          playable = false; reason = '未知卡牌：' + id;
        } else if (p.playsUsed >= p.playLimit) {
          playable = false; reason = '本回合出牌次数已用完（' + p.playsUsed + '/' + p.playLimit + '）';
        } else if (card.select === 'minion' && aliveMinions(S).length === 0) {
          playable = false; reason = '场上没有存活的小怪';
        }
        out.push({ index: i, id: id, name: card ? card.name : id, playable: playable, reason: reason });
      }
      return out;
    }

    function playableManuals() {
      var out = [];
      var p = S.player;
      for (var i = 0; i < p.manuals.length; i++) {
        var m = p.manuals[i];
        var card = idx.manualById[m.id] || { id: m.id, name: m.id, routeSeq: '' };
        var playable = true;
        var reason = '';
        var routeThisTurn = p.playedThisTurn.map(function (x) { return x.route; });
        var seq = routeSeqChars(card.routeSeq);
        if (S.stage !== 'player') {
          playable = false; reason = '不是玩家回合';
        } else if (m.used) {
          playable = false; reason = '已翻面（本场不可再用）';
        } else if (S._manualsUsedThisTurn >= (S._manualLimit || 1)) {
          playable = false; reason = '本回合已发动过 ' + (S._manualLimit || 1) + ' 张秘笈';
        } else if (card.requires && card.requires.hpMin && p.hp < card.requires.hpMin) {
          playable = false; reason = 'HP 需不少于 ' + card.requires.hpMin + '（当前 ' + p.hp + '）';
        } else if (!containsSeq(routeThisTurn, seq)) {
          playable = false; reason = '路数未满足：需连续「' + (card.routeSeq || '') + '」';
        }
        out.push({
          id: m.id,
          name: card.name || m.id,
          routeSeq: card.routeSeq || '',
          desc: card.desc || '',
          playable: playable,
          reason: reason
        });
      }
      return out;
    }

    function playCard(index, choice) {
      try {
        beginAction(S);
        if (S.stage !== 'player') return { ok: false, reason: '不是玩家回合' };
        var p = S.player;
        if (!(typeof index === 'number' && index >= 0 && index < p.hand.length && index === Math.floor(index))) {
          addLog(S, 'error', 'playCard: 非法手牌序号 ' + index);
          return { ok: false, reason: '手牌序号无效' };
        }
        if (p.playsUsed >= p.playLimit) return { ok: false, reason: '本回合出牌次数已用完（' + p.playsUsed + '/' + p.playLimit + '）' };
        var cardId = p.hand[index];
        var card = idx.cardById[cardId];
        if (!card) {
          addLog(S, 'error', 'playCard: 未知卡牌 ' + cardId);
          return { ok: false, reason: '未知卡牌：' + cardId };
        }
        var effect = JZ.CARD_EFFECTS[cardId];
        if (typeof effect !== 'function') {
          addLog(S, 'error', 'playCard: 卡牌效果未实现 ' + cardId);
          return { ok: false, reason: '卡牌效果未实现：' + cardId };
        }
        var v = validateChoice(S, card, choice);
        if (!v.ok) {
          addLog(S, 'system', '出牌失败（' + card.name + '）：' + v.reason);
          return { ok: false, reason: v.reason };
        }

        // --- 正式结算 ---
        p.hand.splice(index, 1);
        p.playsUsed += 1;
        trackCardPlay(S, cardId); // R25 玩家画像统计
        var effRoute = card.route;
        if (cardId === 'YJQ-AQ-14') effRoute = v.value.route; // 变轨弹记录宣言路数
        var locked = p.routeLock.count > 0;
        if (locked) { p.routeLock.count -= 1; effRoute = '特'; }

        addLog(S, 'card', '打出 ' + card.name + '（' + card.type + '·' + (locked ? card.route : effRoute) + '）');
        emit(S, 'card-play', {
          cardId: cardId,
          name: card.name,
          type: card.type,
          route: effRoute,
          targets: cardTargets(card, v.value)
        });
        var consumeDmgBuff = p.dmgBuff.cardsLeft > 0;
        var splash = makeSplash(card, v.value);
        effect(makeCtx(S, BD, null, { splash: splash }), card, v.value);
        if (splash) flushSplash(S, splash);
        // 路数记录（A4：履历/身份也记；R10：逆流幻象下记「特」）
        p.routeHistory.push(effRoute);
        p.playedThisTurn.push({ id: cardId, route: effRoute, type: card.type });
        p.discard.push(cardId);
        if (consumeDmgBuff) p.dmgBuff.cardsLeft = Math.max(0, p.dmgBuff.cardsLeft - 1);
        checkEnd(S);
        return { ok: true, events: finishAction(S) };
      } catch (e) {
        addLog(S, 'error', 'playCard 内部错误：' + (e && e.message ? e.message : e));
        return { ok: false, reason: '内部错误：' + (e && e.message ? e.message : e) };
      }
    }

    function playManual(id, choice) {
      try {
        beginAction(S);
        if (S.stage !== 'player') return { ok: false, reason: '不是玩家回合' };
        var p = S.player;
        var entry = null;
        for (var i = 0; i < p.manuals.length; i++) if (p.manuals[i].id === id) entry = p.manuals[i];
        if (!entry) return { ok: false, reason: '未知秘笈：' + id };
        if (entry.used) return { ok: false, reason: '该秘笈已翻面（本场不可再用）' };
        if (S._manualsUsedThisTurn >= (S._manualLimit || 1)) return { ok: false, reason: '本回合已发动过 ' + (S._manualLimit || 1) + ' 张秘笈' };
        var card = idx.manualById[id];
        if (!card) {
          addLog(S, 'error', 'playManual: 缺少秘笈数据 ' + id);
          return { ok: false, reason: '缺少秘笈数据：' + id };
        }
        var effect = JZ.CARD_EFFECTS[id];
        if (typeof effect !== 'function') {
          addLog(S, 'error', 'playManual: 秘笈效果未实现 ' + id);
          return { ok: false, reason: '秘笈效果未实现：' + id };
        }
        // 路数：本回合连续子串匹配（R7）
        var routeThisTurn = p.playedThisTurn.map(function (x) { return x.route; });
        if (!containsSeq(routeThisTurn, routeSeqChars(card.routeSeq))) {
          return { ok: false, reason: '路数未满足：需连续「' + card.routeSeq + '」' };
        }
        if (card.requires && card.requires.hpMin && p.hp < card.requires.hpMin) {
          return { ok: false, reason: 'HP 需不少于 ' + card.requires.hpMin + '（当前 ' + p.hp + '）' };
        }
        var v = validateChoice(S, card, choice);
        if (!v.ok) return { ok: false, reason: v.reason };

        entry.used = true;
        S._manualsUsedThisTurn += 1;
        trackManualUse(S, card.id); // R25 玩家画像统计
        addLog(S, 'manual', '发动秘笈「' + card.name + '」（本回合秘笈已用）');
        emit(S, 'manual-play', { cardId: card.id, name: card.name });
        effect(makeCtx(S, BD, null), card, v.value);
        checkEnd(S);
        return { ok: true, events: finishAction(S) };
      } catch (e) {
        addLog(S, 'error', 'playManual 内部错误：' + (e && e.message ? e.message : e));
        return { ok: false, reason: '内部错误：' + (e && e.message ? e.message : e) };
      }
    }

    function endTurn() {
      try {
        beginAction(S);
        if (S.stage !== 'player') return { ok: false, reason: '不是玩家回合' };
        var p = S.player;
        emit(S, 'turn-end', { turn: S.turn });
        // a. 弃手牌（未出完的张数在下回合摸牌补偿）
        var unplayed = p.hand.length;
        while (p.hand.length) p.discard.push(p.hand.pop());
        addLog(S, 'turn', '—— 玩家回合结束（剩余手牌 ' + unplayed + ' 张已弃置）——');
        S.stage = 'enemy';

        // b. 敌方行动（SPEC §10.11.3：全局调度顺序执行；新召唤的不行动）
        addLog(S, 'turn', '—— 敌方行动 ——');
        executeEnemyTurn(S, BD);
        if (S.stage === 'over') return { ok: true, events: finishAction(S) };

        // c. 胜负（伤害结算内已即时检查，这里再兜一次）
        checkEnd(S);
        if (S.stage === 'over') return { ok: true, events: finishAction(S) };

        // d. 阶段检查（回合末统一处理）
        phaseCheck(S, BD.boss);
        if (S.stage === 'over') return { ok: true, events: finishAction(S) };

        // e. 清理 + 结算下回合减益
        cleanupTurn(S, BD.deck);

        // f. 回合数++ / 摸牌 / 新意图
        nextTurn(S, BD.boss, BD.deck);
        return { ok: true, events: finishAction(S) };
      } catch (e) {
        addLog(S, 'error', 'endTurn 内部错误：' + (e && e.message ? e.message : e));
        return { ok: false, reason: '内部错误：' + (e && e.message ? e.message : e) };
      }
    }

    function serialize() {
      // events 是「本次动作」的临时数据，不进存档（避免存档膨胀 / 恢复后播放旧演出）
      var saved = {};
      for (var k in S) if (Object.prototype.hasOwnProperty.call(S, k)) saved[k] = S[k];
      saved._events = [];
      return JSON.stringify({ v: JZ.VERSION, S: saved });
    }

    var battle = {
      playableCards: playableCards,
      playableManuals: playableManuals,
      playCard: playCard,
      playManual: playManual,
      endTurn: endTurn,
      serialize: serialize,
      /** 测试/调试专用：返回内部可变状态（UI 不得使用） */
      _internal: function () { return S; }
    };
    Object.defineProperty(battle, 'state', {
      enumerable: true,
      get: function () { return publicState(S); }
    });
    return battle;
  }

  // ------------------------------------------------------------
  // 对外 API
  // ------------------------------------------------------------
  var FALLBACK_DATA = { cards: { cards: [], manuals: [], player: { maxHp: 1 } }, boss: {} };

  JZ.startBattle = function (opts) {
    opts = opts || {};
    var D = resolveData();
    var S;
    try {
      if (!D || !D.cards || !D.boss) throw new Error('缺少数据 JZ.DATA（需先加载 data/bundle.js 或注入 GAME_DATA）');
      S = createState(D, opts);
    } catch (e) {
      S = emptyBrokenState(e);
    }
    return makeBattle(S, D || FALLBACK_DATA);
  };

  JZ.restoreBattle = function (json) {
    var parsed;
    try {
      parsed = typeof json === 'string' ? JSON.parse(json) : json;
    } catch (e) {
      return null;
    }
    var S = parsed && parsed.S ? parsed.S : parsed;
    if (!S || S.version !== STATE_VERSION || !S.player || !Array.isArray(S.enemies)) return null;
    // 兼容旧存档 / 补齐 v1.1 新字段
    if (!Array.isArray(S._events)) S._events = [];
    if (!S._pending) S._pending = { playLimit: 0, routeLock: 0, dmgMinus: 0, dmgMinusTurns: 1 };
    if (!S._unitSeq) S._unitSeq = { shrimp: 0, crab: 0 };
    if (typeof S._manualLimit !== 'number') S._manualLimit = 1;
    if (S._challenge === undefined) S._challenge = null;
    if (S._deckId === undefined) S._deckId = null;
    if (S._bossId === undefined) S._bossId = null;
    // R25：补齐内置 AI 学习相关字段（旧存档）
    if (S._aiId === undefined || !S._aiId) S._aiId = (S._challenge && S._challenge.id) || '_default';
    if (!S._stats || typeof S._stats !== 'object') {
      S._stats = {
        cardsPlayed: 0,
        playsByRole: { attack: 0, defense: 0, utility: 0 },
        manualsUsed: 0,
        qianshouUsed: false,
        archetypeUses: { offense: 0, defense: 0, utility: 0, burst: 0 }
      };
    }
    if (S._learningRecorded === undefined) S._learningRecorded = false;
    if (JZ.AILearning && typeof JZ.AILearning.load === 'function') {
      try { JZ.AILearning.load(S._aiId); } catch (e) { /* 静默降级 */ }
    }
    var D = resolveData();
    // R30：旧存档没有 _strategy → 从当前 boss 数据补
    if (!S._strategy || typeof S._strategy !== 'object') {
      var bd = battleData(S, D || FALLBACK_DATA);
      S._strategy = normalizeStrategy(bd.boss && bd.boss.strategy);
    }
    // R32：旧存档没有 _mode → standard
    if (S._mode !== 'extreme') S._mode = 'standard';
    return makeBattle(S, D || FALLBACK_DATA);
  };

  /**
   * 挑战清单（SPEC §10.3）：{ challenges:[…], upcoming:[…] } 的深拷贝，不含内部 _meta
   */
  JZ.getChallenges = function () {
    var D = resolveData();
    var lists = challengeLists(D);
    var out = { challenges: clone(lists.challenges), upcoming: clone(lists.upcoming) };
    if (out.challenges && out.challenges._meta) delete out.challenges._meta;
    if (out.upcoming && out.upcoming._meta) delete out.upcoming._meta;
    return out;
  };

  /** UI 便捷读取（只读数据） */
  JZ.getData = function () { return resolveData(); };

  function allDeckData(D) {
    var list = [];
    if (D && D.cards) list.push(D.cards);
    if (D && D.decks) {
      for (var k in D.decks) {
        if (Object.prototype.hasOwnProperty.call(D.decks, k) && D.decks[k] && list.indexOf(D.decks[k]) < 0) list.push(D.decks[k]);
      }
    }
    return list;
  }
  JZ.getCard = function (id) {
    var D = resolveData();
    if (!D) return null;
    var decks = allDeckData(D);
    for (var d = 0; d < decks.length; d++) {
      var list = decks[d].cards || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    }
    return null;
  };
  JZ.getManual = function (id) {
    var D = resolveData();
    if (!D) return null;
    var decks = allDeckData(D);
    for (var d = 0; d < decks.length; d++) {
      var list = decks[d].manuals || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    }
    return null;
  };

  // ------------------------------------------------------------
  // 测试钩子（仅 tests/ 使用，UI 不得使用）
  // ------------------------------------------------------------
  JZ._test = {
    resolveDamage: resolveDamage,
    containsSeq: containsSeq,
    crossedNodes: crossedNodes,
    chooseIntentSet: chooseIntentSet,
    findEnemy: findEnemy,
    bossOf: bossOf,
    aliveEnemies: aliveEnemies,
    resolveBattleSetup: resolveBattleSetup,
    battleData: battleData,
    summon: function (S, unitType, count) {
      var D = JZ.DATA || root.GAME_DATA || {};
      var BD = battleData(S, D);
      return summonUnits(S, BD.boss, unitType, count || 1);
    },
    rollIntents: function (S, entity) {
      var D = JZ.DATA || root.GAME_DATA || {};
      var BD = battleData(S, D);
      return rollIntents(S, BD.boss, entity);
    },
    applyIcePearl: applyIcePearl,
    publicState: publicState,
    makeCtx: makeCtx,
    emit: emit,
    cardRoleOf: cardRoleOf,
    archetypeOfIntentSet: archetypeOfIntentSet,
    finalizeLearning: finalizeLearning,
    maxMinionsOf: maxMinionsOf,
    summonUnits: summonUnits
  };
})(typeof window !== 'undefined' ? window : globalThis);
