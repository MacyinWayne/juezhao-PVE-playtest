/* ============================================================
 * 《抉招：江湖录》· 鲨鱼头挑战 —— 敌方 AI（Boss / 小怪）
 * ------------------------------------------------------------
 * 形态：经典脚本（非 ESM），挂到 JZ.ENEMY_AI
 * 职责（SPEC §四.b / §2.2）：
 *   ① 意图套组选择（按 weight 加权随机）
 *   ② 敌方行动：先按 intentSet.plan 顺序「尽量施展」，剩余标记贪心补齐
 *   ③ 敌方技能 op 执行（只认 SPEC §2.2 的 op 表；未知 op 记 error 日志，不静默）
 * 约束：纯逻辑；不抛异常（引擎已 try/catch）
 * ============================================================ */
(function (root) {
  'use strict';

  var JZ = (root.JZ = root.JZ || {});
  var AI = (JZ.ENEMY_AI = JZ.ENEMY_AI || {});

  var MAX_LOOPS = 40;

  // ------------------------------------------------------------
  // 小工具
  // ------------------------------------------------------------
  function skillCost(skill) {
    var c = (skill && skill.cost) || {};
    return ((c.jq || 0) + (c.bs || 0) + (c.lh || 0)) || 1;
  }
  function findSkill(skills, id) {
    for (var i = 0; i < skills.length; i++) if (skills[i].id === id) return skills[i];
    return null;
  }

  // ------------------------------------------------------------
  // 意图套组选择：基础 weight × 原型倍率（SPEC §10.9 R25）
  // ------------------------------------------------------------
  var MIN_MULT = 0.5;
  var MAX_MULT = 2.5;

  /** 意图套组的原型：burst（隐藏）/ offense（jq≥3）/ defense（bs≥3）/ utility（lh≥3）/ 兜底取最大项 */
  function archetypeOfSet(set) {
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

  /** 取学习倍率（无 ai.js / 异常 → 1；clamp 0.5~2.5） */
  function learnMultiplier(archetype) {
    try {
      var A = JZ.AILearning;
      if (A && typeof A.getMultiplier === 'function') {
        var m = Number(A.getMultiplier(archetype));
        if (isFinite(m)) return Math.max(MIN_MULT, Math.min(MAX_MULT, m));
      }
    } catch (e) { /* 静默降级 */ }
    return 1;
  }

  AI.chooseIntentSet = function (sets, rand) {
    if (!sets || !sets.length) return null;
    var weights = [];
    var total = 0;
    for (var i = 0; i < sets.length; i++) {
      var base = Math.max(0, Number(sets[i].weight) || 0) || 1;
      var mult = learnMultiplier(archetypeOfSet(sets[i]));
      var w = base * mult;
      weights.push(w);
      total += w;
    }
    if (!(total > 0)) return sets[0];
    var r = rand() * total;
    var acc = 0;
    for (var j = 0; j < sets.length; j++) {
      acc += weights[j];
      if (r < acc) return sets[j];
    }
    return sets[sets.length - 1];
  };

  AI.archetypeOfSet = archetypeOfSet;
  AI.learnMultiplier = learnMultiplier;

  // ------------------------------------------------------------
  // 技能价值（贪心补标记用）
  //   只看「这一招对当前局势大概值多少」，除以标记消耗得到密度
  // ------------------------------------------------------------
  function opValue(op) {
    var v = Number(op.v) || 0;
    switch (op.op) {
      case 'damage': return v;
      case 'multiDamage': return v * (Number(op.times) || 1);
      case 'block': return v * 0.7;
      case 'dodge': return v * 0.7;
      case 'hua': return v * 0.7;
      case 'healSelf': return v * 0.6;
      case 'healFake': return v * 0.6;
      case 'summon': return 2.4;
      case 'allyDamageBuff': return 2.0;
      case 'allyBlock': return v * 0.6;
      case 'allyDodge': return v * 0.6;
      case 'allyHeal': return v * 0.6;
      case 'playerPlayLimit': return 1.8;
      case 'playerRouteLock': return 1.3;
      case 'playerDamageDebuff': return v * 1.6;
      case 'retaliate': return 1.2;
      case 'selfDamageBuff': return v * 1.0; // 下回合才生效，价值略打折
      default: return 0.2;
    }
  }
  function skillValue(skill) {
    var total = 0;
    var effs = (skill && skill.effects) || [];
    for (var i = 0; i < effs.length; i++) total += opValue(effs[i]);
    return total;
  }
  function skillScore(skill) {
    return skillValue(skill) / skillCost(skill);
  }

  // ------------------------------------------------------------
  // 技能描述（给战斗日志用）
  // ------------------------------------------------------------
  function describeSkill(skill) {
    var parts = [];
    var effs = skill.effects || [];
    for (var i = 0; i < effs.length; i++) {
      var op = effs[i];
      var v = Number(op.v) || 0;
      switch (op.op) {
        case 'damage': parts.push(v + ' 点伤害'); break;
        case 'multiDamage': parts.push(v + ' 点伤害 ×' + (Number(op.times) || 1)); break;
        case 'block': parts.push('获得 ' + v + ' 点格挡'); break;
        case 'dodge': parts.push('获得 ' + v + ' 层闪避'); break;
        case 'hua': parts.push('获得 ' + v + ' 点化劲'); break;
        case 'healSelf': parts.push('回复 ' + v + ' HP'); break;
        case 'healFake': parts.push('假血 +' + v); break;
        case 'summon': parts.push('召唤 ' + (op.unit === 'crab' ? '蟹将' : op.unit === 'shrimp' ? '虾兵' : op.unit)); break;
        case 'allyDamageBuff': parts.push('友方本回合每次伤害 +' + v); break;
        case 'allyBlock': parts.push('友方获得 ' + v + ' 点格挡'); break;
        case 'allyDodge': parts.push('友方获得 ' + v + ' 层闪避'); break;
        case 'allyHeal': parts.push('友方回复 ' + v + ' HP'); break;
        case 'playerPlayLimit': parts.push('玩家下回合出牌上限 -' + v); break;
        case 'playerRouteLock': parts.push('玩家下回合前 ' + (op.count || 3) + ' 张路数视为「特」'); break;
        case 'playerDamageDebuff': parts.push('玩家下回合每段伤害 -' + v); break;
        case 'retaliate': parts.push('逆鳞反噬（本回合每次被命中追加 ' + (op.perHit || 0) + ' 点）'); break;
        case 'selfDamageBuff': parts.push('自身下回合首次攻击 +' + v + '（一次性）'); break;
        default: parts.push(op.op); break;
      }
    }
    return parts.join('，');
  }

  // ------------------------------------------------------------
  // 敌方技能 op 执行（SPEC §2.2）
  //   R22 逆鳞反噬：「造成 4 点伤害，再追加 2×玩家本回合命中 Boss 次数（同一段结算）」
  //   → 先扫出 retaliate 的追加值，合并进同一技能里的 damage 段（而不是另开一段）
  // ------------------------------------------------------------
  function executeOps(ctx, entity, skill) {
    var effs = skill.effects || [];
    var i, op, v;

    // 预扫 retaliate（取最后一个，数据里每技能最多一个）
    var retOp = null;
    for (i = 0; i < effs.length; i++) if (effs[i].op === 'retaliate') retOp = effs[i];
    var retBonus = 0;
    var retConsumed = false;
    if (retOp) {
      var hits = (ctx.player && ctx.player.hitOnBossThisTurn) || 0;
      retBonus = hits * (Number(retOp.perHit) || 0);
    }

    for (i = 0; i < effs.length; i++) {
      if (ctx.over()) break;
      op = effs[i];
      v = Number(op.v) || 0;
      switch (op.op) {
        case 'damage': {
          var bonus = retConsumed ? 0 : retBonus;
          if (bonus > 0) {
            ctx.log('intent', entity.name + ' 逆鳞反噬：追加 ' + bonus + ' 点（与本段合并结算）');
            retConsumed = true;
          }
          ctx.enemyHit(entity, v + bonus);
          break;
        }
        case 'multiDamage':
          ctx.enemyMultiHit(entity, v, Number(op.times) || 1);
          break;
        case 'block':
          ctx.addEnemyBlock(entity, v);
          break;
        case 'dodge':
          ctx.addEnemyDodge(entity, v);
          break;
        case 'hua':
          ctx.addEnemyHua(entity, v);
          break;
        case 'healSelf':
          ctx.healEntity(entity, v);
          break;
        case 'healFake':
          ctx.healFake(entity, v);
          break;
        case 'summon':
          ctx.summon(op.unit, Number(op.count) || 1);
          break;
        case 'allyDamageBuff':
          ctx.allyDamageBuff(entity, v, op.unit || null);
          break;
        case 'allyBlock':
          ctx.allyBlock(entity, v, !!op.includeSelf);
          break;
        case 'allyDodge':
          ctx.allyDodge(entity, v, !!op.includeSelf);
          break;
        case 'allyHeal':
          ctx.allyHeal(entity, v, !!op.includeSelf);
          break;
        case 'playerPlayLimit':
          ctx.playerPlayLimit(v);
          break;
        case 'playerRouteLock':
          ctx.playerRouteLock(Number(op.count) || 3, Number(op.turns) || 1);
          break;
        case 'playerDamageDebuff':
          ctx.playerDamageDebuff(v, Number(op.turns) || 1);
          break;
        case 'retaliate':
          // 已合并进 damage 段；若该技能没有 damage op，则按追加段单独结算（数据不会走到）
          if (!retConsumed) {
            if (retBonus > 0) {
              ctx.log('intent', entity.name + ' 逆鳞反噬：追加 ' + retBonus + ' 点');
              ctx.enemyHit(entity, retBonus);
            } else {
              ctx.log('intent', entity.name + ' 逆鳞反噬：本回合未被命中，无追加伤害');
            }
            retConsumed = true;
          }
          break;
        // SPEC §2.2：selfDamageBuff = 自身「下回合」首次攻击额外 +v（一次性）
        case 'selfDamageBuff':
          ctx.selfDamageBuff(entity, v);
          break;
        default:
          ctx.log('error', '未知的敌方技能 op：' + op.op + '（技能「' + skill.name + '」）');
          break;
      }
    }
  }

  // ------------------------------------------------------------
  // 单次技能施放：扣标记 → 记 skill-start 事件 → 记日志 → 执行 op
  //   事件流（SPEC §10.4）：UI 靠 skill-start 的 cost/remain 播放「消耗了哪些意图」
  // ------------------------------------------------------------
  function castSkill(ctx, entity, skill) {
    var cost = skill.cost || {};
    if (!ctx.afford(entity, cost)) return false;
    var paid = { jq: Number(cost.jq) || 0, bs: Number(cost.bs) || 0, lh: Number(cost.lh) || 0 };
    ctx.spend(entity, cost);
    var remain = {
      jq: entity.intents.jq || 0,
      bs: entity.intents.bs || 0,
      lh: entity.intents.lh || 0
    };
    if (typeof ctx.emit === 'function') {
      ctx.emit('skill-start', {
        enemyId: entity.id,
        enemyName: entity.name,
        skillId: skill.id,
        skillName: skill.name,
        cost: paid,
        remain: remain
      });
    }
    ctx.log('intent', entity.name + ' 使用 ' + skill.name +
      (describeSkill(skill) ? '：' + describeSkill(skill) : ''));
    executeOps(ctx, entity, skill);
    return true;
  }

  // ------------------------------------------------------------
  // 敌方一次完整行动（SPEC §四.b）
  //   ① plan 按顺序尽量施展 ② 剩余标记贪心补齐 ③ 未用完标记由引擎作废
  // ------------------------------------------------------------
  function runAction(ctx, entity) {
    var skills = entity._skills || [];
    var plan = entity._plan || [];
    var cast = 0;
    var i;

    // ① plan：按顺序「尽量施展」
    for (i = 0; i < plan.length; i++) {
      if (ctx.over()) return;
      var skillId = plan[i];
      var sk = findSkill(skills, skillId);
      if (!sk) {
        ctx.log('error', '意图套组 plan 引用了未知技能：' + skillId + '（' + entity.name + '）');
        continue;
      }
      if (!ctx.afford(entity, sk.cost || {})) continue;
      if (castSkill(ctx, entity, sk)) cast++;
    }

    // ② 剩余标记：贪心补齐（取「价值 / 消耗」最高，平手按数据顺序）
    var guard = 0;
    while (!ctx.over() && guard < MAX_LOOPS) {
      guard++;
      var usable = [];
      for (i = 0; i < skills.length; i++) {
        if (ctx.afford(entity, skills[i].cost || {})) usable.push(skills[i]);
      }
      if (!usable.length) break;
      var best = usable[0];
      var bestScore = skillScore(usable[0]);
      for (i = 1; i < usable.length; i++) {
        var sc = skillScore(usable[i]);
        if (sc > bestScore + 1e-9) { best = usable[i]; bestScore = sc; }
      }
      if (!castSkill(ctx, entity, best)) break;
      cast++;
    }

    if (cast === 0) {
      ctx.log('system', entity.name + ' 剩余标记不足以施展任何技能，意图作废');
    }
  }

  AI.runAction = runAction;
  AI.executeOps = executeOps;
  AI.castSkill = castSkill;
  AI.skillScore = skillScore;
  AI.skillValue = skillValue;
  AI.describeSkill = describeSkill;
  AI.skillCost = skillCost;
})(typeof window !== 'undefined' ? window : globalThis);
