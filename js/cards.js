/* ============================================================
 * 《抉招：江湖录》· 鲨鱼头挑战 —— 29 张卡 + 5 张秘笈的效果实现
 * ------------------------------------------------------------
 * 形态：经典脚本（非 ESM），挂到 JZ.CARD_EFFECTS[cardId]
 * 签名：fn(ctx, card, choice)
 *   ctx    —— 引擎注入的上下文（伤害/治疗/防御/意图 等原子操作）
 *   card   —— data/cards.json 里的卡牌对象（name/type/route/select/desc…）
 *   choice —— 已由引擎校验并规范化的选择（SPEC §3.2）
 * 约束：纯逻辑；不抛异常（引擎已 try/catch）；不做随机以外的副作用
 * 规则口径：SPEC §五 R1~R28（尤其 R13~R22）
 * ============================================================ */
(function (root) {
  'use strict';

  var JZ = (root.JZ = root.JZ || {});
  var EFFECTS = (JZ.CARD_EFFECTS = JZ.CARD_EFFECTS || {});

  // ------------------------------------------------------------
  // 工具
  // ------------------------------------------------------------
  function firstEnemy(ctx) {
    var ens = ctx.enemies();
    return ens.length ? ens[0] : null;
  }
  function resolveTargetId(ctx, choice) {
    if (choice && choice.targetId && ctx.enemy(choice.targetId)) return choice.targetId;
    var e = firstEnemy(ctx);
    return e ? e.id : null;
  }
  function routeOf(ctx, choice) {
    return (choice && choice.route) || '上';
  }

  // ============================================================
  // 招式卡（14 种）
  // ============================================================

  // 常式·破气弹：选择 1 个敌人造成 5 点伤害
  EFFECTS['YJQ-AQ-01'] = function (ctx, card, choice) {
    ctx.hitEnemy(choice.targetId, 5, 'normal');
  };

  // 常式·双星打：3 点伤害 ×2
  EFFECTS['YJQ-AQ-02'] = function (ctx, card, choice) {
    ctx.hitEnemy(choice.targetId, 3, 'normal');
    ctx.hitEnemy(choice.targetId, 3, 'normal');
  };

  // 常式·连环弹：1 点伤害 ×5
  EFFECTS['YJQ-AQ-03'] = function (ctx, card, choice) {
    for (var i = 0; i < 5; i++) ctx.hitEnemy(choice.targetId, 1, 'normal');
  };

  // 常式·绽血枫：4 点伤害；若成功造成伤害，恢复等量 HP（R6：实际伤害 >0 才算）
  //   R24：黑白错把本卡「命中对象」增加时，按本卡对全部被命中目标实际造成的伤害总量回血
  EFFECTS['YJQ-AQ-04'] = function (ctx, card, choice) {
    var dealt = ctx.hitEnemy(choice.targetId, 4, 'normal');
    if (dealt > 0) ctx.healPlayer(dealt);
    ctx.onBystanderHit(function (targetId, dealtTotal) {
      if (dealtTotal > 0) ctx.healPlayer(dealtTotal);
    });
  };

  // 常式·子母弹：1 点伤害，再 2 点伤害；下回合多抽 2 张（R8 与少出补偿叠加）
  EFFECTS['YJQ-AQ-05'] = function (ctx, card, choice) {
    ctx.hitEnemy(choice.targetId, 1, 'normal');
    ctx.hitEnemy(choice.targetId, 2, 'normal');
    ctx.gainDraw(2);
  };

  // 变式·飞花叶：5 点伤害
  EFFECTS['YJQ-AQ-06'] = function (ctx, card, choice) {
    ctx.hitEnemy(choice.targetId, 5, 'normal');
  };

  // 变式·连飞蝗：1 点伤害 ×3，并消除其 1 个进取意图
  //   数据 select='enemy'（消除目标 = 伤害目标）；兼容旧 choice.jqPick
  //   R24：黑白错增加命中对象时，每个额外目标也各自「受 3 段伤害 + 消除其 1 个进取意图」
  EFFECTS['YJQ-AQ-07'] = function (ctx, card, choice) {
    for (var i = 0; i < 3; i++) ctx.hitEnemy(choice.targetId, 1, 'normal');
    var intentTarget = (choice.jqPick && choice.jqPick.enemyId) ? choice.jqPick.enemyId : choice.targetId;
    if (intentTarget) {
      ctx.removeIntent(intentTarget, 'jq', 1);
    } else {
      ctx.log('system', '连飞蝗：没有可消除的意图目标');
    }
    ctx.onBystanderHit(function (targetId) {
      ctx.removeIntent(targetId, 'jq', 1);
    });
  };

  // 变式·诸星落：最多 3 个敌人，各 1 点伤害 ×4（A5）
  //   多目标卡不吃黑白错溅射 → noSplash
  EFFECTS['YJQ-AQ-08'] = function (ctx, card, choice) {
    var ids = (choice.targetIds || []).slice();
    if (!ids.length) {
      var ens = ctx.enemies();
      for (var k = 0; k < ens.length && ids.length < 3; k++) ids.push(ens[k].id);
    }
    for (var t = 0; t < 4; t++) {
      for (var i = 0; i < ids.length; i++) ctx.hitEnemy(ids[i], 1, 'normal', { noSplash: true });
    }
  };

  // 变式·定千军：场上每 1 个敌人单位，可消除 1 个任意敌人的进取意图
  EFFECTS['YJQ-AQ-09'] = function (ctx, card, choice) {
    var picks = choice.picks || [];
    if (!picks.length) {
      ctx.log('system', '定千军：未选择要消除的进取意图');
      return;
    }
    for (var i = 0; i < picks.length; i++) {
      ctx.removeIntent(picks[i].enemyId, 'jq', 1);
    }
  };

  // 变式·赶星月：场上所有敌人每有 1 个进取意图，获得 1 层闪避
  EFFECTS['YJQ-AQ-10'] = function (ctx, card, choice) {
    var n = ctx.countIntent('jq');
    if (n > 0) ctx.addDodge(n);
    else ctx.log('system', '赶星月：场上没有进取意图');
  };

  // 变式·锱铢较：场上所有敌人每有 1 个非进取意图，获得 2 点格挡
  EFFECTS['YJQ-AQ-11'] = function (ctx, card, choice) {
    var n = ctx.countNonJq();
    if (n > 0) ctx.addBlock(n * 2);
    else ctx.log('system', '锱铢较：场上没有非进取意图');
  };

  // 变式·黑白错（R14）：本回合后续「单体招式」额外对最多 2 个其他敌人造成同样的伤害段
  EFFECTS['YJQ-AQ-12'] = function (ctx, card, choice) {
    ctx.setMultiSplash();
  };

  // 神兵·玄寒珠（R13）：本回合后续每命中 1 次记 1 点，下回合滚完意图后按 灵活→进取→保守 扣
  EFFECTS['YJQ-AQ-13'] = function (ctx, card, choice) {
    ctx.setIcePearl();
  };

  // 通式·变轨弹：宣言路数 → 上=5 伤害；中=1+4；下=1×5；特=恢复 5 HP
  //   目标：choice.targetId 可选（SPEC select 只给 route）；缺省打第一个存活敌人
  EFFECTS['YJQ-AQ-14'] = function (ctx, card, choice) {
    var route = routeOf(ctx, choice);
    var tid = resolveTargetId(ctx, choice);
    if (route === '特') {
      ctx.healPlayer(5);
      return;
    }
    if (!tid) {
      ctx.log('system', '变轨弹：没有可攻击的目标');
      return;
    }
    // SPEC §10.11.1：路数=上/中/下 视为单体攻击招式 → 吃黑白错多目标（不再 noSplash）
    if (route === '上') {
      ctx.hitEnemy(tid, 5, 'normal');
    } else if (route === '中') {
      ctx.hitEnemy(tid, 1, 'normal');
      ctx.hitEnemy(tid, 4, 'normal');
    } else {
      for (var i = 0; i < 5; i++) ctx.hitEnemy(tid, 1, 'normal');
    }
  };

  // ============================================================
  // 履历卡（5 种）
  // ============================================================

  // 凰宫密谈：场上所有敌人每有 1 个非进取意图 → HP 上限 +1、闪避 +1
  EFFECTS['YJQ-LL-01'] = function (ctx, card, choice) {
    var n = ctx.countNonJq();
    if (!n) { ctx.log('system', '凰宫密谈：场上没有非进取意图'); return; }
    ctx.maxHpUp(n);
    ctx.addDodge(n);
  };

  // 为师则厉（R15）：我方 1 人、敌方 ≥2 → 本回合后续每段伤害 +1
  EFFECTS['YJQ-LL-02'] = function (ctx, card, choice) {
    if (ctx.aliveCount() >= 2) ctx.addTurnBonus(1);
    else ctx.log('system', '为师则厉：敌方不足 2 个单位，本回合未生效');
  };

  // 为人表率：若我方血量 <5 → 扣除 5 点 HP 上限，将血量恢复至上限
  EFFECTS['YJQ-LL-03'] = function (ctx, card, choice) {
    var p = ctx.player;
    if (p.hp >= 5) { ctx.log('system', '为人表率：当前 HP 不低于 5，未生效'); return; }
    ctx.maxHpDown(5);
    ctx.healPlayer(p.maxHp - p.hp);
    ctx.log('system', '为人表率：血量恢复至上限 ' + p.maxHp);
  };

  // 为父则严：扣除自身 5 点 HP，对场上所有敌人造成 5 点真实必中伤害
  EFFECTS['YJQ-LL-04'] = function (ctx, card, choice) {
    ctx.selfDamage(5);
    if (ctx.over()) return;
    ctx.hitAll(5, 1, 'trueAim');
  };

  // 金权可易：选择 1 个敌人，将其任意一类意图全部修改为另一类意图
  EFFECTS['YJQ-LL-05'] = function (ctx, card, choice) {
    ctx.convertIntent(choice.targetId, choice.from, choice.to);
  };

  // ============================================================
  // 身份卡（5 种）
  // ============================================================

  // 盟主号令：场上所有敌人每有 1 个进取意图 → 2 点格挡 + 1 点化劲
  EFFECTS['YJQ-SF-01'] = function (ctx, card, choice) {
    var n = ctx.countIntent('jq');
    if (!n) { ctx.log('system', '盟主号令：场上没有进取意图'); return; }
    ctx.addBlock(n * 2);
    ctx.addHua(n);
  };

  // 杯酒停戎（R18）：对杂兵回 4 HP，溢出每 1 点 → 操控 1 次行动
  EFFECTS['YJQ-SF-02'] = function (ctx, card, choice) {
    var m = ctx.enemy(choice.targetId);
    if (!m || m.kind !== 'minion') { ctx.log('system', '杯酒停戎：目标不是杂兵'); return; }
    var before = m.hp;
    var heal = Math.min(4, m.maxHp - m.hp);
    m.hp = Math.min(m.maxHp, m.hp + 4);
    ctx.log('heal', m.name + ' 恢复 ' + heal + ' HP（' + m.hp + '/' + m.maxHp + '）');
    var overflow = 4 - heal;
    if (overflow > 0) ctx.addEnemyMc(m.id, overflow);
    else ctx.log('system', '杯酒停戎：未溢出，未获得操控权');
  };

  // 行事以中（R17）：6 格挡；本回合已打出的上段/下段数量相等（不含本张）→ 12 格挡
  EFFECTS['YJQ-SF-03'] = function (ctx, card, choice) {
    var played = ctx.player.playedThisTurn || [];
    var up = 0, down = 0;
    for (var i = 0; i < played.length; i++) {
      if (played[i].route === '上') up++;
      else if (played[i].route === '下') down++;
    }
    var block = (up === down) ? 12 : 6;
    ctx.log('system', '行事以中：上段 ' + up + ' / 下段 ' + down + ' → ' + block + ' 点格挡');
    ctx.addBlock(block);
  };

  // 万事当先（R16）：接下来 2 张牌每段伤害 +1；若为本回合首张 → 3 张
  EFFECTS['YJQ-SF-04'] = function (ctx, card, choice) {
    var played = ctx.player.playedThisTurn || [];
    var n = played.length === 0 ? 3 : 2;
    ctx.setDmgBuffCards(n);
  };

  // 深不可测：获得 5 点化劲（一次性，R4）
  EFFECTS['YJQ-SF-05'] = function (ctx, card, choice) {
    ctx.addHua(5);
  };

  // ============================================================
  // 秘笈（5 张；不入牌库、每回合限 1、结算后翻面、不占出牌数）
  // ============================================================

  // 诸天八打：消除最多 8 个进取意图，每消除一个对被消除单位造成 2 点伤害
  EFFECTS['YJQ-MJ-01'] = function (ctx, card, choice) {
    var picks = choice.picks || [];
    var count = 0;
    for (var i = 0; i < picks.length && count < 8; i++) {
      var rm = ctx.removeIntent(picks[i].enemyId, 'jq', 1);
      if (rm > 0) {
        count += rm;
        ctx.manualHit(picks[i].enemyId, 2, 'normal');
      }
    }
    ctx.log('system', '诸天八打：共消除 ' + count + ' 个进取意图');
  };

  // 聚啸潮涌（R19 / A6）：说书人逐个随机 50% —— 消除该意图，或放弃消除并造成 1 点伤害 ×3
  EFFECTS['YJQ-MJ-02'] = function (ctx, card, choice) {
    var picks = choice.picks || [];
    for (var i = 0; i < picks.length && i < 6; i++) {
      var eid = picks[i].enemyId;
      var e = ctx.enemy(eid);
      if (!e) continue;
      if (ctx.rng() < 0.5) {
        var rm = ctx.removeIntent(eid, 'jq', 1);
        ctx.log('system', '聚啸潮涌：说书人选择消除（' + e.name + '）' + (rm > 0 ? '' : '，但未能消除'));
      } else {
        ctx.log('system', '聚啸潮涌：说书人放弃消除（' + e.name + '）→ 1 点伤害 ×3');
        for (var k = 0; k < 3; k++) ctx.manualHit(eid, 1, 'normal');
      }
    }
  };

  // 骤雨入冥：投入 5~15 点 HP 上限，对全体敌人造成 1 点伤害，次数 = 投入值
  EFFECTS['YJQ-MJ-03'] = function (ctx, card, choice) {
    var bet = Number(choice.amount) || 10;
    ctx.maxHpDown(bet);
    ctx.log('system', '骤雨入冥：投入 ' + bet + ' 点 HP 上限，全体敌人各受 1 点伤害 ×' + bet);
    ctx.manualHitAll(1, bet, 'normal');
  };

  // 天罗地网（R21）：接下来 5 次受攻击时（每段算 1 次），对伤害来源造成 1 点伤害 ×3 段
  EFFECTS['YJQ-MJ-04'] = function (ctx, card, choice) {
    ctx.setReflect(5, 1, 3);
  };

  // 千手归一（R20）：HP>20 可用。10 点真实伤害；每损失 1 点 HP 伤害 +2；然后 HP→1；
  //   结算后若未获胜 → 立即战败
  EFFECTS['YJQ-MJ-05'] = function (ctx, card, choice) {
    var p = ctx.player;
    var dmg = 10 + 2 * (p.hp - 1);
    ctx.log('manual', '千手归一：易金权 HP ' + p.hp + ' → 对 ' + (function () {
      var e = ctx.enemy(choice.targetId);
      return e ? e.name : '目标';
    })() + ' 造成 ' + dmg + ' 点真实伤害');
    ctx.manualHit(choice.targetId, dmg, 'true');
    ctx.setPlayerHp(1);
    ctx.checkEnd();
    if (ctx.state.stage !== 'over') {
      ctx.lose('千手归一未获胜');
    }
  };

  // ------------------------------------------------------------
  // 极限模式秘笈（SPEC §10.14 R32）：万法皆通 = 千手归一在极限模式下的替换
  //   对所有敌人造成 20 点真实必中伤害（穿闪避/格挡；化劲仍按引擎通用规则）
  // ------------------------------------------------------------
  EFFECTS['YJQ-MJ-05E'] = function (ctx, card, choice) {
    ctx.log('manual', '万法皆通：对所有敌人造成 20 点真实必中伤害');
    ctx.manualHitAll(20, 1, 'trueAim');
  };

  // ------------------------------------------------------------
  // 自检用元信息（测试可校验：数据里每张卡都必须有效果实现）
  // ------------------------------------------------------------
  JZ.CARD_EFFECT_IDS = Object.keys(EFFECTS);
})(typeof window !== 'undefined' ? window : globalThis);
