/* ============================================================
 * 《抉招：江湖录》· 鲨鱼头挑战 —— 内置敌方 AI 自我学习（SPEC §10.9 / R25）
 * ------------------------------------------------------------
 * 形态：纯前端 + localStorage（只在本浏览器生效，不跨玩家汇总）
 * 学习对象：敌方「意图套组」的选择概率
 *   选意图套组 = 基础 weight × 原型倍率（倍率 clamp 0.5~2.5）加权随机
 * 原型 archetype：
 *   offense（jq≥3）/ defense（bs≥3）/ utility（lh≥3）/ burst（hidden 套组）
 * 更新规则（简单在线 bandit + 衰减，可解释）：
 *   1) 玩家胜 + 防御牌占比高 → offense +0.10（压血线）
 *   2) 玩家胜 + 攻击牌占比高 → defense +0.08、utility +0.04
 *   3) 玩家靠「千手归一」获胜 → burst +0.12（在其凑齐前施压）
 *   4) 敌方胜 → 本局主用原型 +0.05
 *   5) 每局所有倍率向 1.0 衰减 0.02（防跑飞）；保留最近 10 局输局摘要
 * 无 localStorage（node 测试 / 隐私模式）自动降级为内存态；任何异常都不抛出。
 * 挂载：window.JZ.AILearning / globalThis.JZ.AILearning
 * ============================================================ */
(function (root) {
  'use strict';

  var JZ = (root.JZ = root.JZ || {});

  var STORAGE_KEY = 'jz_shark_ai_v1';
  var ARCHETYPES = ['offense', 'defense', 'utility', 'burst'];
  var MIN_MULT = 0.5;
  var MAX_MULT = 2.5;
  var RECENT_LOSSES_MAX = 10;
  var DECAY = 0.02;
  // 玩家画像「高」的阈值（可解释的固定值，SPEC 未给死 → 实现取保守中值）
  var DEFENSE_RATIO_HIGH = 0.30;
  var ATTACK_RATIO_HIGH = 0.50;

  // 内存降级存储（无 localStorage / 存储写失败时使用；模块级，进程内持久）
  var memStore = null;
  var currentId = null;
  var storageBroken = false; // 一旦 localStorage 写失败（配额/隐私），本次会话改用内存态

  // ------------------------------------------------------------
  // 小工具
  // ------------------------------------------------------------
  function num(v, d) {
    var n = Number(v);
    return isFinite(n) ? n : (d === undefined ? 0 : d);
  }
  function clamp(n, lo, hi) {
    return n < lo ? lo : n > hi ? hi : n;
  }
  function round3(n) {
    return Math.round(n * 1000) / 1000;
  }
  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }
  function now() {
    return Date.now();
  }
  function defaultMultipliers() {
    var m = {};
    for (var i = 0; i < ARCHETYPES.length; i++) m[ARCHETYPES[i]] = 1;
    return m;
  }
  function defaultEntry(id) {
    return {
      id: id,
      battles: 0,
      playerWins: 0,
      bossWins: 0,
      multipliers: defaultMultipliers(),
      recentLosses: [], // 敌方输掉的局（玩家胜）摘要，最近 10 局
      totals: { turns: 0, turnsCount: 0 },
      lastPlayerHp: null,
      updatedAt: 0
    };
  }

  // ------------------------------------------------------------
  // 存储（localStorage 优先；异常 → 内存态）
  // ------------------------------------------------------------
  function getStorage() {
    if (storageBroken) return null;
    try {
      if (typeof localStorage !== 'undefined' && localStorage &&
        typeof localStorage.getItem === 'function') return localStorage;
    } catch (e) { /* 隐私模式等 */ }
    return null;
  }
  function readStore() {
    var ls = getStorage();
    if (ls) {
      try {
        var raw = ls.getItem(STORAGE_KEY);
        if (!raw) return { version: 1, entries: {} };
        var parsed = JSON.parse(raw);
        if (parsed && parsed.entries && typeof parsed.entries === 'object') return parsed;
        return { version: 1, entries: {} };
      } catch (e) {
        storageBroken = true; // 读取异常（安全策略等）→ 本次会话改用内存态
        if (memStore && memStore.entries) return memStore;
        memStore = { version: 1, entries: {} };
        return memStore;
      }
    }
    if (!memStore || !memStore.entries) memStore = { version: 1, entries: {} };
    return memStore;
  }
  function writeStore(store) {
    var ls = getStorage();
    if (ls) {
      try {
        ls.setItem(STORAGE_KEY, JSON.stringify(store));
        return true;
      } catch (e) {
        storageBroken = true; // 配额/隐私 → 本次会话降级内存态
      }
    }
    memStore = store;
    return false;
  }
  function normalizeEntry(raw, id) {
    var d = defaultEntry(id);
    if (!raw || typeof raw !== 'object') return d;
    var out = d;
    out.battles = Math.max(0, Math.floor(num(raw.battles)));
    out.playerWins = Math.max(0, Math.floor(num(raw.playerWins)));
    out.bossWins = Math.max(0, Math.floor(num(raw.bossWins)));
    var mm = raw.multipliers || {};
    for (var i = 0; i < ARCHETYPES.length; i++) {
      var a = ARCHETYPES[i];
      out.multipliers[a] = clamp(num(mm[a], 1), MIN_MULT, MAX_MULT);
    }
    if (Array.isArray(raw.recentLosses)) {
      out.recentLosses = raw.recentLosses.slice(0, RECENT_LOSSES_MAX);
    }
    if (raw.totals && typeof raw.totals === 'object') {
      out.totals.turns = Math.max(0, num(raw.totals.turns));
      out.totals.turnsCount = Math.max(0, Math.floor(num(raw.totals.turnsCount)));
    }
    out.lastPlayerHp = (raw.lastPlayerHp === undefined || raw.lastPlayerHp === null) ? null : num(raw.lastPlayerHp);
    out.updatedAt = num(raw.updatedAt);
    return out;
  }
  function getEntry(store, id) {
    if (!store.entries[id]) store.entries[id] = defaultEntry(id);
    var e = normalizeEntry(store.entries[id], id);
    store.entries[id] = e;
    return e;
  }
  function resolveId(id) {
    if (id === undefined || id === null || id === '') return currentId || '_default';
    return String(id);
  }

  // ------------------------------------------------------------
  // 规则：向 1.0 衰减（线性步进 0.02）
  // ------------------------------------------------------------
  function decayToward1(m) {
    if (m > 1) return clamp(m - DECAY, 1, MAX_MULT);
    if (m < 1) return clamp(m + DECAY, MIN_MULT, 1);
    return 1;
  }
  function aggregateState(store) {
    var out = defaultEntry('__all__');
    var ids = Object.keys(store.entries || {});
    for (var i = 0; i < ids.length; i++) {
      var e = normalizeEntry(store.entries[ids[i]], ids[i]);
      out.battles += e.battles;
      out.playerWins += e.playerWins;
      out.bossWins += e.bossWins;
      out.totals.turns += e.totals.turns;
      out.totals.turnsCount += e.totals.turnsCount;
      for (var a = 0; a < ARCHETYPES.length; a++) out.multipliers[ARCHETYPES[a]] += e.multipliers[ARCHETYPES[a]];
    }
    if (ids.length) {
      for (var k = 0; k < ARCHETYPES.length; k++) {
        out.multipliers[ARCHETYPES[k]] = round3(out.multipliers[ARCHETYPES[k]] / ids.length);
      }
    }
    out.avgTurns = out.totals.turnsCount ? round3(out.totals.turns / out.totals.turnsCount) : 0;
    out.id = '__all__';
    return out;
  }

  // ------------------------------------------------------------
  // 对外 API（SPEC §10.9）
  // ------------------------------------------------------------
  var API = {
    STORAGE_KEY: STORAGE_KEY,
    ARCHETYPES: ARCHETYPES,
    MIN_MULT: MIN_MULT,
    MAX_MULT: MAX_MULT,
    DEFENSE_RATIO_HIGH: DEFENSE_RATIO_HIGH,
    ATTACK_RATIO_HIGH: ATTACK_RATIO_HIGH,

    /** 切换当前学习对象（开战前调用一次），返回该 id 的深拷贝状态 */
    load: function (id) {
      try {
        currentId = resolveId(id);
        var store = readStore();
        var entry = getEntry(store, currentId);
        store.entries[currentId] = entry;
        writeStore(store);
        return clone(entry);
      } catch (e) {
        return clone(defaultEntry(resolveId(id)));
      }
    },

    /** 读取学习状态；不给 id 时：有当前对象读当前，否则返回全部聚合 */
    getState: function (id) {
      try {
        var store = readStore();
        if (id === undefined || id === null || id === '') {
          if (!currentId) return aggregateState(store);
          var e0 = getEntry(store, currentId);
          store.entries[currentId] = e0;
          return withAvg(clone(e0));
        }
        var key = String(id);
        return withAvg(clone(getEntry(store, key)));
      } catch (e) {
        return withAvg(defaultEntry(resolveId(id)));
      }
    },

    /** 某原型的当前倍率（未 load 时返回 1） */
    getMultiplier: function (archetype) {
      try {
        if (ARCHETYPES.indexOf(archetype) < 0) return 1;
        if (!currentId) return 1;
        var store = readStore();
        var e = getEntry(store, currentId);
        return clamp(num(e.multipliers[archetype], 1), MIN_MULT, MAX_MULT);
      } catch (e) {
        return 1;
      }
    },

    /** 当前 id 的全部原型倍率（便捷读取，UI 用） */
    getMultipliers: function () {
      var out = {};
      for (var i = 0; i < ARCHETYPES.length; i++) out[ARCHETYPES[i]] = API.getMultiplier(ARCHETYPES[i]);
      return out;
    },

    /**
     * 记录一局（引擎在战斗结束时调用一次）
     * summary = {
     *   challengeId, winner:'player'|'boss', turns, playerHp, mainArchetype,
     *   archetypeUses:{offense,defense,utility,burst},
     *   profile:{ defenseRatio, attackRatio, utilityRatio, manualUses, manualRate,
     *             qianshouWin, qianshouUsed, cardsPlayed }
     * }
     */
    recordBattle: function (id, summary) {
      try {
        if (!summary || (summary.winner !== 'player' && summary.winner !== 'boss')) {
          return API.getState(id);
        }
        var key = resolveId(id);
        var store = readStore();
        var entry = getEntry(store, key);
        var profile = summary.profile || {};
        var winner = summary.winner;

        entry.battles += 1;
        if (winner === 'player') entry.playerWins += 1;
        else entry.bossWins += 1;
        entry.totals.turns += Math.max(0, num(summary.turns));
        entry.totals.turnsCount += 1;
        entry.lastPlayerHp = num(summary.playerHp);
        entry.updatedAt = now();

        // ---- 更新规则 1~4 ----
        if (winner === 'player') {
          // 1) 防御牌占比高 → offense +0.10
          if (num(profile.defenseRatio) >= DEFENSE_RATIO_HIGH) {
            entry.multipliers.offense += 0.10;
          }
          // 2) 攻击牌占比高 → defense +0.08、utility +0.04
          if (num(profile.attackRatio) >= ATTACK_RATIO_HIGH) {
            entry.multipliers.defense += 0.08;
            entry.multipliers.utility += 0.04;
          }
          // 3) 千手归一获胜 → burst +0.12
          if (profile.qianshouWin) entry.multipliers.burst += 0.12;
          // 保留最近 10 局「敌方输局（玩家胜）」摘要
          entry.recentLosses.unshift({
            ts: now(),
            turns: Math.max(0, num(summary.turns)),
            playerHp: num(summary.playerHp),
            mainArchetype: summary.mainArchetype || '',
            defenseRatio: round3(num(profile.defenseRatio)),
            attackRatio: round3(num(profile.attackRatio)),
            manualRate: round3(num(profile.manualRate)),
            qianshouWin: !!profile.qianshouWin
          });
          while (entry.recentLosses.length > RECENT_LOSSES_MAX) entry.recentLosses.pop();
        } else {
          // 4) 敌方胜 → 本局主用原型 +0.05
          var main = summary.mainArchetype;
          if (ARCHETYPES.indexOf(main) >= 0) entry.multipliers[main] += 0.05;
        }

        // 5) 每局所有倍率向 1.0 衰减 0.02，再夹到 [0.5, 2.5]
        for (var i = 0; i < ARCHETYPES.length; i++) {
          var a = ARCHETYPES[i];
          entry.multipliers[a] = clamp(decayToward1(num(entry.multipliers[a], 1)), MIN_MULT, MAX_MULT);
        }

        store.entries[key] = entry;
        writeStore(store);
        return withAvg(clone(entry));
      } catch (e) {
        return withAvg(defaultEntry(resolveId(id)));
      }
    },

    /** 重置学习（某个 id；不给 id 时重置当前对象） */
    reset: function (id) {
      try {
        var key = resolveId(id);
        var store = readStore();
        delete store.entries[key];
        store.entries[key] = defaultEntry(key);
        writeStore(store);
        if (key === currentId || currentId === null) currentId = key;
        return withAvg(clone(store.entries[key]));
      } catch (e) {
        return withAvg(defaultEntry(resolveId(id)));
      }
    }
  };

  function withAvg(entry) {
    entry.avgTurns = entry.totals && entry.totals.turnsCount
      ? round3(entry.totals.turns / entry.totals.turnsCount) : 0;
    return entry;
  }

  JZ.AILearning = API;
})(typeof window !== 'undefined' ? window : globalThis);
